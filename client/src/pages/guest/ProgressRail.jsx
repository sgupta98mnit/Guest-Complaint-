import { STEPS } from '../../validation.js';

/**
 * Sticky progress rail.
 *
 * An ordered list rather than a stack of divs, so steps are announced as
 * "N of 7", and `aria-current="step"` marks where the filer actually is.
 * Completed steps carry visually-hidden text too — a green tick means nothing
 * to a screen reader.
 *
 * Rail steps are navigable, but only backwards to steps already completed. The
 * prototype allows jumping anywhere as a demo convenience; its own notes say to
 * gate forward navigation on validation in production.
 */
export function ProgressRail({ currentIndex, maxVisited, onJump }) {
  const pct = Math.round((currentIndex / (STEPS.length - 1)) * 100);

  return (
    <nav className="card wizard__rail" aria-label="Complaint filing progress">
      <div className="eyebrow eyebrow--sm">Your progress</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', margin: '6px 0 18px' }}>
        Step {currentIndex + 1} of {STEPS.length}
      </div>

      <div
        className="rail__track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Filing progress"
      >
        <div className="rail__fill" style={{ width: `${pct}%` }} />
      </div>

      <ol className="rail__steps">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          const reachable = index <= maxVisited && index !== currentIndex;

          return (
            <li key={step.id}>
              <button
                type="button"
                className={`rail__step${current ? ' rail__step--current' : ''}`}
                aria-current={current ? 'step' : undefined}
                disabled={!reachable}
                onClick={() => reachable && onJump(index)}
              >
                <span
                  className={`rail__dot${done ? ' rail__dot--done' : ''}${
                    current ? ' rail__dot--current' : ''
                  }`}
                  aria-hidden="true"
                >
                  {done ? '✓' : index + 1}
                </span>
                <span>
                  <span className="rail__label">{step.label}</span>
                  {done && <span className="visually-hidden"> (completed)</span>}
                  <span className="rail__hint">{step.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="rail__foot">
        Guest filings can’t be saved as a draft. Finish in one sitting — about 10 minutes.
      </p>
    </nav>
  );
}
