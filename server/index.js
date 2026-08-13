import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authRouter } from './routes/auth.js';
import { complaintsRouter } from './routes/complaints.js';
import { referenceRouter } from './routes/reference.js';
import { verificationRouter } from './routes/verification.js';
import { rateLimit } from './lib/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_DIST = path.resolve(__dirname, '..', 'client', 'dist');

export function createApp() {
  const app = express();

  // Body cap. Without one, an unauthenticated endpoint accepting JSON is a
  // trivial memory-exhaustion target; the largest legitimate submission here is
  // a few KB.
  app.use(express.json({ limit: '1mb' }));

  // In dev the Vite server on :5173 proxies /api here, so same-origin applies
  // and CORS is not strictly needed - it is enabled anyway so the API can be
  // exercised directly with curl or Postman during development. In production
  // the client is served from this same origin, so CORS stays off.
  if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
  }

  // Cheap liveness probe for the VPS process manager / reverse proxy.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Rate limits are registered BEFORE the routers they protect. Express matches
  // in order, so a limiter mounted after its router never runs.
  //
  // These are the three unauthenticated write paths, each capped per IP:
  // generous enough that a real filer never meets them, tight enough that a
  // script does. Tests disable this with DISABLE_RATE_LIMIT.
  if (process.env.DISABLE_RATE_LIMIT !== 'true') {
    app.post('/api/auth/login', rateLimit({ name: 'login', limit: 10, windowMs: 15 * 60 * 1000 }));
    app.use('/api/verification', rateLimit({ name: 'verify', limit: 20, windowMs: 15 * 60 * 1000 }));
    app.post('/api/complaints', rateLimit({ name: 'submit', limit: 10, windowMs: 60 * 60 * 1000 }));
  }

  app.use('/api/auth', authRouter);
  app.use('/api/reference', referenceRouter);
  app.use('/api/verification', verificationRouter);
  app.use('/api/complaints', complaintsRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Single-process production mode: if the client has been built, serve it from
  // here so a deployment is one node process behind a reverse proxy rather than
  // a separate static host.
  const hasBuiltClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
  if (hasBuiltClient) {
    app.use(express.static(CLIENT_DIST));
    // SPA fallback - client-side routes like /reviewer/complaints/3 must return
    // index.html rather than a 404 on hard refresh.
    app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  // Terminal error handler. Logs the stack for operators but never echoes it to
  // the caller, and never logs the request body - submissions contain names,
  // emails, and phone numbers that have no business in a log file.
  // eslint-disable-next-line no-unused-vars -- Express identifies this by arity
  app.use((err, req, res, _next) => {
    console.error(`[error] ${req.method} ${req.path}:`, err.message);
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body.' });
    }
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return { app, hasBuiltClient };
}

// Only listen when run directly, so the test suite can import `createApp`
// without binding a port.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app, hasBuiltClient } = createApp();
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(
      hasBuiltClient
        ? '[server] serving built client from client/dist'
        : '[server] API only - run the Vite dev server for the UI',
    );
  });
}
