// src/components/Auth.tsx
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeContext } from '../../contexts/ThemeContext';
import { LogIn, UserPlus, Sun, Moon, Loader2 } from 'lucide-react';

export function Auth() {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [role, setRole] = React.useState<'admin' | 'student' | 'teacher'>('student');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = React.useContext(ThemeContext);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, fullName, role);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300">

      {/* Theme Toggle Button (Top Right) */}
      <button
        onClick={toggleTheme}
        className="
          absolute top-5 right-5 p-2 rounded-full border shadow-sm transition-all
          bg-white border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-200
          dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-sky-400 dark:hover:border-sky-800
        "
        title="Toggle Theme"
      >
        {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Auth Card */}
      <div className="
        w-full max-w-md p-8 rounded-2xl shadow-xl border transition-all
        bg-white border-slate-200 shadow-slate-200/50
        dark:bg-slate-900 dark:border-slate-800 dark:shadow-slate-900/50
      ">
        <div className="text-center mb-8">
          <div className="
            inline-flex items-center justify-center w-16 h-16 rounded-full mb-4
            bg-sky-600 text-white shadow-lg shadow-sky-600/20
          ">
            {isSignUp ? <UserPlus className="w-8 h-8" /> : <LogIn className="w-8 h-8" />}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {isSignUp ? 'Sign up to get started' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="
                  w-full px-4 py-3 rounded-lg border outline-none transition
                  bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent
                  dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:focus:ring-sky-600
                "
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="
                w-full px-4 py-3 rounded-lg border outline-none transition
                bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent
                dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:focus:ring-sky-600
              "
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="
                w-full px-4 py-3 rounded-lg border outline-none transition
                bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent
                dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:focus:ring-sky-600
              "
              required
              minLength={6}
            />
          </div>

          {isSignUp && (
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'student' | 'teacher')}
                className="
                  w-full px-4 py-3 rounded-lg border outline-none transition appearance-none
                  bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent
                  dark:bg-slate-950 dark:border-slate-700 dark:text-white dark:focus:ring-sky-600
                "
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          {error && (
            <div className="
              p-3 rounded-lg text-sm border
              bg-rose-50 text-rose-700 border-rose-200
              dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900
            ">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3 rounded-lg font-semibold text-white transition shadow-md
              bg-sky-600 hover:bg-sky-500 
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
            "
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="
              text-sm font-medium transition
              text-sky-600 hover:text-sky-500
              dark:text-sky-400 dark:hover:text-sky-300
            "
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}