# --- Build stage ---
FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Bake the API URL in at build time (Vite env vars are compiled into the
# bundle, not read at runtime). Override with --build-arg for other envs.
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# --- Serve stage ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
