import Keycloak from 'keycloak-js';

// Single Keycloak instance shared across the app. Configured via Vite env vars
// (see frontend/.env.example); falls back to local docker-compose defaults.
const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'streamapp',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'streamapp-frontend',
});

export default keycloak;
