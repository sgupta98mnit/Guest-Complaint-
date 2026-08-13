import { useEffect, useId, useRef, useState } from 'react';
import { SelectField, TextField } from './Field.jsx';
import { api } from '../api.js';

/**
 * Address and contact belong to the organization, so selecting one rewrites the
 * entity's fields and clearing it empties them again.
 */
export const orgSelectPatch = (organization) => ({
  orgId: organization.id,
  orgName: organization.name,
  entityType: organization.entityType || '',
  address: organization.address || '',
  city: organization.city || '',
  state: organization.state || '',
  zip: organization.zip || '',
  phone: organization.phone || '',
});

export const ORG_CLEAR_PATCH = {
  orgId: null,
  orgName: '',
  entityType: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
};

/**
 * Organization lookup with inline creation.
 *
 * Implemented as an ARIA combobox rather than a styled text input: the input
 * owns `aria-expanded` and `aria-activedescendant`, the results are a real
 * `listbox`, and arrow keys move a highlight *class* without moving DOM focus.
 * That is what makes it announce as a combobox instead of as a text field with
 * mysterious clickable text underneath.
 */
export function OrganizationPicker({
  id,
  label,
  hint,
  value, // { orgId, orgName, city, state }
  onSelect,
  onClear,
  error,
  entityTypes = [],
  states = [],
  required = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const blurTimer = useRef(null);
  const listboxId = `${id}-listbox`;
  const selected = Boolean(value.orgId);

  // Debounced search. Without the delay this fires a request per keystroke;
  // 250ms coalesces typing while still feeling immediate.
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
          {label}{' '}
          {required && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </span>

        <div className="org-selected" aria-labelledby={`${id}-label`}>
          <div>
            <strong>{value.orgName}</strong>
            {(value.city || value.state) && (
              <div style={{ fontSize: 13, color: 'var(--subtle)' }}>
                {[value.city, value.state].filter(Boolean).join(', ')}
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
          {label}{' '}
          {required && (
            <>
              <span className="req" aria-hidden="true">
                *
              </span>
              <span className="visually-hidden">(required)</span>
            </>
          )}
        </label>
        <span className="field__hint" id={`${id}-hint`}>
          {hint || 'Start typing to search organizations already on file.'}
        </span>

        <div className="org-combobox">
          <input
            id={id}
            className="field__control"
            type="text"
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              highlight >= 0 && results[highlight]
                ? `${id}-option-${results[highlight].id}`
                : undefined
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
            placeholder="Search organizations…"
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
                    <span style={{ fontSize: 13, color: 'var(--subtle)' }}>
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
        <span className="visually-hidden" role="status" aria-live="polite">
          {searching
            ? 'Searching organizations'
            : query.trim().length >= 2
              ? `${results.length} organization${results.length === 1 ? '' : 's'} found`
              : ''}
        </span>

        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '6px 0 0' }}>
            No matches. Add the organization below.
          </p>
        )}

        {error && (
          <span className="field__error" id={`${id}-error`}>
            {error}
          </span>
        )}

        <button type="button" className="btn--link org-add" onClick={() => setShowCreate(true)}>
          + New organization
        </button>
      </div>

      {showCreate && (
        <NewOrganizationModal
          entityTypes={entityTypes}
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

function NewOrganizationModal({ entityTypes, states, initialName, onClose, onCreated }) {
  const uid = useId();
  const [form, setForm] = useState({
    name: initialName || '',
    entityType: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.querySelector('input')?.focus();
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  async function save(event) {
    event.preventDefault();
    setErrors({});
    setBanner(null);
    setBusy(true);
    try {
      // A duplicate name comes back as the existing record rather than an
      // error, so either way the caller gets a usable organization.
      const { organization } = await api.createOrganization(form);
      onCreated(organization);
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length > 0) setErrors(err.errors);
      else setBanner(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 id={`${uid}-title`}>New organization</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        <div className="modal__body">
          {banner && (
            <div className="callout callout--error" role="alert" style={{ marginBottom: 18 }}>
              {banner}
            </div>
          )}

          <form id={`${uid}-form`} onSubmit={save} noValidate>
            <TextField
              id={`${uid}-name`}
              label="Organization name"
              required
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />
            <SelectField
              id={`${uid}-entityType`}
              label="Entity type"
              required
              value={form.entityType}
              onChange={set('entityType')}
              options={entityTypes}
              error={errors.entityType}
            />
            <TextField
              id={`${uid}-address`}
              label="Street address"
              required
              value={form.address}
              onChange={set('address')}
              error={errors.address}
            />
            <div className="two-up">
              <TextField
                id={`${uid}-city`}
                label="City"
                required
                value={form.city}
                onChange={set('city')}
                error={errors.city}
              />
              <SelectField
                id={`${uid}-state`}
                label="State"
                required
                value={form.state}
                onChange={set('state')}
                options={states}
                error={errors.state}
                placeholder="—"
              />
              <TextField
                id={`${uid}-zip`}
                label="ZIP"
                required
                value={form.zip}
                onChange={set('zip')}
                error={errors.zip}
              />
              <TextField
                id={`${uid}-phone`}
                label="Contact phone"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                error={errors.phone}
              />
            </div>

            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
              Organizations are shared records. Details are required here because every future
              complaint filed against this organization reuses them.
            </p>
          </form>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={`${uid}-form`} className="btn btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save organization'}
          </button>
        </div>
      </div>
    </div>
  );
}
