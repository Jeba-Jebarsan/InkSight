import React, { useState, useEffect } from 'react';
import { AppView } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onNavigate }) => {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // Check localStorage for token
    const checkToken = () => {
      const token = localStorage.getItem('replicate_api_token') || import.meta.env.VITE_REPLICATE_API_TOKEN;
      setHasToken(!!token);
    };

    checkToken();
    // Listen for storage changes
    window.addEventListener('storage', checkToken);
    // Also check periodically for same-tab updates
    const interval = setInterval(checkToken, 1000);

    return () => {
      window.removeEventListener('storage', checkToken);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNavigate(AppView.LANDING)}
        >
          <div className="w-8 h-8 bg-white text-black flex items-center justify-center rounded-sm font-bold rotate-12">
            IN
          </div>
          <span className="font-serif text-xl tracking-tight">InkSight</span>
        </div>

        <div className="flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => onNavigate(AppView.SIMULATOR)}
            className={`${activeView === AppView.SIMULATOR ? 'text-white' : 'text-zinc-500'} hover:text-white transition-colors`}
          >
            Simulator
          </button>

          <button
            onClick={() => onNavigate(AppView.GALLERY)}
            className={`${activeView === AppView.GALLERY ? 'text-white' : 'text-zinc-500'} hover:text-white transition-colors`}
          >
            Archive
          </button>

          <div className="h-4 w-px bg-zinc-800"></div>

          <a
            href="https://github.com/Jeba-Jebarsan/InkSight"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white transition-colors"
            title="View on GitHub"
          >
            <i className="fa-brands fa-github text-xl"></i>
          </a>

          {/* API Status Indicator */}
          <div className="h-4 w-px bg-zinc-800"></div>
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${hasToken ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className={hasToken ? 'text-zinc-500' : 'text-amber-400'}>
              {hasToken ? 'API Ready' : 'Add API Key'}
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-auto custom-scrollbar">
        {children}
      </main>

      <footer className="border-t border-white/5 py-8 px-6 text-center text-zinc-600 text-xs flex flex-col items-center gap-4">
        <p>&copy; 2024 InkSight AI. Visualization purposes only. Consult a professional artist.</p>

        <div className="flex gap-4">
          <a
            href="https://github.com/Jeba-Jebarsan/InkSight"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 hover:border-zinc-700 hover:text-white transition-all group"
          >
            <i className="fa-brands fa-github text-zinc-400 group-hover:text-white text-sm"></i>
            <span className="font-medium text-zinc-400 group-hover:text-white">Open Source</span>
          </a>

          <a
            href="https://x.com/Thomas_jebarsan"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 hover:border-zinc-700 hover:text-white transition-all group"
          >
            <i className="fa-brands fa-x-twitter text-zinc-400 group-hover:text-white text-sm"></i>
            <span className="text-zinc-500 group-hover:text-zinc-300">Made by</span>
            <span className="font-bold text-zinc-300 group-hover:text-white">Jebarsan</span>
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
