// Runs in its own process so it can set NODE_ENV=production and prove the
// hosted demo is still usable.
//
// The bug this guards: the verification code used to be gated on
// NODE_ENV !== 'production'. The deployed container sets NODE_ENV=production
// and has no mail server, so the code was suppressed AND no email arrived -
// verification could never be completed and the public demo was dead. Nothing
// in the suite caught it, because the tests all ran outside production mode.
process.env.ASETT_DB_PATH = ':memory:';
process.env.NODE_ENV = 'production';
process.env.ASETT_DEMO_MODE = 'true';
process.env.DISABLE_RATE_LIMIT = 'true';

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

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: JSON.parse(await res.text()) };
}

describe('demo mode under NODE_ENV=production', () => {
  test('advertises demo mode so the UI can tell the truth', async () => {
    const res = await call('GET', '/api/reference');
    assert.equal(res.body.demoMode, true);
  });

  test('returns the verification code, so a visitor can actually file', async () => {
    const res = await call('POST', '/api/verification/request', {
      email: 'demo-user@example.org',
    });
    assert.equal(res.status, 200);
    assert.match(
      res.body.devCode ?? '',
      /^\d{6}$/,
      'without the code the hosted demo cannot be completed',
    );
  });

  test('a full filing is completable end to end', async () => {
    const email = 'demo-complete@example.org';
    const requested = await call('POST', '/api/verification/request', { email });
    const verified = await call('POST', '/api/verification/verify', {
      email,
      code: requested.body.devCode,
    });
    assert.equal(verified.status, 200);

    const res = await fetch(`${base}/api/complaints`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-verification-token': verified.body.token },
      body: JSON.stringify({
        complaint: {
          complaintType: 'Transactions',
          transactionType: 'Claims & encounter information (837)',
          description: 'Demo-mode end-to-end filing.',
          incidentDate: '2026-05-14',
        },
        complainant: {
          firstName: 'Dana',
          lastName: 'Whitfield',
          email,
          role: 'Health care provider',
          anonymous: false,
        },
        fae: { orgName: 'Demo Health Plan', entityType: 'Health plan' },
      }),
    });

    assert.equal(res.status, 201);
    assert.match((await res.json()).trackingId, /^CM-\d{2}-\d{5}$/);
  });
});
