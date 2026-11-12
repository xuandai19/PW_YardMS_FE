import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../services/api';

type User = { username: string; roles: string[]; permissions: string[] };
type Ctx = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (p: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem(ACCESS_TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('yms_user') || 'null');
      return saved ? { ...saved, permissions: saved.permissions ?? [] } : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (!token) return;
    void api.get('/auth/me').then(({ data }) => {
      const authorities: string[] = data.data.authorities ?? [];
      const currentUser = {
        username: data.data.username,
        roles: authorities.filter(value => value.startsWith('ROLE_')).map(value => value.slice(5)),
        permissions: authorities.filter(value => !value.startsWith('ROLE_')),
      };
      localStorage.setItem('yms_user', JSON.stringify(currentUser));
      setUser(currentUser);
    }).catch(() => undefined);
  }, [token]);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    try { if (refresh) await api.post('/auth/logout', { refreshToken: refresh }); } catch { /* ignore logout network errors */ }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('yms_user');
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (payload: { username: string; password: string }) => {
    const { data } = await api.post('/auth/login', payload);
    const result = data.data;
    localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    const currentUser = {
      username: result.username,
      roles: result.roles,
      permissions: result.permissions ?? [],
    };
    localStorage.setItem('yms_user', JSON.stringify(currentUser));
    setToken(result.accessToken);
    setUser(currentUser);
  }, []);

  const value = useMemo(() => ({ token, user, isAuthenticated: !!token, login, logout }),
    [token, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth outside provider');
  return context;
}
