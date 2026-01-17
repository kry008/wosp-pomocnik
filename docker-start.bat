@echo off
chcp 65001 > nul

REM Skrypt do uruchamiania aplikacji WOŚP w Docker (Windows)

echo === Pomocnik Szefa Sztabu WOŚP - Uruchamianie w Docker ===
echo.

REM Sprawdź czy plik .env istnieje
if not exist .env (
    echo ⚠️  Plik .env nie istnieje!
    echo 📋 Kopiuję plik .env.example do .env...
    copy .env.example .env > nul
    echo ✅ Plik .env został utworzony. Edytuj go przed ponownym uruchomieniem.
    echo.
    pause
    exit /b 1
)

REM Sprawdź czy Docker jest zainstalowany
docker --version > nul 2>&1
if errorlevel 1 (
    echo ❌ Docker nie jest zainstalowany!
    echo 📥 Pobierz Docker z: https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)

REM Sprawdź czy Docker Compose jest dostępny
docker compose version > nul 2>&1
if errorlevel 1 (
    docker-compose --version > nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose nie jest zainstalowany!
        echo 📥 Pobierz Docker Compose z: https://docs.docker.com/compose/install/
        pause
        exit /b 1
    )
    set DOCKER_COMPOSE=docker-compose
) else (
    set DOCKER_COMPOSE=docker compose
)

echo 🐳 Uruchamianie aplikacji w Docker...
echo.

REM Zatrzymaj i usuń stare kontenery jeśli istnieją
%DOCKER_COMPOSE% down

REM Zbuduj i uruchom kontener
%DOCKER_COMPOSE% up -d --build

if errorlevel 1 (
    echo.
    echo ❌ Wystąpił błąd podczas uruchamiania aplikacji!
    echo 📋 Sprawdź logi: %DOCKER_COMPOSE% logs
    pause
    exit /b 1
)

echo.
echo ✅ Aplikacja została uruchomiona pomyślnie!
echo.
echo 📊 Status kontenera:
%DOCKER_COMPOSE% ps
echo.
echo 🌐 Aplikacja dostępna pod adresami:
echo   - Lokalnie:          http://localhost:3001

REM Wyświetl wszystkie adresy IP w sieci lokalnej
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo   - W sieci lokalnej:  http://%%b:3001
    )
)
echo.
echo 📝 Przydatne komendy:
echo   - Zobacz logi:        %DOCKER_COMPOSE% logs -f
echo   - Zatrzymaj:          %DOCKER_COMPOSE% stop
echo   - Uruchom ponownie:   %DOCKER_COMPOSE% restart
echo   - Usuń kontener:      %DOCKER_COMPOSE% down
echo.
pause
