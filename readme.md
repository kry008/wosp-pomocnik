# Pomocnik Szefa Sztabu
Aplikacja stworzona w celu ułatwienia i uporządkowania pracy szefów sztabów podczas finału WOŚP.

## Instalacja

### Windows
0. Załącz wyświetlanie rozszerzeń plików w Eksploratorze plików, aby móc poprawnie skonfigurować plik `.env`. Jak to zrobić, znajdziesz [tutaj](https://support.microsoft.com/pl-pl/windows/eksplorator-plik%C3%B3w-w-systemie-windows-ef370130-1cca-9dc5-e0df-2f7416fe1cb1#ID0EFBBBDFD).
1. Pobierz i zainstaluj [Node.js](https://nodejs.org/en/download)
1. Pobierz repozytorium
1. Uruchom PowerShell lub CMD w trybie administratora w katalogu z aplikacją
1. Wykonaj polecenie `npm install`
1. Zmień nazwę pliku `.env.example` na `.env` i dostosuj jego zawartość
1. Zainstaluj [PM2](https://pm2.keymetrics.io/) globalnie za pomocą polecenia `npm install pm2 -g`
1. Uruchom ustawienie wstępne aplikacji za pomocą polecenia `node init_db.cjs` *
1. Uruchom aplikację za pomocą polecenia `pm2 start index.mjs`
1. Aplikacja powinna być dostępna pod adresem `http://localhost:3001` lub `http://<TWOJE_IP>:3001`

\* W przypadku problemów zmień nazwę pliku `baza.plik.sql` na `baza.sqlite`

### Linux
1. Pobierz i zainstaluj [Node.js](https://nodejs.org/en/download)
1. Pobierz repozytorium
1. Uruchom terminal w katalogu z aplikacją
1. Wykonaj polecenie `npm install`
1. Zmień nazwę pliku `.env.example` na `.env` i dostosuj jego zawartość
1. Zainstaluj [PM2](https://pm2.keymetrics.io/) globalnie za pomocą polecenia `npm install pm2 -g`
1. Uruchom ustawienie wstępne aplikacji za pomocą polecenia `node init_db.cjs`
1. Uruchom aplikację za pomocą polecenia `pm2 start index.mjs`
1. Aplikacja powinna być dostępna pod adresem `http://localhost:3001` lub `http://<TWOJE_IP>:3001`

\* W przypadku problemów zmień nazwę pliku `baza.plik.sql` na `baza.sqlite`

### MacOS
1. Pobierz i zainstaluj [Node.js](https://nodejs.org/en/download)
1. Pobierz repozytorium
1. Uruchom terminal w katalogu z aplikacją
1. Wykonaj polecenie `npm install`
1. Zmień nazwę pliku `.env.example` na `.env` i dostosuj jego zawartość
1. Zainstaluj [PM2](https://pm2.keymetrics.io/) globalnie za pomocą polecenia `npm install pm2 -g`
1. Uruchom ustawienie wstępne aplikacji za pomocą polecenia `node init_db.cjs`
1. Uruchom aplikację za pomocą polecenia `pm2 start index.mjs`
1. Aplikacja powinna być dostępna pod adresem `http://localhost:3001` lub `http://<TWOJE_IP>:3001`

\* W przypadku problemów zmień nazwę pliku `baza.plik.sql` na `baza.sqlite`

## Ponowne uruchamianie aplikacji

### Restart aplikacji (zachowując dane)

Aby ponownie uruchomić aplikację, użyj polecenia `pm2 restart index.mjs` w terminalu lub PowerShellu uruchomionym w katalogu z aplikacją.

### Uruchomienie po uruchomieniu systemu

Aby uruchomić aplikację po włączeniu systemu, przejdź do katalogu z aplikacją i wykonaj polecenie `pm2 startup`, a następnie skopiuj i wklej wyświetlone polecenie do terminala lub PowerShella i naciśnij Enter. Następnie wykonaj polecenie `pm2 save`, aby zapisać aktualny stan procesów.  
Jeżeli to nie zadzaiała ręczne uruchomienie aplikacji: `pm2 start index.mjs` powinno pomóc.