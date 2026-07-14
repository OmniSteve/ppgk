import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll, useMotionValueEvent } from 'framer-motion';
import {
  Menu,
  X,
  ShieldCheck,
  TrendingUp,
  ClipboardCheck,
  CalendarCheck,
  Users,
  UserCheck,
  Wallet,
  UserPlus,
  Mail,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DotGridCanvas from '@/components/landing/DotGridCanvas';
import RotatingWord from '@/components/landing/RotatingWord';
import './LandingPage.css';

const ROTATING_WORDS = ['Technique', 'Confidence', 'Reactions', 'Positioning', 'Performance'];

// Anchors point to on-page sections; `route` entries are real application routes.
const NAV_LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'Coaching', href: '#coaching' },
  { label: 'Sessions', href: '/sessions', route: true },
  { label: 'Player Development', href: '#development' },
  { label: 'Contact', href: '#contact' },
];

const roleHome = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'coach' || role === 'head_coach') return '/coach';
  return '/dashboard';
};

const NavItem = ({ link, onClick, innerRef }) =>
  link.route ? (
    <Link to={link.href} onClick={onClick} ref={innerRef}>
      {link.label}
    </Link>
  ) : (
    <a href={link.href} onClick={onClick} ref={innerRef}>
      {link.label}
    </a>
  );

export default function LandingPage() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const menuToggleRef = useRef(null);
  const firstMobileLinkRef = useRef(null);
  const heroArtRef = useRef(null);

  // Sticky header intensifies its background/border once the page scrolls.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => setIsScrolled(latest > 10));

  // Scroll-reveal: observe .reveal elements and add .in when they enter the viewport.
  // On reduced-motion or no IntersectionObserver support, mark all visible immediately.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = document.querySelectorAll('.ppgk-landing .reveal');
    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Lock background scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Escape closes the menu and returns focus to the toggle button; opening
  // moves focus into the menu so keyboard users land somewhere useful.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    firstMobileLinkRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuToggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  // Subtle desktop-only pointer parallax on the goal graphic. Fine-pointer
  // devices only, disabled under reduced-motion; shifts the whole SVG a few
  // px via a CSS custom property so it never touches the ball's own
  // offset-path trajectory. Rect is measured once (+ on resize) rather than
  // per pointer move.
  useEffect(() => {
    if (shouldReduceMotion) return undefined;
    if (!window.matchMedia('(pointer: fine)').matches) return undefined;
    const el = heroArtRef.current;
    if (!el) return undefined;

    let rect = el.getBoundingClientRect();
    const onResize = () => { rect = el.getBoundingClientRect(); };
    window.addEventListener('resize', onResize);

    let frame = null;
    const onMove = (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        el.style.setProperty('--parallax-x', px.toFixed(3));
        el.style.setProperty('--parallax-y', py.toFixed(3));
      });
    };
    const onLeave = () => {
      el.style.setProperty('--parallax-x', '0');
      el.style.setProperty('--parallax-y', '0');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [shouldReduceMotion]);

  const closeMobile = () => setMobileOpen(false);
  const dashboardHref = user ? roleHome(user.role) : null;

  return (
    <div className="ppgk-landing">

      <motion.header
        initial={false}
        animate={isScrolled ? 'scrolled' : 'top'}
        variants={{
          top: { backgroundColor: 'hsl(var(--background) / 0.7)', boxShadow: 'none' },
          scrolled: { backgroundColor: 'hsl(var(--background) / 0.94)', boxShadow: '0 8px 24px -12px rgba(0,0,0,0.5)' },
        }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <nav className="nav" aria-label="Main">
          <a className="logo" href="#top">PP<span>GK</span></a>

          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <NavItem link={link} />
              </li>
            ))}
            <li>
              {dashboardHref ? (
                <Link to={dashboardHref}>Dashboard</Link>
              ) : (
                <Link to="/signin">Sign In</Link>
              )}
            </li>
            <li><Link className="btn btn-solid" to="/sessions">Book a session</Link></li>
          </ul>

          <div className="nav-mobile-actions">
            <Link className="btn btn-solid btn-sm" to="/sessions">Book a session</Link>
            <button
              ref={menuToggleRef}
              type="button"
              className="menu-toggle"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </nav>

        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.div
              id="mobile-menu"
              className="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <ul>
                {NAV_LINKS.map((link, i) => (
                  <li key={link.label}>
                    <NavItem link={link} onClick={closeMobile} innerRef={i === 0 ? firstMobileLinkRef : undefined} />
                  </li>
                ))}
                <li>
                  {dashboardHref ? (
                    <Link to={dashboardHref} onClick={closeMobile}>Dashboard</Link>
                  ) : (
                    <Link to="/signin" onClick={closeMobile}>Sign In</Link>
                  )}
                </li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <main id="top">

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section className="hero" aria-label="Introduction">
          <DotGridCanvas className="hero-canvas" />
          <div className="hero-canvas-fade" aria-hidden="true" />
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap hero-grid">

            <motion.div
              className="hero-copy"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: shouldReduceMotion ? 0 : 0.12,
                    delayChildren: shouldReduceMotion ? 0 : 0.05,
                  },
                },
              }}
            >
              <motion.span
                className="hero-lead"
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 },
                  visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.5 } },
                }}
              >
                <span className="dot" aria-hidden="true" />
                Coaching led by <strong>Matthew Towns</strong>
              </motion.span>

              <motion.h1
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 },
                  visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                Build better<br />
                <span className="rotating-clip">
                  <RotatingWord words={ROTATING_WORDS} active={!shouldReduceMotion} className="accent" />
                </span>
              </motion.h1>

              <motion.p
                className="lede"
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 },
                  visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                Professional goalkeeper coaching designed to develop technique, confidence,
                decision-making and match performance &mdash; structured individual and group
                sessions in Malta, with every player's progress tracked and shared after each
                evaluation.
              </motion.p>

              <motion.div
                className="hero-actions"
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 },
                  visible: { opacity: 1, y: 0, transition: { duration: shouldReduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] } },
                }}
              >
                <Link className="btn btn-solid" to="/sessions">
                  View Sessions
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link className="btn btn-ghost" to="/register">Create Account</Link>
              </motion.div>

              <motion.div
                className="hero-signin"
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0 },
                  visible: { opacity: 1, transition: { duration: shouldReduceMotion ? 0 : 0.5 } },
                }}
              >
                Already training with us? <Link to="/signin">Sign in</Link>
              </motion.div>

              <motion.div
                className="hero-platform"
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0 },
                  visible: { opacity: 1, transition: { duration: shouldReduceMotion ? 0 : 0.5 } },
                }}
              >
                <span><CalendarCheck size={15} aria-hidden="true" /> Book sessions online</span>
                <span><TrendingUp size={15} aria-hidden="true" /> Track player progress</span>
              </motion.div>

              <motion.div
                className="hero-meta"
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 1 } : { opacity: 0 },
                  visible: { opacity: 1, transition: { duration: shouldReduceMotion ? 0 : 0.5 } },
                }}
              >
                <span><strong>1-to-1</strong> and group sessions</span>
                <span><strong>10</strong> evaluation categories</span>
              </motion.div>
            </motion.div>

            {/* Signature element: the save, drawn as a training diagram */}
            <motion.div
              className="hero-art anim"
              aria-hidden="true"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.7, delay: shouldReduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <svg
                ref={heroArtRef}
                viewBox="0 0 460 340"
                role="img"
                aria-label="Diagram of a shot arcing towards the top corner and being saved"
              >
                {/* net: the two verticals and top rail nearest the save point are split
                    into their own group (.net-ripple) so impact can shake just that
                    corner instead of the whole net */}
                <g className="net-line">
                  <line x1="60"  y1="40" x2="60"  y2="300" />
                  <line x1="110" y1="40" x2="110" y2="300" />
                  <line x1="160" y1="40" x2="160" y2="300" />
                  <line x1="210" y1="40" x2="210" y2="300" />
                  <line x1="260" y1="40" x2="260" y2="300" />
                  <line x1="20"  y1="140" x2="400" y2="140" />
                  <line x1="20"  y1="190" x2="400" y2="190" />
                  <line x1="20"  y1="245" x2="400" y2="245" />
                </g>
                <g className="net-ripple">
                  <line x1="310" y1="40" x2="310" y2="300" />
                  <line x1="360" y1="40" x2="360" y2="300" />
                  <line x1="20"  y1="90"  x2="400" y2="90"  />
                </g>
                {/* goal frame */}
                <path className="frame-line" d="M20 300 L20 40 L400 40 L400 300" fill="none" />

                {/* shot trajectory to top corner */}
                <path className="shot-path" d="M20 300 C 140 240, 240 130, 318 74" />

                {/* faint trailing ghosts, drawn behind the ball via positive animation-delay
                    so they always lag the same fraction of a loop behind it */}
                <circle className="ball-trail ball-trail-1" r="6.5" />
                <circle className="ball-trail ball-trail-2" r="4.5" />
                {/* soft halo that blooms as the ball approaches the save point */}
                <circle className="ball-glow" r="15" />
                {/* ball + seam: both ride the same offset-path in lockstep (kept as
                    sibling shapes rather than a wrapping <g> — offset-path support
                    for plain SVG shapes is far more consistent across browsers than
                    for container elements). The seam gets its own extra rotation. */}
                <circle className="ball" r="9" />
                <path className="ball-seam" d="M-6 -3 Q 0 -7 6 -3 M-6 3 Q 0 7 6 3" />

                {/* save impact: flash + expanding ring at the contact point */}
                <circle className="impact-flash" cx="318" cy="74" r="7" />
                <circle className="impact-ring"  cx="318" cy="74" r="10" />

                {/* glove intercept: two strokes forming an open catch (the "save arc") */}
                <g className="glove-mark">
                  <path d="M330 52 q 14 10 10 32" />
                  <path d="M352 62 q 2 20 -16 28" />
                </g>

                {/* short-lived spark burst at the save point */}
                <g className="impact-particles">
                  <circle className="particle" cx="318" cy="74" r="2.2" style={{ '--dx': '-20px', '--dy': '-8px' }} />
                  <circle className="particle" cx="318" cy="74" r="1.8" style={{ '--dx': '-10px', '--dy': '-22px' }} />
                  <circle className="particle" cx="318" cy="74" r="2"   style={{ '--dx': '8px',   '--dy': '-24px' }} />
                  <circle className="particle" cx="318" cy="74" r="1.6" style={{ '--dx': '20px',  '--dy': '-10px' }} />
                  <circle className="particle" cx="318" cy="74" r="1.8" style={{ '--dx': '16px',  '--dy': '10px'  }} />
                  <circle className="particle" cx="318" cy="74" r="1.6" style={{ '--dx': '-6px',  '--dy': '16px'  }} />
                </g>

                <text className="save-label" x="300" y="120">Save. Reset. Again.</text>
              </svg>
            </motion.div>

          </div>

          <motion.a
            href="#coaching"
            className="scroll-cue"
            aria-label="Scroll to coaching benefits"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.6, delay: shouldReduceMotion ? 0 : 1.1 }}
          >
            <ChevronDown size={20} aria-hidden="true" />
          </motion.a>
        </section>

        {/* ── COACHING BENEFITS ──────────────────────────────────────────── */}
        <section id="coaching" className="rule-top" aria-labelledby="coaching-title">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Coaching</span>
              <h2 id="coaching-title">Coaching with a plan behind it</h2>
              <p className="lede">
                Every session belongs to a programme. Nothing is a one-off drill for the sake of
                it &mdash; each block builds the technical foundations a goalkeeper needs at
                their stage, with progress reviewed as they go.
              </p>
            </div>
            <div className="feature-grid">
              <article className="feature-card reveal">
                <span className="feature-icon"><ShieldCheck size={22} aria-hidden="true" /></span>
                <h3>Specialist goalkeeper coaching</h3>
                <p>
                  Goalkeeping is its own game. Sessions are led by a dedicated goalkeeper coach,
                  not folded into general outfield training.
                </p>
              </article>
              <article className="feature-card reveal reveal-delay-1">
                <span className="feature-icon"><TrendingUp size={22} aria-hidden="true" /></span>
                <h3>Structured player development</h3>
                <p>
                  Individual and group sessions sit inside development programmes, so parents
                  and players can see what is being worked on and why, week by week.
                </p>
              </article>
              <article className="feature-card reveal reveal-delay-2">
                <span className="feature-icon"><ClipboardCheck size={22} aria-hidden="true" /></span>
                <h3>Performance evaluations</h3>
                <p>
                  Coaches rate every goalkeeper across ten categories after each evaluation,
                  with notes and development priorities recorded for each player.
                </p>
              </article>
              <article className="feature-card reveal reveal-delay-3">
                <span className="feature-icon"><CalendarCheck size={22} aria-hidden="true" /></span>
                <h3>Simple online booking</h3>
                <p>
                  Buy credits, book sessions and manage more than one player from a single
                  account &mdash; no phone calls or spreadsheets required.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── PLAYER DEVELOPMENT ─────────────────────────────────────────── */}
        <section id="development" aria-labelledby="dev-title">
          <div className="wrap perf-grid">
            <div className="perf-copy reveal">
              <span className="eyebrow">Player development</span>
              <h2 id="dev-title">See the progress, not just the sessions</h2>
              <p className="lede">
                After evaluations, coaches rate each goalkeeper across ten categories and record
                strengths, priorities and notes. Parents see it all in one place.
              </p>
              <ul className="dev-tags" aria-label="Areas covered in coaching and evaluations">
                <li>Technical development</li>
                <li>Positioning &amp; decision-making</li>
                <li>Distribution</li>
                <li>Handling &amp; shot-stopping</li>
                <li>Communication &amp; confidence</li>
                <li>Coach evaluations &amp; progress tracking</li>
              </ul>
              <ul className="perf-points">
                <li>Ratings across shot stopping, handling, distribution, positioning and more</li>
                <li>Trend indicators showing what has improved since the last evaluation</li>
                <li>Coach notes and development priorities written for each player</li>
              </ul>
            </div>
            <div
              className="perf-card reveal reveal-delay-1"
              role="img"
              aria-label="Example evaluation card showing category ratings and trends"
            >
              <div className="perf-card-head">
                <span className="name">Evaluation</span>
                <span className="date">Latest session</span>
              </div>
              <div className="rating">
                <div className="rating-row">
                  <span className="cat">Shot stopping</span>
                  <span className="trend">&#9650; Improved</span>
                  <span className="bar"><i style={{ '--w': '82%' }}></i></span>
                </div>
                <div className="rating-row">
                  <span className="cat">Handling</span>
                  <span className="trend">&#9650; Improved</span>
                  <span className="bar"><i style={{ '--w': '74%' }}></i></span>
                </div>
                <div className="rating-row">
                  <span className="cat">Distribution</span>
                  <span className="trend">&#8211; Unchanged</span>
                  <span className="bar"><i style={{ '--w': '63%' }}></i></span>
                </div>
                <div className="rating-row">
                  <span className="cat">Positioning</span>
                  <span className="trend">&#9650; Improved</span>
                  <span className="bar"><i style={{ '--w': '70%' }}></i></span>
                </div>
                <div className="rating-row">
                  <span className="cat">One-on-ones</span>
                  <span className="trend">&#9650; Improved</span>
                  <span className="bar"><i style={{ '--w': '58%' }}></i></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section id="how-it-works" className="rule-top" aria-labelledby="how-title">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">How it works</span>
              <h2 id="how-title">From sign-up to first save</h2>
              <p className="lede">
                Getting a goalkeeper started with PPGK takes three steps, all managed from one
                account.
              </p>
            </div>
            <div className="credit-grid">
              <article className="credit-card reveal">
                <span className="k">Step 1</span>
                <h3>Create your account and player profile</h3>
                <p>
                  Register as a parent or player and add a profile for each goalkeeper you want
                  to book sessions for.
                </p>
              </article>
              <article className="credit-card reveal reveal-delay-1">
                <span className="k">Step 2</span>
                <h3>Choose a session or training package</h3>
                <p>
                  Buy a single session or a credit package, then book the sessions that suit your
                  schedule directly from your account.
                </p>
              </article>
              <article className="credit-card reveal reveal-delay-2">
                <span className="k">Step 3</span>
                <h3>Train, receive feedback and track development</h3>
                <p>
                  Confirmations, reminders and evaluation updates arrive automatically, so
                  progress is always visible between sessions.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── SESSIONS / PACKAGES ────────────────────────────────────────── */}
        <section id="packages" aria-labelledby="packages-title">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Sessions &amp; packages</span>
              <h2 id="packages-title">Find the right way to train</h2>
              <p className="lede">
                Browse current session availability and credit packages from your account.
                Pricing and schedules are kept up to date inside the platform.
              </p>
            </div>
            <div className="package-grid">
              <article className="package-card reveal">
                <span className="feature-icon"><Users size={22} aria-hidden="true" /></span>
                <h3>Group goalkeeper sessions</h3>
                <p>
                  Small-group training that adds match realism &mdash; crosses, one-on-ones and
                  communication under pressure.
                </p>
                <Link className="package-link" to="/sessions">
                  View upcoming sessions
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
              <article className="package-card reveal reveal-delay-1">
                <span className="feature-icon"><UserCheck size={22} aria-hidden="true" /></span>
                <h3>Individual coaching</h3>
                <p>
                  Focused 1-to-1 technical work on the areas a goalkeeper needs most, set at
                  their own pace.
                </p>
                <Link className="package-link" to="/sessions">
                  View upcoming sessions
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
              <article className="package-card reveal reveal-delay-2">
                <span className="feature-icon"><Wallet size={22} aria-hidden="true" /></span>
                <h3>Training credit packages</h3>
                <p>
                  Buy credits in advance for better value across multiple sessions, with balance
                  and expiry always visible in your account.
                </p>
                <Link className="package-link" to="/packages">
                  See packages
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* ── COACH / CREDIBILITY ─────────────────────────────────────────── */}
        <section id="coach" className="coach" aria-labelledby="coach-title">
          <div className="wrap coach-grid">
            <div className="reveal">
              <div className="coach-id">
                <span className="coach-avatar" role="img" aria-label="Coach initials placeholder">MT</span>
                <span className="coach-id-text">
                  <strong>Matthew Towns</strong>
                  <span>Head Coach, Premier Performance Goalkeeping</span>
                </span>
              </div>
              <h2 id="coach-title" style={{ margin: '1.4rem 0 1.6rem' }}>
                Goalkeeping is its own game
              </h2>
              <p className="coach-quote">
                "Goalkeepers are made in the details:{' '}
                <span className="accent">set position, first touch, one more save</span>{' '}
                than the striker expects."
              </p>
            </div>
            <div className="coach-facts reveal reveal-delay-1">
              <div className="fact">
                <span className="k">Specialism</span>
                <span className="v">Goalkeeping only</span>
              </div>
              <div className="fact">
                <span className="k">Based in</span>
                <span className="v">Malta</span>
              </div>
              <div className="fact">
                <span className="k">Session types</span>
                <span className="v">1-to-1 / Group / Programme</span>
              </div>
              <div className="fact">
                <span className="k">Evaluation categories</span>
                <span className="v">10 per player</span>
              </div>
              <div className="fact">
                <span className="k">Progress shared with</span>
                <span className="v">Parents and players</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
        <section id="book" className="cta" aria-labelledby="cta-title">
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap inner reveal">
            <span className="eyebrow" style={{ justifyContent: 'center' }}>Get started</span>
            <h2 id="cta-title">Give your goalkeeper a coach of their own</h2>
            <p className="lede">
              Create an account, add your player's profile and book their first session in
              minutes.
            </p>
            <div className="cta-actions">
              <Link className="btn btn-solid" to="/sessions">
                <CalendarCheck size={16} aria-hidden="true" />
                View upcoming sessions
              </Link>
              <Link className="btn btn-ghost" to="/register">
                <UserPlus size={16} aria-hidden="true" />
                Create an account
              </Link>
              <a className="btn btn-ghost" href="mailto:info@ppgk.app">
                <Mail size={16} aria-hidden="true" />
                Contact Matthew
              </a>
            </div>
          </div>
        </section>

      </main>

      <footer id="contact">
        <div className="wrap foot-grid">
          <div className="foot-brand">
            <a className="logo" href="#top">PP<span>GK</span></a>
            <p>Specialist goalkeeper coaching, Malta.</p>
          </div>

          <div className="foot-col">
            <span className="foot-heading">Platform</span>
            <a href="#coaching">Coaching</a>
            <Link to="/sessions">Sessions</Link>
            <a href="#development">Player development</a>
            <Link to="/packages">Packages</Link>
          </div>

          <div className="foot-col">
            <span className="foot-heading">Account</span>
            <Link to="/signin">Sign in</Link>
            <Link to="/register">Create an account</Link>
          </div>

          <div className="foot-col">
            <span className="foot-heading">Contact &amp; legal</span>
            <a href="mailto:info@ppgk.app">info@ppgk.app</a>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms and Conditions</Link>
          </div>
        </div>
        <div className="wrap foot-bottom">
          <span className="mono">&copy; {new Date().getFullYear()} PPGK &middot; Premier Performance Goalkeeping</span>
          <span className="mono">ppgk.app</span>
        </div>
      </footer>

    </div>
  );
}
