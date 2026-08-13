import { useEffect, useId, useRef, useState } from 'react';
import { Modal } from './Modal.jsx';
import { SelectField, TextField } from './Field.jsx';
import { api } from '../api.js';

/**
 * Address lives on the organization, so selecting one rewrites the party's
 * address fields and clearing it empties them again. Shared by the complainant
 * and FAE steps so the two cannot drift.
 */
export const orgSelectPatch = (organization) => ({
  orgId: organization.id,
  orgName: organization.name,
  addressLine1: organization.addressLine1 || '',
  addressLine2: organization.addressLine2 || '',
  city: organization.city || '',
  state: organization.state || '',
  zip: organization.zip || '',
});

export const ORG_CLEAR_PATCH = {
  orgId: null,
  orgName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
};

/**
 * Organization lookup with inline creation, replacing what was a plain text
 * field and mirroring the sandbox's search-or-create control.
 *
 * Implemented as an ARIA combobox rather than a styled text input: the input
 * owns `aria-expanded` and `aria-activedescendant`, the results are a real
 * `listbox`, and arrow keys move a highlight without moving DOM focus. That is
 * what makes it announce as a combobox instead of as an input with some
 * mysterious clickable text underneath it.
 */
export function OrganizationPicker({
  id,
  label,
  value, // { orgId, orgName }
  onSelect,
  onClear,
  error,
  hint,
  states = [],
  required = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const inputRef = useRef(null);
  const blurTimer = useRef(null);
  const listboxId = `${id}-listbox`;
  const statusId = `${id}-status`;

  const selected = Boolean(value.orgId);

  // Debounced search. Without the delay this fires a request per keystroke; 250ms
  // is long enough to coalesce typing and short enough to feel immediate.
  useEffect(() => {
    if (selected) return undefined;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { organizations } = await api.searchOrganizations(term);
        setResults(organizations);
        setHighlight(-1);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, selected]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  function choose(organization) {
    onSelect(organization);
    setOpen(false);
    setQuery('');
    setResults([]);
    setHighlight(-1);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' && !open && results.length > 0) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter' && highlight >= 0) {
      event.preventDefault();
      choose(results[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  }

  /* ------------------------------------------------------ selected state -- */

  if (selected) {
    return (
      <div className={`field${error ? ' field--error' : ''}`}>
        <span className="field__label" id={`${id}-label`}>
          {required && (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          )}
          {label}
        </span>

        <div className="org-selected" aria-labelledby={`${id}-label`}>
          <div>
            <strong>{value.orgName}</strong>
            {value.orgCity && (
              <div className="text-small text-muted">
                {[value.orgCity, value.orgState].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <button type="button" className="btn btn--secondary" onClick={onClear}>
            Change<span className="visually-hidden"> {label}</span>
          </button>
        </div>

        {error && (
          <span className="field__error" id={`${id}-error`}>
            {error}
          </span>
        )}
      </div>
    );
  }

  /* --------------------------------------------------------- search state -- */

  return (
    <>
      <div className={`field${error ? ' field--error' : ''}`}>
        <label className="field__label" htmlFor={id}>
          {required && (
            <span className="field__required" aria-hidden="true">
              *
            </span>
          )}
          {label}
          {required && <span className="visually-hidden"> (required)</span>}
        </label>

        <span className="field__hint" id={`${id}-hint`}>
          {hint || 'Start typing to search existing organizations.'}
        </span>

        <div className="org-combobox">
          <input
            ref={inputRef}
            id={id}
            className="field__control"
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              highlight >= 0 && results[highlight] ? `${id}-option-${results[highlight].id}` : undefined
            }
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setOpen(true)}
            // Delay the close so a click on an option lands before the list
            // disappears out from under the pointer.
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpen(false), 150);
            }}
            placeholder="Search organizations..."
          />

          {open && results.length > 0 && (
            <ul className="org-results" role="listbox" id={listboxId} aria-label={`${label} results`}>
              {results.map((organization, index) => (
                <li
                  key={organization.id}
                  id={`${id}-option-${organization.id}`}
                  role="option"
                  aria-selected={index === highlight}
                  className={`org-results__item${index === highlight ? ' is-highlighted' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(organization)}
                  onMouseEnter={() => setHighlight(index)}
                >
                  <strong>{organization.name}</strong>
                  {(organization.city || organization.state) && (
                    <span className="text-small text-muted">
                      {' '}
                      — {[organization.city, organization.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Announced politely so a screen-reader user learns how many matches
            appeared without the list stealing focus. */}
        <span className="visually-hidden" id={statusId} role="status" aria-live="polite">
          {searching
            ? 'Searching organizations'
            : query.trim().length >= 2
              ? `${results.length} organization${results.length === 1 ? '' : 's'} found`
              : ''}
        </span>

        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="text-small text-muted" style={{ marginTop: '0.35rem' }}>
            No matches. Create the organization below.
          </p>
        )}

        {error && (
          <span className="field__error" id={`${id}-error`}>
            {error}
          </span>
        )}

        <button type="button" className="btn--link org-add" onClick={() => setShowCreate(true)}>
          + New Organization
        </button>
      </div>

      {showCreate && (
        <NewOrganizationModal
          states={states}
          initialName={query.trim()}
          onClose={() => setShowCreate(false)}
          onCreated={(organization) => {
            setShowCreate(false);
            choose(organization);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ modal -- */

function NewOrganizationModal({ states, initialName, onClose, onCreated }) {
  const uid = useId();
  const [form, setForm] = useState({
    name: initialName || '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function save(event) {
    event.preventDefault();
    setErrors({});
    setBanner(null);
    setBusy(true);
    try {
      const { created, organization } = await api.createOrganization(form);
      // The server returns the existing record instead of failing on a
      // duplicate name, so either way the caller gets a usable organization.
      if (!created) setBanner(null);
      onCreated(organization);
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length > 0) setErrors(err.errors);
      else setBanner(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title="New ASETT Organization"
      onClose={onClose}
      labelledBy={`${uid}-title`}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={`${uid}-form`} className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      {banner && (
        <div className="alert alert--error" role="alert">
          {banner}
        </div>
      )}

      <form id={`${uid}-form`} onSubmit={save} noValidate>
        <TextField
          id={`${uid}-name`}
          label="Organization Name"
          required
          value={form.name}
          onChange={set('name')}
          error={errors.name}
        />
        <TextField
          id={`${uid}-address1`}
          label="Address Line 1"
          required
          value={form.addressLine1}
          onChange={set('addressLine1')}
          error={errors.addressLine1}
        />
        <TextField
          id={`${uid}-address2`}
          label="Address Line 2"
          value={form.addressLine2}
          onChange={set('addressLine2')}
          error={errors.addressLine2}
        />
        <div className="grid-2">
          <TextField
            id={`${uid}-city`}
            label="City/Town"
            required
            value={form.city}
            onChange={set('city')}
            error={errors.city}
          />
          <SelectField
            id={`${uid}-state`}
            label="State/Province"
            required
            value={form.state}
            onChange={set('state')}
            options={states}
            error={errors.state}
          />
          <TextField
            id={`${uid}-zip`}
            label="ZIP Code/Postal Code"
            required
            value={form.zip}
            onChange={set('zip')}
            error={errors.zip}
          />
          <TextField
            id={`${uid}-phone`}
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            error={errors.phone}
            placeholder="(555) 123-4567"
          />
        </div>

        <p className="text-small text-muted" style={{ marginBottom: 0 }}>
          Organizations are shared records. Address details are required here because every future
          complaint filed against this organization will reuse them.
        </p>
      </form>
    </Modal>
  );
}
