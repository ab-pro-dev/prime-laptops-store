import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import tokenStore from '../utils/tokenStore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('admin_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = tokenStore.get();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (data.user?.role !== 'admin') {
          tokenStore.clear();
          setUser(null);
        } else {
          setUser(data.user);
          localStorage.setItem('admin_user', JSON.stringify(data.user));
        }
      } catch {
        tokenStore.clear();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.user?.role !== 'admin') {
      tokenStore.clear();
      throw new Error('Access denied. Administrator privileges required.');
    }
    tokenStore.set(data.token);
    setUser(data.user);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    } finally {
      tokenStore.clear();
      setUser(null);
      window.location.href = '/login';
    }
  };

  const updateUser = (updated) => {
    setUser(updated);
    localStorage.setItem('admin_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
