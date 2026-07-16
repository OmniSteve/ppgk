import { memo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import DotGridCanvas from '@/components/landing/DotGridCanvas';

// Memoised so navigation (which only swaps the wrapper's opacity class)
// never re-renders the canvas or restarts its animation loop.
const Canvas = memo(DotGridCanvas);

/**
 * Single app-wide reactive dot-grid background.
 *
 * Mounted once in App.jsx so one canvas instance persists across route
 * changes. Lives in a fixed full-viewport layer with a negative z-index —
 * above the body background, below all page content — and never captures
 * pointer events. The canvas remounts on theme change (key) so the dots
 * re-sample the active theme's --primary colour.
 */
export default function GlobalDotGrid() {
  const { theme } = useTheme();
  const { pathname } = useLocation();
  // Full strength on the marketing landing page; dialled back everywhere
  // else so dashboards, tables and forms stay easy to read.
  const emphasis = pathname === '/' ? 'opacity-90' : 'opacity-55';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 -z-10 pointer-events-none transition-opacity duration-500 print:hidden ${emphasis}`}
    >
      <Canvas key={theme} className="block w-full h-full pointer-events-none" />
    </div>
  );
}
