// The database module reads ASETT_DB_PATH at import time, so these must be set
// before it loads. That is why index.js is pulled in with a dynamic import
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

async function reviewerToken() {
  const res = await api('POST', '/api/auth/login', {
    body: { username: 'reviewer', password: 'reviewer123' },
  });
  assert.equal(res.status, 200);
  return res.body.token;
}

const authed = (token) => ({ headers: { authorization: `Bearer ${token}` } });

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
      email: 'd.whitfield@example.org',
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

const submit = (payload) => api('POST', '/api/complaints', { body: payload });

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

  test('rejects missing required fields, keyed by section', async () => {
    const res = await submit(
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
    const res = await submit(validSubmission({ complaint: { incidentDate: '2099-01-01' } }));
    assert.equal(res.status, 400);
    assert.match(res.body.errors['complaint.incidentDate'], /future/i);
  });

  test('rejects an impossible calendar date', async () => {
    const res = await submit(validSubmission({ complaint: { incidentDate: '2026-02-30' } }));
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.incidentDate']);
  });

  test('rejects a value the dropdown never offered', async () => {
    const res = await submit(
      validSubmission({ complaint: { transactionType: 'Not a real transaction' } }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.transactionType']);
  });

  test('rejects a malformed previous tracking id', async () => {
    const res = await submit(validSubmission({ complaint: { previousTrackingId: 'nope' } }));
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complaint.previousTrackingId']);
  });
});

/* -------------------------------------------------------------- anonymity -- */

describe('anonymous filing', () => {
  test('allows a submission with no name or email when anonymous', async () => {
    const res = await submit(
      validSubmission({
        complainant: {
          anonymous: true,
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
        },
      }),
    );
    assert.equal(res.status, 201);
  });

  test('still requires a role when anonymous', async () => {
    const res = await submit(
      validSubmission({
        complainant: { anonymous: true, firstName: '', lastName: '', email: '', role: '' },
      }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complainant.role']);
  });

  test('requires name and email when not anonymous', async () => {
    const res = await submit(
      validSubmission({
        complainant: { anonymous: false, firstName: '', lastName: '', email: '' },
      }),
    );
    assert.equal(res.status, 400);
    assert.ok(res.body.errors['complainant.firstName']);
    assert.ok(res.body.errors['complainant.email']);
  });

  test('labels an anonymous filer as such in the queue', async () => {
    const submitted = await submit(
      validSubmission({
        complainant: { anonymous: true, firstName: '', lastName: '', email: '' },
      }),
    );
    const token = await reviewerToken();
    const row = await findByTracking(token, submitted.body.trackingId);
    assert.equal(row.filer, 'Anonymous complainant');
    assert.equal(row.anonymous, true);
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
