import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => api.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('lakshi_auth') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('lakshi_auth', isAuthenticated ? 'true' : 'false');
  }, [isAuthenticated]);

  const login = async (username, password) => {
    const trimmedUser = (username || '').trim().toLowerCase();
    const trimmedPass = (password || '').trim();

    try {
      // Clear any prior cached data from previous sessions/groups
      localStorage.removeItem('lakshi_shg_data');

      // Connect to backend API to authenticate and register lastLoginAt
      const data = await api.login(trimmedUser, trimmedPass);
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true, user: data.user };
    } catch (err) {
      console.warn('[PWA Auth] Remote authentication failed:', err);

      // Offline-first fallback: allow access only if network is unavailable and offline session matches
      const isNetworkError =
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        err?.status === 0 ||
        !navigator.onLine;

      if (isNetworkError) {
        const cachedUser = api.getUser();
        if (cachedUser && cachedUser.username === trimmedUser) {
          api.setSession({
            accessToken: api.getToken() || 'offline-token',
            user: cachedUser,
          });
          setUser(cachedUser);
          setIsAuthenticated(true);
          return { success: true, user: cachedUser, isOffline: true };
        }

        return {
          success: false,
          error: 'Network connection failed. Please check internet connectivity.',
        };
      }

      return {
        success: false,
        error: err?.message || 'Invalid username or password',
      };
    }
  };

  const logout = async () => {
    await api.logout().catch(() => null);
    try {
      localStorage.removeItem('lakshi_shg_data');
      localStorage.removeItem('lakshi_auth');
    } catch (e) {
      // ignore
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
