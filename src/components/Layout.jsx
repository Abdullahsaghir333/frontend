import { useContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { AuthContext } from '../context/AuthContext';

export default function Layout() {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';

  if (isAuthRoute) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', margin: 0, padding: 0 }}>
        <Outlet />
      </div>
    );
  }

  // Unified global wrapper with Navbar
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', position: 'relative' }}>
      <Navbar />
      
      <main style={{ flex: 1, width: '100%', paddingTop: 56, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}