# Architecture

How this application works, why it is built this way, and where it is weak.
[README.md](README.md) covers setup and scope; this covers mechanism.

---

## 1. Shape of the system

```
Browser (React SPA)
   |
   |  relative /api/* requests — never an absolute URL
   |    dev:  Vite on :5173 proxies /api to :3001
   |    prod: Express serves the SPA and the API from one origin
   v
Express (:3001)
   |
   |-- rate limiters   per-IP caps on the unauthenticated write paths
   |-- routes/         HTTP only: parse, delegate, choose a status code
   |-- lib/validation  business rules -> { 'section.field': message }
   |-- lib/*Store      every SQL statement and every transaction
   v
SQLite (better-sqlite3, synchronous, WAL)
```

Three properties fall out of this shape:

**The client never knows where the API is.** Every request is a relative path, prefixed by the
deployment base path in exactly one place (`client/src/basePath.js`). In development Vite proxies
them; in production the same Express process that serves `index.html` answers them.

**Layers are separated by what changes them.** A rule change touches `lib/validation.js`. A query
change touches a `*Store.js`. A status-code change touches `routes/`. There is no
service/repository/DTO tower on an app this size, but those three seams are real — the proof is
that the seed script and the test suite write through the same store the API does.

**Database access is synchronous.** `better-sqlite3` blocks rather than returning promises. That is
a genuine constraint — a slow query stalls the event loop — and acceptable here because every query
is indexed and returns a small result. It is also what makes the transactions below simple: no
`await` inside a transaction means no chance of interleaving.

---

## 2. A guest filing, traced end to end

### 2.1 The gate

"Start complaint" does not advance the wizard; it opens the verification dialog.

1. `POST /api/verification/request` → `requestCode()` in `lib/verification.js`:
   throttles resends (30s per address), generates a code with `crypto.randomInt` (CSPRNG —
   `Math.random` would be guessable), stores the **SHA-256 hash** with an expiry and an attempt
   counter, then calls `deliverCode()`.
2. `deliverCode()` is the single mocked function in the flow. In demo mode it writes to the console
   and the code is returned so the UI can show it; otherwise it logs nothing identifying and returns
   nothing.
3. `POST /api/verification/verify` increments the attempt counter, compares with
   `crypto.timingSafeEqual`, and on success **deletes the code** (single use) and issues a token
   bound to that email with a 30-minute lifetime.

Failure messages are identical for "never requested", "expired", and "wrong code", so the endpoint
cannot be used to discover which addresses have codes pending.

**`DEMO_MODE` is deliberately not derived from `NODE_ENV`.** They answer different questions: the
hosted demo runs in production mode but has no mail server. Deriving one from the other shipped a
deployment where the code was suppressed *and* no email arrived, so verification could never be
completed. `server/test/demoMode.test.js` runs with `NODE_ENV=production` and asserts a filing is
still completable.

### 2.2 Choosing an organization

The filed-against organization is an ARIA combobox (`components/OrganizationPicker.jsx`), not a
styled text input: the input owns `aria-expanded` and `aria-activedescendant`, results are a real
`listbox`, and arrow keys move a highlight **class** without moving DOM focus. That is what makes it
announce as a combobox rather than a text field with mysterious clickable text beneath it.

Search is debounced 250ms and ignores terms under two characters. Server-side,
`searchOrganizations` escapes `%`, `_`, and `\` before building the `LIKE` pattern — otherwise
typing `%` matches every row — and orders prefix matches ahead of substring matches.

Selecting one calls `setMany()` with `orgSelectPatch()`, rewriting the name and six inherited fields
in **one** state update; seven sequential updates would each read the same stale snapshot. Those
fields then render read-only, because they belong to the organization rather than to this filing.

Creating one **does not fail on a duplicate name**: it returns the existing record with
`created: false` and the UI selects it. A filer typing a name that already exists wants that record,
not an error.

### 2.3 The wizard

`pages/guest/GuestWizard.jsx` owns everything:

```js
form   = { complaint: {...}, complainant: {...}, fae: {...} }
errors = { 'complaint.description': '...' }
stepIndex, maxVisited, verification
```

The step bodies are presentational. All decisions live in the orchestrator, so there is exactly one
place that answers *"may the filer continue?"* — `goNext()`, which runs `validateStep()` and, if
anything comes back, refuses to advance and hands focus to `<ErrorSummary>`.

The verified address is seeded into `form.complainant.email` and rendered **read-only**: the server
rejects any submission whose complainant email differs from the verified one, so an editable field
would only produce a confusing failure three steps later.

Rail steps navigate backwards only. The prototype allows jumping anywhere as a demo convenience;
its own notes say to gate forward navigation on validation in production.

Nothing is persisted between steps — no drafts, per the brief.

### 2.4 Submit

1. **Validate first, redeem second.** The token is single-use, so burning it on a payload that was
   going to fail anyway would force the filer to re-verify over a typo.
2. `consumeToken(token, complainant.email)` checks existence, checks the email **matches**, and
   deletes it. The binding is the part that matters: without it, someone could verify an address
   they control and file under someone else's.
3. `persistSubmission()` — one transaction:

```js
const trackingId = nextTrackingId();   // atomic counter bump, same transaction
insertComplaint.run(...);              // -> complaintId
insertComplainant.run(complaintId, ..., emailVerifiedAt);
insertFae.run(complaintId, orgId, ...);
```

Four writes that succeed together or not at all. A complaint without its complainant row would be
useless to a reviewer, and a burned tracking number on a failed insert would leave a permanent gap.

`nextTrackingId()` is a single statement:

```sql
INSERT INTO tracking_sequence (year, last_seq) VALUES (?, 1)
ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1
RETURNING last_seq
```

One atomic upsert. Two concurrent submissions cannot read the same value, and deleting a complaint
does not cause its number to be reissued. The first implementation derived the sequence from
`COUNT(*)` and had both bugs.

`email_verified_at` is written by the **route**, from the server's clock, once the token is
redeemed — never asserted by the client.

4. The response is `{ trackingId, status }` — no internal row id. A guest cannot look a complaint up
   anyway, and handing out sequential ids on a public endpoint invites probing.

---

## 3. The review side

### 3.1 Auth

`routes/auth.js` compares against one hardcoded account, generates 24 random bytes on success, and
holds the token in an in-process `Set`. Usernames are trimmed and compared case-insensitively;
passwords are not trimmed, because whitespace can legitimately be part of one.

Demo-grade **on purpose**, and its failure mode is worth stating: the token set is process memory,
so restarting the API invalidates every session. `client/src/api.js` handles that by clearing the
local token on any authenticated 401, dropping the reviewer at sign-in rather than leaving the UI
retrying.

`RequireAuth` is a **convenience, not a control** — every protected endpoint checks the token
server-side regardless.

### 3.2 Recording a decision

```js
const persistAction = db.transaction((complaintId, action, note, reviewerName) => {
  insertAction.run(complaintId, reviewerName, action, note);   // append
  updateStatus.run(STATUS_FOR_ACTION[action], complaintId);    // denormalized column
});
```

**This transaction is what makes the denormalization safe.** `complaints.status` duplicates a fact
the action log already contains — a real trade, justified because the queue is the hottest read and
needs a status on every row — and it is only sound because the two writes cannot be separated.

Note what is *absent*: `needs_info` triggers no notification anywhere. That is the requirement, not
an oversight, and there is no notification subsystem for it to leak into.

Actions **append**. A second decision adds a row; it never edits the first.

---

## 4. Error handling, end to end

One error shape flows through the stack. The server returns `400` with
`{ errors: { 'complainant.email': '...' } }`, namespaced by section — which is what makes the last
step work. `firstStepWithErrors()` maps failing keys back to owning steps, so a submit-time
rejection naming a step-3 field **jumps back to step 3** before rendering the summary. Otherwise the
filer is told to fix a field that is not on screen.

`ApiError` carries `status`, the `errors` map, and a `reason` code together, so a component can
render field errors and a banner from one thrown object. A `fetch` rejection — transport failure
only — becomes "Could not reach the server", which genuinely is a different problem.

When submit fails with `unverified` or `email_mismatch`, the wizard reopens the verification dialog
**in place** and retries with the completed form intact. Verification state is process-local and
expires, so a deploy or a slow filing can invalidate it mid-form; discarding a finished wizard over
that is far worse than the problem.

---

## 5. Accessibility mechanics

The non-obvious one is the **error-summary pattern**. On a failed step, focus moves to a
`role="alert"` region listing every problem, each entry a button that focuses the offending field.
Without it a keyboard user presses "Next", nothing appears to happen, and inline errors below the
fold are never announced. The `useEffect` keys on the *set* of failing field names, so it does not
steal focus on every keystroke.

Focus also moves to the step heading on each transition, into modals on open and back to the trigger
on close, and to the status pill after a decision is recorded. Queue rows are `<button>` elements so
the whole row is keyboard-operable. Radio cards are real `fieldset`/`legend` with real radio inputs
styled over the top, so arrow-key navigation is native rather than reimplemented.

---

## 6. Known weaknesses

Ranked by how much they would matter in production.

| # | Weakness | Consequence | Fix |
| --- | --- | --- | --- |
| 1 | **Auth is a hardcoded credential and an in-memory token set** | No revocation, no expiry, sessions die on restart, and one shared identity makes `reviewer_name` meaningless | `users` table, argon2id, `sessions` table, idle + absolute timeout |
| 2 | **No pagination on the queue** | Every row is returned; fine at 50, unusable at 50,000 | Keyset pagination on `(created_at, id)` — but see #3, the ordering is unindexed |
| 3 | **`ORDER BY created_at` is not indexed** | Fine now, a sort on every load later | Index on `(created_at, id)` before adding pagination |
| 4 | **Correlated subqueries in the list query** | `action_count` and `last_reviewer` run per row | Rewrite as a `LEFT JOIN ... GROUP BY` at scale |
| 5 | **Rate limiting is per-process and in memory** | Resets on redeploy, does not span replicas | Redis, or the edge — Caddy's `rate_limit` or a WAF |
| 6 | **Verification state is in memory** | A restart mid-flow invalidates pending codes. Mitigated in the UI (re-verify in place) but still process-local | Redis or a table with a TTL sweep |
| 7 | **Guests create organizations; nobody can merge them** | Near-duplicates accumulate, and name-only dedupe means one name cannot exist in two cities | Staff curation tooling; a natural key including address or NPI/EIN |
| 8 | **Reads are not audited** | We know who *decided*, not who *viewed* a complainant's contact details — including on anonymous filings | Append-only access log |
| 9 | **No optimistic locking on decisions** | Two reviewers at once: last write wins on `status`; history keeps both | A `version` column, or surface the conflict |
| 10 | **`ensureColumn` is not a migration system** | No ordering, no version tracking, no down path | A real migration tool before a second environment |
| 11 | **SQLite is single-writer** | Concurrent writes serialize; `SQLITE_BUSY` under load | `busy_timeout`; Postgres when write concurrency is real |
| 12 | **No frontend tests** | The React layer is verified by driving the built app, not by CI | Vitest + Testing Library on step gating and error routing |

Two things that look like weaknesses but are decisions:

- **The duplicated validation module.** The server copy is authoritative; the client copy is a
  latency affordance. Identically-keyed maps mean a disagreement degrades gracefully.
- **No CSRF protection.** Authentication is a bearer header, not a cookie, so a cross-site request
  cannot carry credentials. Move auth to cookies and CSRF protection becomes mandatory that day.

---

## 7. If this were going to production

1. **Real auth and roles** — intake staff, investigators, admins, with endpoint authorization to
   match. Today "authenticated" and "may see everything" are the same thing.
2. **Postgres and a migration tool.** The schema ports almost unchanged: `AUTOINCREMENT` →
   `GENERATED AS IDENTITY`, `datetime('now')` → `now()`, the tracking counter → a sequence.
   Organization search moves from `LIKE '%term%'` (which cannot use an index) to trigram or
   full-text search.
3. **Pagination, search, and saved filters** on the queue — the screen staff live in.
4. **Real email delivery** behind `deliverCode()`, with bounce handling and a suppression list.
5. **An outbox table for notifications**, written in the same transaction as the status change and
   drained by a worker, so a status update and its email cannot get out of step — and so
   `needs_info` is excluded by an explicit rule rather than by absence.
6. **Audit logging of reads**, not just writes.
7. **Organization curation** — merge, edit, retire.
8. **Observability** — structured logs without PII, request ids, error tracking, uptime checks
   against `/api/health`.
