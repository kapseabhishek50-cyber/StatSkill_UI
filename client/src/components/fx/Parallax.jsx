import { reducedMotion, useParallax } from '../../hooks/useScrollFX.js';

/**
 * Scroll-parallax wrapper: children drift at `speed` relative to the page
 * scroll, giving sections depth. speed 0.15 = subtle, 0.4 = dramatic.
 * Also scales from `zoomFrom` to 1 as the element crosses the viewport.
 */
export default function Parallax({
  children,
  speed = 0.15,
  zoomFrom = 0,
  rotate = 0,
  className = '',
  style,
}) {
  const [ref, offset] = useParallax(speed);
  if (reducedMotion()) {
    return (
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    );
  }

  // offset swings roughly -100*speed..+100*speed px; clamp for safety.
  const clamped = Math.max(-160, Math.min(160, offset));
  const zoom = zoomFrom ? 1 + zoomFrom * Math.min(1, Math.abs(clamped) / 120) : 1;
  const rot = rotate ? clamped * rotate * 0.06 : 0;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: `translate3d(0, ${clamped.toFixed(1)}px, 0)${zoom !== 1 ? ` scale(${zoom.toFixed(3)})` : ''}${
          rot ? ` rotate(${rot.toFixed(2)}deg)` : ''
        }`,
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
