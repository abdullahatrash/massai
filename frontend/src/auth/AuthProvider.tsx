import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import keycloak from "./keycloak";
import { setAccessTokenProvider } from "../api/client";

// Module-level flag: persists across React StrictMode's mount→unmount→remount cycle.
// keycloak-js throws if init() is called more than once on the same instance.
let keycloakInitStarted = false;

type AuthUser = {
  email: string | null;
  name: string | null;
  roles: string[];
  contractIds: string[];
};

type AuthContextValue = {
  error: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  token: string | null;
  user: AuthUser | null;
};

type AuthState = Omit<AuthContextValue, "login" | "logout">;

const AuthContext = createContext<AuthContextValue | null>(null);

function deriveUser(): AuthUser | null {
  const parsedToken = keycloak.tokenParsed;
  if (!parsedToken) {
    return null;
  }

  const realmAccess = parsedToken.realm_access;
  const roles =
    realmAccess && typeof realmAccess === "object" && Array.isArray(realmAccess.roles)
      ? realmAccess.roles.map((role) => String(role))
      : [];

  const contractIds = Array.isArray(parsedToken.contract_ids)
    ? parsedToken.contract_ids.map((contractId) => String(contractId))
    : [];

  return {
    email: typeof parsedToken.email === "string" ? parsedToken.email : null,
    name:
      typeof parsedToken.name === "string"
        ? parsedToken.name
        : typeof parsedToken.preferred_username === "string"
          ? parsedToken.preferred_username
          : null,
    roles,
    contractIds,
  };
}

function syncTokenProvider(token: string | null): void {
  setAccessTokenProvider(() => token);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    error: null,
    isAuthenticated: false,
    isReady: false,
    token: null,
    user: null,
  });

  useEffect(() => {
    let isMounted = true;

    const applyState = (nextState: AuthState) => {
      if (!isMounted) {
        return;
      }
      syncTokenProvider(nextState.token);
      startTransition(() => {
        setState(nextState);
      });
    };

    const syncFromKeycloak = () => {
      applyState({
        error: null,
        isAuthenticated: Boolean(keycloak.authenticated),
        isReady: true,
        token: keycloak.token ?? null,
        user: deriveUser(),
      });
    };

    const handleFailure = (message: string) => {
      applyState({
        error: message,
        isAuthenticated: false,
        isReady: true,
        token: null,
        user: null,
      });
    };

    keycloak.onAuthSuccess = syncFromKeycloak;
    keycloak.onAuthLogout = syncFromKeycloak;
    keycloak.onAuthRefreshSuccess = syncFromKeycloak;
    keycloak.onAuthRefreshError = () => {
      void keycloak.login({ redirectUri: window.location.href });
    };
    keycloak.onTokenExpired = () => {
      void keycloak.updateToken(30).catch(() => {
        void keycloak.login({ redirectUri: window.location.href });
      });
    };

    if (keycloakInitStarted) {
      // StrictMode second mount: Keycloak already initialised — just sync current state.
      syncFromKeycloak();
    } else {
      keycloakInitStarted = true;
      void keycloak
        .init({
          checkLoginIframe: false,
          onLoad: "check-sso",
          pkceMethod: "S256",
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        })
        .then(syncFromKeycloak)
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : "Unable to initialize Keycloak.";
          handleFailure(message);
        });
    }

    const refreshHandle = window.setInterval(() => {
      if (!keycloak.authenticated) {
        return;
      }

      void keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) {
          syncFromKeycloak();
        }
      });
    }, 20_000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshHandle);
      syncTokenProvider(null);
      keycloak.onAuthSuccess = undefined;
      keycloak.onAuthLogout = undefined;
      keycloak.onAuthRefreshSuccess = undefined;
      keycloak.onAuthRefreshError = undefined;
      keycloak.onTokenExpired = undefined;
    };
  }, []);

  const login = async () => {
    await keycloak.login({ redirectUri: window.location.href });
  };

  const logout = async () => {
    syncTokenProvider(null);
    await keycloak.logout({ redirectUri: `${window.location.origin}/` });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
