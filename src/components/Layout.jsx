import { useContext } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, BookOpen, UploadCloud, RefreshCcw } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // All pages with their own sidebar — bypass Layout chrome entirely
  const fullBleedRoutes = [
    '/login', '/signup',
    '/dashboard', '/upload', '/sessions', '/notes', '/settings',
  ];

  // Also match dynamic session routes like /session/abc123
  const isFullBleed =
    fullBleedRoutes.includes(location.pathname) ||
    location.pathname.startsWith('/session/');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (isFullBleed) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', margin: 0, padding: 0 }}>
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 h-20 bg-slate-900/40 backdrop-blur-2xl border-b border-indigo-500/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] flex items-center justify-between px-6 lg:px-12 transition-all">

        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-[0_0_15px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.6)] transition-all duration-300 transform group-hover:scale-105">
            <img src="/logo1.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tight">Acadomi</h1>
            <span className="text-xs font-medium text-indigo-200/60 uppercase tracking-widest mt-0.5">AI Learning</span>
          </div>
        </div>

        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/40 p-1.5 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
            <NavLink to="/upload" className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <UploadCloud size={16} /> Upload
            </NavLink>
            <NavLink to="/notes" className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <BookOpen size={16} /> Notes
            </NavLink>
            <NavLink to="/role-reversal" className={({ isActive }) => `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <RefreshCcw size={16} /> Reversal
            </NavLink>
          </nav>
        )}

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold shadow-lg">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm font-medium text-slate-200">{user.name}</span>
              </div>
              <div className="h-6 w-px bg-slate-700"></div>
              <button className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-red-400 transition-colors" onClick={handleLogout}>
                <LogOut size={16} /> <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white transition-colors" onClick={() => navigate('/login')}>Log In</button>
              <button className="btn-primary py-2.5 !text-sm" onClick={() => navigate('/signup')}>Sign Up</button>
            </div>
          )}
        </div>
      </header>

      <div className="h-20 w-full shrink-0"></div>

      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col items-center px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <Outlet />
      </main>
    </div>
  );
}