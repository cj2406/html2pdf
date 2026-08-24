FROM node:20-slim

# Install Chromium + the fonts/libs it needs to render HTML/CSS properly,
# plus openssl which Prisma's query engine needs on Debian slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    openssl \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

# Apply any pending migrations, then start the API.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
