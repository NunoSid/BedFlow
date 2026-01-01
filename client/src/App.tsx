import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { Dashboard } from './pages/Dashboard';
import { PlanningPage } from './pages/PlanningPage';
import { AuditPage } from './pages/AuditPage';
import { Login } from './pages/Login';
import { AdminPage } from './pages/AdminPage';
import { useTranslation } from 'react-i18next';

// Versão simplificada sem MUI Layout para isolar erros
export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/planeamento" element={<PlanningPage />} />
              <Route path="/auditorias" element={<AuditPage />} />
              <Route path="/administracao" element={<AdminPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

const ProtectedRoute = () => {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { settings } = useSettings();
  if (!user) return <Navigate to="/login" />;

  const handleLogout = () => {
    logout();
  };

  const roleLabel =
    user.role === 'ADMIN'
      ? t('roles.admin')
      : user.role === 'COORDINATOR'
        ? t('roles.coordinator')
        : t('roles.nurse');

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    localStorage.setItem('bedflow_lang', value);
  };

  const hospitalName = (settings.hospitalName || '').trim();

  return (
    <div style={{ minHeight: '100vh', background: '#f7fbff' }}>
      <header
        style={{
          background: '#eaf4ff',
          color: '#0b3d5c',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/logo.png"
            alt="BedFlow logo"
            style={{ height: 72 }}
            onError={(event) => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          {hospitalName ? (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{hospitalName}</div>
              <div style={{ fontSize: 14, opacity: 0.85 }}>{t('app.headerSubtitle')}</div>
            </div>
          ) : (
            <div style={{ fontSize: 14, opacity: 0.85 }}>{t('app.headerSubtitle')}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <select
            value={i18n.language}
            onChange={(event) => handleLanguageChange(event.target.value)}
            style={{
              borderRadius: 16,
              padding: '6px 12px',
              border: '1px solid #b9d7f0',
              fontWeight: 600,
              color: '#0b3d5c',
              background: '#ffffff',
            }}
          >
            <option value="pt">{t('language.pt')}</option>
            <option value="en">{t('language.en')}</option>
          </select>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{t('app.authenticatedUser')}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{user.fullName || user.username} · {roleLabel}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: '#ffffff',
              color: '#0b3d5c',
              border: '1px solid #b9d7f0',
              borderRadius: 24,
              padding: '8px 18px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('app.logout')}
          </button>
        </div>
      </header>
      <nav style={{ background: '#f4f9ff', padding: '8px 32px', display: 'flex', gap: 16 }}>
        <Link to="/" style={{ color: '#0b3d5c', fontWeight: 600, textDecoration: 'none' }}>{t('app.distribution')}</Link>
        <Link to="/planeamento" style={{ color: '#0b3d5c', fontWeight: 600, textDecoration: 'none' }}>{t('app.planning')}</Link>
        {(user.role === 'COORDINATOR' || user.role === 'ADMIN') && (
          <Link to="/auditorias" style={{ color: '#0b3d5c', fontWeight: 600, textDecoration: 'none' }}>{t('app.audits')}</Link>
        )}
        {(user.role === 'COORDINATOR' || user.role === 'ADMIN') && (
          <Link to="/administracao" style={{ color: '#0b3d5c', fontWeight: 600, textDecoration: 'none' }}>{t('app.administration')}</Link>
        )}
      </nav>
      <main style={{ padding: '24px 32px' }}>
        <Outlet />
      </main>
    </div>
  );
};
