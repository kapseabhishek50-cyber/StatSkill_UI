import { useEffect, useRef, useState } from 'react';
import { useInView, reducedMotion } from '../../hooks/useScrollFX.js';

/**
 * Scroll-triggered animated counter. The number counts up with an
 * ease-out curve the first time it scrolls into view, formatted with
 * Indian digit grouping (en-IN) to match the platform's audience.
 *
 *   <CountUp end={38} suffix="+" /> → 38+
 */
export default function CountUp({
  end,
  start = 0,
  decimals = 0,
  duration = 1600,
  delay = 0,
  prefix = '',
  suffix = '',
  locale = 'en-IN',
  className = '',
}) {
  const [ref, inView] = useInView({ threshold: 0.4 });
  const [value, setValue] = useState(reducedMotion() ? end : start);
  const ran = useRef(false);

  useEffect(() => {
    if (!inView || ran.current) return undefined;
    if (reducedMotion()) {
      setValue(end);
      ran.current = true;
      return undefined;
    }

    ran.current = true;
    let raf = 0;
    let timer = 0;

    const tick = (now) => {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / duration);
      // easeOutExpo — fast start, gentle landing.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(start + (end - start) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const started = () => {
      startedAt = performance.now();
      raf = requestAnimationFrame(tick);
    };
    let startedAt = 0;

    timer = window.setTimeout(started, delay);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [inView, end, start, duration, delay]);

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={`tnum ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
