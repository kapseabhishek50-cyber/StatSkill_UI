import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, endpoints, setUnauthorisedHandler, tokenStore } from '../lib/api.js';

/**
 * Auth state for the UI only.
 *
 * The role kept here decides what the interface *offers*; it decides nothing
 * about access. Every admin route is enforced server-side by requireRole, so
 * editing `role` in devtools reveals a menu item and nothing behind it.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready
  const [error, setError] = useState(null);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // A token in storage is a claim, not proof - verify it against the API before
  // trusting the role, since it may be expired or the account may be disabled.
  useEffect(() => {
    setUnauthorisedHandler(() => setUser(null));

    if (!tokenStore.get()) {
      setStatus('ready');
      return;
    }

    let live = true;
    api
      .get(endpoints.me)
      .then((payload) => {
        if (live) setUser(payload?.user ?? null);
      })
      .catch(() => {
        if (live) setUser(null);
      })
      .finally(() => {
        if (live) setStatus('ready');
      });

    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    try {
      const payload = await api.post(endpoints.login, { email, password });
      tokenStore.set(payload.token);
      setUser(payload.user);
      return payload.user;
    } catch (caught) {
      setError(caught.message);
      throw caught;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      error,
      signIn,
      signOut,
      isAdmin: user?.role === 'admin',
      isTrainer: user?.role === 'trainer',
    }),
    [user, status, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
