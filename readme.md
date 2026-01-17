# Pomocnik Szefa Sztabu
Aplikacja stworzona w celu ułatwienia i uporządkowania pracy szefów sztabów podczas finału WOŚP.

## Spis treści
- [Instalacja](#instalacja)
  - [Docker (zalecane)](#docker-zalecane)
  - [Windows](#windows)
  - [Linux](#linux)
  - [MacOS](#macos)
- [Ponowne uruchamianie aplikacji](#ponowne-uruchamianie-aplikacji)
  - [Docker](#docker-1)
  - [PM2](#pm2)
- [Narzędzia pomocnicze](#narzędzia-pomocnicze)

## Instalacja

### Docker (zalecane)

Docker umożliwia łatwe i szybkie uruchomienie aplikacji bez konieczności instalowania Node.js i innych zależności.

#### Wymagania
- [Docker Desktop](https://docs.docker.com/get-docker/) (Windows/Mac) lub Docker Engine (Linux)
- Docker Compose (zazwyczaj wchodzi w skład Docker Desktop)

#### Instalacja i uruchomienie

1. Pobierz repozytorium
1. Skopiuj plik `.env.example` na `.env` i dostosuj jego zawartość
1. Uruchom aplikację:
   - **Windows**: Kliknij dwukrotnie plik `docker-start.bat` lub uruchom go w CMD
   - **Linux/MacOS**: Uruchom w terminalu: `./docker-start.sh`
   - **Ręcznie**: Uruchom w terminalu: `docker compose up -d --build`

Aplikacja będzie dostępna pod adresem `http://localhost:3001` lub `http://<TWOJE_IP>:3001`

#### Zarządzanie kontenerem Docker

```bash
# Zobacz logi aplikacji
docker compose logs -f

# Zatrzymaj aplikację
docker compose stop

# Uruchom ponownie
docker compose restart

# Usuń kontener (zachowując dane)
docker compose down

# Usuń kontener wraz z danymi
docker compose down -v
```

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

### Docker

Aby ponownie uruchomić aplikację w Docker:

```bash
# Zatrzymaj i uruchom ponownie
docker compose restart

# Lub zatrzymaj, zaktualizuj kod i uruchom z rebuildem
docker compose down
docker compose up -d --build
```

Aby uruchomić automatycznie po starcie systemu, skonfiguruj Docker Desktop do automatycznego startu lub dodaj kontener do autostartu systemowego.

### PM2

#### Restart aplikacji (zachowując dane)

Aby ponownie uruchomić aplikację, użyj polecenia `pm2 restart index.mjs` w terminalu lub PowerShellu uruchomionym w katalogu z aplikacją.

#### Uruchomienie po uruchomieniu systemu

Aby uruchomić aplikację po włączeniu systemu, przejdź do katalogu z aplikacją i wykonaj polecenie `pm2 startup`, a następnie skopiuj i wklej wyświetlone polecenie do terminala lub PowerShella i naciśnij Enter. Następnie wykonaj polecenie `pm2 save`, aby zapisać aktualny stan procesów.  
Jeżeli to nie zadziała, ręczne uruchomienie aplikacji: `pm2 start index.mjs` powinno pomóc.
