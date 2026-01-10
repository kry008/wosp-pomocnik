#!/usr/bin/env bash
# test_api.sh — prosty skrypt testowy dla /api
# Użycie:
#   BASE_URL=http://localhost:3001 LOGIN=admin PASSWORD=pass VOL_ID=1 ./test_api.sh

BASE_URL="${BASE_URL:-http://localhost:3001}"
LOGIN="${LOGIN:-admin}"
PASSWORD="${PASSWORD:-admin}"
VOL_ID="${VOL_ID:-1}"

JQ=$(command -v jq || true)

parse_token() {
  local body="$1"
  if [ -n "$JQ" ]; then
    echo "$body" | jq -r '.token'
  else
    echo "$body" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
  fi
}

pretty() {
  local body="$1"
  if [ -n "$JQ" ]; then
    echo "$body" | jq .
  else
    echo "$body"
  fi
}

echo "BASE_URL=$BASE_URL"

echo "\n1) Logowanie i pobranie tokenu (LOGIN=$LOGIN)..."
resp=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/login" -H "Content-Type: application/json" -d "{\"login\":\"$LOGIN\",\"haslo\":\"$PASSWORD\"}")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
if [ "$code" != "200" ] && [ "$code" != "201" ]; then
  echo "Logowanie nie powiodło się (HTTP $code):"
  pretty "$body"
  exit 1
fi
TOKEN=$(parse_token "$body")
if [ -z "$TOKEN" ]; then
  echo "Nie udało się wyciągnąć tokenu z odpowiedzi:"
  pretty "$body"
  exit 1
fi
echo "Token: $TOKEN"

call_get() {
  local path="$1"
  resp=$(curl -s -w "\n%{http_code}" -H "token: $TOKEN" "$BASE_URL$path")
  body=$(echo "$resp" | sed '$d')
  code=$(echo "$resp" | tail -n1)
  echo "\n=== GET $path (HTTP $code) ==="
  pretty "$body"
}

call_post() {
  local path="$1"; local data="$2"
  resp=$(curl -s -w "\n%{http_code}" -X POST -H "token: $TOKEN" -H "Content-Type: application/json" -d "$data" "$BASE_URL$path")
  body=$(echo "$resp" | sed '$d')
  code=$(echo "$resp" | tail -n1)
  echo "\n=== POST $path (HTTP $code) ==="
  pretty "$body"
}

echo "\n2) Lista wolontariuszy do rozliczenia"
call_get "/api/rozliczenia/listawolontariuszy"

echo "\n3) Szczegóły wolontariusza (id=$VOL_ID)"
call_get "/api/rozliczenia/wolontariusz/$VOL_ID"

echo "\n4) Statystyki: podsumowanie"
call_get "/api/statystyki/podsumowanie"

echo "\n5) Statystyki: liczący"
call_get "/api/statystyki/liczacy"

echo "\n6) Statystyki: wolontariusz"
call_get "/api/statystyki/wolontariusz"

echo "\n7) Próbne rozliczenie wolontariusza (POST)"
# Przykładowe dane rozliczenia — dostosuj jeśli potrzeba
json='{"terminal":0,"kwotaZTerminala":0,"m1gr":0,"m2gr":5,"m5gr":0,"m10gr":0,"m20gr":0,"m50gr":0,"m1zl":1,"m2zl":0,"m5zl":0,"b10zl":0,"b20zl":0,"b50zl":0,"b100zl":0,"b200zl":0,"b500zl":5,"walutaObca":"BRAK","daryInne":"BRAK","uwagiLiczacych":"BRAK","uwagiWolontariusza":"BRAK","liczacy":["1"]}'
call_post "/api/rozliczenia/wolontariusz/$VOL_ID" "$json"

echo "\n8) Wylogowanie (unieważnienie tokenu)"
resp=$(curl -s -w "\n%{http_code}" -X POST -H "token: $TOKEN" "$BASE_URL/api/logout")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
echo "Wylogowanie (HTTP $code):"
pretty "$body"

echo "\n9) Sprawdzenie użycia unieważnionego tokenu — oczekujemy 401"
resp=$(curl -s -w "\n%{http_code}" -H "token: $TOKEN" "$BASE_URL/api/rozliczenia/listawolontariuszy")
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)
echo "GET /api/rozliczenia/listawolontariuszy po logout (HTTP $code):"
pretty "$body"

echo "\nTest zakończony."