import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';
import historyRouter from './routes/history.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// Build allowed origins list: always allow localhost for local dev,
// plus any production URLs set in FRONTEND_URL (comma-separated).
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173', // vite preview
  ...( process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
    : [] )
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, etc.)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/analyze', analyzeRouter);
app.use('/api/history', historyRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, () =>
  console.log(`✅ FinSight API running on http://localhost:${PORT}`)
);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`   Run: netstat -ano | findstr :${PORT}  then taskkill /PID <PID> /F`);
    process.exit(1);
  } else { throw err; }
});

process.on('SIGTERM', () => { server.close(() => process.exit(0)); });

