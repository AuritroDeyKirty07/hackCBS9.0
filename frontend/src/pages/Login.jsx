import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore.js';
import { Cpu, ShieldCheck, Zap } from 'lucide-react';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setName('Demo Provider');
    setEmail('demo@meshcompute.ai');
    setPassword('password123');
    try {
      await login('demo@meshcompute.ai', 'password123');
      navigate('/');
    } catch (err) {
      // If demo user doesn't exist yet, register it
      try {
        await register('Demo Provider', 'demo@meshcompute.ai', 'password123');
        navigate('/');
      } catch (regErr) {
        setError(regErr.response?.data?.error || 'Failed to authenticate demo user');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900/80 border border-gray-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-3">
            <Cpu className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Create an Account' : 'Welcome to MeshCompute'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {isRegister
              ? 'Lend compute or run large distributed jobs'
              : 'Log in to manage cluster workers and batch jobs'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-500/20"
          >
            {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign In'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gray-900 px-2 text-gray-500">Or For Judges & Demo</span>
          </div>
        </div>

        <button
          onClick={handleDemoLogin}
          type="button"
          className="w-full py-2.5 px-4 rounded-lg bg-gray-800/80 hover:bg-gray-800 border border-gray-700/80 text-gray-200 font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Quick 1-Click Demo Login</span>
        </button>

        <div className="mt-6 text-center text-xs text-gray-400">
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                className="text-blue-400 hover:underline font-medium"
              >
                Log In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                className="text-blue-400 hover:underline font-medium"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

