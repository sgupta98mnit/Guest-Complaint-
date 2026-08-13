# Architecture

How this application actually works, why it is built this way, and where it is weak.
[README.md](README.md) covers setup and scope; this document covers mechanism.

---

## 1. Shape of the system

```
Browser (React SPA)
   |
   |  relative /api/* requests — never an absolute URL
   |    dev:  Vite dev server on :5173 proxies /api to :3001
   |    prod: Express serves the SPA and the API from the same origin
   v
Express (:3001)
   |
   |-- routes/         HTTP only: parse, delegate, shape a response
   |-- lib/validation  business rules -> { 'section.field': message }
   |-- lib/*Store      every SQL statement, both write transactions
   v
SQLite (better-sqlite3, synchronous, WAL)
```

Three deliberate properties fall out of this shape:

**The client never knows where the API is.** Every request is a relative path. In development
Vite proxies them; in production the same Express process that serves `index.html` answers them.
That is why there is no API base URL configuration anywhere, and why CORS is only enabled outside
production — in production, everything is same-origin.

**Layers are separated by what changes them, not by ceremony.** A change to a validation rule
touches `lib/validation.js`. A change to a query touches `lib/complaintStore.js`. A change to
status codes touches `routes/`. There is no service/repository/DTO tower on top of an app this
size, but the three seams that actually earn their keep are real.

**Database access is synchronous.** `better-sqlite3` is not a promise-based driver — calls block.
That is a genuine constraint (a slow query stalls the event loop), and it is acceptable here
because every query is indexed and single-row or small-result. It is also what makes the
transactions below so simple: no `await` inside a transaction means no chance of interleaving.

---

## 2. A guest submission, traced end to end

Follow one complaint from click to database.

### 2.1 The gate — proving the email

`pages/Home.jsx` opens the **File a Complaint** dialog, then `EmailVerificationModal`.

1. `api.requestVerificationCode(email)` → `POST /api/verification/request`.
2. `routes/verification.js` shape-checks the address and calls `requestCode()` in
   `lib/verification.js`, which:
   - throttles resends (30s per address),
   - generates a code with `crypto.randomInt` (CSPRNG — `Math.random` would be guessable),
   - stores the **SHA-256 hash**, an expiry, and an attempt counter,
   - calls `deliverCode()`, the single stubbed function in the flow. Outside production it prints
     to the console and returns the code so the UI can show it; in production it logs nothing
     identifying and returns nothing.
3. The user submits the code. `verifyCode()` increments the attempt counter, compares with
   `crypto.timingSafeEqual`, and on success **deletes the code** (single use) and issues a
   `verificationToken` bound to that email with a 30-minute lifetime.
4. `Home.jsx` navigates to `/complaints/new`, passing `{ email, verificationToken }` in **router
   state** — not `sessionStorage`. Reloading the wizard therefore drops it and bounces the user
   back to verify again, which is correct: the token is single-use and short-lived.

Failure messages are deliberately identical for "never requested", "expired", and "wrong code", so
the endpoint cannot be used to discover which addresses have codes pending.

### 2.2 Choosing an organization

Both the complainant and FAE steps use `OrganizationPicker`, an ARIA combobox rather than a styled
text input: the input carries `aria-expanded` and `aria-activedescendant`, results are a real
`listbox`, and arrow keys move a highlight class **without moving DOM focus**. That last detail is
what makes it announce as a combobox instead of as a text field with some mysterious clickable text
underneath.

Search is debounced 250ms and ignores terms under two characters. On the server,
`searchOrganizations` escapes `%`, `_`, and `\` before building the `LIKE` pattern — otherwise a
user typing `%` matches every row — and orders prefix matches ahead of substring matches so typing
`riv` surfaces "Riverbend" above "Great River".

Selecting an organization calls `updateMany()` with `orgSelectPatch()`, rewriting the name and five
address fields in **one** state update. Six sequential `update()` calls would each read the same
stale snapshot. The address fields then render read-only, because the address belongs to the
organization rather than the person — which is exactly why they appear greyed out in the source
application. The state field swaps from a `<select>` to a read-only text input rather than being
disabled, since a disabled control drops out of the tab order entirely.

Creating an organization is a `POST` that **does not fail on a duplicate name**: it returns the
existing record with `created: false`, and the UI simply selects it. A filer who types a name that
already exists wants to use that record, not read an error.

### 2.3 The wizard

`pages/guest/GuestWizard.jsx` holds everything:

```js
form   = { complaint: {...}, complainant: {...}, fae: {...} }
errors = { 'complaint.description': '...' }
stepIndex
```

The seven step components are **presentational** — they render fields against `form` and call
`update(section, field, value)`. All the decisions live in the orchestrator. One consequence worth
noting: there is exactly one place in the client that answers *"may the user continue?"*, which is
`goNext()`.

`goNext()` runs `validateStep(step.id, form)` from `client/src/validation.js`. If it returns
anything, the step does not advance and `<ErrorSummary>` takes focus.

The verified email is seeded into `form.complainant.email` and rendered **read-only**. The server
rejects any submission whose complainant email differs from the verified one, so an editable field
would only produce a confusing failure four steps later.

Nothing is persisted between steps. A guest who refreshes loses the form — no drafts, matching the
real tool's guest behaviour and the brief.

### 2.4 Submit

`api.submitComplaint(form, verificationToken)` → `POST /api/complaints`, with the token in an
`x-verification-token` header. In `routes/complaints.js`:

1. **Validate first, redeem second.** `validateSubmission()` runs before `consumeToken()`. This
   ordering is intentional — the token is single-use, so burning it on a payload that was going to
   fail validation anyway would force the user to re-verify their email over a typo.
2. `consumeToken(token, payload.complainant.email)` checks existence, checks the email **matches**,
   and deletes it. The email binding is the part that matters: without it, someone could verify an
   address they control and then file under someone else's.
3. `persistSubmission(payload)` — one transaction:

```js
const persistSubmission = db.transaction(({ complaint, complainant, fae }) => {
  const trackingId = nextTrackingId();   // atomic counter bump, same transaction
  insertComplaint.run(...);              // -> complaintId
  insertComplainant.run(complaintId, ...);
  insertFae.run(complaintId, ...);
});
```

Three inserts and a counter increment succeed together or none of them land. A complaint row
without its FAE row would be useless to a reviewer, and a burned tracking number on a failed insert
would leave a permanent gap in the sequence.

`nextTrackingId()` is a single statement:

```sql
INSERT INTO tracking_sequence (year, last_seq) VALUES (?, 1)
ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1
RETURNING last_seq
```

One atomic upsert. Two concurrent submissions cannot read the same value, and deleting a complaint
does not cause its number to be reissued.

If redemption fails, the wizard does **not** send the filer back to the start. Verification state
is process-local, so a deploy or a 30-minute expiry can invalidate a token while someone is still
filling in the form — and discarding a completed seven-step form because of that is a far worse
outcome than the problem it is reacting to. Instead the wizard opens the verification dialog in
place with the email locked to the one on the complaint, and retries the submission with the fresh
token once the code is accepted. Because validation runs before redemption and all three inserts
share a transaction, a rejected attempt leaves nothing behind, so the retry is safe. Covered by a
regression test.

4. The response is `{ trackingId, status }` — no internal row id. A guest cannot look a complaint
   up anyway, and handing out sequential internal ids on a public endpoint invites probing.

On the way in, `blankToNull()` collapses empty strings to `NULL` (so "absent" is one value in the
database, not two), and `normalizePhone()` strips formatting so `(716) 555-0142` and `7165550142`
store identically.

---

## 3. The review side

### 3.1 Auth

`routes/auth.js` compares against one hardcoded account, generates 24 random bytes on success, and
holds the token in an in-process `Set`. `requireReviewer` reads the `Authorization` header and
checks membership.

This is demo-grade **on purpose**, and its failure mode is worth stating precisely: the token set
is process memory, so restarting the API invalidates every session. `client/src/api.js` handles
that by clearing the local token whenever an authenticated request returns `401`, which drops the
reviewer back to the login screen rather than leaving the UI stuck retrying.

The token lives in `sessionStorage` — it dies with the tab, which is closer to "a reviewer session"
than `localStorage` would be. It is still readable by any script on the origin; an httpOnly cookie
would not be, which is what production should use (and would then need CSRF protection, which the
bearer-header design currently makes unnecessary).

`RequireAuth` in `auth.jsx` is a **convenience, not a control** — it stops an honest user wandering
into a broken screen. Every protected endpoint checks the token server-side regardless.

### 3.2 Recording a decision

`POST /api/complaints/:id/reviews` validates that the action is one of the three allowed values and
that the note is non-empty, then:

```js
const persistReview = db.transaction((complaintId, action, note, reviewer) => {
  insertReview.run(complaintId, action, note, reviewer);  // append to history
  updateStatus.run(action, complaintId);                  // denormalized column
});
```

**This transaction is what makes the denormalization safe.** `complaints.status` duplicates a fact
that the history already contains. That is a real trade — justified because the queue is the app's
hottest read and needs a status for every row — and it is only sound because the two writes cannot
be separated.

Note also what is *absent*: `needs_info` triggers no notification anywhere in the codebase. That is
the requirement, not an oversight. "Needs More Info" is an internal state and the complainant is
never told about it. There is no notification subsystem to accidentally wire it into.

Actions **append**. A second decision adds a row; it never edits the first. The history is the
audit trail.

---

## 4. Error handling, end to end

One error shape flows through the whole stack.

The server returns `400` with `{ errors: { 'complainant.email': '...' } }`. Keys are namespaced by
section, which is what makes the last step work: `firstStepWithErrors()` maps the failing keys back
to the step that owns them, and if a submit-time rejection names a field from step 3 while the user
is on step 5, the wizard **jumps back to step 3** before showing the summary. Otherwise the user
would be told to fix a field that is not on screen.

`ApiError` in `client/src/api.js` carries `status`, the `errors` map, and a `reason` code together,
so a component can render field errors and a banner from one thrown object. A `fetch` rejection —
which only happens on transport failure — is turned into "Could not reach the server", because
that genuinely is a different problem from "the server said no".

---

## 5. Accessibility mechanics

The non-obvious one is the **error-summary pattern**. When a step fails validation, focus moves to
a `role="alert"` region listing every problem, each entry a button that focuses the offending
field. Without it, a keyboard or screen-reader user presses "Next", nothing appears to happen, and
the inline errors further down the page are never announced. The `useEffect` keys on the *set* of
failing field names rather than the errors object, so it does not steal focus on every keystroke.

Focus also moves to the step heading on each transition (`headingRef.current?.focus()` with
`tabIndex={-1}`), into the first focusable element of a modal on open, and back to the trigger on
close. `Modal` traps Tab at both ends and closes on Escape.

---

## 6. Known weaknesses

Ranked by how much they would matter in production.

| # | Weakness | Consequence | Fix |
| --- | --- | --- | --- |
| 1 | **Auth is a hardcoded credential and an in-memory token set** | No revocation, no expiry, sessions die on restart, one shared identity means the `reviewer` column is meaningless | `users` table, argon2id hashes, `sessions` table, idle + absolute timeout, login rate limiting |
| 2 | **No pagination on the queue** | `GET /api/complaints` returns every row; fine at 50, unusable at 50,000 | Keyset pagination on `(created_at, id)` — the ordering is already indexed |
| 3 | **No rate limiting on the public submit endpoint** | Anyone can flood the database with complaints | Per-IP limiting at the proxy plus an application-level token bucket; CAPTCHA if abuse is real |
| 4 | **`activeTokens` grows unbounded** | Every login adds an entry that is only removed on explicit logout — a slow leak | Expiry timestamps and a sweep, which the OTP module already does |
| 5 | **No optimistic locking on review** | Two reviewers acting simultaneously: last write wins on `status`. History keeps both, so nothing is lost, but one decision silently supersedes the other | A `version` column checked on update, or surface the conflict in the UI |
| 6 | **`prev_tracking_id` is unvalidated free text** | Can reference a complaint that does not exist | Deliberate — confirming a tracking ID exists would let anyone probe for valid ones. Real fix: resolve it server-side and expose the link only to reviewers |
| 7 | **Reads are not audited** | We know who *decided*, not who *looked* at a complainant's contact details | Append-only access log, which is table stakes in real government systems |
| 8 | **SQLite is single-writer** | Concurrent writes serialize; under load a writer can hit `SQLITE_BUSY` | Set `busy_timeout`; migrate to Postgres when write concurrency is real |
| 9 | **Verification state is in memory** | A restart mid-flow invalidates pending codes and tokens. Mitigated in the UI — the filer re-verifies in place and keeps their form — but the underlying state is still process-local | Move to Redis or a table with a TTL sweep |
| 10 | **No frontend tests** | The React layer is verified manually and by a scripted pass over the built app | Vitest + Testing Library on the wizard's step-gating and error-routing logic |
| 11 | **Guests can create organizations, and nobody can merge them** | Near-duplicates ("Riverbend Hospital" vs "Riverbend Regional Hospital") will accumulate, and dedupe is on name alone so the same name in two cities cannot coexist | Staff curation tooling — merge, edit, deactivate — plus a natural key that includes address or NPI/EIN |
| 12 | **`ensureColumn` is not a migration system** | It adds a missing column on boot, but there is no ordering, no version tracking, and no down path | A real migration tool before a second environment exists |

Two things that look like weaknesses but are decisions:

- **The duplicated validation module.** Discussed in the README — the server copy is authoritative,
  the client copy is a latency affordance, and they return identically-keyed maps so a disagreement
  degrades gracefully.
- **No CSRF protection.** Not an omission: authentication is a bearer header, not a cookie, so a
  cross-site request cannot carry credentials. If auth moved to cookies, CSRF protection would
  become mandatory the same day.

---

## 7. If this were going to production

Roughly in order of what I would do first:

1. **Real auth and roles.** Not one `reviewer` but intake staff, investigators, and admins, with
   the endpoint authorization to match.
2. **Postgres.** The schema ports almost unchanged — `AUTOINCREMENT` becomes `GENERATED AS
   IDENTITY`, `datetime('now')` becomes `now()`, and the tracking counter becomes a sequence or a
   `SELECT ... FOR UPDATE`. Add a real migration tool at the same time: `schema.sql`-on-boot plus
   the `ensureColumn` helper in `db/index.js` is the smallest thing that keeps a dev database
   working, and it does not survive contact with a second environment. Organization search would
   also move from `LIKE` to a trigram index or full-text search, which `LIKE '%term%'` cannot use
   an index for.
3. **Pagination, search, and saved filters** on the queue, because that is the screen staff live in.
4. **An outbox table for notifications**, written in the same transaction as the status change and
   drained by a worker, so a status update and its email cannot get out of step — and so
   `needs_info` can be excluded from notification by an explicit rule rather than by absence.
5. **Audit logging** of reads as well as writes.
6. **File uploads**, done properly: object storage, presigned URLs, MIME allowlist, size caps,
   AV scanning, served from a separate origin.
7. **Observability** — structured logs (still without PII), request IDs, error tracking, uptime
   checks against `/api/health`.
