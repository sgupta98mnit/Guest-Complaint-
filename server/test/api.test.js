// The database module reads ASETT_DB_PATH at import time, so these must be set
// before it loads. That is why index.js is pulled in with a dynamic import
// below - static imports are hoisted and would run first.
process.env.ASETT_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
// The suite fires far more requests than a human would; the limiter is
// exercised by its own test with a dedicated app instead.
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

/* ---------------------------------------------------------------- helpers -- */

async function api(method, path, { body, headers } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function reviewerToken() {
  const res = await api('POST', '/api/auth/login', {
    body: { username: 'reviewer', password: 'reviewer123' },
  });
  assert.equal(res.status, 200);
  return res.body.token;
}

const authed = (token) => ({ headers: { authorization: `Bearer ${token}` } });

// Verification throttles resends per address, so every submission gets its own
// email. Tests that care about a specific address override it.
let emailSeq = 0;
const uniqueEmail = () => `filer-${(emailSeq += 1)}@example.org`;

/** A complete, valid submission. Tests clone this and break specific fields. */
function validSubmission(overrides = {}) {
  return {
    complaint: {
      complaintType: 'Transactions',
      transactionType: 'Claims & encounter information (837)',
      description: 'The plan rejected our 837P claims without a compliant 277CA response.',
      actionsTaken: 'Four support calls and two written escalations.',
      incidentDate: '2026-05-14',
      ...overrides.complaint,
    },
    complainant: {
      firstName: 'Dana',
      lastName: 'Whitfield',
      email: uniqueEmail(),
      phone: '(555) 014-8823',
      role: 'Health care provider',
      anonymous: false,
      ...overrides.complainant,
    },
    fae: {
      orgName: 'Cardinal Health Plan of New York',
      entityType: 'Health plan',
      address: '480 Rivermont Ave',
      city: 'Albany',
      state: 'NY',
      zip: '12207',
      phone: '5185550188',
      ...overrides.fae,
    },
  };
}

/** Walk the OTP flow and return a redeemable verification token. */
async function getVerificationToken(email) {
  const requested = await api('POST', '/api/verification/request', { body: { email } });
  assert.equal(requested.status, 200);
  const verified = await api('POST', '/api/verification/verify', {
    body: { email, code: requested.body.devCode },
  });
  assert.equal(verified.status, 200);
  return verified.body.token;
}

/** Submit through the real gate: verify the complainant's email, then post. */
async function submit(payload) {
  const token = await getVerificationToken(payload.complainant.email);
  return api('POST', '/api/complaints', {
    body: payload,
    headers: { 'x-verification-token': token },
  });
}

/** Post without a valid token, for tests that only care about validation. */
const submitRaw = (payload, token = 'not-a-real-token') =>
  api('POST', '/api/complaints', { body: payload, headers: { 'x-verification-token': token } });

/** Find a complaint in the queue by its tracking id. */
async function findByTracking(token, trackingId) {
  const list = await api('GET', '/api/complaints', authed(token));
  return list.body.complaints.find((c) => c.trackingId === trackingId);
}

/* ------------------------------------------------------------- reference -- */

describe('reference data', () => {
  test('serves the picklists the wizard needs', async () => {
    const res = await api('GET', '/api/reference');
    assert.equal(res.status, 200);
    assert.equal(res.body.complaintTypes.length, 4);
    assert.equal(res.body.transactionTypes.length, 5);
    assert.equal(res.body.complainantRoles.length, 5);
    assert.equal(res.body.entityTypes.length, 3);
    assert.equal(res.body.decisions.length, 3);
  });
});

/* -------------------------------------------------------------- submission -- */

describe('POST /api/complaints', () => {
  test('accepts a valid submission and returns a CM-YY-NNNNN tracking id', async () => {
    const res = await submit(validSubmission());
    assert.equal(res.status, 201);
    assert.match(res.body.trackingId, /^CM-\d{2}-\d{5}$/);
    assert.equal(res.body.status, 'submitted');
  });

  test('issues sequential, non-colliding tracking ids', async () => {
    const first = await submit(validSubmission());
    const second = await submit(validSubmission());
    const seq = (id) => Number(id.split('-')[2]);
    assert.equal(seq(second.body.trackingId), seq(first.body.trackingId) + 1);
  });

  // Validation runs before the token is redeemed, so these can post with a
  // bogus token and still assert on the 400 - which is itself the behaviour
  // that stops a typo burning a single-use code.
  test('rejects missing required fields, keyed by section', async () => {
    const res = await submitRaw(
      validSubmission({
        complaint: { description: '' },
        complainant: { lastName: '   ' },
        fae: { orgName: '' },
      }),
    );

    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.description']);
    assert.ok(res.body.errors['complainant.lastName']);
    assert.ok(res.body.errors['fae.orgName']);
  });

  test('rejects a future incident date', async () => {
    const res = await submitRaw(validSubmission({ complaint: { incidentDate: '2099-01-01' } }));
    assert.equal(res.status, 400);
    assert.match(res.body.errors['complaint.incidentDate'], /future/i);
  });

  test('rejects an impossible calendar date', async () => {
    const res = await submitRaw(validSubmission({ complaint: { incidentDate: '2026-02-30' } }));
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.incidentDate']);
  });

  test('rejects a value the dropdown never offered', async () => {
    const res = await submitRaw(
      validSubmission({ complaint: { transactionType: 'Not a real transaction' } }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.transactionType']);
  });

  test('rejects a malformed previous tracking id', async () => {
    const res = await submitRaw(validSubmission({ complaint: { previousTrackingId: 'nope' } }));
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.previousTrackingId']);
  });
});

/* ----------------------------------------------------------- organizations -- */

describe('organizations', () => {
  const org = {
    name: 'Test Organization Alpha',
    entityType: 'Health plan',
    address: '1 Test Way',
    city: 'Albany',
    state: 'NY',
    zip: '12207',
    phone: '(518) 555-0100',
  };

  test('creates an organization and normalizes its phone', async () => {
    const res = await api('POST', '/api/organizations', { body: org });
    assert.equal(res.status, 201);
    assert.equal(res.body.created, true);
    assert.equal(res.body.organization.phone, '5185550100');
  });

  test('returns the existing record instead of failing on a duplicate name', async () => {
    const res = await api('POST', '/api/organizations', {
      body: { ...org, name: 'test organization alpha' }, // different case
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.created, false);
    assert.equal(res.body.organization.name, org.name);
  });

  test('requires complete details, since the record is reused', async () => {
    const res = await api('POST', '/api/organizations', { body: { name: 'Incomplete Org' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.address);
    assert.ok(res.body.errors.city);
    assert.ok(res.body.errors.entityType);
  });

  test('searches by partial name', async () => {
    const res = await api('GET', '/api/organizations?q=organization%20alph');
    assert.ok(res.body.organizations.some((o) => o.name === org.name));
  });

  test('ignores searches shorter than two characters', async () => {
    assert.deepEqual((await api('GET', '/api/organizations?q=a')).body.organizations, []);
  });

  test('treats LIKE wildcards as literal characters', async () => {
    // Without escaping, "%" would match every organization in the table.
    assert.deepEqual((await api('GET', '/api/organizations?q=%25%25')).body.organizations, []);
  });

  test('links a complaint to the organization record', async () => {
    const { body: made } = await api('POST', '/api/organizations', {
      body: { ...org, name: 'Linked Health Plan' },
    });

    const payload = validSubmission({
      fae: { orgId: made.organization.id, orgName: made.organization.name },
    });
    const submitted = await submit(payload);
    assert.equal(submitted.status, 201);

    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);
    const detail = await api('GET', `/api/complaints/${row.id}`, authed(token));
    assert.equal(detail.body.fae.orgId, made.organization.id);
    assert.equal(detail.body.fae.orgName, 'Linked Health Plan');
  });

  test('rejects a complaint naming an organization that does not exist', async () => {
    const res = await submitRaw(validSubmission({ fae: { orgId: 999999 } }));
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['fae.orgName']);
  });
});

/* ----------------------------------------------------- verification gate -- */

describe('email verification', () => {
  test('issues a 6-digit code and accepts it once', async () => {
    const email = 'otp-happy@example.org';
    const requested = await api('POST', '/api/verification/request', { body: { email } });
    assert.match(requested.body.devCode, /^\d{6}$/);

    const first = await api('POST', '/api/verification/verify', {
      body: { email, code: requested.body.devCode },
    });
    assert.equal(first.status, 200);

    // Codes are single use - replaying one must fail.
    const replay = await api('POST', '/api/verification/verify', {
      body: { email, code: requested.body.devCode },
    });
    assert.equal(replay.status, 400);
  });

  test('locks out after five wrong codes', async () => {
    const email = 'otp-bruteforce@example.org';
    const requested = await api('POST', '/api/verification/request', { body: { email } });
    const wrong = requested.body.devCode === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await api('POST', '/api/verification/verify', { body: { email, code: wrong } });
      assert.equal(res.status, 400, `attempt ${attempt} should be rejected`);
    }
    assert.equal(
      (await api('POST', '/api/verification/verify', { body: { email, code: wrong } })).status,
      429,
    );
  });

  test('throttles resends to the same address', async () => {
    const email = 'otp-cooldown@example.org';
    assert.equal((await api('POST', '/api/verification/request', { body: { email } })).status, 200);
    assert.equal((await api('POST', '/api/verification/request', { body: { email } })).status, 429);
  });

  test('refuses to persist a complaint without a verification token', async () => {
    const res = await api('POST', '/api/complaints', { body: validSubmission() });
    assert.equal(res.status, 403);
    assert.equal(res.body.reason, 'unverified');
  });

  test('refuses when the verified email differs from the complaint email', async () => {
    const token = await getVerificationToken('verified-as@example.org');
    const res = await api('POST', '/api/complaints', {
      body: validSubmission({ complainant: { email: 'filed-as-someone-else@example.org' } }),
      headers: { 'x-verification-token': token },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.reason, 'email_mismatch');
  });

  test('records when the email was verified', async () => {
    const submitted = await submit(validSubmission());
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);
    const detail = await api('GET', `/api/complaints/${row.id}`, authed(token));
    assert.ok(detail.body.complainant.emailVerifiedAt, 'expected a verification timestamp');
  });
});

/* -------------------------------------------------------------- anonymity -- */

describe('anonymous filing', () => {
  test('allows a submission with no name when anonymous', async () => {
    const res = await submit(
      validSubmission({
        complainant: { anonymous: true, firstName: '', lastName: '', phone: '' },
      }),
    );
    assert.equal(res.status, 201);
  });

  test('still requires a verified email when anonymous', async () => {
    // This is the point of the whole gate: anonymity withholds the filer's
    // name from the filed-against entity, it does not make the filing
    // untraceable. Without it the public endpoint is an open spam channel.
    const res = await submitRaw(
      validSubmission({
        complainant: { anonymous: true, firstName: '', lastName: '', email: '' },
      }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complainant.email']);
  });

  test('still requires a role when anonymous', async () => {
    const res = await submitRaw(
      validSubmission({ complainant: { anonymous: true, firstName: '', lastName: '', role: '' } }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complainant.role']);
  });

  test('requires a name when not anonymous', async () => {
    const res = await submitRaw(
      validSubmission({ complainant: { anonymous: false, firstName: '', lastName: '' } }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complainant.firstName']);
    assert.ok(res.body.errors['complainant.lastName']);
  });

  test('labels an anonymous filer as such in the queue, but keeps the email on record', async () => {
    const email = 'anon-with-email@example.org';
    const submitted = await submit(
      validSubmission({ complainant: { anonymous: true, firstName: '', lastName: '', email } }),
    );
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);
    assert.equal(row.filer, 'Anonymous complainant');
    assert.equal(row.anonymous, true);

    const detail = await api('GET', `/api/complaints/${row.id}`, authed(token));
    assert.equal(detail.body.complainant.email, email);
    assert.ok(detail.body.complainant.emailVerifiedAt);
  });
});

/* --------------------------------------------------------------------- auth -- */

describe('reviewer authentication', () => {
  test('rejects bad credentials', async () => {
    const res = await api('POST', '/api/auth/login', {
      body: { username: 'reviewer', password: 'wrong' },
    });
    assert.equal(res.status, 401);
  });

  test('tolerates surrounding whitespace and casing in the username', async () => {
    for (const username of ['  reviewer', ' Reviewer ', 'REVIEWER']) {
      const res = await api('POST', '/api/auth/login', {
        body: { username, password: 'reviewer123' },
      });
      assert.equal(res.status, 200, `"${username}" should sign in`);
    }
  });

  test('guards every reviewer endpoint', async () => {
    assert.equal((await api('GET', '/api/complaints')).status, 401);
    assert.equal((await api('GET', '/api/complaints/1')).status, 401);
    assert.equal((await api('POST', '/api/complaints/1/actions', { body: {} })).status, 401);
  });

  test('rejects a token that was never issued', async () => {
    assert.equal((await api('GET', '/api/complaints', authed('deadbeef'))).status, 401);
  });
});

/* ------------------------------------------------------------------- queue -- */

describe('reviewer queue', () => {
  test('returns status counts for the stat tiles', async () => {
    const token = await reviewerToken();
    const res = await api('GET', '/api/complaints', authed(token));
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.counts === 'object');
    assert.ok(res.body.counts.submitted > 0);
  });

  test('filters by status', async () => {
    const token = await reviewerToken();
    const res = await api('GET', '/api/complaints?status=submitted', authed(token));
    assert.ok(res.body.complaints.every((c) => c.status === 'submitted'));
  });

  test('rejects an unknown status filter', async () => {
    const token = await reviewerToken();
    assert.equal((await api('GET', '/api/complaints?status=bogus', authed(token))).status, 400);
  });

  test('404s on a complaint that does not exist', async () => {
    const token = await reviewerToken();
    assert.equal((await api('GET', '/api/complaints/999999', authed(token))).status, 404);
  });
});

/* ------------------------------------------------------------------ actions -- */

describe('intake decisions', () => {
  test('requires a note on every action', async () => {
    const submitted = await submit(validSubmission());
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);

    const res = await api('POST', `/api/complaints/${row.id}/actions`, {
      body: { action: 'approve', note: '   ' },
      ...authed(token),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.note);
  });

  test('rejects an unknown action', async () => {
    const submitted = await submit(validSubmission());
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);

    const res = await api('POST', `/api/complaints/${row.id}/actions`, {
      body: { action: 'shred', note: 'nope' },
      ...authed(token),
    });
    assert.equal(res.status, 400);
  });

  test('maps each action to its status and appends history newest-first', async () => {
    const submitted = await submit(validSubmission());
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);
    assert.equal(row.status, 'submitted');

    const approved = await api('POST', `/api/complaints/${row.id}/actions`, {
      body: { action: 'approve', note: 'Documented 837P/277CA evidence. Routing to intake.' },
      ...authed(token),
    });
    assert.equal(approved.status, 201);
    assert.equal(approved.body.complaint.status, 'approved_for_intake');
    assert.equal(approved.body.actions.length, 1);
    assert.equal(approved.body.actions[0].reviewerName, 'Jordan Reviewer');

    // A second decision appends rather than replacing - the log is the audit trail.
    const held = await api('POST', `/api/complaints/${row.id}/actions`, {
      body: { action: 'needs_info', note: 'Reopening to request trace numbers.' },
      ...authed(token),
    });
    assert.equal(held.body.complaint.status, 'needs_more_info');
    assert.equal(held.body.actions.length, 2);
    // Newest first, as the timeline renders it.
    assert.deepEqual(
      held.body.actions.map((a) => a.action),
      ['needs_info', 'approve'],
    );
  });

  test('deny maps to denied_for_intake', async () => {
    const submitted = await submit(validSubmission());
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);

    const res = await api('POST', `/api/complaints/${row.id}/actions`, {
      body: { action: 'deny', note: 'Out of scope as filed.' },
      ...authed(token),
    });
    assert.equal(res.body.complaint.status, 'denied_for_intake');
  });

  test('detail returns complaint, complainant, entity, and actions together', async () => {
    const submitted = await submit(validSubmission());
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);

    const detail = await api('GET', `/api/complaints/${row.id}`, authed(token));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.complainant.role, 'Health care provider');
    assert.equal(detail.body.complainant.phone, '5550148823'); // normalized to digits
    assert.equal(detail.body.fae.entityType, 'Health plan');
    assert.deepEqual(detail.body.actions, []);
  });
});
