
require('dotenv').config()
var crypto = require('crypto')
const sqlite_db = process.env.SQLITE_DB || './baza.sqlite'

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(sqlite_db)

db.serialize(() => {

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
        zatwierdzone INTEGER DEFAULT 0,
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
        //Sprawdź czy istnieje wpis w users dla superadmina, jeśli nie to go dodaj
    db.get(`SELECT COUNT(*) AS count FROM users WHERE dostep = 0`, (err, row) => {
        if (err) {
            console.error(err.message);
        }
        else if (row.count === 0) {
            const insert = 'INSERT INTO users (login, haslo, imie, nazwisko, dostep) VALUES (?,?,?,?,?)'
            db.run(insert, ['szef', crypto.createHash('sha256').update('szef').digest('hex'), 'Szef', 'Sztabu', 0])
            console.log("Dodano domyślnego superadmina (login: szef, hasło: szef)")
        }
    })
    // Dodaj domyślne ustawienia jeśli nie istnieją
    const defaultSettings = [
        { klucz: 'DISCORD', wartosc: process.env.DISCORD || '' },
        { klucz: 'URL_FOR_APP', wartosc: process.env.URL_FOR_APP || '' }
    ]
    defaultSettings.forEach(setting => {
        db.get(`SELECT COUNT(*) AS count FROM ustawienia WHERE klucz = ?`, [setting.klucz], (err, row) => {
            if (err) {
                console.error(err.message);
            } else if (row.count === 0) {
                db.run(`INSERT INTO ustawienia (klucz, wartosc) VALUES (?, ?)`, [setting.klucz, setting.wartosc], (err) => {
                    if (err) {
                        console.error('Błąd dodawania ustawienia:', err.message);
                    } else {
                        console.log(`Dodano domyślne ustawienie: ${setting.klucz}`);
                    }
                });
            }
        });
    });
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
        )`)

})