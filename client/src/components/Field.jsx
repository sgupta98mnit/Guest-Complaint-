// Form primitives. Every control here wires up the same accessibility contract,
// which is the point of having them: a label bound by `htmlFor`, `aria-required`
// on required inputs, `aria-invalid` when a field is in error, and
// `aria-describedby` pointing at the hint and error text so a screen reader
// announces why a field was rejected instead of just that it was.

function describedBy(id, hint, error) {
  const ids = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length ? ids.join(' ') : undefined;
}

function Label({ id, label, required }) {
  return (
    <label className="field__label" htmlFor={id}>
      {required && (
        <span className="field__required" aria-hidden="true">
          *
        </span>
      )}
      {label}
      {required && <span className="visually-hidden"> (required)</span>}
    </label>
  );
}

function Messages({ id, hint, error }) {
  return (
    <>
      {hint && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </>
  );
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
      {hint && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <input
        className="field__control"
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function TextArea({ id, label, value, onChange, error, hint, required = false, ...rest }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <Label id={id} label={label} required={required} />
      {hint && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <textarea
        className="field__control"
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
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
  placeholder = 'Select an option...',
}) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <Label id={id} label={label} required={required} />
      {hint && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <select
        className="field__control"
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
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
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Radio groups are a `fieldset`/`legend`, not a div with a label. That is what
 * lets a screen reader announce the question along with each option instead of
 * reading four disconnected choices.
 */
export function RadioGroup({ id, legend, value, onChange, options, error, required = false }) {
  return (
    <fieldset
      className="field--radio"
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend>
        {required && (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        )}
        {legend}
        {required && <span className="visually-hidden"> (required)</span>}
      </legend>

      {options.map((option) => {
        const val = typeof option === 'string' ? option : option.value;
        const text = typeof option === 'string' ? option : option.label;
        const description = typeof option === 'string' ? null : option.description;
        const optionId = `${id}-${String(val).replace(/\W+/g, '-').toLowerCase()}`;

        return (
          <div className="radio-option" key={val}>
            <input
              type="radio"
              id={optionId}
              name={id}
              value={val}
              checked={value === val}
              onChange={() => onChange(val)}
              aria-describedby={description ? `${optionId}-desc` : undefined}
            />
            <div className="radio-option__body">
              <label htmlFor={optionId}>{text}</label>
              {description && (
                <p className="radio-option__description" id={`${optionId}-desc`}>
                  {description}
                </p>
              )}
            </div>
          </div>
        );
      })}

      <Messages id={id} error={error} />
    </fieldset>
  );
}

export function SectionTitle({ children }) {
  return <h2 className="card__section-title">{children}</h2>;
}
