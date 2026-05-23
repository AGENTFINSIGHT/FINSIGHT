import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Brain, Zap, BarChart3, Shield, MessageSquare, LayoutDashboard, LogOut, User, AlertCircle, FolderOpen, Menu, X, Sun, Moon } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BatchProvider } from './contexts/BatchContext';
import ProtectedRoute from './components/ProtectedRoute';
import UploadZone from './components/UploadZone';
import ProcessingScreen from './components/ProcessingScreen';
import ResultsDashboard from './components/ResultsDashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AnalysisPage from './pages/AnalysisPage';
import BatchUploadPage from './pages/BatchUploadPage';
import { analyzeText, analyzeImage } from './utils/apiClient';
import './index.css';

function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('finsight-theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('finsight-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const handleSignOut = async () => { await signOut(); navigate('/login'); setMenuOpen(false); };

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Logo */}
        <Link to="/" className="header-logo" onClick={() => setMenuOpen(false)}>
          <div className="header-logo-icon">
            <Brain size={18} color="white" />
          </div>
          <div>
            <span className="header-brand">FinSight AI</span>
            <span className="header-sub">Powered by OpenRouter</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="header-nav-desktop">
          {user ? (
            <>
              <Link to="/batch" className="btn btn-ghost btn-sm"><FolderOpen size={13} /> Batch</Link>
              <Link to="/dashboard" className="btn btn-ghost btn-sm"><LayoutDashboard size={13} /> Dashboard</Link>
              <div className="header-user-pill">
                <User size={12} color="var(--blue)" />
                <span className="header-email">{user.email}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={handleSignOut} id="btn-signout"><LogOut size={13} /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
          <div className="ai-status-dot">
            <div className="dot-green" />
            <span>AI Online</span>
          </div>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown nav */}
      {menuOpen && (
        <div className="mobile-nav">
          {user ? (
            <>
              <div className="mobile-nav-user">
                <User size={13} color="var(--blue)" />
                <span>{user.email}</span>
              </div>
              <Link to="/batch" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                <FolderOpen size={15} /> Batch Upload
              </Link>
              <Link to="/dashboard" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <button className="mobile-nav-link mobile-nav-danger" onClick={handleSignOut}>
                <LogOut size={15} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>Sign In</Link>
              <Link to="/register" className="mobile-nav-link mobile-nav-primary" onClick={() => setMenuOpen(false)}>Get Started</Link>
            </>
          )}
          <div className="mobile-nav-status">
            <div className="dot-green" />
            <span>AI Online</span>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{ marginLeft: 'auto' }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      )}
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
    <main className="container home-main">
      {stage === 'home' && (
        <div>
          <div className="home-hero animate-fade-up">
            <div className="home-badge">
              <Zap size={12} color="var(--blue)" />
              <span>Powered by Google Gemini 1.5 Flash</span>
            </div>
            <h1>Your AI <span className="gradient-text">Financial Analyst</span></h1>
            <p className="home-desc">Upload a PDF, drop a photo snapshot, or paste OCR text. Get instant spending analysis, charts, and advice — saved to your history.</p>
            <div className="home-chips">
              {[[BarChart3, 'Spending Charts'], [Shield, 'Categorization'], [MessageSquare, 'AI Chat'], [LayoutDashboard, 'Dashboard']].map(([Icon, t]) => (
                <div key={t} className="home-chip">
                  <Icon size={12} color="var(--blue)" /> {t}
                </div>
              ))}
            </div>
          </div>

          <div className="card home-upload-card">
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

          <div className="home-trust">
            {['100% Secure', 'Gemini Vision OCR', 'Multi-Currency', 'Private History'].map(t => (
              <span key={t} className="home-trust-item"><Shield size={11} color="var(--emerald)" /> {t}</span>
            ))}
          </div>
        </div>
      )}

      {stage === 'processing' && <div className="card p-32 processing-wrap"><ProcessingScreen /></div>}
      {stage === 'results' && result && <ResultsDashboard data={result} onReset={() => { setStage('home'); setResult(null); }} saved />}

      {stage === 'error' && (
        <div className="card p-32 error-wrap">
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
        <BatchProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<><Header /><HomePage /></>} />
            <Route path="/dashboard" element={<ProtectedRoute><Header /><DashboardPage /></ProtectedRoute>} />
            <Route path="/history" element={<Navigate to="/dashboard" replace />} />
            <Route path="/analysis/:id" element={<ProtectedRoute><Header /><AnalysisPage /></ProtectedRoute>} />
            <Route path="/batch" element={<ProtectedRoute><Header /><BatchUploadPage /></ProtectedRoute>} />
          </Routes>
        </BatchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
