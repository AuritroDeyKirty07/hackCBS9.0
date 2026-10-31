import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore.js';
import { Cpu, Server, PlusCircle, History, LogOut, Activity } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: Activity },
    { to: '/workers', label: 'Workers', icon: Server },
    { to: '/jobs/new', label: 'New Job', icon: PlusCircle },
    { to: '/history', label: 'History', icon: History },
  ];

  return (
    <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              MeshCompute
            </span>
            <span className="ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              AI
            </span>
          </div>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}

            <div className="h-5 w-px bg-gray-800 mx-2" />

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden md:inline">
                {user.email}
              </span>
              <button
                onClick={logout}
                title="Logout"
                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </nav>
        ) : (
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
