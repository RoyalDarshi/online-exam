// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

// Define types (You can move these to a separate types file later)
export type User = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'student' | 'teacher';
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'student' | 'teacher') => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (Token exists)
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  async function signIn(email: string, password: string) {
    // Call Go Backend
    const response = await axios.post('http://localhost:8080/api/auth/login', {
      email,
      password
    });

    const { token, user } = response.data;

    // Save to LocalStorage
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
  }

  async function signUp(email: string, password: string, fullName: string, role: 'admin' | 'student' | 'teacher') {
    // Call Go Backend
    await axios.post('http://localhost:8080/api/auth/register', {
      email,
      password,
      full_name: fullName,
      role
    });
    // Optional: Automatically login after register, or ask user to login
  }

  function signOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}