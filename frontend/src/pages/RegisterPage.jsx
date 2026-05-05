import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Mail, Lock, UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShow]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp }            = useAuth();
  const navigate              = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error: err } = await signUp(email, password);
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
  };

  const strengthScore = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 6 ? 1 : 0;
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'][strengthScore];
  const strengthColor = ['', 'var(--red)', 'var(--amber)', 'var(--emerald)'][strengthScore];

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '24px',
    }}>
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(183,148,244,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="text-center" style={{ marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(99,179,237,0.3)',
          }}>
            <Brain size={26} color="white" />
          </div>
          <h2 style={{ fontFamily: 'Outfit, sans-serif', marginBottom: 6 }}>Create account</h2>
          <p className="text-sm text-muted">Start analyzing your finances with AI</p>
        </div>

        <div className="card p-32">
          {success ? (
            <div className="text-center" style={{ padding: '16px 0' }}>
              <CheckCircle2 size={48} color="var(--emerald)" style={{ marginBottom: 16 }} />
              <h3 style={{ marginBottom: 8 }}>Check your email!</h3>
              <p className="text-sm text-muted" style={{ marginBottom: 24 }}>
                We've sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Click it to activate your account.
              </p>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/login')}>
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Email address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input id="reg-email" type="email" className="input" style={{ paddingLeft: 40 }} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input id="reg-password" type={showPass ? 'text' : 'password'} className="input" style={{ paddingLeft: 40, paddingRight: 44 }} placeholder="Min. 6 characters" value={password} onChange={e => setPass(e.target.value)} required autoComplete="new-password" />
                  <button type="button" onClick={() => setShow(p => !p)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= strengthScore ? strengthColor : 'var(--border-subtle)', transition: 'background 0.3s' }} />
                    ))}
                    <span style={{ fontSize: '0.72rem', color: strengthColor, minWidth: 40, textAlign: 'right' }}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Confirm password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input id="reg-confirm" type={showPass ? 'text' : 'password'} className="input" style={{ paddingLeft: 40, borderColor: confirm && confirm !== password ? 'var(--red)' : undefined }} placeholder="Re-enter password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
                </div>
              </div>

              {error && (
                <div className="alert alert-danger">
                  <AlertCircle size={15} />
                  <span style={{ fontSize: '0.82rem' }}>{error}</span>
                </div>
              )}

              <button id="btn-register-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: 4 }}>
                {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <UserPlus size={16} />}
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}

          {!success && (
            <>
              <div className="divider" style={{ margin: '24px 0' }} />
              <p className="text-sm text-center text-muted">
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
