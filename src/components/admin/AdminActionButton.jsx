import React from 'react';
import { Link } from 'react-router-dom';

// Shared row-action icon button for the admin User/Player/Coach management
// tables. Sizing is deliberately NOT baked in here — callers always pass it
// via `className` (e.g. `w-full h-11 sm:w-9 sm:h-9`). Mixing an unprefixed
// Tailwind utility here with an unprefixed override at the call site would
// make the winner depend on Tailwind's internal generation order rather than
// className order, so every caller supplies a complete, unambiguous size.
const VARIANTS = {
  default:     'bg-accent hover:bg-primary text-muted-foreground hover:text-foreground',
  warning:     'bg-accent hover:bg-warning text-muted-foreground hover:text-warning-foreground',
  success:     'bg-accent hover:bg-success text-muted-foreground hover:text-success-foreground',
  destructive: 'bg-accent hover:bg-destructive text-muted-foreground hover:text-destructive-foreground',
};

export function AdminActionButton({ icon: Icon, label, onClick, to, variant = 'default', size = 14, className = '' }) {
  const cls = `rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${VARIANTS[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to.pathname} state={to.state} title={label} aria-label={label} className={cls}>
        <Icon size={size} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={cls}>
      <Icon size={size} />
    </button>
  );
}
