import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, isLoggedIn as checkLoggedInCookie } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(checkLoggedInCookie());
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(checkLoggedInCookie());

  const refresh = useCallback(async () => {
    if (!checkLoggedInCookie()) {
      setLoggedIn(false);
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.me();
      setUser(data.user);
      setSubscription(data.subscription);
      setApiKeys(data.apiKeys);
      setLoggedIn(true);
    } catch {
      setLoggedIn(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setLoggedIn(false);
      setUser(null);
      setSubscription(null);
      setApiKeys([]);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ loggedIn, user, subscription, apiKeys, loading, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
