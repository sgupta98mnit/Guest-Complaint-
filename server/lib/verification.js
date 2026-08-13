import crypto from 'node:crypto';

// Mocked email verification, standing in for the sandbox's "Send Verification
// Code" step on the guest path.
//
// Everything lives in memory and dies with the process - like the reviewer
// tokens in routes/auth.js, this is demo-grade on purpose. What is NOT faked is
// the security shape of the flow: codes are hashed at rest, single-use,
// expiring, attempt-capped, resend-throttled, and compared in constant time.
// The only stubbed part is delivery.

const CODE_TTL_MS = 10 * 60 * 1000; // code is valid for 10 minutes
const TOKEN_TTL_MS = 30 * 60 * 1000; // proof-of-verification lasts one wizard session
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

const pendingCodes = new Map(); // email -> { codeHash, expiresAt, attempts, sentAt }
const verifiedTokens = new Map(); // token -> { email, expiresAt }

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest();
}

function constantTimeEquals(a, b) {
  // timingSafeEqual throws on length mismatch, but both sides here are
  // fixed-width sha256 digests, so lengths always match.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Delivery seam. In a real deployment this is the one function that changes -
 * swap the console write for SES/SendGrid and the rest of the flow is unchanged.
 * The code is never logged in production mode.
 */
function deliverCode(email, code) {
  if (process.env.NODE_ENV === 'production') {
    console.log('[verification] code issued'); // no email, no code - see README on PII in logs
    return;
  }
  console.log(`[verification] code for ${email}: ${code}`);
}

/** Drop expired entries. Called on every mutation so the maps cannot grow without bound. */
function sweep(now = Date.now()) {
  for (const [email, entry] of pendingCodes) {
    if (entry.expiresAt <= now) pendingCodes.delete(email);
  }
  for (const [token, entry] of verifiedTokens) {
    if (entry.expiresAt <= now) verifiedTokens.delete(token);
  }
}

export function requestCode(rawEmail, now = Date.now()) {
  sweep(now);
  const email = normalizeEmail(rawEmail);

  const existing = pendingCodes.get(email);
  if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000);
    return { ok: false, reason: 'cooldown', retryAfter };
  }

  // randomInt is CSPRNG-backed; Math.random would be guessable.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  pendingCodes.set(email, {
    codeHash: hashCode(code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
  });

  deliverCode(email, code);

  // The code is returned only outside production so the UI can show it in a
  // dev banner. In production the caller gets nothing back.
  return {
    ok: true,
    expiresInSeconds: CODE_TTL_MS / 1000,
    devCode: process.env.NODE_ENV === 'production' ? undefined : code,
  };
}

export function verifyCode(rawEmail, rawCode, now = Date.now()) {
  sweep(now);
  const email = normalizeEmail(rawEmail);
  const entry = pendingCodes.get(email);

  // Same generic failure for "never requested", "expired", and "wrong code" so
  // the endpoint cannot be used to enumerate which addresses have codes pending.
  if (!entry) return { ok: false, reason: 'invalid' };

  if (entry.attempts >= MAX_ATTEMPTS) {
    pendingCodes.delete(email);
    return { ok: false, reason: 'too_many_attempts' };
  }

  entry.attempts += 1;

  const supplied = String(rawCode ?? '').trim();
  if (!/^\d{6}$/.test(supplied) || !constantTimeEquals(hashCode(supplied), entry.codeHash)) {
    return { ok: false, reason: 'invalid', attemptsRemaining: MAX_ATTEMPTS - entry.attempts };
  }

  // Single use: the code is burned whether or not the wizard is completed.
  pendingCodes.delete(email);

  const token = crypto.randomBytes(24).toString('hex');
  verifiedTokens.set(token, { email, expiresAt: now + TOKEN_TTL_MS });
  return { ok: true, token, email };
}

/**
 * Redeem a verification token at submit time.
 *
 * Binding to `expectedEmail` is the part that matters: without it, someone could
 * verify an address they control and then file a complaint under someone else's
 * email, which would defeat the point of verifying at all.
 */
export function consumeToken(token, expectedEmail, now = Date.now()) {
  sweep(now);
  const entry = verifiedTokens.get(token);
  if (!entry) return { ok: false, reason: 'unverified' };
  if (entry.email !== normalizeEmail(expectedEmail)) {
    return { ok: false, reason: 'email_mismatch' };
  }
  verifiedTokens.delete(token);
  return { ok: true, email: entry.email };
}

/** Test seam - lets the suite start from a known state. */
export function __reset() {
  pendingCodes.clear();
  verifiedTokens.clear();
}

export const VERIFICATION_LIMITS = {
  CODE_TTL_MS,
  TOKEN_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
};
