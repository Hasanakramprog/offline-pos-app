import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Eye, EyeOff, LogIn } from 'lucide-react';
import { loginUser } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = useAuthStore(s => s.login);
  const { settings } = useSettingsStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginUser(username.trim(), password);
      login(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pos-bg p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-pos-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pos-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-sm animate-page-enter">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-pos-primary mb-4 shadow-lg shadow-pos-primary/30">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold capitalize">{settings.store_name}</h1>
          <p className="text-pos-muted mt-1 text-sm">Point of Sale System</p>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-2xl">
          <h2 className="text-lg font-semibold mb-5">Sign in to your account</h2>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-pos-danger/10 border border-pos-danger/30 rounded-lg text-sm text-pos-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-pos-muted block mb-1">Username</label>
              <input
                className="input"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-pos-muted block mb-1">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pos-muted hover:text-pos-text"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : <LogIn size={18} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-pos-muted">
            Default: <span className="font-mono text-pos-text">admin</span> / <span className="font-mono text-pos-text">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
};
