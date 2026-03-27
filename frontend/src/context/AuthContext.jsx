import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('idToken');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ email: payload.email || payload['cognito:username'] });
      } catch {
        localStorage.removeItem('idToken');
      }
    }
    setLoading(false);
  }, []);

  const saveTokens = (tokens) => {
    const idToken = tokens.IdToken || tokens.idToken;
    const accessToken = tokens.AccessToken || tokens.accessToken;
    const refreshToken = tokens.RefreshToken || tokens.refreshToken;
    localStorage.setItem('idToken', idToken);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    setUser({ email: payload.email || payload['cognito:username'] });
  };

  const logout = () => {
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, saveTokens, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true });
  }, [user, loading, navigate]);

  if (loading) return <div className="flex items-center justify-center h-screen">로딩 중...</div>;
  if (!user) return null;
  return children;
}
