import { useEffect, useRef, useState } from 'react';
import { useInView } from '../../hooks/useScrollFX.js';

/**
 * Scroll-reveal wrapper: children rise, zoom or flip into place the first
 * time they enter the viewport. Variants are pure transforms so the GPU
 * does all the work; `delay` staggers siblings into a cascade.
 *
 *   <Reveal variant="up" delay={120}>…</Reveal>
 */

const VARIANTS = {
  up: 'translate3d(0, 30px, 0)',
  down: 'translate3d(0, -30px, 0)',
  left: 'translate3d(-36px, 0, 0)',
  right: 'translate3d(36px, 0, 0)',
  zoom: 'scale(0.92)',
  'flip-3d': 'perspective(1100px) translate3d(0, 26px, -60px) rotateX(-14deg)',
  'rotate-3d': 'perspective(1100px) translate3d(0, 26px, 0) rotateY(-12deg)',
  blur: 'translate3d(0, 18px, 0)',
};

const TRANSITIONS = {
  up: 'opacity {d}ms cubic-bezier(0.22,1,0.36,1) {delay}ms, transform {d}ms cubic-bezier(0.22,1,0.36,1) {delay}ms',
  blur:
    'opacity {d}ms cubic-bezier(0.22,1,0.36,1) {delay}ms, transform {d}ms cubic-bezier(0.22,1,0.36,1) {delay}ms, filter {d}ms ease {delay}ms',
};

export default function Reveal({
  children,
  as: Tag = 'div',
  variant = 'up',
  delay = 0,
  duration = 700,
  once = true,
  className = '',
  style,
  ...rest
}) {
  const [ref, inView] = useInView({ once });
  const blur = variant === 'blur' ? ' blur(10px)' : '';
  const hidden = VARIANTS[variant] ?? VARIANTS.up;

  const template = (TRANSITIONS[variant] ?? TRANSITIONS.up)
    .replace('{d}', duration)
    .replace('{delay}', delay);

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : hidden,
        filter: inView ? 'blur(0px)' : blur,
        transition: template,
        willChange: 'opacity, transform',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
