import express from 'express'
import 'dotenv/config'
import sqlite3pkg from 'sqlite3'
import dotenv from 'dotenv'
dotenv.config()
import ejs from 'ejs'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import multer from 'multer'
import { peselAnonimizuj, czyPelnoletni, czyPoprawnyPesel } from './pomocnicze.mjs'
import apiRouter from './api.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
/*
db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT NOT NULL UNIQUE,
        haslo TEXT NOT NULL,
        imie TEXT,
        nazwisko TEXT,
        dostep INTEGER DEFAULT 1,
        kod TEXT,
        aktywny INTEGER DEFAULT 1
    )`) // access_level - 0 superadmin, 1 dostęp pełny, 2 osoba licząca
    db.run(`CREATE TABLE IF NOT EXISTS wolontariusz (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numerID TEXT NOT NULL UNIQUE,
        imie TEXT,
        nazwisko TEXT,
        discord TEXT,
        telefon TEXT,
        pesel TEXT,
        rodzic TEXT DEFAULT 'BRAK',
        terminal INTEGER DEFAULT 0,
        ostatniaZmiana TEXT DEFAULT '',
        puszkaWydana INTEGER DEFAULT 0,
        zaznaczony INTEGER DEFAULT 0,
        aktywny INTEGER DEFAULT 1
        )`)
    db.run(`CREATE TABLE IF NOT EXISTS rozliczenie (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wolontariuszID INTEGER NOT NULL,
        czasRozliczenia TEXT NOT NULL,
        terminal INTEGER DEFAULT 0,
        kwotaZTerminala REAL DEFAULT 0,
        m1gr INTEGER DEFAULT 0,
        m2gr INTEGER DEFAULT 0,
        m5gr INTEGER DEFAULT 0,
        m10gr INTEGER DEFAULT 0,
        m20gr INTEGER DEFAULT 0,
        m50gr INTEGER DEFAULT 0,
        m1zl INTEGER DEFAULT 0,
        m2zl INTEGER DEFAULT 0,
        m5zl INTEGER DEFAULT 0,
        b10zl INTEGER DEFAULT 0,
        b20zl INTEGER DEFAULT 0,
        b50zl INTEGER DEFAULT 0,
        b100zl INTEGER DEFAULT 0,
        b200zl INTEGER DEFAULT 0,
        b500zl INTEGER DEFAULT 0,
        walutaObca TEXT DEFAULT 'BRAK',
        daryInne TEXT DEFAULT 'BRAK',
        uwagiLiczacych TEXT DEFAULT 'BRAK',
        uwagiWolontariusza TEXT DEFAULT 'BRAK',
        wstawil INTEGER NOT NULL,
        zatwierdzil INTEGER DEFAULT 0,
        sala TEXT DEFAULT 'GŁÓWNA',
        wpisaneDoBSS INTEGER DEFAULT 0,
        ostatniaZmiana TEXT NOT NULL,
        aktywny INTEGER DEFAULT 1
        )`)
    db.run(`CREATE TABLE IF NOT EXISTS ktoRozliczal (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rozliczenieID INTEGER NOT NULL,
        userID INTEGER NOT NULL
        )`)
    db.run(`CREATE TABLE IF NOT EXISTS ustawienia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        klucz TEXT NOT NULL UNIQUE,
        wartosc TEXT NOT NULL
        )`)

    db.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tabela TEXT NOT NULL,
        rekordID INTEGER NOT NULL,
        operacja TEXT NOT NULL,
        czasOperacji TEXT NOT NULL,
        uzytkownikID INTEGER NOT NULL,
        szczegoly TEXT DEFAULT 'BRAK'
        )`)
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userID INTEGER NOT NULL,
        dataZakonczenia TEXT NOT NULL
        )`)
    db.run(`CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userID INTEGER NOT NULL,
        token TEXT NOT NULL,
        dataZakonczenia TEXT NOT NULL
        )`)*/

const app = express()
const port = process.env.PORT || 3001
const sqlite_db = process.env.SQLITE_DB || './baza.sqlite'
const sqlite3 = sqlite3pkg.verbose();
const db = new sqlite3.Database(sqlite_db)

// Załaduj ustawienia z bazy
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
loadSettings() // Załaduj na starcie
// Konfiguracja multer do przesyłania plików
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage })

app.use(express.json())
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.set('views', './views')
app.use(express.urlencoded({ extended: true }))
import session from 'express-session';
import { title } from 'process'
import { log } from 'console'
app.use(session({
  secret: process.env.SECRET_KEY || 'supersecretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Podłącz API z autoryzacją tokenową
app.use('/api', apiRouter({ db, zapiszLog, settings }))

app.all('/{*splat}', (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
  next()
})

app.get('/', (req, res) => {
  //sprawdź czy w sesji jest zalogowany użytkownik, w sesji będzie user_id oraz session_id, następnie sprawdź w bazie, jeżeli jest przekieruj do /dashboard, jeżeli nie to do /login
  if (req.session.user_id) {
    //sprawdź czy sesja jest ważna
    const session_id = req.session.session_id
    db.get(`SELECT * FROM sessions WHERE id = ? AND userID = ? AND dataZakonczenia > ?`, [session_id, req.session.user_id, new Date().toISOString()], (err, row) => {
      if (err) {
        console.error(err.message)
        res.redirect('/login')
      } else if (row) {
        res.redirect('/dashboard')
      } else {
        res.redirect('/login')
      }
    })
  } else {
    res.redirect('/login')
  }
})

app.get('/login', (req, res) => {
  res.render('login', { error: null, title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' })
})

app.post('/login', (req, res) => {
  const { login, haslo } = req.body
  
  if (!login || !haslo) {
    return res.render('login', { 
      error: 'Login i hasło są wymagane', 
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
    })
  }
  
  // Sprawdzenie użytkownika w bazie danych
  db.get(`SELECT * FROM users WHERE login = ? AND aktywny = 1`, [login], (err, user) => {
    if (err) {
      console.error('Błąd bazy danych:', err.message)
      return res.render('login', { 
        error: 'Błąd serwera', 
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
      })
    }
    
    if (!user) {
      return res.render('login', { 
        error: 'Nieprawidłowy login lub hasło', 
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
      })
    }
    
    // Sprawdzenie hasła (zakładam że hasła są hashowane SHA256)
    const hashedPassword = crypto.createHash('sha256').update(haslo).digest('hex')
    
    if (user.haslo !== hashedPassword) {
      return res.render('login', { 
        error: 'Nieprawidłowy login lub hasło', 
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
      })
    }
    
    // Tworzenie sesji w bazie danych
    const sessionEndTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 godziny
    
    db.run(`INSERT INTO sessions (userID, dataZakonczenia) VALUES (?, ?)`, [user.id, sessionEndTime], function(err) {
      if (err) {
        console.error('Błąd tworzenia sesji:', err.message)
        return res.render('login', { 
          error: 'Błąd serwera', 
          title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
          footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
        })
      }
      
      const sessionId = this.lastID
      
      // Zapisanie informacji do sesji
      req.session.user_id = user.id
      req.session.session_id = sessionId
      req.session.login = user.login
      req.session.dostep = user.dostep
      req.session.imie = user.imie
      req.session.nazwisko = user.nazwisko
      
      // Zapisanie logowania do audit_log
      db.run(`INSERT INTO audit_log (tabela, rekordID, operacja, czasOperacji, uzytkownikID, szczegoly) VALUES (?, ?, ?, ?, ?, ?)`, 
        ['users', user.id, 'LOGIN', new Date().toISOString(), user.id, `Zalogowano użytkownika: ${user.login}`], 
        (err) => {
          if (err) {
            console.error('Błąd zapisu audit_log:', err.message)
          }
        }
      )
      
      console.log(`Pomyślne logowanie użytkownika: ${user.login} (ID: ${user.id}, dostęp: ${user.dostep})`)
      res.redirect('/dashboard')
    })
  })
})

// Middleware sprawdzający uwierzytelnienie
function requireAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.redirect('/login')
  }
  
  // Sprawdź czy sesja jest ważna
  const session_id = req.session.session_id
  db.get(`SELECT * FROM sessions WHERE id = ? AND userID = ? AND dataZakonczenia > ?`, 
    [session_id, req.session.user_id, new Date().toISOString()], 
    (err, row) => {
      if (err) {
        console.error('Błąd sprawdzania sesji:', err.message)
        return res.redirect('/login')
      } else if (row) {
        next()
      } else {
        req.session.destroy()
        return res.redirect('/login')
      }
    }
  )
}

app.get('/dashboard', requireAuth, (req, res) => {
  const user = {
    id: req.session.user_id,
    login: req.session.login,
    dostep: req.session.dostep,
    imie: req.session.imie,
    nazwisko: req.session.nazwisko
  }
  
  // Określ poziom dostępu dla wyświetlenia
  let dostepText = ''
  switch(user.dostep) {
    case 0:
      dostepText = 'Superadmin'
      break
    case 1:
      dostepText = 'Dostęp pełny'
      break
    case 2:
      dostepText = 'Osoba licząca'
      break
    default:
      dostepText = 'Nieznany'
  }
  
  res.render('dashboard', { 
    user, 
    dostepText,
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008',
    URL_FOR_APP: settings.URL_FOR_APP || ''
  })
})

//wolontariusze, dostęp 0 lub 1 -> lista, dodaj, edytuj, importuj
app.get('/wolontariusze', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  //renderuj panel z kafelkami opcji lista, dodaj, edytuj, importuj
  res.render('wolontariusze', { 
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
  })
})

app.get('/wolontariusze/lista', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  //pobierz listę wolontariuszy z bazy
  db.all(`SELECT * FROM wolontariusz WHERE aktywny = 1 ORDER BY numerID ASC`, [], (err, rows) => {
    if (err) {
      console.error('Błąd pobierania wolontariuszy:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    res.render('wolontariusze_lista', { 
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      wolontariusze: rows,
      peselAnonimizuj: peselAnonimizuj,
      czyPelnoletni: czyPelnoletni,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
    })
  })
})

//lista wolontariuszy ma przycisk edytuj przy każdym wolontariuszu, który przenosi do /wolontariusze/edytuj/:id. W edycji na dole jest czerwony przycisk usuń, dostęp 0 tylko usuń
app.get('/wolontariusze/edytuj/:id', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  const wolontariuszId = req.params.id
  //pobierz dane wolontariusza z bazy
  db.get(`SELECT * FROM wolontariusz WHERE id = ? AND aktywny = 1`, [wolontariuszId], (err, row) => {
    if (err) {
      console.error('Błąd pobierania wolontariusza:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (!row) {
      return res.status(404).send('Wolontariusz nie znaleziony')
    }
    res.render('wolontariusze_edytuj', { 
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      wolontariusz: row,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
    })
  })
})

app.post('/wolontariusze/edytuj/:id', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  const wolontariuszId = req.params.id
  const { imie, nazwisko, discord, telefon, pesel, rodzic, terminal, puszkaWydana } = req.body
  // sprawdź PESEL jeśli podany
  if (pesel && pesel.trim() !== '' && !czyPoprawnyPesel(pesel.trim())) {
    return res.status(400).send('Podany numer PESEL jest nieprawidłowy')
  }
  const terminalValue = terminal ? 1 : 0
  const puszkaWydanaValue = puszkaWydana ? 1 : 0
  const rodzicValue = rodzic && rodzic.trim() !== '' ? rodzic : 'BRAK'
  
  //zaktualizuj dane wolontariusza w bazie
  db.run(`UPDATE wolontariusz SET imie = ?, nazwisko = ?, discord = ?, telefon = ?, pesel = ?, rodzic = ?, terminal = ?, puszkaWydana = ?, ostatniaZmiana = ? WHERE id = ? AND aktywny = 1`, 
    [imie, nazwisko, discord, telefon, pesel, rodzicValue, terminalValue, puszkaWydanaValue, new Date().toISOString(), wolontariuszId], 
    function(err) {
      if (err) {
        console.error('Błąd aktualizacji wolontariusza:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      zapiszLog('EDYCJA', req.session.user_id, 'wolontariusz', wolontariuszId)
      res.redirect('/wolontariusze/lista')
    }
  )
})

app.delete('/wolontariusze/usun/:id', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep !== 0) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  const wolontariuszId = req.params.id
  //usuń (dezaktywuj) wolontariusza w bazie
  db.run(`UPDATE wolontariusz SET aktywny = 0, ostatniaZmiana = ? WHERE id = ?`, 
    [new Date().toISOString(), wolontariuszId], 
    function(err) {
      if (err) {
        console.error('Błąd usuwania wolontariusza:', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
      }
      zapiszLog('USUNIECIE', req.session.user_id, 'wolontariusz', wolontariuszId)
      res.json({ success: true })
    }
  )
})

app.patch('/wolontariusze/toggle/:id', requireAuth, (req, res) => {
  //sprawdź dostęp
  
  if (req.session.dostep > 1) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  
  const wolontariuszId = req.params.id
  const { field, value } = req.body
  console.log(`Toggle request for wolontariusz ID: ${wolontariuszId}, field: ${field}, value: ${value}`)
  // Walidacja pola - tylko terminal, puszkaWydana i zaznaczony są dozwolone
  if (field !== 'terminal' && field !== 'puszkaWydana' && field !== 'zaznaczony') {
    return res.status(400).json({ success: false, message: 'Nieprawidłowe pole' })
  }
  
  // Walidacja wartości - tylko 0 lub 1
  if (value !== 0 && value !== 1) {
    return res.status(400).json({ success: false, message: 'Nieprawidłowa wartość' })
  }
  
  // Aktualizacja pola
  db.run(`UPDATE wolontariusz SET ${field} = ?, ostatniaZmiana = ? WHERE id = ? AND aktywny = 1`, 
    [value, new Date().toISOString(), wolontariuszId], 
    function(err) {
      if (err) {
        console.error('Błąd aktualizacji pola:', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
      }
      zapiszLog(`TOGGLE_${field.toUpperCase()}`, req.session.user_id, 'wolontariusz', wolontariuszId)
      res.json({ success: true })
    }
  )
})

app.get('/wolontariusze/dodaj', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  res.render('wolontariusze_dodaj', {
    error: null,
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
  })
})

app.post('/wolontariusze/dodaj', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  const { numerID, imie, nazwisko, discord, telefon, pesel, rodzic, terminal, puszkaWydana } = req.body
  if (!numerID || !imie || !nazwisko) {
    return res.render('wolontariusze_dodaj', {
      error: 'Numer ID, imię i nazwisko są wymagane',
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
    })
  }
  // sprawdź PESEL jeśli podany
  if (pesel && pesel.trim() !== '' && !czyPoprawnyPesel(pesel.trim())) {
    return res.render('wolontariusze_dodaj', {
      error: 'Podany numer PESEL jest nieprawidłowy',
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
    })
  }
  //sprawdź czy numerID już istnieje
  db.get(`SELECT id FROM wolontariusz WHERE numerID = ?`, [numerID], (err, row) => {
    if (err) {
      console.error('Błąd sprawdzania wolontariusza:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (row) {
      return res.render('wolontariusze_dodaj', {
        error: 'Wolontariusz o podanym numerze ID już istnieje',
        user: {
          id: req.session.user_id,
          login: req.session.login,
          dostep: req.session.dostep,
          imie: req.session.imie,
          nazwisko: req.session.nazwisko
        },
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
      })
    }
    // Dodaj wolontariusza do bazy
    const terminalValue = terminal ? 1 : 0
    const puszkaWydanaValue = puszkaWydana ? 1 : 0
    const rodzicValue = rodzic && rodzic.trim() !== '' ? rodzic : 'BRAK'
    db.run(`INSERT INTO wolontariusz (numerID, imie, nazwisko, discord, telefon, pesel, rodzic, terminal, puszkaWydana, ostatniaZmiana, aktywny) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [numerID, imie, nazwisko, discord, telefon, pesel, rodzicValue, terminalValue, puszkaWydanaValue, new Date().toISOString()],
      function(err) {
        if (err) {
          console.error('Błąd dodawania wolontariusza:', err.message)
          return res.status(500).send('Błąd serwera')
        }
        zapiszLog('DODANIE', req.session.user_id, 'wolontariusz', this.lastID)
        res.redirect('/wolontariusze/lista')
      }
    )
  })
})


app.get('/wolontariusze/import', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  res.render('wolontariusze_import', {
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
  })
})

app.post('/wolontariusze/import', requireAuth, upload.single('csvfile'), (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Nie przesłano pliku' })
  }
  
  const filePath = req.file.path
  
  // Odczytaj plik CSV
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ success: false, message: 'Błąd podczas odczytu pliku' })
    }
    
    const lines = data.split('\n')
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'Plik jest pusty lub nieprawidłowy' })
    }
    
    const headers = lines[0].split(';').map(h => h.trim())
    
    // Sprawdź nagłówki - pesel;id_number;group_name;token;full_name;phone;email;data_status;photo_status;guardian;address
    const requiredHeaders = ['pesel', 'id_number', 'full_name', 'email', 'phone']
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Brakujące nagłówki: ${missingHeaders.join(', ')}` 
      })
    }
    
    let imported = 0
    let skipped = 0
    let errors = 0
    const promises = []
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      const values = line.split(';').map(v => {
        v = v.trim()
        // Usuń cudzysłowy na początku i końcu jeśli istnieją
        if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
          return v.substring(1, v.length - 1)
        }
        return v
      })
      const row = {}
      
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      
      // Przetwarzanie danych
      const pesel = row.pesel || ''
      const numerID = row.id_number || ''
      const fullName = row.full_name || ''
      let phone = row.phone || ''
      //w numerze telefonu usuń spacje i myślniki
      phone = phone.replace(/[\s-]/g, '')
      const guardian = row.guardian || 'BRAK'
      
      // Rozdziel imię i nazwisko
      const nameParts = fullName.split(' ')
      const imie = nameParts[0] || ''
      const nazwisko = nameParts.slice(1).join(' ') || ''
      
      if (!numerID || !fullName) {
        skipped++
        continue
      }
      
      // sprawdź PESEL jeśli podany
      if (pesel && pesel.trim() !== '' && !czyPoprawnyPesel(pesel.trim())) {
        skipped++
        continue
      }
      
      // Dodaj wolontariusza do bazy
      const promise = new Promise((resolve) => {
        db.run(
          `INSERT INTO wolontariusz (numerID, imie, nazwisko, pesel, telefon, rodzic, ostatniaZmiana) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [numerID, imie, nazwisko, pesel, phone, guardian, new Date().toISOString()],
          function(err) {
            if (err) {
              if (err.message.includes('UNIQUE')) {
                skipped++
              } else {
                errors++
                console.error(err)
              }
            } else {
              imported++
              zapiszLog('IMPORT', req.session.user_id, 'wolontariusz', this.lastID)
            }
            resolve()
          }
        )
      })
      
      promises.push(promise)
    }
    
    // Poczekaj na wszystkie operacje
    Promise.all(promises).then(() => {
      // Usuń plik po przetworzeniu
      fs.unlink(filePath, (err) => {
        if (err) console.error('Błąd usuwania pliku:', err)
      })
      
      res.json({
        success: true,
        imported,
        skipped,
        errors
      })
    })
  })
})


app.get('/uzytkownicy', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  //renderuj panel z kafelkami opcji lista, dodaj, edytuj
  res.render('uzytkownicy', { 
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008',
    URL_FOR_APP: settings.URL_FOR_APP || ''
  })
})

app.get('/uzytkownicy/lista', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  //pobierz listę użytkowników z bazy
  db.all(`SELECT * FROM users WHERE aktywny = 1 ORDER BY login ASC`, [], (err, rows) => {
    if (err) {
      console.error('Błąd pobierania użytkowników:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    res.render('uzytkownicy_lista', { 
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      uzytkownicy: rows,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008',
      URL_FOR_APP: process.env.URL_FOR_APP || ''
    })
  })
})
//dodawanie, usuwanie i edycja liczących - poziom dostępu 0 i 1, dodanie admina tylko 0, edycja admina tylko 0. Możliwość edycji hasła dostęp 1 i 0, jeżeli dostęp 1 to edycja hasła liczącego i swoje, dostęp 0 to edycja hasła każdego użytkownika.

app.post('/uzytkownicy/dodaj', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  const { login, haslo, imie, nazwisko, dostep } = req.body

  // Walidacja pól
  if (!login || typeof login !== 'string' || login.trim().length === 0) {
    return res.status(400).send('Login jest wymagany i musi być niepustym ciągiem znaków')
  }
  if (login.length < 3 || login.length > 50) {
    return res.status(400).send('Login musi mieć od 3 do 50 znaków')
  }
  if (!/^[a-zA-Z0-9_]+$/.test(login)) {
    return res.status(400).send('Login może zawierać tylko litery, cyfry i podkreślenia')
  }
  if (!haslo || typeof haslo !== 'string' || haslo.length < 6) {
    return res.status(400).send('Hasło jest wymagane i musi mieć co najmniej 6 znaków')
  }
  if (!imie || typeof imie !== 'string' || imie.trim().length === 0) {
    return res.status(400).send('Imię jest wymagane i musi być niepustym ciągiem znaków')
  }
  if (imie.length > 100) {
    return res.status(400).send('Imię nie może mieć więcej niż 100 znaków')
  }
  if (!nazwisko || typeof nazwisko !== 'string' || nazwisko.trim().length === 0) {
    return res.status(400).send('Nazwisko jest wymagane i musi być niepustym ciągiem znaków')
  }
  if (nazwisko.length > 100) {
    return res.status(400).send('Nazwisko nie może mieć więcej niż 100 znaków')
  }
  const parsedDostep = parseInt(dostep, 10)
  if (isNaN(parsedDostep) || parsedDostep < 0 || parsedDostep > 2) {
    return res.status(400).send('Poziom dostępu musi być liczbą całkowitą od 0 do 2')
  }

  //sprawdź czy poziom uprawnień pozwoli na dodanie użytkownika o danym poziomie dostępu
  if (req.session.dostep === 1 && parsedDostep === 0) {
    return res.status(403).send('Brak dostępu do dodania użytkownika o poziomie dostępu 0')
  }

  // Hashowanie hasła
  const hashedPassword = crypto.createHash('sha256').update(haslo).digest('hex')

  //sprawdź czy login już istnieje
  db.get(`SELECT * FROM users WHERE login = ?`, [login.trim()], (err, row) => {
    if (err) {
      console.error('Błąd sprawdzania użytkownika:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (row) {
      return res.status(400).send('Użytkownik o podanym loginie już istnieje')
    }
    // Dodaj użytkownika do bazy
    db.run(`INSERT INTO users (login, haslo, imie, nazwisko, dostep, aktywny) VALUES (?, ?, ?, ?, ?, 1)`, 
      [login.trim(), hashedPassword, imie.trim(), nazwisko.trim(), parsedDostep], 
      function(err) {
        if (err) {
          console.error('Błąd dodawania użytkownika:', err.message)
          return res.status(500).send('Błąd serwera')
        }
        zapiszLog('DODANIE', req.session.user_id, 'users', this.lastID)
        res.redirect('/uzytkownicy/lista')
      }
    )
  })
})

app.delete('/uzytkownicy/usun/:id', requireAuth, (req, res) => {
  //sprawdź dostęp i czy o danych uprawnieniach może edytować danego użytkownika (dane dostęp)
  if (req.session.dostep > 1) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  const userIdToDelete = req.params.id
  db.get(`SELECT * FROM users WHERE id = ?`, [userIdToDelete], (err, row) => {
    if (err) {
      console.error('Błąd sprawdzania użytkownika:', err.message)
      return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (!row) {
      return res.status(404).json({ success: false, message: 'Użytkownik nie znaleziony' })
    }
    const targetDostep = row.dostep
    if (req.session.dostep === 1) {
      // Uprawnienia 1 mogą usuwać tylko uprawnienia 2
      if (targetDostep !== 2) {
        return res.status(403).json({ success: false, message: 'Brak dostępu do usunięcia tego użytkownika' })
      }
    } else if (req.session.dostep === 0) {
      // Uprawnienia 0 mogą usuwać 1 i 2, ale nie 0
      if (targetDostep === 0) {
        return res.status(403).json({ success: false, message: 'Brak dostępu do usunięcia użytkownika o poziomie dostępu 0' })
      }
    }
    //usuń (dezaktywuj) użytkownika w bazie
    db.run(`UPDATE users SET aktywny = 0 WHERE id = ?`, 
      [userIdToDelete], 
      function(err) {
        if (err) {
          console.error('Błąd usuwania użytkownika:', err.message)
          return res.status(500).json({ success: false, message: 'Błąd serwera' })
        }
        zapiszLog('USUNIECIE', req.session.user_id, 'users', userIdToDelete)
        res.json({ success: true })
      }
    )
  })
})

app.post('/uzytkownicy/edytuj/:id', requireAuth, (req, res) => {
  //sprawdź dostęp i czy o danych uprawnieniach może edytować danego użytkownika (dane dostęp)
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  const userId = req.params.id
  const { imie, nazwisko, dostep, haslo } = req.body

  // Zabezpieczenie: nie pozwól użytkownikowi zmienić własnego poziomu dostępu
  if (parseInt(userId) === parseInt(req.session.user_id) && typeof dostep !== 'undefined' && parseInt(dostep) !== parseInt(req.session.dostep)) {
    return res.status(400).send('Nie możesz zmienić swojego poziomu dostępu')
  }

  if (req.session.dostep === 1) {
    //sprawdź czy użytkownik do edycji nie jest adminem
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
      if (err) {
        console.error('Błąd sprawdzania użytkownika:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      if (row && row.dostep === 0) {
        return res.status(403).send('Brak dostępu do edycji użytkownika o poziomie dostępu 0')
      }
    })
  }
  
  // Przygotuj zapytanie aktualizujące
  let query = `UPDATE users SET imie = ?, nazwisko = ?, dostep = ?`
  const params = [imie, nazwisko, dostep]
  
  if (haslo && haslo.trim() !== '') {
    const hashedPassword = crypto.createHash('sha256').update(haslo).digest('hex')
    query += `, haslo = ?`
    params.push(hashedPassword)
  }
  
  query += ` WHERE id = ?`
  params.push(userId)
  
  // Wykonaj aktualizację
  db.run(query, params, function(err) {
    if (err) {
      console.error('Błąd aktualizacji użytkownika:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    zapiszLog('EDYCJA', req.session.user_id, 'users', userId)
    
    // Jeśli zmieniono hasło, unieważnij tokeny użytkownika
    if (haslo && haslo.trim() !== '') {
      db.run(`UPDATE tokens SET dataZakonczenia = ? WHERE userID = ? AND dataZakonczenia > ?`, 
        [new Date().toISOString(), userId, new Date().toISOString()], 
        function(tokenErr) {
          if (tokenErr) {
            console.error('Błąd unieważniania tokenów:', tokenErr.message)
          } else {
            zapiszLog('UNIEWAŻNIENIE TOKENÓW (ZMIANA HASŁA)', req.session.user_id, 'tokens', userId)
          }
        }
      )
    }
    
    res.redirect('/uzytkownicy/lista')
  })
})
/*
app.post('/uzytkownicy/dodaj', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  const { login, haslo, imie, nazwisko, dostep } = req.body
  if (!login || !haslo) {
    return res.status(400).send('Login i hasło są wymagane')
  }
  //sprawdź czy osoba może dodać użytkownika o danym poziomie dostępu
  if (req.session.dostep === 1 && parseInt(dostep) === 0) {
    return res.status(403).send('Brak dostępu do dodania użytkownika o poziomie dostępu 0')
  }
  // Hashowanie hasła
  const hashedPassword = crypto.createHash('sha256').update(haslo).digest('hex')
  //sprawdź czy login już istnieje
  db.get(`SELECT * FROM users WHERE login = ?`, [login], (err, row) => {
    if (err) {
      console.error('Błąd sprawdzania użytkownika:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (row) {
      return res.status(400).send('Użytkownik o podanym loginie już istnieje')
    }
  })
  // Dodaj użytkownika do bazy
  db.run(`INSERT INTO users (login, haslo, imie, nazwisko, dostep, aktywny) VALUES (?, ?, ?, ?, ?, 1)`, 
    [login, hashedPassword, imie, nazwisko, dostep], 
    function(err) {
      if (err) {
        console.error('Błąd dodawania użytkownika:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      zapiszLog('DODANIE', req.session.user_id, 'users', this.lastID)
      res.redirect('/uzytkownicy/lista')
    }
  ) 
})*/

app.get('/uzytkownicy/dodaj', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  res.render('uzytkownicy_dodaj', { 
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
  })
})

app.get('/logs', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep !== 0) {
    return res.status(403).send('Brak dostępu')
  }
  //pobierz logi z bazy
  db.all(`SELECT al.*, u.login AS uzytkownikLogin FROM audit_log al LEFT JOIN users u ON al.uzytkownikID = u.id ORDER BY al.czasOperacji DESC LIMIT 10000`, [], (err, rows) => {
    if (err) {
      console.error('Błąd pobierania logów:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    res.render('logs', { 
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      logs: rows,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
    })
  })
})

//endpoint spis osób, w postaci {id, imie, nazwisko, dostep}
app.get('/helper/uzytkownicy/spis', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 2) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  db.all(`SELECT id, imie, nazwisko, dostep FROM users WHERE aktywny = 1 ORDER BY nazwisko ASC`, [], (err, rows) => {
    if (err) {
      console.error('Błąd pobierania użytkowników:', err.message)
      return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    res.json({ success: true, users: rows })
  })
})

//rozliczenia, 2 ekrany dodanie rozliczenia i lista rozliczeń, dostęp 0, 1, 2, edycja tylko 0 i 1
app.get('/rozliczenia', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  //renderuj panel z kafelkami opcji lista, dodaj
  res.render('rozliczenia', { 
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
  })
})

app.get('/rozliczenia/listawolontariuszy', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  // pobierz wolontariuszy, którzy nie mają aktywnego rozliczenia
  if(req.session.dostep == 2){
  var sql = 'SELECT w.* FROM wolontariusz w LEFT JOIN rozliczenie r ON w.id = r.wolontariuszID AND r.aktywny = 1 WHERE r.id IS NULL AND w.aktywny = 1 AND w.puszkaWydana = 1 ORDER BY w.numerID ASC'
  } else {
  var sql = 'SELECT w.* FROM wolontariusz w LEFT JOIN rozliczenie r ON w.id = r.wolontariuszID AND r.aktywny = 1 WHERE r.id IS NULL AND w.aktywny = 1 ORDER BY w.numerID ASC'
  }
  db.all(
    sql,
    [],
    (err, rows) => {
      if (err) {
        console.error('Błąd pobierania nierozliczonych wolontariuszy:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      res.render('rozliczenia_listawolontariuszy', {
        user: {
          id: req.session.user_id,
          login: req.session.login,
          dostep: req.session.dostep,
          imie: req.session.imie,
          nazwisko: req.session.nazwisko
        },
        wolontariusze: rows,
        peselAnonimizuj: peselAnonimizuj,
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
      })
    }
  )
})


// Wyświetlenie formularza rozliczenia dla wolontariusza
app.get('/rozliczenia/wolontariusz/:id', requireAuth, (req, res) => {
  const id = req.params.id
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  db.get(`SELECT * FROM wolontariusz WHERE id = ? AND aktywny = 1`, [id], (err, row) => {
    if (err) {
      console.error('Błąd pobierania wolontariusza:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (!row) {
      return res.status(404).send('Wolontariusz nie znaleziony')
    }
    // sprawdź czy wolontariusz miał terminal wcześniej
    db.get(`SELECT terminal FROM rozliczenie WHERE wolontariuszID = ? AND terminal = 1 AND aktywny = 1 LIMIT 1`, [id], (err, terminalRow) => {
      if (err) {
        console.error('Błąd sprawdzania terminala:', err.message)
        // Mimo błędu, renderuj bez hadTerminal
        res.render('rozliczenia_wolontariusz', {
          user: {
            id: req.session.user_id,
            login: req.session.login,
            dostep: req.session.dostep,
            imie: req.session.imie,
            nazwisko: req.session.nazwisko
          },
          wolontariusz: row,
          hadTerminal: false,
          title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
          footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
        })
        return
      }
      const hadTerminal = !!terminalRow
      // renderuj formularz rozliczenia
      res.render('rozliczenia_wolontariusz', {
        user: {
          id: req.session.user_id,
          login: req.session.login,
          dostep: req.session.dostep,
          imie: req.session.imie,
          nazwisko: req.session.nazwisko
        },
        wolontariusz: row,
        hadTerminal,
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
      })
    })
  })
})

// Obsługa zapisu rozliczenia
app.post('/rozliczenia/wolontariusz/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const body = req.body
  // sprawdź istniejącego wolontariusza
  db.get(`SELECT * FROM wolontariusz WHERE id = ? AND aktywny = 1`, [id], (err, wol) => {
    if (err) {
      console.error(err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (!wol) return res.status(404).send('Wolontariusz nie znaleziony')

    const now = new Date().toISOString()
    const parseIntSafe = v => (v ? parseInt(v, 10) || 0 : 0)
    const parseFloatSafe = v => (v ? parseFloat(v) || 0 : 0)

    const terminal = body.terminal === 'on' ? 1 : 0
    const kwotaZTerminala = parseFloatSafe(body.kwotaZTerminala)
    const m1gr = parseIntSafe(body.m1gr)
    const m2gr = parseIntSafe(body.m2gr)
    const m5gr = parseIntSafe(body.m5gr)
    const m10gr = parseIntSafe(body.m10gr)
    const m20gr = parseIntSafe(body.m20gr)
    const m50gr = parseIntSafe(body.m50gr)
    const m1zl = parseIntSafe(body.m1zl)
    const m2zl = parseIntSafe(body.m2zl)
    const m5zl = parseIntSafe(body.m5zl)
    const b10zl = parseIntSafe(body.b10zl)
    const b20zl = parseIntSafe(body.b20zl)
    const b50zl = parseIntSafe(body.b50zl)
    const b100zl = parseIntSafe(body.b100zl)
    const b200zl = parseIntSafe(body.b200zl)
    const b500zl = parseIntSafe(body.b500zl)
    const walutaObca = body.walutaObca && body.walutaObca.trim() !== '' ? body.walutaObca.trim() : 'BRAK'
    const daryInne = body.daryInne && body.daryInne.trim() !== '' ? body.daryInne.trim() : 'BRAK'
    const uwagiLiczacych = body.uwagiLiczacych && body.uwagiLiczacych.trim() !== '' ? body.uwagiLiczacych.trim() : 'BRAK'
    const uwagiWolontariusza = body.uwagiWolontariusza && body.uwagiWolontariusza.trim() !== '' ? body.uwagiWolontariusza.trim() : 'BRAK'
    const sala = body.sala && body.sala.trim() !== '' ? body.sala.trim() : 'GŁÓWNA'

    const params = [
      id,
      now,
      terminal,
      kwotaZTerminala,
      m1gr,m2gr,m5gr,m10gr,m20gr,m50gr,m1zl,m2zl,m5zl,
      b10zl,b20zl,b50zl,b100zl,b200zl,b500zl,
      walutaObca,
      daryInne,
      uwagiLiczacych,
      uwagiWolontariusza,
      req.session.user_id,
      0,
      sala,
      0,
      now,
      1
    ]

    db.run(`INSERT INTO rozliczenie (
      wolontariuszID, czasRozliczenia, terminal, kwotaZTerminala,
      m1gr,m2gr,m5gr,m10gr,m20gr,m50gr,m1zl,m2zl,m5zl,
      b10zl,b20zl,b50zl,b100zl,b200zl,b500zl,
      walutaObca,daryInne,uwagiLiczacych,uwagiWolontariusza,
      wstawil,zatwierdzil,sala,wpisaneDoBSS,ostatniaZmiana,aktywny
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, params, function(err) {
      if (err) {
        console.error('Błąd zapisu rozliczenia:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      const rozliczenieId = this.lastID

      // przetwórz dodatkowe osoby rozliczające (kto_ids jako csv)
      let kto_ids = []
      if (body.kto_ids && body.kto_ids.trim() !== '') {
        kto_ids = body.kto_ids.split(',').map(s => parseInt(s,10)).filter(n => !isNaN(n))
      }
      // upewnij się, że wpisujący jest zawsze dodany
      if (!kto_ids.includes(req.session.user_id)) kto_ids.push(req.session.user_id)

      // wstaw do ktoRozliczal
      const insertKto = (index, callback) => {
        if (index >= kto_ids.length) {
          return callback()
        }
        const uid = kto_ids[index]
        db.run(`INSERT INTO ktoRozliczal (rozliczenieID, userID) VALUES (?, ?)`, [rozliczenieId, uid], (err) => {
          if (err) console.error('Błąd zapisu ktoRozliczal:', err.message)
          insertKto(index+1, callback)
        })
      }
      insertKto(0, () => {
        zapiszLog('DODANIE_ROZLICZENIA', req.session.user_id, 'rozliczenie', rozliczenieId)
        // sprawdź DISCORD env
        if (settings.DISCORD && settings.DISCORD !== '0') {
          // oblicz sumę zebranych pieniędzy
          let suma = parseFloatSafe(body.kwotaZTerminala)
          suma += parseIntSafe(body.m1gr) * 0.01
          suma += parseIntSafe(body.m2gr) * 0.02
          suma += parseIntSafe(body.m5gr) * 0.05
          suma += parseIntSafe(body.m10gr) * 0.10
          suma += parseIntSafe(body.m20gr) * 0.20
          suma += parseIntSafe(body.m50gr) * 0.50
          suma += parseIntSafe(body.m1zl) * 1
          suma += parseIntSafe(body.m2zl) * 2
          suma += parseIntSafe(body.m5zl) * 5
          suma += parseIntSafe(body.b10zl) * 10
          suma += parseIntSafe(body.b20zl) * 20
          suma += parseIntSafe(body.b50zl) * 50
          suma += parseIntSafe(body.b100zl) * 100
          suma += parseIntSafe(body.b200zl) * 200
          suma += parseIntSafe(body.b500zl) * 500
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
        res.redirect('/rozliczenia')
      })
      
    })
  })
})

app.post('/rozliczenia/zatwierdz/:id', requireAuth, (req, res) => {
  if (req.session.dostep > 1) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  const id = req.params.id
  db.run(`UPDATE rozliczenie SET zatwierdzil = ? WHERE id = ? AND zatwierdzil = 0 AND aktywny = 1`, [req.session.user_id, id], function(err) {
    if (err) {
      console.error('Błąd zatwierdzania rozliczenia:', err.message)
      return res.status(500).json({ success: false, message: 'Błąd serwera' })
    }
    if (this.changes > 0) {
      zapiszLog('ZATWIERDZENIE', req.session.user_id, 'rozliczenie', id)
      res.json({ success: true })
    } else {
      res.json({ success: false, message: 'Już zatwierdzone lub nie istnieje' })
    }
  })
})

app.get('/rozliczenia/lista', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  const query = `
    SELECT w.numerID, w.imie, w.nazwisko, r.kwotaZTerminala, r.zatwierdzil, r.id AS rozliczenieID,
    (r.m1gr*0.01 + r.m2gr*0.02 + r.m5gr*0.05 + r.m10gr*0.10 + r.m20gr*0.20 + r.m50gr*0.50 +
     r.m1zl*1 + r.m2zl*2 + r.m5zl*5 + r.b10zl*10 + r.b20zl*20 + r.b50zl*50 + r.b100zl*100 + r.b200zl*200 + r.b500zl*500) AS sumaKwoty
    FROM rozliczenie r JOIN wolontariusz w ON r.wolontariuszID = w.id WHERE r.aktywny = 1 ORDER BY r.czasRozliczenia DESC
  `
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Błąd pobierania rozliczeń:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    res.render('rozliczenia_lista', {
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      rozliczenia: rows,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
    })
  })
})

// Wyświetlenie formularza edycji rozliczenia
app.get('/rozliczenia/edytuj/:id', requireAuth, (req, res) => {
  const id = req.params.id
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  // Pobierz rozliczenie
  db.get(`SELECT * FROM rozliczenie WHERE id = ? AND aktywny = 1`, [id], (err, rozliczenie) => {
    if (err) {
      console.error('Błąd pobierania rozliczenia:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (!rozliczenie) {
      return res.status(404).send('Rozliczenie nie znalezione')
    }
    // Sprawdź dostęp do edycji
    if (req.session.dostep === 1 && rozliczenie.zatwierdzil !== 0) {
      return res.status(403).send('Brak dostępu do edycji zatwierdzonego rozliczenia')
    }
    // Pobierz wolontariusza
    db.get(`SELECT * FROM wolontariusz WHERE id = ? AND aktywny = 1`, [rozliczenie.wolontariuszID], (err, wolontariusz) => {
      if (err) {
        console.error('Błąd pobierania wolontariusza:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      if (!wolontariusz) {
        return res.status(404).send('Wolontariusz nie znaleziony')
      }
      // Pobierz ktoRozliczal
      db.all(`SELECT u.id, u.imie, u.nazwisko FROM ktoRozliczal kr JOIN users u ON kr.userID = u.id WHERE kr.rozliczenieID = ?`, [id], (err, ktoRozliczal) => {
        if (err) {
          console.error('Błąd pobierania ktoRozliczal:', err.message)
          return res.status(500).send('Błąd serwera')
        }
        res.render('rozliczenia_edytuj', {
          user: {
            id: req.session.user_id,
            login: req.session.login,
            dostep: req.session.dostep,
            imie: req.session.imie,
            nazwisko: req.session.nazwisko
          },
          rozliczenie: rozliczenie,
          wolontariusz: wolontariusz,
          ktoRozliczal: ktoRozliczal,
          title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
          footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
        })
      })
    })
  })
})

// Obsługa zapisu edycji rozliczenia
app.post('/rozliczenia/edytuj/:id', requireAuth, (req, res) => {
  const id = req.params.id
  const body = req.body
  if (req.session.dostep > 1) {
    return res.status(403).send('Brak dostępu')
  }
  // Sprawdź rozliczenie
  db.get(`SELECT * FROM rozliczenie WHERE id = ? AND aktywny = 1`, [id], (err, rozliczenie) => {
    if (err) {
      console.error('Błąd pobierania rozliczenia:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    if (!rozliczenie) {
      return res.status(404).send('Rozliczenie nie znalezione')
    }
    // Sprawdź dostęp
    if (req.session.dostep === 1 && rozliczenie.zatwierdzil !== 0) {
      return res.status(403).send('Brak dostępu do edycji zatwierdzonego rozliczenia')
    }

    const now = new Date().toISOString()
    const parseIntSafe = v => (v ? parseInt(v, 10) || 0 : 0)
    const parseFloatSafe = v => (v ? parseFloat(v) || 0 : 0)

    const terminal = body.terminal === 'on' ? 1 : 0
    const kwotaZTerminala = parseFloatSafe(body.kwotaZTerminala)
    const m1gr = parseIntSafe(body.m1gr)
    const m2gr = parseIntSafe(body.m2gr)
    const m5gr = parseIntSafe(body.m5gr)
    const m10gr = parseIntSafe(body.m10gr)
    const m20gr = parseIntSafe(body.m20gr)
    const m50gr = parseIntSafe(body.m50gr)
    const m1zl = parseIntSafe(body.m1zl)
    const m2zl = parseIntSafe(body.m2zl)
    const m5zl = parseIntSafe(body.m5zl)
    const b10zl = parseIntSafe(body.b10zl)
    const b20zl = parseIntSafe(body.b20zl)
    const b50zl = parseIntSafe(body.b50zl)
    const b100zl = parseIntSafe(body.b100zl)
    const b200zl = parseIntSafe(body.b200zl)
    const b500zl = parseIntSafe(body.b500zl)
    const walutaObca = body.walutaObca && body.walutaObca.trim() !== '' ? body.walutaObca.trim() : 'BRAK'
    const daryInne = body.daryInne && body.daryInne.trim() !== '' ? body.daryInne.trim() : 'BRAK'
    const uwagiLiczacych = body.uwagiLiczacych && body.uwagiLiczacych.trim() !== '' ? body.uwagiLiczacych.trim() : 'BRAK'
    const uwagiWolontariusza = body.uwagiWolontariusza && body.uwagiWolontariusza.trim() !== '' ? body.uwagiWolontariusza.trim() : 'BRAK'
    const sala = body.sala && body.sala.trim() !== '' ? body.sala.trim() : 'GŁÓWNA'

    // Zaktualizuj rozliczenie
    db.run(`UPDATE rozliczenie SET 
      terminal = ?, kwotaZTerminala = ?, m1gr = ?, m2gr = ?, m5gr = ?, m10gr = ?, m20gr = ?, m50gr = ?,
      m1zl = ?, m2zl = ?, m5zl = ?, b10zl = ?, b20zl = ?, b50zl = ?, b100zl = ?, b200zl = ?, b500zl = ?,
      walutaObca = ?, daryInne = ?, uwagiLiczacych = ?, uwagiWolontariusza = ?, sala = ?, ostatniaZmiana = ?
      WHERE id = ? AND aktywny = 1`,
      [terminal, kwotaZTerminala, m1gr, m2gr, m5gr, m10gr, m20gr, m50gr, m1zl, m2zl, m5zl, b10zl, b20zl, b50zl, b100zl, b200zl, b500zl,
       walutaObca, daryInne, uwagiLiczacych, uwagiWolontariusza, sala, now, id], 
      function(err) {
        if (err) {
          console.error('Błąd aktualizacji rozliczenia:', err.message)
          return res.status(500).send('Błąd serwera')
        }
        // Usuń stare ktoRozliczal
        db.run(`DELETE FROM ktoRozliczal WHERE rozliczenieID = ?`, [id], (err) => {
          if (err) {
            console.error('Błąd usuwania ktoRozliczal:', err.message)
            return res.status(500).send('Błąd serwera')
          }
          // Dodaj nowe ktoRozliczal
          let kto_ids = []
          if (body.kto_ids && body.kto_ids.trim() !== '') {
            kto_ids = body.kto_ids.split(',').map(s => parseInt(s,10)).filter(n => !isNaN(n))
          }
          if (!kto_ids.includes(req.session.user_id)) kto_ids.push(req.session.user_id)

          const insertKto = (index) => {
            if (index >= kto_ids.length) {
              zapiszLog('EDYCJA_ROZLICZENIA', req.session.user_id, 'rozliczenie', id)
              return res.redirect('/rozliczenia/lista')
            }
            const uid = kto_ids[index]
            db.run(`INSERT INTO ktoRozliczal (rozliczenieID, userID) VALUES (?, ?)`, [id, uid], (err) => {
              if (err) console.error('Błąd zapisu ktoRozliczal:', err.message)
              insertKto(index+1)
            })
          }
          insertKto(0)
        })
      })
  })
})

// Statystyki - panel główny
app.get('/statystyki', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  res.render('statystyki', { 
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
  })
})

// Statystyki - podsumowanie (do rzutnika)
app.get('/statystyki/podsumowanie', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  
  // Pobierz sumy wszystkich monet/banknotów
  db.get(
    `SELECT 
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
    FROM rozliczenie WHERE aktywny = 1`,
    [],
    (err, summary) => {
      if (err) {
        console.error('Błąd pobierania podsumowania:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      
      // Pobierz TOP 5 wolontariuszy
      db.all(
        `SELECT w.numerID, w.imie, w.nazwisko,
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
        LIMIT 5`,
        [],
        (err, topWolontariusze) => {
          if (err) {
            console.error('Błąd pobierania TOP wolontariuszy:', err.message)
            return res.status(500).send('Błąd serwera')
          }
          
          // Pobierz TOP 5 liczących
          db.all(
            `SELECT u.imie, u.nazwisko, COUNT(DISTINCT kr.rozliczenieID) as liczbaRozliczen,
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
            ORDER BY suma DESC
            LIMIT 5`,
            [],
            (err, topLiczacy) => {
              if (err) {
                console.error('Błąd pobierania TOP liczących:', err.message)
                return res.status(500).send('Błąd serwera')
              }
              
              res.render('statystyki_podsumowanie', {
                user: {
                  id: req.session.user_id,
                  login: req.session.login,
                  dostep: req.session.dostep,
                  imie: req.session.imie,
                  nazwisko: req.session.nazwisko
                },
                summary: summary || {},
                topWolontariusze,
                topLiczacy,
                title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
                footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
              })
            }
          )
        }
      )
    }
  )
})

// Statystyki liczących
app.get('/statystyki/liczacy', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  
  db.all(
    `SELECT u.id, u.imie, u.nazwisko, COUNT(DISTINCT kr.rozliczenieID) as liczbaRozliczen,
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
    ORDER BY suma DESC`,
    [],
    (err, liczacy) => {
      if (err) {
        console.error('Błąd pobierania statystyk liczących:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      
      // Oblicz globalne sumy po stronie serwera, aby uniknąć podwójnego liczenia rozliczeń przypisanych do wielu osób
      db.get(`SELECT COUNT(*) as totalRozliczen, SUM(
        m1gr*0.01 + m2gr*0.02 + m5gr*0.05 + m10gr*0.10 + m20gr*0.20 + m50gr*0.50 +
        m1zl*1 + m2zl*2 + m5zl*5 +
        b10zl*10 + b20zl*20 + b50zl*50 + b100zl*100 + b200zl*200 + b500zl*500 +
        kwotaZTerminala
      ) as totalSuma FROM rozliczenie WHERE aktywny = 1`, [], (err2, totals) => {
        if (err2) {
          console.error('Błąd pobierania podsumowania rozliczeń:', err2.message)
          // W razie błędu pokaż bez wartości globalnych
          return res.render('statystyki_liczacy', {
            user: {
              id: req.session.user_id,
              login: req.session.login,
              dostep: req.session.dostep,
              imie: req.session.imie,
              nazwisko: req.session.nazwisko
            },
            liczacy,
            title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
            footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
          })
        }

        res.render('statystyki_liczacy', {
          user: {
            id: req.session.user_id,
            login: req.session.login,
            dostep: req.session.dostep,
            imie: req.session.imie,
            nazwisko: req.session.nazwisko
          },
          liczacy,
          totalSuma: totals.totalSuma || 0,
          totalRozliczen: totals.totalRozliczen || 0,
          title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
          footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
        })
      })
    }
  )
})

// Statystyki wolontariuszy
app.get('/statystyki/wolontariusz', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  
  db.all(
    `SELECT w.id, w.numerID, w.imie, w.nazwisko,
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
    ORDER BY suma DESC`,
    [],
    (err, wolontariusze) => {
      if (err) {
        console.error('Błąd pobierania statystyk wolontariuszy:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      
      res.render('statystyki_wolontariusz', {
        user: {
          id: req.session.user_id,
          login: req.session.login,
          dostep: req.session.dostep,
          imie: req.session.imie,
          nazwisko: req.session.nazwisko
        },
        wolontariusze,
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
      })
    }
  )
})


app.get('/druki', requireAuth, (req, res) => {
  //sprawdź dostęp
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  //renderuj panel z kafelkami opcji lista, dodaj
  res.render('druki', { 
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP', 
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008' 
  })
})

app.get('/druki/spotkanie/obecnosc', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  // Pobierz wszystkich wolontariuszy
  db.all(`SELECT numerID, imie, nazwisko FROM wolontariusz WHERE aktywny = 1 ORDER BY numerID ASC`, [], (err, wolontariusze) => {
    if (err) {
      console.error('Błąd pobierania wolontariuszy:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    res.render('druki_spotkanie_obecnosc', {
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      wolontariusze,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
    })
  })
})

app.get('/druki/spotkanie/obecnosc/pesel', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  // Pobierz wszystkich wolontariuszy
  db.all(`SELECT numerID, imie, nazwisko, pesel FROM wolontariusz WHERE aktywny = 1 ORDER BY numerID ASC`, [], (err, wolontariusze) => {
    if (err) {
      console.error('Błąd pobierania wolontariuszy:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    res.render('druki_spotkanie_obecnosc_pesel', {
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      wolontariusze,
      peselAnonimizuj: peselAnonimizuj,
      czyPelnoletni: czyPelnoletni,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
    })
  })
})

app.get('/druki/odbiorPuszki', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  // Pobierz wolontariuszy z zaznaczonymi do odbioru puszki
  db.all(`SELECT numerID, imie, nazwisko, pesel FROM wolontariusz WHERE aktywny = 1 ORDER BY numerID ASC`, [], (err, wolontariusze) => {
    if (err) {
      console.error('Błąd pobierania wolontariuszy:', err.message)
      return res.status(500).send('Błąd serwera')
    }
    res.render('druki_odbiorPuszki', {
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      wolontariusze,
      peselAnonimizuj: peselAnonimizuj,
      czyPelnoletni: czyPelnoletni,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
    })
  })
})

app.get('/druki/doRozliczenia', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  // Pobierz wolontariuszy którzy mają wydane puszki ale nie są rozliczeni
  db.all(
    `SELECT w.numerID, w.imie, w.nazwisko, w.pesel FROM wolontariusz w 
     LEFT JOIN rozliczenie r ON w.id = r.wolontariuszID AND r.aktywny = 1 
     WHERE w.aktywny = 1 AND w.puszkaWydana = 1 AND r.id IS NULL 
     ORDER BY w.numerID ASC`, 
    [], 
    (err, wolontariusze) => {
      if (err) {
        console.error('Błąd pobierania wolontariuszy:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      res.render('druki_doRozliczenia', {
        user: {
          id: req.session.user_id,
          login: req.session.login,
          dostep: req.session.dostep,
          imie: req.session.imie,
          nazwisko: req.session.nazwisko
        },
        wolontariusze,
        peselAnonimizuj: peselAnonimizuj,
        czyPelnoletni: czyPelnoletni,
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
      })
    }
  )
})

app.get('/druki/rozliczenia', requireAuth, (req, res) => {
  if (req.session.dostep > 2) {
    return res.status(403).send('Brak dostępu')
  }
  // Pobierz wszystkie rozliczenia z danymi wolontariuszy
  db.all(
    `SELECT w.numerID, w.imie, w.nazwisko, w.pesel, r.czasRozliczenia,
     (r.m1gr*0.01 + r.m2gr*0.02 + r.m5gr*0.05 + r.m10gr*0.10 + r.m20gr*0.20 + r.m50gr*0.50 +
      r.m1zl*1 + r.m2zl*2 + r.m5zl*5 + r.b10zl*10 + r.b20zl*20 + r.b50zl*50 + 
      r.b100zl*100 + r.b200zl*200 + r.b500zl*500 + r.kwotaZTerminala) AS suma
     FROM rozliczenie r JOIN wolontariusz w ON r.wolontariuszID = w.id 
     WHERE r.aktywny = 1 ORDER BY r.czasRozliczenia DESC`, 
    [], 
    (err, rozliczenia) => {
      if (err) {
        console.error('Błąd pobierania rozliczeń:', err.message)
        return res.status(500).send('Błąd serwera')
      }
      res.render('druki_rozliczenia', {
        user: {
          id: req.session.user_id,
          login: req.session.login,
          dostep: req.session.dostep,
          imie: req.session.imie,
          nazwisko: req.session.nazwisko
        },
        rozliczenia,
        peselAnonimizuj: peselAnonimizuj,
        czyPelnoletni: czyPelnoletni,
        title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
        footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
      })
    }
  )
})

app.get('/logout', requireAuth, (req, res) => {
  const userId = req.session.user_id
  const sessionId = req.session.session_id
  const userLogin = req.session.login
  
  // Usuń sesję z bazy danych
  db.run(`DELETE FROM sessions WHERE id = ? AND userID = ?`, [sessionId, userId], (err) => {
    if (err) {
      console.error('Błąd usuwania sesji:', err.message)
    }
  })
  
  // Zapisanie wylogowania do audit_log
  db.run(`INSERT INTO audit_log (tabela, rekordID, operacja, czasOperacji, uzytkownikID, szczegoly) VALUES (?, ?, ?, ?, ?, ?)`, 
    ['users', userId, 'LOGOUT', new Date().toISOString(), userId, `Wylogowano użytkownika: ${userLogin}`], 
    (err) => {
      if (err) {
        console.error('Błąd zapisu audit_log:', err.message)
      }
    }
  )
  
  // Zniszcz sesję
  req.session.destroy((err) => {
    if (err) {
      console.error('Błąd niszczenia sesji:', err.message)
    }
    res.redirect('/login')
  })
})

// Unieważnienie wszystkich tokenów (tylko superadmin)
app.post('/tokens/invalidate-all', requireAuth, (req, res) => {
  if (req.session.dostep !== 0) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  
  db.run(`UPDATE tokens SET dataZakonczenia = ? WHERE dataZakonczenia > ?`, 
    [new Date().toISOString(), new Date().toISOString()], 
    function(err) {
      if (err) {
        console.error('Błąd unieważniania tokenów:', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
      }
      zapiszLog('UNIEWAŻNIENIE WSZYSTKICH TOKENÓW', req.session.user_id, 'tokens', 0)
      res.json({ success: true, message: `Unieważniono wszystkie tokeny`, count: this.changes })
    }
  )
})

// Unieważnienie tokenu dla konkretnego użytkownika (tylko superadmin)
app.post('/tokens/invalidate/:userId', requireAuth, (req, res) => {
  if (req.session.dostep !== 0) {
    return res.status(403).json({ success: false, message: 'Brak dostępu' })
  }
  
  const userId = req.params.userId
  
  db.run(`UPDATE tokens SET dataZakonczenia = ? WHERE userID = ? AND dataZakonczenia > ?`, 
    [new Date().toISOString(), userId, new Date().toISOString()], 
    function(err) {
      if (err) {
        console.error('Błąd unieważniania tokenów:', err.message)
        return res.status(500).json({ success: false, message: 'Błąd serwera' })
      }
      zapiszLog('UNIEWAŻNIENIE TOKENÓW UŻYTKOWNIKA', req.session.user_id, 'tokens', userId)
      res.json({ success: true, message: `Unieważniono tokeny użytkownika`, count: this.changes })
    }
  )
})

app.get('/ustawienia', requireAuth, (req, res) => {
  // Tylko superadmin
  if (req.session.dostep !== 0) {
    return res.status(403).send('Brak dostępu')
  }
  res.render('ustawienia', {
    user: {
      id: req.session.user_id,
      login: req.session.login,
      dostep: req.session.dostep,
      imie: req.session.imie,
      nazwisko: req.session.nazwisko
    },
    settings,
    success: req.query.success == '1',
    title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
    footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
  })
})

app.post('/ustawienia', requireAuth, (req, res) => {
  // Tylko superadmin
  if (req.session.dostep !== 0) {
    return res.status(403).send('Brak dostępu')
  }
  const { discord, url_for_app } = req.body

  // Walidacja
  let errors = []
  if (discord && discord.trim() !== '') {
    try {
      const url = new URL(discord.trim())
      if (!url.href.startsWith('https://discord.com/api/webhooks/')) {
        errors.push('URL Discord webhook musi zaczynać się od https://discord.com/api/webhooks/')
      }
    } catch (e) {
      errors.push('Nieprawidłowy URL dla Discord webhook')
    }
  }
  if (url_for_app && url_for_app.trim() !== '') {
    try {
      new URL(url_for_app.trim())
    } catch (e) {
      errors.push('Nieprawidłowy URL dla aplikacji')
    }
  }

  if (errors.length > 0) {
    return res.render('ustawienia', {
      user: {
        id: req.session.user_id,
        login: req.session.login,
        dostep: req.session.dostep,
        imie: req.session.imie,
        nazwisko: req.session.nazwisko
      },
      settings,
      errors,
      success: false,
      title: process.env.TITLE || 'Pomocnik szefa sztabu WOŚP',
      footer_text: process.env.FOOTER_TEXT || '© 2026 WOŚP, przez kry008'
    })
  }

  // Zapisz do bazy
  const updates = []
  if (discord !== undefined) {
    updates.push({ klucz: 'DISCORD', wartosc: discord.trim() || '' })
  }
  if (url_for_app !== undefined) {
    updates.push({ klucz: 'URL_FOR_APP', wartosc: url_for_app.trim() || '' })
  }

  let completed = 0
  updates.forEach(update => {
    db.run(`INSERT OR REPLACE INTO ustawienia (klucz, wartosc) VALUES (?, ?)`, [update.klucz, update.wartosc], (err) => {
      if (err) {
        console.error('Błąd zapisu ustawienia:', err.message)
      } else {
        settings[update.klucz] = update.wartosc
        zapiszLog('ZMIANA_USTAWIEN', req.session.user_id, 'ustawienia', 0, `Klucz: ${update.klucz}`)
      }
      completed++
      if (completed === updates.length) {
        res.redirect('/ustawienia?success=1')
      }
    })
  })
})

app.use((req, res, next) => {
  //json not found for api routes
  res.status(404).json({ error: 'Not Found' })
})

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})

function zapiszLog(opis, kto, tabela, rekordID) {
  const czasOperacji = new Date().toISOString()
  db.run(`INSERT INTO audit_log (tabela, rekordID, operacja, czasOperacji, uzytkownikID, szczegoly) VALUES (?, ?, ?, ?, ?, ?)`, 
    [tabela, rekordID, opis, czasOperacji, kto, `Operacja: ${opis} na tabeli: ${tabela}, rekord ID: ${rekordID}`], 
    (err) => {
      if (err) {
        console.error('Błąd zapisu audit_log:', err.message)
      }
    }
  )
}