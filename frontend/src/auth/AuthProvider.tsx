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

let initStarted = false;

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
        setReady(true);
      });

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.login());
    };
  }, []);

  if (!ready) {
    return <p className="p-8 text-yt-gray">Signing in…</p>;
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
