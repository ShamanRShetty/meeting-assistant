// components/LandingPage.js
import { ZapIcon, GoogleIcon } from './Icons';

export default function LandingPage({ onDemo, onGoogleLogin, authError }) {
  return (
    <div className="landing">
      <p className="landing-eyebrow">Meeting Intelligence</p>
      <h1 className="landing-title">Meri<span>dian</span></h1>
      <p className="landing-tagline">
        AI-powered briefs, transcription, action items, and ROI scoring — in one place.
      </p>

      <div className="landing-cards">
        <button className="auth-card demo" onClick={onDemo}>
          <div className="auth-card-badge">No login needed</div>
          <div className="auth-card-icon"><ZapIcon /></div>
          <div className="auth-card-title">Try Demo Mode</div>
          <div className="auth-card-desc">Full access instantly. Live AI processing via Gemini.</div>
        </button>

        <button className="auth-card google" onClick={onGoogleLogin}>
          <div className="auth-card-badge">Google OAuth</div>
          <div className="auth-card-icon"><GoogleIcon /></div>
          <div className="auth-card-title">Sign in with Google</div>
          <div className="auth-card-desc">Connect Calendar, Drive & Gmail for personalized intelligence.</div>
        </button>
      </div>

      {authError && (
        <div className="auth-error">
          <strong>Sign-in failed:</strong> {authError}<br />
          <span style={{ opacity: 0.75 }}>Try Demo Mode, or check your account is approved.</span>
        </div>
      )}

      <p className="auth-notice">
        ⚠ This app hasn't completed Google's verification. You may see a warning — click
        <strong> "Advanced" → "Go to Meridian (unsafe)"</strong> to proceed.
        Demo Mode gives full access with no login required.
      </p>
    </div>
  );
}