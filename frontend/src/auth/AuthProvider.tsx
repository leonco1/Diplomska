import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import keycloak from './keycloak';

interface AuthContextValue {
  authenticated: boolean;
  username: string;
  roles: string[];
  hasRole: (role: string) => boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Guards against double-init under React 18 StrictMode (effect runs twice in dev).
let initStarted = false;

/**
 * Initializes Keycloak once on mount and renders children only after the auth
 * state is known. With `onLoad: 'login-required'` the user is redirected to the
 * Keycloak login page if they don't already have a session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (initStarted) return;
    initStarted = true;

    keycloak
      .init({
        onLoad: 'login-required',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .then((auth) => {
        setAuthenticated(auth);
        setReady(true);
      })
      .catch(() => {
        // If Keycloak is unreachable, fail open into an unauthenticated state
        // so the app still renders (API calls will then 401).
        setReady(true);
      });

    // Proactively refresh the token a bit before it expires.
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.login());
    };
  }, []);

  if (!ready) {
    return (
      <p className="muted" style={{ padding: '2rem' }}>
        Signing in…
      </p>
    );
  }

  const roles = keycloak.tokenParsed?.realm_access?.roles ?? [];
  const value: AuthContextValue = {
    authenticated,
    username:
      (keycloak.tokenParsed?.preferred_username as string) ??
      (keycloak.tokenParsed?.email as string) ??
      '',
    roles,
    hasRole: (role) => roles.includes(role),
    login: () => keycloak.login(),
    logout: () => keycloak.logout({ redirectUri: window.location.origin }),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
