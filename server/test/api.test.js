// The database module reads ASETT_DB_PATH at import time, so these must be set
// before it is loaded. That is why index.js is pulled in with a dynamic import
// below - static imports are hoisted and would run first.
process.env.ASETT_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

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

async function reviewerToken() {
  const res = await api('POST', '/api/auth/login', {
    body: { username: 'reviewer', password: 'reviewer123' },
  });
  assert.equal(res.status, 200);
  return res.body.token;
}

const authed = (token) => ({ headers: { authorization: `Bearer ${token}` } });

/** A complete, valid submission. Tests clone and break specific fields. */
function validSubmission(email = 'filer@example.org') {
  return {
    complaint: {
      complaintType: 'Transactions',
      description: 'Payer rejects compliant 837I claims without a valid rejection reason.',
      actionsTaken: 'Contacted provider services twice.',
      incidentDate: '2026-05-14',
      transactionType: 'Healthcare Claim - Institutional (837I)',
    },
    complainant: {
      anonymous: false,
      orgName: 'Riverbend Regional Hospital',
      orgType: 'Covered Health Care Provider',
      firstName: 'Dana',
      lastName: 'Whitfield',
      addressLine1: '1400 Mercy Lane',
      city: 'Buffalo',
      state: 'New York',
      zip: '14214',
      email,
      phone: '(716) 555-0142',
    },
    fae: {
      orgName: 'Cardinal Health Plan',
      orgType: 'Health Plan',
      contactFirstName: 'Marcus',
      contactLastName: 'Delgado',
      city: 'Albany',
      state: 'New York',
      zip: '12205',
      email: 'compliance@example.com',
      phone: '5185550188',
    },
  };
}

/** Submit end to end, returning the parsed response. */
async function submit(payload) {
  const token = await getVerificationToken(payload.complainant.email);
  return api('POST', '/api/complaints', {
    body: payload,
    headers: { 'x-verification-token': token },
  });
}

/* ------------------------------------------------------------ verification -- */

describe('email verification (OTP)', () => {
  test('issues a 6-digit code and accepts it once', async () => {
    const email = 'otp-happy@example.org';
    const requested = await api('POST', '/api/verification/request', { body: { email } });
    assert.equal(requested.status, 200);
    assert.match(requested.body.devCode, /^\d{6}$/);

    const first = await api('POST', '/api/verification/verify', {
      body: { email, code: requested.body.devCode },
    });
    assert.equal(first.status, 200);
    assert.ok(first.body.token);

    // Codes are single use - replaying the same one must fail.
    const replay = await api('POST', '/api/verification/verify', {
      body: { email, code: requested.body.devCode },
    });
    assert.equal(replay.status, 400);
  });

  test('rejects a malformed email address', async () => {
    const res = await api('POST', '/api/verification/request', { body: { email: 'not-an-email' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.email);
  });

  test('locks out after five wrong codes', async () => {
    const email = 'otp-bruteforce@example.org';
    const requested = await api('POST', '/api/verification/request', { body: { email } });
    const wrong = requested.body.devCode === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await api('POST', '/api/verification/verify', { body: { email, code: wrong } });
      assert.equal(res.status, 400, `attempt ${attempt} should be rejected`);
    }

    const locked = await api('POST', '/api/verification/verify', { body: { email, code: wrong } });
    assert.equal(locked.status, 429);
  });

  test('throttles resend requests for the same address', async () => {
    const email = 'otp-cooldown@example.org';
    assert.equal((await api('POST', '/api/verification/request', { body: { email } })).status, 200);
    const second = await api('POST', '/api/verification/request', { body: { email } });
    assert.equal(second.status, 429);
  });
});

/* ----------------------------------------------------------- organizations -- */

describe('organizations', () => {
  const org = {
    name: 'Test Organization Alpha',
    addressLine1: '1 Test Way',
    city: 'Buffalo',
    state: 'New York',
    zip: '14214',
    phone: '(716) 555-0100',
  };

  test('creates an organization and normalizes its phone', async () => {
    const res = await api('POST', '/api/organizations', { body: org });
    assert.equal(res.status, 201);
    assert.equal(res.body.created, true);
    assert.equal(res.body.organization.name, org.name);
    assert.equal(res.body.organization.phone, '7165550100');
  });

  test('returns the existing record instead of failing on a duplicate name', async () => {
    const res = await api('POST', '/api/organizations', {
      body: { ...org, name: 'test organization alpha' }, // different case
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.created, false);
    assert.equal(res.body.organization.name, org.name);
  });

  test('requires a complete address', async () => {
    const res = await api('POST', '/api/organizations', { body: { name: 'Incomplete Org' } });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.addressLine1);
    assert.ok(res.body.errors.city);
    assert.ok(res.body.errors.zip);
  });

  test('searches by partial name', async () => {
    const res = await api('GET', '/api/organizations?q=organization%20alph');
    assert.equal(res.status, 200);
    assert.ok(res.body.organizations.some((o) => o.name === org.name));
  });

  test('ignores searches shorter than two characters', async () => {
    const res = await api('GET', '/api/organizations?q=a');
    assert.deepEqual(res.body.organizations, []);
  });

  test('treats LIKE wildcards as literal characters', async () => {
    // Without escaping, "%" would match every organization in the table.
    const res = await api('GET', '/api/organizations?q=%25%25');
    assert.deepEqual(res.body.organizations, []);
  });
});

/* --------------------------------------------------------------- submission -- */

describe('POST /api/complaints', () => {
  test('accepts a valid submission and returns a CM-YY-NNNNN tracking id', async () => {
    const res = await submit(validSubmission('happy-path@example.org'));
    assert.equal(res.status, 201);
    assert.match(res.body.trackingId, /^CM-\d{2}-\d{5}$/);
    assert.equal(res.body.status, 'submitted');
  });

  test('issues sequential, non-colliding tracking ids', async () => {
    const first = await submit(validSubmission('seq-one@example.org'));
    const second = await submit(validSubmission('seq-two@example.org'));

    const seq = (id) => Number(id.split('-')[2]);
    assert.equal(seq(second.body.trackingId), seq(first.body.trackingId) + 1);
  });

  test('rejects a submission with missing required fields, keyed by section', async () => {
    const payload = validSubmission('missing-fields@example.org');
    payload.complaint.description = '';
    payload.complainant.lastName = '   ';
    payload.fae.orgName = '';

    const token = await getVerificationToken(payload.complainant.email);
    const res = await api('POST', '/api/complaints', {
      body: payload,
      headers: { 'x-verification-token': token },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.description']);
    assert.ok(res.body.errors['complainant.lastName']);
    assert.ok(res.body.errors['fae.orgName']);
  });

  test('rejects a future incident date', async () => {
    const payload = validSubmission('future-date@example.org');
    payload.complaint.incidentDate = '2099-01-01';

    const token = await getVerificationToken(payload.complainant.email);
    const res = await api('POST', '/api/complaints', {
      body: payload,
      headers: { 'x-verification-token': token },
    });

    assert.equal(res.status, 400);
    assert.match(res.body.errors['complaint.incidentDate'], /future/i);
  });

  test('rejects a value that is not in the server-side picklist', async () => {
    const payload = validSubmission('bad-picklist@example.org');
    payload.complaint.transactionType = 'Something The Dropdown Never Offered';

    const token = await getVerificationToken(payload.complainant.email);
    const res = await api('POST', '/api/complaints', {
      body: payload,
      headers: { 'x-verification-token': token },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.transactionType']);
  });

  test('refuses to persist without a verification token', async () => {
    const res = await api('POST', '/api/complaints', {
      body: validSubmission('no-token@example.org'),
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.reason, 'unverified');
  });

  test('links the complaint to a real organization record', async () => {
    const { body: made } = await api('POST', '/api/organizations', {
      body: {
        name: 'Linked Hospital Group',
        addressLine1: '9 Linked Road',
        city: 'Buffalo',
        state: 'New York',
        zip: '14214',
      },
    });

    const payload = validSubmission('org-linked@example.org');
    payload.complainant.orgId = made.organization.id;
    payload.complainant.orgName = made.organization.name;

    const submitted = await submit(payload);
    assert.equal(submitted.status, 201);

    const token = await reviewerToken();
    const list = await api('GET', '/api/complaints', authed(token));
    const target = list.body.complaints.find(
      (c) => c.trackingId === submitted.body.trackingId,
    );
    const detail = await api('GET', `/api/complaints/${target.id}`, authed(token));

    assert.equal(detail.body.complainant.orgId, made.organization.id);
    assert.equal(detail.body.complainant.orgName, 'Linked Hospital Group');
  });

  test('rejects a submission naming an organization that does not exist', async () => {
    const payload = validSubmission('bad-org@example.org');
    payload.complainant.orgId = 999999;

    const token = await getVerificationToken(payload.complainant.email);
    const res = await api('POST', '/api/complaints', {
      body: payload,
      headers: { 'x-verification-token': token },
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complainant.orgName']);
  });

  test('refuses when the verified email differs from the complaint email', async () => {
    const token = await getVerificationToken('verified-as@example.org');
    const payload = validSubmission('filed-as-somebody-else@example.org');

    const res = await api('POST', '/api/complaints', {
      body: payload,
      headers: { 'x-verification-token': token },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.reason, 'email_mismatch');
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

  test('guards the list and detail endpoints', async () => {
    assert.equal((await api('GET', '/api/complaints')).status, 401);
    assert.equal((await api('GET', '/api/complaints/1')).status, 401);
    assert.equal((await api('POST', '/api/complaints/1/reviews', { body: {} })).status, 401);
  });

  test('rejects a token that was never issued', async () => {
    const res = await api('GET', '/api/complaints', authed('deadbeef'));
    assert.equal(res.status, 401);
  });
});

/* ------------------------------------------------------------------- review -- */

describe('reviewer workflow', () => {
  test('requires a note on every action', async () => {
    await submit(validSubmission('needs-note@example.org'));
    const token = await reviewerToken();
    const { body } = await api('GET', '/api/complaints', authed(token));
    const target = body.complaints[0];

    const res = await api('POST', `/api/complaints/${target.id}/reviews`, {
      body: { action: 'approved', note: '   ' },
      ...authed(token),
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.errors.note);
  });

  test('updates status and appends history in one step', async () => {
    const submitted = await submit(validSubmission('review-flow@example.org'));
    const token = await reviewerToken();

    const list = await api('GET', '/api/complaints', authed(token));
    const target = list.body.complaints.find(
      (c) => c.trackingId === submitted.body.trackingId,
    );
    assert.equal(target.status, 'submitted');

    const denied = await api('POST', `/api/complaints/${target.id}/reviews`, {
      body: { action: 'denied', note: 'Outside jurisdiction for this transaction set.' },
      ...authed(token),
    });
    assert.equal(denied.status, 201);
    assert.equal(denied.body.complaint.status, 'denied');
    assert.equal(denied.body.reviews.length, 1);

    // A second action appends rather than replacing - the history is the audit trail.
    const reopened = await api('POST', `/api/complaints/${target.id}/reviews`, {
      body: { action: 'needs_info', note: 'Reopening to request trace numbers.' },
      ...authed(token),
    });
    assert.equal(reopened.body.complaint.status, 'needs_info');
    assert.equal(reopened.body.reviews.length, 2);
    assert.deepEqual(
      reopened.body.reviews.map((r) => r.action),
      ['denied', 'needs_info'],
    );
  });

  test('returns the full record, including the anonymity flag', async () => {
    const payload = validSubmission('anon-filer@example.org');
    payload.complainant.anonymous = true;
    const submitted = await submit(payload);

    const token = await reviewerToken();
    const list = await api('GET', '/api/complaints', authed(token));
    const target = list.body.complaints.find(
      (c) => c.trackingId === submitted.body.trackingId,
    );

    const detail = await api('GET', `/api/complaints/${target.id}`, authed(token));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.complainant.anonymous, true);
    // Anonymity is a disclosure control, not a collection control - contact
    // details are still stored so CMS can reach the filer.
    assert.equal(detail.body.complainant.email, 'anon-filer@example.org');
    assert.equal(detail.body.complainant.phone, '7165550142'); // normalized to digits
    assert.ok(detail.body.fae.orgName);
  });

  test('filters the list by status', async () => {
    const token = await reviewerToken();
    const res = await api('GET', '/api/complaints?status=denied', authed(token));
    assert.equal(res.status, 200);
    assert.ok(res.body.complaints.every((c) => c.status === 'denied'));
  });

  test('rejects an unknown status filter', async () => {
    const token = await reviewerToken();
    const res = await api('GET', '/api/complaints?status=bogus', authed(token));
    assert.equal(res.status, 400);
  });

  test('404s on a complaint that does not exist', async () => {
    const token = await reviewerToken();
    assert.equal((await api('GET', '/api/complaints/999999', authed(token))).status, 404);
  });
});
