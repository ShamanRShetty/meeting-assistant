import { LogOutIcon, GoogleIcon, SunIcon, MoonIcon } from './Icons';

export default function Header({ isDemo, onSignOut, onSignIn, theme, toggleTheme }) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <p className="app-header-eyebrow">Meeting Intelligence</p>
        <h1 className="app-header-title">Meri<span>dian</span></h1>
        <p className="app-header-sub">
          {isDemo
            ? 'Demo Mode — AI features live · Google integrations use demo data'
            : 'Capture · Analyse · Act on every meeting'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'flex-start' }}>
        <button className="btn" onClick={toggleTheme} title="Toggle Theme" style={{ padding: '8px' }}>
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>

        {!isDemo ? (
          <button className="btn" onClick={onSignOut}>
            <LogOutIcon /> Sign out
          </button>
        ) : (
          <button className="btn" onClick={onSignIn}>
            <GoogleIcon /> Sign in
          </button>
        )}
      </div>
    </header>
  );
}