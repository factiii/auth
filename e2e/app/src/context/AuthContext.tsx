import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import { trpc, service, getErrorMessage } from '../trpc';
import type { AppRouter } from '../../../server/trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type LoginResult = RouterOutputs['auth']['login'];

interface User {
  id: number;
  email: string;
  username: string;
  twoFaEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string, code?: string) => Promise<LoginResult>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function hasAccessToken(): boolean {
  return document.cookie.includes('auth-token=');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializeUser = (userData: { id: number; email: string; username: string; twoFaEnabled?: boolean }) => {
    setUser({
      id: userData.id,
      email: userData.email,
      username: userData.username,
      twoFaEnabled: userData.twoFaEnabled ?? false,
    });
  };

  useEffect(() => {
    if (!hasAccessToken()) {
      setIsLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const result = await trpc.me.query();
        if (result.user) {
          initializeUser(result.user);
        }
      } catch {
        // Not authenticated
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string, code?: string) => {
    const result = await trpc.auth.login.mutate({ username, password, code });
    if (result.success) {
      const { user } = await trpc.me.query();
      if (user) initializeUser(user);
    }
    return result;
  };

  const signup = async (username: string, email: string, password: string) => {
    const result = await trpc.auth.register.mutate({ username, email, password });
    if (result.success) {
      initializeUser(result.user);
    }
  };

  const logout = async () => {
    try {
      await trpc.auth.logout.mutate();
    } finally {
      service.clearTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, setUser }}>
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

export { getErrorMessage };
