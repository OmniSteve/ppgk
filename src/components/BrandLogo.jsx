import React, { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared PPGK brand logo, served from R2 through the Worker's fixed-key
 * asset route (see worker/src/routes/assets.js). The relative URL means the
 * dev and production domains each hit their own environment's bucket — no
 * per-environment config needed here.
 */
export const BRAND_LOGO_URL = '/api/assets/logo_small.png';

const BRAND_ALT = 'Premier Performance Goalkeeping';

// Width-only sizing: height stays auto so the 769×542 source keeps its
// aspect ratio at every size.
const VARIANT_CLASSES = {
  header: 'w-[100px] md:w-[124px]',      // public landing navigation
  sidebar: 'w-[124px]',                  // expanded desktop sidebars
  sidebarCollapsed: 'w-10',              // narrow icon-rail sidebars
  compact: 'w-[96px]',                   // mobile headers / tight toolbars
  auth: 'w-[150px] sm:w-[184px]',        // sign-in / register cards
};

export default function BrandLogo({ variant = 'header', to = '/', className = '', onClick }) {
  const [failed, setFailed] = useState(false);

  // One-shot fallback: once the image errors we stop rendering the <img>
  // entirely, so there is no reload/retry loop.
  const logo = failed ? (
    <span className="font-black tracking-wide text-foreground whitespace-nowrap">
      PP<span className="text-primary">GK</span>
    </span>
  ) : (
    <img
      src={BRAND_LOGO_URL}
      alt={BRAND_ALT}
      className={`${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.header} h-auto object-contain`}
      onError={() => setFailed(true)}
    />
  );

  if (to === null) {
    return <span className={`inline-flex items-center ${className}`}>{logo}</span>;
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label={BRAND_ALT}
      className={`inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      {logo}
    </Link>
  );
}
