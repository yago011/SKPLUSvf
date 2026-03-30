import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sk_token');
    const savedUser = localStorage.getItem('sk_user');
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { localStorage.clear(); }
    }
    setLoading(false);
  }, []);

  const login = async (email, senha) => {
    const { data } = await api.post('/api/auth/login', { email, senha });
    localStorage.setItem('sk_token', data.token);
    localStorage.setItem('sk_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('sk_token');
    localStorage.removeItem('sk_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
