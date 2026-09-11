import { useEffect, useRef } from 'react';
import { useScrollProgress } from '../../hooks/useScrollFX.js';

/**
 * Reading-progress bar pinned to the top edge of the viewport.
 * Rendered inside the landing page and the app layout alike.
 */
export default function ScrollProgress({ height = 3, gradient = true, className = '' }) {
  const progress = useScrollProgress();
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.style.transform = `scaleX(${progress})`;
  }, [progress]);

  return (
    <div
      className={`scroll-progress ${className}`}
      style={{ height }}
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        ref={ref}
        className="scroll-progress-fill"
        style={{
          background: gradient
            ? 'linear-gradient(90deg, var(--primary) 0%, var(--primary-bright) 60%, #6db6ff 100%)'
            : 'var(--primary)',
        }}
      />
    </div>
  );
}
