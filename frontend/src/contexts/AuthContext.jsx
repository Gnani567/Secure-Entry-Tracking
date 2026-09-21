import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, getMe, setToken, clearToken, getToken } from "@/lib/api";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(!!getToken());

  // FIX: listen for auth:expired events dispatched by apiFetch on 401
  // so any request from any page auto-logs the user out cleanly.
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  // On mount, restore session from stored token
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getMe()
      .then((me) => setUser(me))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []); // run once on mount only

  const login = useCallback(async ({ userId, password, role }) => {
    const response = await apiLogin({ userId, password, role });
    if (!response.token) throw new Error("No token returned from server");
    setToken(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
