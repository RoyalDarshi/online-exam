// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import fpPromise from '@fingerprintjs/fingerprintjs'; // <--- IMPORT THIS
import api from '../lib/api';

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'student' | 'teacher';
};

type AuthContextType = {
  user: User;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'admin' | 'student' | 'teacher') => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>({} as User);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // ----------------------- UPDATED SIGN IN -----------------------
  async function signIn(email: string, password: string) {
    try {
      // 1. Generate the Device Fingerprint
      const fp = await fpPromise.load();
      const result = await fp.get();
      const visitorId = result.visitorId;

      // 2. Send login request WITH fingerprint
      const response = await api.post('/auth/login', {
        email,
        password,
        fingerprint: visitorId // <--- Backend expects this now
      });

      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch (error: any) {
      // 3. Handle specific security lock errors
      if (error.response && error.response.status === 403) {
        const serverError = error.response.data;
        if (serverError.error === "exam_in_progress") {
          // Security Alert
          alert(`⚠️ Login Blocked: ${serverError.message}`);
        }
      }
      // Re-throw so your Login form can stop the loading spinner
      throw error;
    }
  }
  // ---------------------------------------------------------------

  async function signUp(email: string, password: string, fullName: string, role: 'admin' | 'student' | 'teacher') {
    await api.post('/auth/register', {
      email,
      password,
      full_name: fullName,
      role
    });
  }

  function signOut() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser({} as User);
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