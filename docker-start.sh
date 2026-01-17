#!/bin/bash

# Skrypt do uruchamiania aplikacji WOŚP w Docker

echo "=== Pomocnik Szefa Sztabu WOŚP - Uruchamianie w Docker ==="
echo ""

# Sprawdź czy plik .env istnieje
if [ ! -f .env ]; then
    echo "⚠️  Plik .env nie istnieje!"
    echo "📋 Kopiuję plik .env.example do .env..."
    cp .env.example .env
    echo "✅ Plik .env został utworzony. Edytuj go przed ponownym uruchomieniem."
    echo ""
    exit 1
fi

# Sprawdź czy Docker jest zainstalowany
if ! command -v docker &> /dev/null; then
    echo "❌ Docker nie jest zainstalowany!"
    echo "📥 Pobierz Docker z: https://docs.docker.com/get-docker/"
    exit 1
fi

# Sprawdź czy Docker Compose jest dostępny
if ! docker compose version &> /dev/null; then
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose nie jest zainstalowany!"
        echo "📥 Pobierz Docker Compose z: https://docs.docker.com/compose/install/"
        exit 1
    fi
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo "🐳 Uruchamianie aplikacji w Docker..."
echo ""

# Zatrzymaj i usuń stare kontenery jeśli istnieją
$DOCKER_COMPOSE down

# Zbuduj i uruchom kontener
$DOCKER_COMPOSE up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Aplikacja została uruchomiona pomyślnie!"
    echo ""
    echo "📊 Status kontenera:"
    $DOCKER_COMPOSE ps
    echo ""
    echo "🌐 Aplikacja dostępna pod adresami:"
    echo "  - Lokalnie:          http://localhost:3001"
    
    # Wyświetl wszystkie adresy IP w sieci lokalnej
    if command -v hostname &> /dev/null; then
        LOCAL_IPS=$(hostname -I 2>/dev/null || hostname -i 2>/dev/null)
        if [ ! -z "$LOCAL_IPS" ]; then
            for ip in $LOCAL_IPS; do
                # Pomiń adresy IPv6 i localhost
                if [[ ! $ip =~ ":" ]] && [[ $ip != "127.0.0.1" ]]; then
                    echo "  - W sieci lokalnej:  http://$ip:3001"
                fi
            done
        fi
    fi
    echo ""
    echo "📝 Przydatne komendy:"
    echo "  - Zobacz logi:        $DOCKER_COMPOSE logs -f"
    echo "  - Zatrzymaj:          $DOCKER_COMPOSE stop"
    echo "  - Uruchom ponownie:   $DOCKER_COMPOSE restart"
    echo "  - Usuń kontener:      $DOCKER_COMPOSE down"
    echo ""
else
    echo ""
    echo "❌ Wystąpił błąd podczas uruchamiania aplikacji!"
    echo "📋 Sprawdź logi: $DOCKER_COMPOSE logs"
    exit 1
fi
