import { useStatus } from '../reference.jsx';

/**
 * Status is colour-coded but always carries its label as text, so the meaning
 * never depends on colour alone.
 */
export function StatusPill({ status, large = false }) {
  const { label, bg, fg } = useStatus(status);
  return (
    <span className={`pill${large ? ' pill--lg' : ''}`} style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}
