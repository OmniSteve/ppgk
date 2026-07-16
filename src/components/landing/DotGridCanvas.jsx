import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

const DOT_SPACING = 26;
const DOT_SPACING_MOBILE = 34;
const BASE_OPACITY_MIN = 0.22;
const BASE_OPACITY_MAX = 0.38;
const BASE_RADIUS = 1;
const INTERACTION_RADIUS = 130;
const INTERACTION_RADIUS_SQ = INTERACTION_RADIUS * INTERACTION_RADIUS;
const OPACITY_BOOST = 0.55;
const RADIUS_BOOST = 2;
const GRID_CELL_SIZE = Math.max(50, Math.floor(INTERACTION_RADIUS / 1.5));

/**
 * Decorative animated dot grid, rendered app-wide by GlobalDotGrid as a
 * fixed background layer. Dots idle-pulse and brighten near the pointer,
 * coloured from the active theme's --primary so it follows Classic /
 * Floodlit / Midnight automatically. Sizes itself to its parent element.
 *
 * Renders a single static frame (no RAF loop, no pointer tracking) when the
 * user prefers reduced motion, and pauses the loop whenever the tab is
 * hidden. Purely decorative — hidden from assistive tech.
 */
export default function DotGridCanvas({ className }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dotsRef = useRef([]);
  const gridRef = useRef({});
  const sizeRef = useRef({ width: 0, height: 0 });
  const mouseRef = useRef({ x: null, y: null });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    // Read the active theme's primary colour (an "H S% L%" triplet) so dots
    // match Classic / Floodlit / Midnight without hardcoding a colour here.
    const primaryHsl = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim() || '221 83% 53%';

    const spacing = window.innerWidth < 640 ? DOT_SPACING_MOBILE : DOT_SPACING;

    const createDots = () => {
      const { width, height } = sizeRef.current;
      if (!width || !height) return;
      const dots = [];
      const grid = {};
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing + spacing / 2;
          const y = j * spacing + spacing / 2;
          const cellKey = `${Math.floor(x / GRID_CELL_SIZE)}_${Math.floor(y / GRID_CELL_SIZE)}`;
          if (!grid[cellKey]) grid[cellKey] = [];
          grid[cellKey].push(dots.length);
          const targetOpacity = Math.random() * (BASE_OPACITY_MAX - BASE_OPACITY_MIN) + BASE_OPACITY_MIN;
          dots.push({
            x,
            y,
            currentOpacity: targetOpacity,
            targetOpacity,
            opacitySpeed: Math.random() * 0.004 + 0.0015,
          });
        }
      }
      dotsRef.current = dots;
      gridRef.current = grid;
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const width = parent ? parent.clientWidth : window.innerWidth;
      const height = parent ? parent.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width, height };
      createDots();
    };

    const drawStaticFrame = () => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);
      dotsRef.current.forEach((dot) => {
        ctx.beginPath();
        ctx.fillStyle = `hsl(${primaryHsl} / ${dot.targetOpacity.toFixed(3)})`;
        ctx.arc(dot.x, dot.y, BASE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    if (prefersReducedMotion) {
      resize();
      drawStaticFrame();
      const onResize = () => { resize(); drawStaticFrame(); };
      window.addEventListener('resize', onResize, { passive: true });
      return () => window.removeEventListener('resize', onResize);
    }

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const handleMouseLeave = () => { mouseRef.current = { x: null, y: null }; };

    const animate = () => {
      const { width, height } = sizeRef.current;
      const { x: mouseX, y: mouseY } = mouseRef.current;
      if (!width || !height) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      const active = new Set();
      if (mouseX !== null && mouseY !== null) {
        const mCellX = Math.floor(mouseX / GRID_CELL_SIZE);
        const mCellY = Math.floor(mouseY / GRID_CELL_SIZE);
        const searchRadius = Math.ceil(INTERACTION_RADIUS / GRID_CELL_SIZE);
        for (let i = -searchRadius; i <= searchRadius; i++) {
          for (let j = -searchRadius; j <= searchRadius; j++) {
            const key = `${mCellX + i}_${mCellY + j}`;
            if (gridRef.current[key]) gridRef.current[key].forEach((idx) => active.add(idx));
          }
        }
      }

      dotsRef.current.forEach((dot, index) => {
        dot.currentOpacity += dot.opacitySpeed;
        if (dot.currentOpacity >= dot.targetOpacity || dot.currentOpacity <= BASE_OPACITY_MIN) {
          dot.opacitySpeed = -dot.opacitySpeed;
          dot.currentOpacity = Math.max(BASE_OPACITY_MIN, Math.min(dot.currentOpacity, BASE_OPACITY_MAX));
          dot.targetOpacity = Math.random() * (BASE_OPACITY_MAX - BASE_OPACITY_MIN) + BASE_OPACITY_MIN;
        }

        let interaction = 0;
        let radius = BASE_RADIUS;
        if (mouseX !== null && mouseY !== null && active.has(index)) {
          const dx = dot.x - mouseX;
          const dy = dot.y - mouseY;
          const distSq = dx * dx + dy * dy;
          if (distSq < INTERACTION_RADIUS_SQ) {
            const factor = Math.max(0, 1 - Math.sqrt(distSq) / INTERACTION_RADIUS);
            interaction = factor * factor;
            radius += interaction * RADIUS_BOOST;
          }
        }

        const opacity = Math.min(1, dot.currentOpacity + interaction * OPACITY_BOOST);
        ctx.beginPath();
        ctx.fillStyle = `hsl(${primaryHsl} / ${opacity.toFixed(3)})`;
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibility);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
