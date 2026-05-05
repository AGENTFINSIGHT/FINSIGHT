import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze.js';
import historyRouter from './routes/history.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
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

