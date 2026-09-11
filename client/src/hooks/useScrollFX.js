import { useEffect, useRef, useState } from 'react';

/**
 * Shared scroll/pointer motion hooks.
 *
 * Every listener is passive, every write goes through requestAnimationFrame,
 * and everything switches itself off when the user prefers reduced motion —
 * the effects layer must never fight the person using the page.
 */

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True when the viewport reports hover capability (i.e. a real pointer). */
export const canHover = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

/**
 * Observes an element and reports when it enters the viewport.
 * Returns [ref, inView] — the workhorse behind every scroll reveal.
 */
export function useInView({ threshold = 0.18, rootMargin = '0px 0px -8% 0px', once = true } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, inView];
}

/**
 * Page scroll progress 0..1, written through rAF so dozens of subscribers
 * cost one listener.
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const measure = () => {
      frame.current = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  return progress;
}

/**
 * How far an element has travelled through the viewport, -1..1
 * (0 = centred). Speed > 0 moves the child against the scroll.
 */
export function useParallax(speed = 0.15) {
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    if (reducedMotion()) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      frame.current = 0;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const centre = (rect.top + rect.height / 2 - viewport / 2) / viewport;
      setOffset(centre);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [speed]);

  return [ref, offset * speed * -100];
}

/** True once the page has been scrolled past `threshold` pixels. */
export function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/** Tracks the id of the section currently filling the viewport (scroll-spy). */
export function useScrollSpy(ids, offsetRatio = 0.35) {
  const [active, setActive] = useState(ids[0] ?? null);

  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * offsetRatio;
      let current = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ids, offsetRatio]);

  return active;
}
