import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, endpoints, setUnauthorisedHandler, tokenStore, refreshStore } from '../lib/api.js';

/**
 * Auth state for the UI only.
 *
 * The role kept here decides what the interface *offers*; it decides nothing
 * about access. Every admin route is enforced server-side by requireRole, so
 * editing `role` in devtools reveals a menu item and nothing behind it.
 *
 * The API speaks UPPER_CASE roles (LEARNER/TRAINER/ADMIN); the interface uses
 * lowercase, so the user object is normalized once, here.
 */

const AuthContext = createContext(null);

/** Normalize the API user into the shape the interface renders. */
function normalizeUser(user) {
  if (!user) return null;
  return {
    ...user,
    role: String(user.role ?? 'learner').toLowerCase(),
    jobRole: user.jobRole ?? (user.designation ? { title: user.designation } : null),
  };
}

async function attachStreak(user) {
  try {
    const data = await api.get(endpoints.gamificationStreak);
    return { ...user, currentStreak: data?.streak?.currentStreak ?? 0 };
  } catch {
    return user;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready
  const [error, setError] = useState(null);

  const signOut = useCallback(() => {
    const refreshToken = refreshStore.get();
    if (refreshToken) {
      // Best effort: the session ends locally even if the API is unreachable.
      api.post(endpoints.logout, { refreshToken }).catch(() => {});
    }
    tokenStore.clear();
    refreshStore.clear();
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
      .then((payload) => normalizeUser(payload?.user ?? null))
      .then((normalized) => (normalized ? attachStreak(normalized) : null))
      .then((withStreak) => {
        if (live) setUser(withStreak);
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
      if (payload.accessToken) tokenStore.set(payload.accessToken);
      if (payload.refreshToken) refreshStore.set(payload.refreshToken);
      const normalized = normalizeUser(payload.user);
      const withStreak = normalized ? await attachStreak(normalized) : null;
      setUser(withStreak);
      return withStreak;
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
