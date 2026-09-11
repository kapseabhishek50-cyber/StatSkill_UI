import { useEffect, useRef } from 'react';
import { canHover, reducedMotion } from '../../hooks/useScrollFX.js';

/**
 * Mouse-tracking 3D tilt card with a specular glare.
 *
 * The card lives in its own perspective; the pointer tilts it up to `max`
 * degrees and a radial highlight follows the cursor like a sheen on glass.
 * Smoothing runs through a rAF lerp so the motion feels weighted, not wired.
 *
 *   <Tilt3DCard max={10}>…</Tilt3DCard>
 */
export default function Tilt3DCard({
  children,
  className = '',
  max = 9,
  scale = 1.015,
  glare = true,
  lift = true,
  style,
  ...rest
}) {
  const ref = useRef(null);
  const glareRef = useRef(null);
  const raf = useRef(0);
  const target = useRef({ rx: 0, ry: 0, s: 1 });
  const current = useRef({ rx: 0, ry: 0, s: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reducedMotion() || !canHover()) return undefined;

    const render = () => {
      const c = current.current;
      const t = target.current;
      c.rx += (t.rx - c.rx) * 0.14;
      c.ry += (t.ry - c.ry) * 0.14;
      c.s += (t.s - c.s) * 0.14;
      el.style.transform = `perspective(950px) rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg) scale(${c.s.toFixed(3)})${
        lift && t.s > 1 ? '' : ''
      }`;
      const settled =
        Math.abs(t.rx - c.rx) < 0.02 && Math.abs(t.ry - c.ry) < 0.02 && Math.abs(t.s - c.s) < 0.002;
      raf.current = settled ? 0 : requestAnimationFrame(render);
    };
    const kick = () => {
      if (!raf.current) raf.current = requestAnimationFrame(render);
    };

    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      target.current.ry = (px - 0.5) * 2 * max;
      target.current.rx = -(py - 0.5) * 2 * max;
      target.current.s = scale;
      if (glareRef.current) {
        glareRef.current.style.opacity = '1';
        glareRef.current.style.background = `radial-gradient(420px circle at ${(
          px * 100
        ).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgba(255,255,255,0.30), transparent 60%)`;
      }
      kick();
    };

    const onLeave = () => {
      target.current = { rx: 0, ry: 0, s: 1 };
      if (glareRef.current) glareRef.current.style.opacity = '0';
      kick();
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf.current);
    };
  }, [max, scale, glare, lift]);

  return (
    <div
      ref={ref}
      className={`tilt-3d ${className}`}
      style={{ transformStyle: 'preserve-3d', willChange: 'transform', ...style }}
      {...rest}
    >
      {children}
      {glare && <div ref={glareRef} className="tilt-glare" aria-hidden="true" />}
    </div>
  );
}
