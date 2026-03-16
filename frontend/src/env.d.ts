/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_SIMULATOR?: string;
  readonly VITE_PROVIDER_E4M_CLIENT_SECRET?: string;
  readonly VITE_PROVIDER_FACTOR_CLIENT_SECRET?: string;
  readonly VITE_PROVIDER_TASOWHEEL_CLIENT_SECRET?: string;
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_KEYCLOAK_REALM?: string;
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
