// Runs in its own process (node:test isolates per file), so this app can have
// rate limiting switched ON while the main suite has it off.
process.env.ASETT_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
delete process.env.DISABLE_RATE_LIMIT;

import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

const { createApp } = await import('../index.js');

let server;
let base;

before(async () => {
  const { app } = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

async function post(path, body, headers = {}) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, retryAfter: res.headers.get('retry-after') };
}

describe('rate limiting on public endpoints', () => {
  test('caps complaint submissions per IP', async () => {
    // The limit is 10/hour. Bodies are invalid, which is fine: the limiter is
    // middleware registered before the router, so it counts the request either
    // way - that is what stops a flood of junk from ever reaching validation.
    let sawLimit = false;
    for (let i = 0; i < 12; i += 1) {
      const res = await post('/api/complaints', {}, { 'x-forwarded-for': '203.0.113.7' });
      if (res.status === 429) {
        sawLimit = true;
        assert.ok(Number(res.retryAfter) > 0, 'expected a Retry-After header');
        break;
      }
    }
    assert.ok(sawLimit, 'expected a 429 within 12 submissions');
  });

  test('counts each client address separately', async () => {
    // A different IP must not inherit the previous one's exhausted bucket.
    const res = await post('/api/complaints', {}, { 'x-forwarded-for': '198.51.100.4' });
    assert.notEqual(res.status, 429);
  });

  test('caps sign-in attempts per IP', async () => {
    let sawLimit = false;
    for (let i = 0; i < 12; i += 1) {
      const res = await post(
        '/api/auth/login',
        { username: 'reviewer', password: 'wrong' },
        { 'x-forwarded-for': '203.0.113.9' },
      );
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
    }
    assert.ok(sawLimit, 'brute-forcing the login should be capped');
  });
});
