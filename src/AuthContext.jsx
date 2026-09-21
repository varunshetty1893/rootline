import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

/**
 * Authentication is now cookie-based (HttpOnly session cookie set by the
 * backend).  The JWT is never accessible to JavaScript.
 *
 * Auth state is simply the user profile object: if it is non-null the user is
 * considered logged in.  On mount we probe /auth/me — the browser sends the
 * cookie automatically if it exists.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  /** Called after a successful login or register response. */
  const login = (newUser) => {
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Cookie may already be invalid/expired — clear local state regardless.
    }
    setUser(null);
  };

  const updateProfile = async (payload) => {
    const updatedUser = await api.updateProfile(payload);
    setUser(updatedUser);
    return updatedUser;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
