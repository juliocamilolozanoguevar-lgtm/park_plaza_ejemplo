import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  async function refreshUser() {
    if (!getToken()) return null;
    try {
      const data = await api("/auth/me");
      const normalizedUser = normalizeUser(data.user);
      setUser(normalizedUser);
      return normalizedUser;
    } catch {
      clearToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) return;
    refreshUser();
  }, []);

  useEffect(() => {
    function refreshOnFocus() {
      if (document.visibilityState !== "hidden") refreshUser();
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  async function login(email, password) {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    const normalizedUser = normalizeUser(data.user);
    setUser(normalizedUser);
    return normalizedUser;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  function hasPermission(permission) {
    if (!permission) return true;
    if (user?.role === "ADMINISTRADOR") return true;
    return user?.permissions?.includes(permission);
  }

  function can(module, action = "VER") {
    return hasPermission(`${module}:${action}`);
  }

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser, hasPermission, can, isAuthenticated: Boolean(user) }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

function normalizeUser(user) {
  return {
    ...user,
    permissions: (user.permissions || []).map((permission) => {
      if (typeof permission === "string") return permission;
      return `${permission.module}:${permission.action}`;
    })
  };
}
