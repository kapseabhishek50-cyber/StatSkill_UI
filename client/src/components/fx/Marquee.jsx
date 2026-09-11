import { canHover, reducedMotion } from '../../hooks/useScrollFX.js';

/**
 * Infinite marquee strip. Content is duplicated once and the track slides
 * on a CSS animation; hover pauses it. Items are your children, repeated
 * seamlessly (the two halves must be identical, which this component does
 * for you by rendering `children` twice).
 */
export default function Marquee({
  children,
  duration = 36,
  reverse = false,
  className = '',
  pauseOnHover = true,
}) {
  const disabled = reducedMotion();
  return (
    <div className={`marquee ${className}`} data-reverse={reverse ? '' : undefined}>
      <div
        className="marquee-track"
        style={{
          animationDuration: `${duration}s`,
          animationPlayState: disabled ? 'paused' : undefined,
        }}
        onMouseEnter={(e) => {
          if (pauseOnHover && !disabled && canHover()) e.currentTarget.style.animationPlayState = 'paused';
        }}
        onMouseLeave={(e) => {
          if (pauseOnHover && !disabled && canHover()) e.currentTarget.style.animationPlayState = 'running';
        }}
      >
        <div className="marquee-group">{children}</div>
        <div className="marquee-group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
