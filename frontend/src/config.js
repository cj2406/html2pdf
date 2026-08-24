// Vite exposes env vars prefixed with VITE_ on import.meta.env.
// Set VITE_API_BASE_URL in frontend/.env (see .env.example) to point this
// at your backend deployment. Falls back to the docker-compose default.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
