import './lib/env.js';
import express from 'express';
import cors from 'cors';
import statsRouter from './routes/stats.js';
import customersRouter from './routes/customers.js';
import chatRouter from './routes/chat.js';
import feederRouter from './routes/feeder.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true }));
api.use('/stats', statsRouter);
api.use('/customers', customersRouter);
api.use('/chat', chatRouter);
api.use('/feeder', feederRouter);

app.use('/api', api);
app.use('/', api);

app.use((err, _req, res, _next) => {
  console.error('[api] error', err);
  res.status(500).json({ error: err.message || 'internal error' });
});

export default app;
