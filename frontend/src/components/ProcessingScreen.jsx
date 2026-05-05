export default function ProcessingScreen() {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ minHeight: 320, gap: 24 }}
    >
      {/* Animated rings */}
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div
          style={{
            position: 'absolute', inset: 0,
            border: '3px solid var(--border-subtle)',
            borderTop: '3px solid var(--blue)',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 10,
            border: '2px solid var(--border-subtle)',
            borderBottom: '2px solid var(--purple)',
            borderRadius: '50%',
            animation: 'spin 1.4s linear infinite reverse',
          }}
        />
        <div
          style={{
            position: 'absolute', inset: 20,
            border: '2px solid var(--border-subtle)',
            borderLeft: '2px solid var(--emerald)',
            borderRadius: '50%',
            animation: 'spin 1.8s linear infinite',
          }}
        />
      </div>
      <div className="text-center">
        <p style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: 8 }}>
          Analyzing your statement…
        </p>
        <p className="text-sm text-muted">Gemini AI is extracting, categorizing, and generating insights</p>
      </div>
      {/* Animated steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', minWidth: 240 }}>
        {['Parsing transactions', 'Categorizing expenses', 'Detecting patterns', 'Generating insights'].map((step, i) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--blue)',
              animation: `pulse-glow 1.2s ease-in-out ${i * 0.3}s infinite`,
            }} />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
