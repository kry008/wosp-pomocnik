
require('dotenv').config()
var crypto = require('crypto')
const sqlite_db = process.env.SQLITE_DB || './baza.sqlite'

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(sqlite_db)

const h = (p) => crypto.createHash('sha256').update(p).digest('hex');

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
            console.log("Dodano domyślnego superadmina (login: superadmin, hasło: superadmin)")
        }
    })
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

})
db.serialize(() => {

    db.run(`
        INSERT INTO users (login, haslo, imie, nazwisko, dostep)
        VALUES 
        ('dostep', ?, 'Jan', 'Koordynator', 1),
        ('test1', ?, 'Anna', 'Mazur', 2),
        ('test2', ?, 'Piotr', 'Nowak', 2),
        ('test3', ?, 'Karolina', 'Majewska', 2),
        ('test4', ?, 'Łukasz', 'Kowalski', 2),
        ('test5', ?, 'Monika', 'Wiśniewska', 2),
        ('test6', ?, 'Tomasz', 'Wójcik', 2)
    `,
    [
        h('test1234'),
        h('test1234'),
        h('test1234'),
        h('test1234'),
        h('test1234'),
        h('test1234'),
        h('test1234')
    ]);

});




db.serialize(() => {

    db.run(`
        INSERT INTO wolontariusz 
        (numerID, imie, nazwisko, discord, telefon, pesel, rodzic, terminal, puszkaWydana)
        VALUES
        ('WOL-001', 'Marek', 'Nowak', 'marek#1234', '600111222', '05311525161', 'BRAK', 1, 1),
        ('WOL-002', 'Kasia', 'Kowalska', 'kasia#2345', '600222333', '92112378984', 'BRAK', 0, 1),
        ('WOL-003', 'Ola', 'Zielińska', 'ola#3456', '600333444', '21291022496', 'Anna Zielińska', 0, 1),
        ('WOL-004', 'Tomek', 'Wiśniewski', 'tomek#4567', '600444555', '05312786118', 'Paweł Wiśniewski', 1, 1),
        ('WOL-005', 'Ania', 'Wójcik', 'ania#5678', '600555666', '08302844241', 'BRAK', 0, 0),
        ('WOL-006', 'Piotrek', 'Kaczmarek', 'piotrek#6789', '600666777', '74081171328', 'BRAK', 1, 1),
        ('WOL-007', 'Magda', 'Mazur', 'magda#7890', '600777888', '97081024496', 'BRAK', 0, 1),
        ('WOL-008', 'Bartek', 'Kowalczyk', 'bartek#8901', '600888999', '01242359864', 'BRAK', 1, 1),
        ('WOL-009', 'Ewa', 'Kubiak', 'ewa#9012', '600999000', '15251885481', 'BRAK', 0, 1),
        ('WOL-010', 'Adam', 'Nowicki', 'adam#0123', '601000111', '99012278341', 'BRAK', 1, 1),
        ('WOL-011', 'Zofia', 'Włodarczyk', 'zofia#1122', '601111222', '04273178769', 'BRAK', 0, 1),
        ('WOL-012', 'Michał', 'Sikora', 'michal#2233', '601222333', '08272855225', 'BRAK', 1, 1),
        ('WOL-013', 'Julia', 'Jankowska', 'julia#3344', '601333444', '05292739999', 'BRAK', 0, 1),
        ('WOL-014', 'Krzysztof', 'Pawlak', 'krzysztof#4455', '601444555', '07261035295', 'BRAK', 1, 0),
        ('WOL-015', 'Agnieszka', 'Duda', 'agnieszka#5566', '601555666', '05262964239', 'BRAK', 0, 1),
        ('WOL-016', 'Łukasz', 'Czarnecki', 'lukasz#6677', '601666777', '11232638477', 'BRAK', 1, 1),
        ('WOL-017', 'Natalia', 'Kozłowska', 'natalia#7788', '601777888', '03283175432', 'BRAK', 0, 1),
        ('WOL-018', 'Paweł', 'Jabłoński', 'pawel#8899', '601888999', '07272892524', 'BRAK', 1, 1),
        ('WOL-019', 'Monika', 'Witkowska', 'monika#9900', '601999000', '07320378512', 'BRAK', 0, 1),
        ('WOL-020', 'Grzegorz', 'Walczak', 'grzegorz#1010', '602000111', '00300298183', 'BRAK', 1, 1),
        ('WOL-021', 'Karolina', 'Sadowska', 'karolina#1212', '602111222', '10311954628', 'BRAK', 0, 1),
        ('WOL-022', 'Damian', 'Nowakowski', 'damian#1313', '602222333', '09312661545', 'BRAK', 1, 1),
        ('WOL-023', 'Sylwia', 'Lis', 'sylwia#1414', '602333444', '05241936743', 'BRAK', 0, 1),
        ('WOL-024', 'Rafał', 'Zając', 'rafal#1515', '602444555', '10260573635', 'BRAK', 1, 1),
        ('WOL-025', 'Iwona', 'Wrona', 'iwona#1616', '602555666', '01233149933', 'BRAK', 0, 1),
        ('WOL-026', 'Mariusz', 'Michalski', 'mariusz#1717', '602666777', '88071512345', 'BRAK', 1, 1),
        ('WOL-027', 'Beata', 'Kubiak', 'beata#1818', '602777888', '92062456789', 'BRAK', 0, 1),
        ('WOL-028', 'Tadeusz', 'Gajda', 'tadeusz#1919', '602888999', '75030998765', 'BRAK', 1, 1),
        ('WOL-029', 'Renata', 'Sowa', 'renata#2020', '602999000', '88021534567', 'BRAK', 0, 1),
        ('WOL-030', 'Wojciech', 'Baran', 'wojciech#2121', '603000111', '99073045678', 'BRAK', 1, 1),
        ('WOL-031', 'Elżbieta', 'Cieślak', 'elzbieta#2222', '603111222', '04251234567', 'BRAK', 0, 1),
        ('WOL-032', 'Sebastian', 'Krawczyk', 'sebastian#2323', '603222333', '09282987654', 'BRAK', 1, 1),
        ('WOL-033', 'Alicja', 'Stępień', 'alicja#2424', '603333444', '05263012345', 'BRAK', 0, 1),
        ('WOL-034', 'Cezary', 'Chmiel', 'cezary#2525', '603444555', '88051267890', 'BRAK', 1, 1),
        ('WOL-035', 'Dorota', 'Sikorska', 'dorota#2626', '603555666', '93071823456', 'BRAK', 0, 1)
    `);

});


db.serialize(() => {

    db.run(`
        INSERT INTO rozliczenie (
            wolontariuszID,
            czasRozliczenia,
            terminal,
            kwotaZTerminala,
            m1zl, m2zl, m5zl,
            b10zl, b20zl, b50zl,
            uwagiLiczacych,
            uwagiWolontariusza,
            wstawil,
            zatwierdzil,
            zatwierdzone,
            ostatniaZmiana
        ) VALUES
        (
            1,
            '2026-01-01 14:10:00',
            1,
            123.45,
            10, 5, 2,
            3, 1, 0,
            'Bez uwag',
            'Puszka pełna',
            2,
            1,
            1,
            '2026-01-01 14:15:00'
        ),
        (
            3,
            '2026-01-01 15:30:00',
            0,
            0,
            20, 10, 5,
            2, 0, 0,
            'Niepełnoletni – obecny opiekun',
            'Liczone razem z rodzicem',
            3,
            0,
            0,
            '2026-01-01 15:35:00'
        )
    `);

});

db.serialize(() => {

    db.run(`
        INSERT INTO ktoRozliczal (rozliczenieID, userID)
        VALUES
        (1, 2),
        (1, 3),
        (2, 3)
    `);

});

db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userID INTEGER NOT NULL,
        token TEXT NOT NULL,
        dataZakonczenia TEXT NOT NULL
        )`)
});