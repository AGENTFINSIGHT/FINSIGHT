import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Brain, Zap, BarChart3, Shield, MessageSquare, Clock, LogOut, User, AlertCircle, FolderOpen } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import UploadZone from './components/UploadZone';
import ProcessingScreen from './components/ProcessingScreen';
import ResultsDashboard from './components/ResultsDashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HistoryPage from './pages/HistoryPage';
import AnalysisPage from './pages/AnalysisPage';
import BatchUploadPage from './pages/BatchUploadPage';
import { analyzeText, analyzeImage } from './utils/apiClient';
import './index.css';

function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  return (
    <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-glass)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,179,237,0.3)' }}><Brain size={18} color="white" /></div>
          <div>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.1rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FinSight AI</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1, marginTop: 1 }}>Powered by OpenRouter</span>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <>
              <Link to="/batch" className="btn btn-ghost btn-sm"><FolderOpen size={14} /> Batch Upload</Link>
              <Link to="/history" className="btn btn-ghost btn-sm"><Clock size={14} /> History</Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <User size={13} color="var(--blue)" />
                <span className="text-xs text-muted" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleSignOut} id="btn-signout"><LogOut size={14} /></button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald)', boxShadow: '0 0 8px var(--emerald)' }} />
            <span className="text-xs text-muted">AI Online</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function HomePage() {
  const { user } = useAuth();
  const [stage, setStage] = useState('home');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (fn) => {
    setStage('processing'); setError('');
    try { const data = await fn(); setResult(data); setStage('results'); }
    catch (e) { setError(e.message || 'Analysis failed'); setStage('error'); }
  };

  return (
    <main className="container" style={{ padding: '48px 24px' }}>
      {stage === 'home' && (
        <div>
          <div className="text-center animate-fade-up" style={{ marginBottom: 56 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 99, background: 'var(--blue-glow)', border: '1px solid rgba(99,179,237,0.2)', marginBottom: 20 }}>
              <Zap size={12} color="var(--blue)" />
              <span style={{ fontSize: '0.78rem', color: 'var(--blue)', fontWeight: 600 }}>Powered by Google Gemini 1.5 Flash</span>
            </div>
            <h1 style={{ marginBottom: 16 }}>Your AI <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Financial Analyst</span></h1>
            <p style={{ fontSize: '1.05rem', maxWidth: 560, margin: '0 auto 32px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>Upload a PDF, drop a photo snapshot, or paste OCR text. Get instant spending analysis, charts, and advice — saved to your history.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[[BarChart3, 'Spending Charts'], [Shield, 'Smart Categorization'], [MessageSquare, 'AI Chatbot'], [Clock, 'Saved History']].map(([Icon, t]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 99, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Icon size={12} color="var(--blue)" /> {t}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-32" style={{ maxWidth: 720, margin: '0 auto' }}>
            <h3 style={{ marginBottom: 6 }}>Upload Bank Statement</h3>
            <p className="text-sm text-muted" style={{ marginBottom: 24 }}>PDF · Image snapshot (PNG/JPG/WEBP) · OCR paste · $ USD &amp; ₹ INR supported</p>
            <UploadZone
              onTextReady={(text, name, type) => run(() => analyzeText(text, name, type))}
              onImageReady={(file, name, type) => run(() => analyzeImage(file, name, type))}
              loading={stage === 'processing'}
            />
            {!user && (
              <div className="alert alert-info mt-24">
                <Shield size={14} />
                <span className="text-xs"><Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Sign in</Link> to save your analysis history and access it anytime.</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}>
            {['100% Secure', 'Gemini Vision OCR', 'Multi-Currency', 'Private History'].map(t => (
              <span key={t} className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={11} color="var(--emerald)" /> {t}</span>
            ))}
          </div>
        </div>
      )}

      {stage === 'processing' && <div className="card p-32" style={{ maxWidth: 560, margin: '0 auto' }}><ProcessingScreen /></div>}

      {stage === 'results' && result && <ResultsDashboard data={result} onReset={() => { setStage('home'); setResult(null); }} saved />}

      {stage === 'error' && (
        <div className="card p-32" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--red)" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Analysis Failed</h3>
          <p className="text-sm text-muted" style={{ marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => setStage('home')}>Try Again</button>
        </div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<><Header /><HomePage /></>} />
          <Route path="/history" element={<ProtectedRoute><Header /><HistoryPage /></ProtectedRoute>} />
          <Route path="/analysis/:id" element={<ProtectedRoute><Header /><AnalysisPage /></ProtectedRoute>} />
          <Route path="/batch" element={<ProtectedRoute><Header /><BatchUploadPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
