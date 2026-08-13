/**
 * Progress indicator across the wizard.
 *
 * An ordered list rather than a row of divs, so the steps are announced as
 * "1 of 7" and so `aria-current="step"` can mark where the user actually is.
 * Completed steps carry visually-hidden text too - a green fill means nothing
 * to a screen reader.
 */
export function Stepper({ steps, currentIndex }) {
  return (
    <nav aria-label="Complaint filing progress">
      <ol className="stepper">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li
              key={step.id}
              className={`stepper__step${done ? ' stepper__step--done' : ''}${
                current ? ' stepper__step--current' : ''
              }`}
              aria-current={current ? 'step' : undefined}
            >
              {step.label}
              {done && <span className="visually-hidden"> (completed)</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
