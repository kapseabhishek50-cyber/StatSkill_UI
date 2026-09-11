import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { reducedMotion } from '../../hooks/useScrollFX.js';

/**
 * Full-bleed three.js scene behind the hero.
 *
 * A wireframe icosahedron core with satellite solids and a drifting particle
 * field, all in the platform's navy/blue palette. The group leans toward the
 * pointer and drifts with scroll; everything pauses when off-screen or when
 * the tab is hidden. With prefers-reduced-motion it renders a single still
 * frame — depth without movement.
 */

const NAVY = 0x063b78;
const BLUE = 0x0066e6;
const BRIGHT = 0x1677ff;
const ICE = 0xb9d6f8;

function buildShape(geometry, color, opacity = 1, wireframe = true) {
  const material = new THREE.MeshBasicMaterial({
    color,
    wireframe,
    transparent: true,
    opacity,
  });
  return new THREE.Mesh(geometry, material);
}

export default function Hero3DScene({ className = '', density = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof THREE === 'undefined') return undefined;

    const still = reducedMotion();
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      return undefined; // no WebGL — the CSS layers carry the design alone
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
    renderer.setPixelRatio(dpr);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xf5f9fd, 14, 30);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    const world = new THREE.Group();
    scene.add(world);

    const disposables = [];
    const track = (obj) => {
      disposables.push(obj);
      return obj;
    };

    // ── Core icosahedron ──────────────────────────────────────────────
    const core = new THREE.Group();
    core.add(track(buildShape(new THREE.IcosahedronGeometry(2.6, 1), BLUE, 0.5)));
    const inner = track(buildShape(new THREE.IcosahedronGeometry(1.55, 0), NAVY, 0.75));
    core.add(inner);
    // Soft core glow
    const glowMat = track(
      new THREE.MeshBasicMaterial({ color: BRIGHT, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending }),
    );
    core.add(new THREE.Mesh(track(new THREE.SphereGeometry(1.02, 24, 24)), glowMat));
    core.position.set(3.4, 0.2, -1);
    world.add(core);

    // ── Satellites ────────────────────────────────────────────────────
    const torus = track(buildShape(new THREE.TorusGeometry(1.15, 0.34, 12, 28), BRIGHT, 0.55));
    torus.position.set(-4.3, 1.7, -2);
    world.add(torus);

    const octa = track(buildShape(new THREE.OctahedronGeometry(0.95, 0), ICE, 0.9));
    octa.position.set(-2.6, -2.1, 0.4);
    world.add(octa);

    const ring = track(buildShape(new THREE.TorusGeometry(3.5, 0.02, 8, 90), NAVY, 0.35));
    ring.position.copy(core.position);
    ring.rotation.x = Math.PI / 2.4;
    world.add(ring);

    const ring2 = track(buildShape(new THREE.TorusGeometry(4.3, 0.014, 8, 100), BLUE, 0.28));
    ring2.position.copy(core.position);
    ring2.rotation.x = Math.PI / 1.9;
    ring2.rotation.y = 0.5;
    world.add(ring2);

    // ── Particle field ────────────────────────────────────────────────
    const COUNT = Math.round(700 * density);
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;
      speeds[i] = 0.1 + Math.random() * 0.5;
    }
    const particleGeo = track(new THREE.BufferGeometry());
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = track(
      new THREE.PointsMaterial({ color: BLUE, size: 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true }),
    );
    const particles = new THREE.Points(particleGeo, particleMat);
    world.add(particles);

    // ── Pointer + scroll state ────────────────────────────────────────
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let scrollDrift = 0;
    let scrollTarget = 0;

    const onPointer = (event) => {
      pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const onScroll = () => {
      scrollTarget = Math.min(1.6, window.scrollY / Math.max(1, window.innerHeight));
    };

    const onResize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement || canvas;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    onResize();
    onScroll();

    if (!still) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('resize', onResize);

    // Pause when the hero scrolls out of view or the tab hides.
    let inView = true;
    let pageVisible = true;
    let visible = true;
    const computeVisible = () => {
      visible = inView && pageVisible;
    };
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      computeVisible();
    });
    io.observe(canvas);
    const onVisibility = () => {
      pageVisible = !document.hidden;
      computeVisible();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const clock = new THREE.Clock();
    let raf = 0;

    const renderFrame = () => {
      const t = clock.getElapsedTime();

      core.rotation.y = t * 0.16;
      core.rotation.x = Math.sin(t * 0.22) * 0.22;
      inner.rotation.y = -t * 0.32;
      torus.rotation.x = t * 0.24;
      torus.rotation.y = t * 0.12;
      octa.rotation.y = t * 0.3;
      octa.rotation.z = t * 0.14;
      ring.rotation.z = t * 0.08;
      ring2.rotation.z = -t * 0.06;

      core.position.y = 0.2 + Math.sin(t * 0.7) * 0.22;
      torus.position.y = 1.7 + Math.sin(t * 0.8 + 1.7) * 0.3;
      octa.position.y = -2.1 + Math.sin(t * 0.65 + 3.1) * 0.26;

      // Particles rise slowly and wrap.
      const pos = particleGeo.attributes.position;
      for (let i = 0; i < COUNT; i += 1) {
        let y = pos.getY(i) + speeds[i] * 0.008;
        if (y > 8) y = -8;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;

      // Pointer lean (lerped) + scroll drift.
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      scrollDrift += (scrollTarget - scrollDrift) * 0.08;

      world.rotation.y = pointer.x * 0.12;
      world.rotation.x = pointer.y * 0.08;
      world.position.y = scrollDrift * 2.2;
      camera.position.z = 11 + scrollDrift * 2.4;

      renderer.render(scene, camera);
    };

    if (still) {
      // A single composed frame: depth without motion.
      world.rotation.y = 0.16;
      renderer.render(scene, camera);
    } else {
      const loop = () => {
        if (visible) renderFrame();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      disposables.forEach((obj) => obj.dispose?.());
      renderer.dispose();
    };
  }, [density]);

  return <canvas ref={canvasRef} className={`hero3d-canvas ${className}`} aria-hidden="true" />;
}
