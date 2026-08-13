import { Router } from 'express';
import { requestCode, verifyCode } from '../lib/verification.js';
import { blankToNull } from '../lib/validation.js';

export const verificationRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/verification/request  { email }
verificationRouter.post('/request', (req, res) => {
  const email = blankToNull(req.body?.email);
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ errors: { email: 'Enter a valid email address.' } });
  }

  const result = requestCode(email);
  if (!result.ok && result.reason === 'cooldown') {
    return res
      .status(429)
      .json({ error: `Please wait ${result.retryAfter}s before requesting another code.` });
  }

  res.json({
    sent: true,
    expiresInSeconds: result.expiresInSeconds,
    // Present in dev only, so the UI can show the code without a mail server.
    devCode: result.devCode,
  });
});

// POST /api/verification/verify  { email, code }
verificationRouter.post('/verify', (req, res) => {
  const email = blankToNull(req.body?.email);
  const code = blankToNull(req.body?.code);
  if (!email || !code) {
    return res.status(400).json({ errors: { code: 'Enter the 6-digit code sent to your email.' } });
  }

  const result = verifyCode(email, code);
  if (result.ok) {
    return res.json({ verified: true, token: result.token, email: result.email });
  }

  if (result.reason === 'too_many_attempts') {
    return res
      .status(429)
      .json({ error: 'Too many incorrect attempts. Request a new code to continue.' });
  }

  const remaining = result.attemptsRemaining;
  return res.status(400).json({
    errors: {
      code:
        remaining > 0
          ? `That code is not valid. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'That code is not valid or has expired.',
    },
  });
});
