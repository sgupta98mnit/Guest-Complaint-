// Form primitives. Every control wires the same accessibility contract, which
// is the point of having them: a label bound with `htmlFor`, `aria-required` on
// required inputs, `aria-invalid` when a field is in error, and
// `aria-describedby` pointing at the hint and error text so a screen reader
// announces *why* a field was rejected rather than only that it was.

function describedBy(id, hint, error, extra) {
  const ids = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  if (extra) ids.push(extra);
  return ids.length ? ids.join(' ') : undefined;
}

function Label({ id, label, required }) {
  return (
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
  );
}

function Hint({ id, hint }) {
  return hint ? (
    <span className="field__hint" id={`${id}-hint`}>
      {hint}
    </span>
  ) : null;
}

function Error({ id, error }) {
  return error ? (
    <span className="field__error" id={`${id}-error`}>
      {error}
    </span>
  ) : null;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required = false,
  type = 'text',
  ...rest
}) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <Label id={id} label={label} required={required} />
      <Hint id={id} hint={hint} />
      <input
        className="field__control"
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
      <Error id={id} error={error} />
    </div>
  );
}

/** Textarea with an optional live character counter. */
export function TextArea({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required = false,
  maxLength,
  showCounter = false,
  ...rest
}) {
  const counterId = showCounter ? `${id}-counter` : undefined;
  const used = (value ?? '').length;

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <Label id={id} label={label} required={required} />
      <Hint id={id} hint={hint} />
      <textarea
        className="field__control"
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error, counterId)}
        maxLength={maxLength}
        {...rest}
      />
      {showCounter && (
        // Polite, not assertive: the count should not interrupt typing.
        <div className="field__counter" id={counterId} aria-live="polite">
          {used.toLocaleString()} of {maxLength.toLocaleString()} characters
        </div>
      )}
      <Error id={id} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
  required = false,
  placeholder = 'Select an option…',
  ...rest
}) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <Label id={id} label={label} required={required} />
      <Hint id={id} hint={hint} />
      <select
        className="field__control"
        id={id}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const val = typeof option === 'string' ? option : option.value;
          const text = typeof option === 'string' ? option : option.label;
          return (
            <option key={val} value={val}>
              {text}
            </option>
          );
        })}
      </select>
      <Error id={id} error={error} />
    </div>
  );
}

/**
 * Radio cards for complaint type and the decision panel.
 *
 * A real `fieldset`/`legend` with real radio inputs - the card is only styling
 * over native controls, so arrow-key navigation and screen-reader grouping work
 * without being re-implemented.
 */
export function RadioCards({
  id,
  legend,
  help,
  value,
  onChange,
  options,
  error,
  required = false,
  small = false,
}) {
  return (
    <fieldset
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, help, error)}
    >
      <legend>
        {legend}{' '}
        {required && (
          <>
            <span className="req" aria-hidden="true">
              *
            </span>
            <span className="visually-hidden">(required)</span>
          </>
        )}
      </legend>
      {help && (
        <div className="field__hint" id={`${id}-hint`} style={{ marginBottom: 18 }}>
          {help}
        </div>
      )}

      <div className="radio-cards">
        {options.map((option) => {
          const on = value === option.value;
          const optionId = `${id}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={`radio-card${small ? ' radio-card--sm' : ''}${on ? ' radio-card--on' : ''}`}
            >
              <input
                type="radio"
                id={optionId}
                name={id}
                value={option.value}
                checked={on}
                onChange={() => onChange(option.value)}
              />
              <span className="radio-card__ring" aria-hidden="true">
                <span className="radio-card__dot" />
              </span>
              <span>
                <span className="radio-card__label">{option.label}</span>
                {option.description && (
                  <span className="radio-card__desc" style={{ display: 'block' }}>
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <Error id={id} error={error} />
    </fieldset>
  );
}

export function CheckCard({ id, label, description, checked, onChange }) {
  return (
    <label className="check-card" htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        checked={Boolean(checked)}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
      <span>
        <span className="check-card__label" style={{ display: 'block' }}>
          {label}
        </span>
        {description && (
          <span className="check-card__desc" id={`${id}-desc`} style={{ display: 'block' }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
