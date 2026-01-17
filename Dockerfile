FROM node:20-alpine

# Utwórz katalog aplikacji
WORKDIR /app

# Skopiuj pliki package.json i package-lock.json
COPY package*.json ./

# Zainstaluj zależności
RUN npm install --production

# Skopiuj resztę aplikacji
COPY . .

# Utwórz katalogi dla uploadu i bazy danych
RUN mkdir -p /app/uploads && \
    chmod 777 /app/uploads

# Port na którym działa aplikacja
EXPOSE 3001

# Uruchom inicjalizację bazy danych i aplikację
CMD ["sh", "-c", "node init_db.cjs && node index.mjs"]
