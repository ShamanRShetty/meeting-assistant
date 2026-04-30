// components/Header.js
import { LogOutIcon, GoogleIcon } from './Icons';

export default function Header({ isDemo, onSignOut, onSignIn }) {
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

      {!isDemo ? (
        <button className="btn" onClick={onSignOut} style={{ alignSelf: 'flex-start' }}>
          <LogOutIcon /> Sign out
        </button>
      ) : (
        <button className="btn" onClick={onSignIn} style={{ alignSelf: 'flex-start' }}>
          <GoogleIcon /> Sign in
        </button>
      )}
    </header>
  );
}