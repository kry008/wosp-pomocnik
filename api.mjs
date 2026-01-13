import express from 'express'
import crypto from 'crypto'

export default function createApiRouter({ db, zapiszLog }) {
let settings = {}
function loadSettings() {
    db.all(`SELECT klucz, wartosc FROM ustawienia`, [], (err, rows) => {
    if (err) {
        console.error('Błąd ładowania ustawień:', err.message)
    } else {
        settings = {}
        rows.forEach(row => {
        settings[row.klucz] = row.wartosc
        })
        console.log('Ustawienia załadowane:', settings)
    }
    })
}
loadSettings()
const router = express.Router()

function hashPassword(pass) {
    return crypto.createHash('sha256').update(pass).digest('hex')
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex')
}

// Middleware sprawdzający token w nagłówku 'token'
function verifyApiToken(req, res, next) {
    const token = req.headers['token'] || req.headers['x-api-token']
    if (!token) return res.status(401).json({ success: false, message: 'Brak tokenu' })

    const now = new Date().toISOString()
    db.get(`SELECT t.*, u.login, u.dostep, u.id AS userID FROM tokens t JOIN users u ON t.userID = u.id WHERE t.token = ? AND t.dataZakonczenia > ?`, [token, now], (err, row) => {
    if (err) {
        console.error('Błąd bazy danych (verifyApiToken):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (!row) {
        return res.status(401).json({ success: false, message: 'Token nieprawidłowy lub wygasł' })
    }
    req.api_user = { id: row.userID, login: row.login, dostep: row.dostep }
    req.api_token = token
    next()
    })
}

// Endpoint do logowania i wydawania tokenu ważnego 12h
router.post('/login', (req, res) => {
    if (!req.body) return res.status(400).json({ success: false, message: 'Nieprawidłowe dane' })
    if(req.body.login === undefined || req.body.haslo === undefined) return res.status(400).json({ success: false, message: 'Nieprawidłowe dane' })
    if (!req.body.login || !req.body.haslo) return res.status(400).json({ success: false, message: 'Login i hasło są wymagane' })
    var login = req.body.login || null
    var haslo = req.body.haslo || null
    db.get(`SELECT * FROM users WHERE login = ? AND aktywny = 1`, [login], (err, user) => {
    if (err) {
        console.error('Błąd bazy danych (API login):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (!user) return res.status(401).json({ success: false, message: 'Nieprawidłowy login lub hasło' })

    const hashedPassword = hashPassword(haslo)
    if (user.haslo !== hashedPassword) {
        return res.status(401).json({ success: false, message: 'Nieprawidłowy login lub hasło' })
    }

    const token = generateToken()
    const expiry = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12h

    db.run(`INSERT INTO tokens (userID, token, dataZakonczenia) VALUES (?, ?, ?)`, [user.id, token, expiry], function(err) {
        if (err) {
        console.error('Błąd zapisu tokenu:', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
        }
        const tokenId = this.lastID
        if (typeof zapiszLog === 'function') zapiszLog('API_LOGIN', user.id, 'tokens', tokenId)
        res.json({ success: true, token, expiresAt: expiry })
    })
    })
})

// Wylogowanie - unieważnij token, ustaw czas zakończenia na teraz
router.post('/logout', verifyApiToken, (req, res) => {
    const token = req.api_token
    const now = new Date().toISOString()

    db.run(`UPDATE tokens SET dataZakonczenia = ? WHERE token = ?`, [now, token], function(err) {
    if (err) {
        console.error('Błąd usuwania tokenu:', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (typeof zapiszLog === 'function') zapiszLog('API_LOGOUT', req.api_user.id, 'tokens', 0)
    res.json({ success: true })
    })
})

// Lista wolontariuszy do rozliczenia
router.get('/rozliczenia/listawolontariuszy', verifyApiToken, (req, res) => {
    if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })

    let sql
    if (req.api_user.dostep == 2) {
    sql = 'SELECT w.* FROM wolontariusz w LEFT JOIN rozliczenie r ON w.id = r.wolontariuszID AND r.aktywny = 1 WHERE r.id IS NULL AND w.aktywny = 1 AND w.puszkaWydana = 1 ORDER BY w.numerID ASC'
    } else {
    sql = 'SELECT w.* FROM wolontariusz w LEFT JOIN rozliczenie r ON w.id = r.wolontariuszID AND r.aktywny = 1 WHERE r.id IS NULL AND w.aktywny = 1 ORDER BY w.numerID ASC'
    }

    console.log('SQL:', sql)
    db.all(sql, [], (err, rows) => {
    console.log('Rows:', rows)
    if (err) {
        console.error('Błąd pobierania wolontariuszy (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (typeof zapiszLog === 'function') zapiszLog('API_ACCESS', req.api_user.id, 'rozliczenia/listawolontariuszy', 0)
    res.json({ success: true, wolontariusze: rows })
    })
})

// Szczegóły wolontariusza / informacje czy miał terminal
router.get('/rozliczenia/wolontariusz/:id', verifyApiToken, (req, res) => {
    if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })
    const id = req.params.id

    db.get(`SELECT * FROM wolontariusz WHERE id = ? AND aktywny = 1`, [id], (err, wol) => {
    if (err) {
        console.error('Błąd pobierania wolontariusza (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (!wol) return res.status(404).json({ success: false, message: 'Wolontariusz nie znaleziony' })

    db.get(`SELECT terminal FROM rozliczenie WHERE wolontariuszID = ? AND terminal = 1 AND aktywny = 1 LIMIT 1`, [id], (err, terminalRow) => {
        if (err) {
        console.error('Błąd sprawdzania terminala (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
        }
        const hadTerminal = !!terminalRow
        if (typeof zapiszLog === 'function') zapiszLog('API_ACCESS', req.api_user.id, 'rozliczenia/wolontariusz', id)
        res.json({ success: true, wolontariusz: wol, hadTerminal })
    })
    })
})

// Statystyki - podsumowanie
router.get('/statystyki/podsumowanie', verifyApiToken, (req, res) => {
    if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })

    db.get(`SELECT 
    SUM(m1gr) as m1gr, SUM(m2gr) as m2gr, SUM(m5gr) as m5gr, SUM(m10gr) as m10gr, SUM(m20gr) as m20gr, SUM(m50gr) as m50gr,
    SUM(m1zl) as m1zl, SUM(m2zl) as m2zl, SUM(m5zl) as m5zl,
    SUM(b10zl) as b10zl, SUM(b20zl) as b20zl, SUM(b50zl) as b50zl, SUM(b100zl) as b100zl, SUM(b200zl) as b200zl, SUM(b500zl) as b500zl,
    SUM(kwotaZTerminala) as terminal,
    SUM(
        m1gr*0.01 + m2gr*0.02 + m5gr*0.05 + m10gr*0.10 + m20gr*0.20 + m50gr*0.50 +
        m1zl*1 + m2zl*2 + m5zl*5 +
        b10zl*10 + b20zl*20 + b50zl*50 + b100zl*100 + b200zl*200 + b500zl*500 +
        kwotaZTerminala
    ) as sumaCalkowita
    FROM rozliczenie WHERE aktywny = 1`, [], (err, summary) => {
    if (err) {
        console.error('Błąd pobierania podsumowania (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }

    db.all(`SELECT w.numerID, w.imie, w.nazwisko,
        SUM(
            r.m1gr*0.01 + r.m2gr*0.02 + r.m5gr*0.05 + r.m10gr*0.10 + r.m20gr*0.20 + r.m50gr*0.50 +
            r.m1zl*1 + r.m2zl*2 + r.m5zl*5 +
            r.b10zl*10 + r.b20zl*20 + r.b50zl*50 + r.b100zl*100 + r.b200zl*200 + r.b500zl*500 +
            r.kwotaZTerminala
        ) as suma
        FROM wolontariusz w
        JOIN rozliczenie r ON w.id = r.wolontariuszID
        WHERE r.aktywny = 1
        GROUP BY w.id
        ORDER BY suma DESC
        LIMIT 5`, [], (err, topWol) => {
        if (err) {
        console.error('Błąd pobierania top wolontariuszy (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
        }
        if (typeof zapiszLog === 'function') zapiszLog('API_ACCESS', req.api_user.id, 'statystyki/podsumowanie', 0)
        res.json({ success: true, summary, topWolontariusze: topWol })
    })
    })
})

// Statystyki liczących
router.get('/statystyki/liczacy', verifyApiToken, (req, res) => {
    if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })

    db.all(`SELECT u.id, u.imie, u.nazwisko, COUNT(DISTINCT kr.rozliczenieID) as liczbaRozliczen,
    SUM(
        r.m1gr*0.01 + r.m2gr*0.02 + r.m5gr*0.05 + r.m10gr*0.10 + r.m20gr*0.20 + r.m50gr*0.50 +
        r.m1zl*1 + r.m2zl*2 + r.m5zl*5 +
        r.b10zl*10 + r.b20zl*20 + r.b50zl*50 + r.b100zl*100 + r.b200zl*200 + r.b500zl*500 +
        r.kwotaZTerminala
    ) as suma
    FROM users u
    JOIN ktoRozliczal kr ON u.id = kr.userID
    JOIN rozliczenie r ON kr.rozliczenieID = r.id
    WHERE r.aktywny = 1
    GROUP BY u.id
    ORDER BY suma DESC`, [], (err, rows) => {
    if (err) {
        console.error('Błąd pobierania liczących (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (typeof zapiszLog === 'function') zapiszLog('API_ACCESS', req.api_user.id, 'statystyki/liczacy', 0)
    res.json({ success: true, liczacy: rows })
    })
})

// Statystyki wolontariuszy
router.get('/statystyki/wolontariusz', verifyApiToken, (req, res) => {
    if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })

    db.all(`SELECT w.id, w.numerID, w.imie, w.nazwisko,
    SUM(
        r.m1gr*0.01 + r.m2gr*0.02 + r.m5gr*0.05 + r.m10gr*0.10 + r.m20gr*0.20 + r.m50gr*0.50 +
        r.m1zl*1 + r.m2zl*2 + r.m5zl*5 +
        r.b10zl*10 + r.b20zl*20 + r.b50zl*50 + r.b100zl*100 + r.b200zl*200 + r.b500zl*500 +
        r.kwotaZTerminala
    ) as suma
    FROM wolontariusz w
    JOIN rozliczenie r ON w.id = r.wolontariuszID
    WHERE r.aktywny = 1
    GROUP BY w.id
    ORDER BY suma DESC`, [], (err, rows) => {
    if (err) {
        console.error('Błąd pobierania statystyk wolontariuszy (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (typeof zapiszLog === 'function') zapiszLog('API_ACCESS', req.api_user.id, 'statystyki/wolontariusz', 0)
    res.json({ success: true, wolontariusze: rows })
    })
})

// Statystyki otwarte - suma rozliczonej kwoty, liczba rozliczeń, ostatnia aktualizacja
router.get('/statystyki/otwarte', (req, res) => {
    //if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })

    db.get(`SELECT 
    COUNT(*) as liczbaRozliczen,
    SUM(
        m1gr*0.01 + m2gr*0.02 + m5gr*0.05 + m10gr*0.10 + m20gr*0.20 + m50gr*0.50 +
        m1zl*1 + m2zl*2 + m5zl*5 +
        b10zl*10 + b20zl*20 + b50zl*50 + b100zl*100 + b200zl*200 + b500zl*500 +
        kwotaZTerminala
    ) as sumaRozliczona,
    MAX(ostatniaZmiana) as ostatniaAktualizacja
    FROM rozliczenie WHERE aktywny = 1`, [], (err, row) => {
    if (err) {
        console.error('Błąd pobierania statystyk otwartych (API):', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    //if (typeof zapiszLog === 'function') zapiszLog('API_ACCESS', req.api_user.id, 'statystyki/otwarte', 0)
    res.json({ success: true, statystyki: row })
    })
})

// Lista osób liczących
router.get('/users/liczacy', verifyApiToken, (req, res) => {
    if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })

    db.all(`SELECT id, imie, nazwisko FROM users WHERE aktywny = 1 AND dostep <= 2 ORDER BY nazwisko ASC`, [], (err, rows) => {
        if (err) {
            console.error('Błąd pobierania osób liczących (API):', err.message)
            return res.status(500).json({ success: false, message: 'Błąd serwera' })
        }
        if (typeof zapiszLog === 'function') zapiszLog('API_ACCESS', req.api_user.id, 'users/liczacy', 0)
        res.json({ success: true, liczacy: rows, mojeId: req.api_user.id })
    })
})

// Rozliczanie: POST /rozliczenia/wolontariusz/:id
router.post('/rozliczenia/wolontariusz/:id', verifyApiToken, (req, res) => {
    if (req.api_user.dostep > 2) return res.status(403).json({ success: false, message: 'Brak dostępu' })
    const id = req.params.id
    // sprawdź czy wolontariusz istnieje i uprawnienia
    db.get(`SELECT * FROM wolontariusz WHERE id = ? AND aktywny = 1`, [id], (err, wol) => {
        if (err) {
            console.error('Błąd pobierania wolontariusza do rozliczenia (API):', err.message)
            return res.status(500).json({ success: false, message: 'Błąd serwera' })
        }
        if (!wol) return res.status(404).json({ success: false, message: 'Wolontariusz nie znaleziony' })
        if (req.api_user.dostep == 2 && wol.puszkaWydana == 0) {
            return res.status(400).json({ success: false, message: 'Nie można rozliczyć wolontariusza bez wydanej puszki' })
        }

        // sprawdź czy już nie jest rozliczony
        db.get(`SELECT COUNT(*) AS count FROM rozliczenie WHERE wolontariuszID = ? AND aktywny = 1`, [id], (err, row) => {
            if (err) {
                console.error('Błąd sprawdzania rozliczenia wolontariusza (API):', err.message)
                return res.status(500).json({ success: false, message: 'Błąd serwera' })
            }
            if (row.count > 0) {
                return res.status(400).json({ success: false, message: 'Wolontariusz już został rozliczony' })
            }

            const now = new Date().toISOString()
            const data = req.body || {}
            const parseIntSafe = v => (v ? parseInt(v, 10) || 0 : 0)
            const parseFloatSafe = v => (v ? parseFloat(v) || 0 : 0)

            // przygotuj parametry zgodnie ze schematem w index.mjs
            const terminal = data.terminal === 1 || data.terminal === '1' || data.terminal === true || data.terminal === 'on' ? 1 : 0
            const kwotaZTerminala = parseFloatSafe(data.kwotaZTerminala)
            const m1gr = parseIntSafe(data.m1gr)
            const m2gr = parseIntSafe(data.m2gr)
            const m5gr = parseIntSafe(data.m5gr)
            const m10gr = parseIntSafe(data.m10gr)
            const m20gr = parseIntSafe(data.m20gr)
            const m50gr = parseIntSafe(data.m50gr)
            const m1zl = parseIntSafe(data.m1zl)
            const m2zl = parseIntSafe(data.m2zl)
            const m5zl = parseIntSafe(data.m5zl)
            const b10zl = parseIntSafe(data.b10zl)
            const b20zl = parseIntSafe(data.b20zl)
            const b50zl = parseIntSafe(data.b50zl)
            const b100zl = parseIntSafe(data.b100zl)
            const b200zl = parseIntSafe(data.b200zl)
            const b500zl = parseIntSafe(data.b500zl)
            const walutaObca = data.walutaObca && data.walutaObca.trim() !== '' ? data.walutaObca.trim() : 'BRAK'
            const daryInne = data.daryInne && data.daryInne.trim() !== '' ? data.daryInne.trim() : 'BRAK'
            const uwagiLiczacych = data.uwagiLiczacych && data.uwagiLiczacych.trim() !== '' ? data.uwagiLiczacych.trim() : 'BRAK'
            const uwagiWolontariusza = data.uwagiWolontariusza && data.uwagiWolontariusza.trim() !== '' ? data.uwagiWolontariusza.trim() : 'BRAK'
            const sala = data.sala && data.sala.trim() !== '' ? data.sala.trim() : 'GŁÓWNA'

            const params = [
                id,
                now,
                terminal,
                kwotaZTerminala,
                m1gr,m2gr,m5gr,m10gr,m20gr,m50gr,
                m1zl,m2zl,m5zl,
                b10zl,b20zl,b50zl,b100zl,b200zl,b500zl,
                walutaObca,daryInne,uwagiLiczacych,uwagiWolontariusza,
                req.api_user.id, /* wstawil */
                0, /* zatwierdzil */
                sala,
                0, /* wpisaneDoBSS */
                now,
                1 /* aktywny */
            ]

            db.run(`INSERT INTO rozliczenie (
                wolontariuszID, czasRozliczenia, terminal, kwotaZTerminala,
                m1gr,m2gr,m5gr,m10gr,m20gr,m50gr,m1zl,m2zl,m5zl,
                b10zl,b20zl,b50zl,b100zl,b200zl,b500zl,
                walutaObca,daryInne,uwagiLiczacych,uwagiWolontariusza,
                wstawil,zatwierdzil,sala,wpisaneDoBSS,ostatniaZmiana,aktywny
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, params, function(err) {
                if (err) {
                    console.error('Błąd zapisu rozliczenia (API):', err.message)
                    return res.status(500).json({ success: false, message: 'Błąd serwera' })
                }
                const rozliczenieId = this.lastID

                // przygotuj listę liczących
                let kto_ids = []
                if (data.liczacy && Array.isArray(data.liczacy)) kto_ids = data.liczacy.map(x => parseInt(x,10)).filter(n => !isNaN(n))
                else if (data.liczacy && typeof data.liczacy === 'string') kto_ids = data.liczacy.split(',').map(s => parseInt(s,10)).filter(n => !isNaN(n))
                if (!kto_ids.includes(req.api_user.id)) kto_ids.push(req.api_user.id)

                // wstaw do ktoRozliczal sekwencyjnie
                const insertKto = (index) => {
                    if (index >= kto_ids.length) {
                        // sprawdź DISCORD
                        if (settings.DISCORD && settings.DISCORD !== '0') {
                            // oblicz sumę zebranych pieniędzy
                            let suma = parseFloatSafe(data.kwotaZTerminala)
                            suma += parseIntSafe(data.m1gr) * 0.01
                            suma += parseIntSafe(data.m2gr) * 0.02
                            suma += parseIntSafe(data.m5gr) * 0.05
                            suma += parseIntSafe(data.m10gr) * 0.10
                            suma += parseIntSafe(data.m20gr) * 0.20
                            suma += parseIntSafe(data.m50gr) * 0.50
                            suma += parseIntSafe(data.m1zl) * 1
                            suma += parseIntSafe(data.m2zl) * 2
                            suma += parseIntSafe(data.m5zl) * 5
                            suma += parseIntSafe(data.b10zl) * 10
                            suma += parseIntSafe(data.b20zl) * 20
                            suma += parseIntSafe(data.b50zl) * 50
                            suma += parseIntSafe(data.b100zl) * 100
                            suma += parseIntSafe(data.b200zl) * 200
                            suma += parseIntSafe(data.b500zl) * 500
                            suma = suma.toFixed(2)
                            const time = new Date(now).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
                            const payload = {
                                "username": "Webhook",
                                "content": `Rozliczono o: ${time}`,
                                "embeds": [
                                    {
                                        "author": {
                                            "name": "Bot do rozliczeń",
                                            "url": "https://kry008.xyz",
                                            "icon_url": "https://kry008.xyz/images/logo.webp"
                                        },
                                        "title": "Wpadło nam kolejne rozliczenie",
                                        "description": "",
                                        "color": 15258703,
                                        "fields": [
                                            {
                                                "name": "ID Wolontariusza",
                                                "value": `${wol.numerID}`
                                            },
                                            {
                                                "name": `${wol.imie} ${wol.nazwisko}`,
                                                "value": ""
                                            },
                                            {
                                                "name": "Zebrana suma: ",
                                                "value": `${suma} zł`
                                            },
                                            {
                                                "name": "Dziękujemy",
                                                "value": "Każda kwota zasila wspólną puszkę"
                                            }
                                        ],
                                        "footer": {
                                            "text": "Skrypt stworzony przez kry008.xyz",
                                            "icon_url": "https://kry008.xyz/images/logo.webp"
                                        }
                                    }
                                ]
                            }
                            fetch(settings.DISCORD, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            }).catch(err => console.error('Błąd wysyłania webhook:', err))
                        }
                        // zakończ
                        if (typeof zapiszLog === 'function') zapiszLog('API_ADD_ROZLICZENIE', req.api_user.id, 'rozliczenie', rozliczenieId)
                        return res.status(201).json({ success: true, rozliczenieID: rozliczenieId })
                    }
                    const uid = kto_ids[index]
                    db.run(`INSERT INTO ktoRozliczal (rozliczenieID, userID) VALUES (?, ?)`, [rozliczenieId, uid], (err) => {
                        if (err) console.error('Błąd dodawania ktoRozliczal (API):', err.message)
                        insertKto(index+1)
                    })
                }
                insertKto(0)
            })
        })
    })
})
        
// Prosty status
router.get('/status', (req, res) => {
    res.json({ success: true, message: 'API działa' })
})

// Schemat API
router.get('/', (req, res) => {
    const schema = {
        info: {
            title: 'WOSP API',
            version: '1.0.0',
            description: 'API do zarządzania wolontariuszami i rozliczeniami'
        },
        baseUrl: '/api',
        endpoints: [
            {
                method: 'POST',
                path: '/login',
                description: 'Zaloguj się i otrzymaj token (ważny 12h)',
                requiresAuth: false,
                requestBody: {
                    login: 'string (wymagane)',
                    haslo: 'string (wymagane)'
                },
                response: {
                    success: 'boolean',
                    token: 'string',
                    expiresAt: 'ISO timestamp'
                }
            },
            {
                method: 'POST',
                path: '/logout',
                description: 'Wyloguj się (unieważnij token)',
                requiresAuth: true,
                response: {
                    success: 'boolean'
                }
            },
            {
                method: 'GET',
                path: '/rozliczenia/listawolontariuszy',
                description: 'Lista wolontariuszy do rozliczenia (bez aktywnego rozliczenia)',
                requiresAuth: true,
                accessLevel: 'dostep ≤ 2',
                response: {
                    success: 'boolean',
                    wolontariusze: 'array of objects'
                }
            },
            {
                method: 'GET',
                path: '/rozliczenia/wolontariusz/:id',
                description: 'Szczegóły wolontariusza i informacja czy miał terminal',
                requiresAuth: true,
                accessLevel: 'dostep ≤ 2',
                params: {
                    id: 'integer (ID wolontariusza)'
                },
                response: {
                    success: 'boolean',
                    wolontariusz: 'object',
                    hadTerminal: 'boolean'
                }
            },
            {
                method: 'GET',
                path: '/statystyki/podsumowanie',
                description: 'Podsumowanie zbiórek i top 5 wolontariuszy',
                requiresAuth: true,
                accessLevel: 'dostep ≤ 2',
                response: {
                    success: 'boolean',
                    summary: 'object (sumy nominałów)',
                    topWolontariusze: 'array of top 5'
                }
            },
            {
                method: 'GET',
                path: '/statystyki/liczacy',
                description: 'Statystyki użytkowników liczących (ich współudział)',
                requiresAuth: true,
                accessLevel: 'dostep ≤ 2',
                response: {
                    success: 'boolean',
                    liczacy: 'array of objects'
                }
            },
            {
                method: 'GET',
                path: '/statystyki/wolontariusz',
                description: 'Statystyki wszystkich wolontariuszy',
                requiresAuth: true,
                accessLevel: 'dostep ≤ 2',
                response: {
                    success: 'boolean',
                    wolontariusze: 'array of objects'
                }
            },
            {
                method: 'GET',
                path: '/statystyki/otwarte',
                description: 'Statystyki otwarte - suma rozliczonej kwoty, liczba rozliczeń, ostatnia aktualizacja',
                requiresAuth: false,
                accessLevel: 'dostep ≤ 2',
                response: {
                    success: 'boolean',
                    statystyki: 'object {liczbaRozliczen, sumaRozliczona, ostatniaAktualizacja}'
                }
            },
            {
                method: 'GET',
                path: '/users/liczacy',
                description: 'Lista osób liczących (użytkowników z dostępem do rozliczania)',
                requiresAuth: true,
                accessLevel: 'dostep ≤ 2',
                response: {
                    success: 'boolean',
                    liczacy: 'array of {id, imie, nazwisko}',
                    mojeId: 'integer (ID aktualnego użytkownika)'
                }
            },
            {
                method: 'POST',
                path: '/rozliczenia/wolontariusz/:id',
                description: 'Rozlicz wolontariusza (dodaj wpis rozliczenia)',
                requiresAuth: true,
                accessLevel: 'dostep ≤ 2',
                params: {
                    id: 'integer (ID wolontariusza)'
                },
                requestBody: {
                    terminal: 'boolean|0|1',
                    kwotaZTerminala: 'float',
                    m1gr: 'integer',
                    m2gr: 'integer',
                    m5gr: 'integer',
                    m10gr: 'integer',
                    m20gr: 'integer',
                    m50gr: 'integer',
                    m1zl: 'integer',
                    m2zl: 'integer',
                    m5zl: 'integer',
                    b10zl: 'integer',
                    b20zl: 'integer',
                    b50zl: 'integer',
                    b100zl: 'integer',
                    b200zl: 'integer',
                    b500zl: 'integer',
                    walutaObca: 'string (optional)',
                    daryInne: 'string (optional)',
                    uwagiLiczacych: 'string (optional)',
                    uwagiWolontariusza: 'string (optional)',
                    sala: 'string (optional, default: GŁÓWNA)',
                    liczacy: 'array or comma-separated string of user IDs'
                },
                response: {
                    success: 'boolean',
                    rozliczenieID: 'integer'
                }
            },
            {
                method: 'GET',
                path: '/status',
                description: 'Sprawdzenie czy API działa',
                requiresAuth: false,
                response: {
                    success: 'boolean',
                    message: 'string'
                }
            },
            {
                method: 'GET',
                path: '/',
                description: 'Schemat API (ta strona)',
                requiresAuth: false,
                response: 'object (ten schemat)'
            }
        ],
        authentication: {
            method: 'Header token lub x-api-token',
            flow: 'POST /login -> otrzymaj token -> użyj w nagłówku "token" lub "x-api-token"'
        }
    }
    res.json(schema)
})

return router
}
