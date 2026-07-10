import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

export default function LandingPage() {
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

  return (
    <div className="ppgk-landing">

      <header>
        <nav className="nav" aria-label="Main">
          <a className="logo" href="#top">PP<span>GK</span></a>
          <ul className="nav-links">
            <li><a href="#programmes">Programmes</a></li>
            <li><a href="#performance">Performance</a></li>
            <li><a href="#credits">How it works</a></li>
            <li><a className="btn btn-solid" href="#book">Book a session</a></li>
          </ul>
        </nav>
      </header>

      <main id="top">

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <section className="hero" aria-label="Introduction">
          <div className="wrap hero-grid">

            <div className="hero-copy">
              <span className="eyebrow stagger">Specialist goalkeeper coaching, Malta</span>
              <h1 className="stagger">
                Built in the box.<br />
                <span className="accent">Proven on match day.</span>
              </h1>
              <p className="lede stagger">
                Premier Performance Goalkeeping develops young goalkeepers through structured
                individual and group sessions, with every player's progress tracked and shared
                after each evaluation.
              </p>
              <div className="hero-actions stagger">
                <a className="btn btn-solid" href="#book">Book a session</a>
                <a className="btn btn-ghost" href="#programmes">See the programmes</a>
              </div>
              <div className="hero-meta stagger">
                <span><strong>1-to-1</strong> and group sessions</span>
                <span><strong>10</strong> evaluation categories</span>
                <span>Head Coach <strong>Matthew Towns</strong></span>
              </div>
            </div>

            {/* Signature element: the save, drawn as a training diagram */}
            <div className="hero-art anim" aria-hidden="true">
              <svg
                viewBox="0 0 460 340"
                role="img"
                aria-label="Diagram of a shot arcing towards the top corner and being saved"
              >
                {/* net */}
                <g className="net-line">
                  <line x1="60"  y1="40" x2="60"  y2="300" />
                  <line x1="110" y1="40" x2="110" y2="300" />
                  <line x1="160" y1="40" x2="160" y2="300" />
                  <line x1="210" y1="40" x2="210" y2="300" />
                  <line x1="260" y1="40" x2="260" y2="300" />
                  <line x1="310" y1="40" x2="310" y2="300" />
                  <line x1="360" y1="40" x2="360" y2="300" />
                  <line x1="20"  y1="90"  x2="400" y2="90"  />
                  <line x1="20"  y1="140" x2="400" y2="140" />
                  <line x1="20"  y1="190" x2="400" y2="190" />
                  <line x1="20"  y1="245" x2="400" y2="245" />
                </g>
                {/* goal frame */}
                <path className="frame-line" d="M20 300 L20 40 L400 40 L400 300" fill="none" />
                {/* shot trajectory to top corner */}
                <path className="shot-path" d="M20 300 C 140 240, 240 130, 318 74" />
                {/* ball travelling the path */}
                <circle className="ball" r="9" />
                {/* glove intercept: two strokes forming an open catch */}
                <g className="glove-mark">
                  <path d="M330 52 q 14 10 10 32" />
                  <path d="M352 62 q 2 20 -16 28" />
                </g>
                <text className="save-label" x="300" y="120">Save. Reset. Again.</text>
              </svg>
            </div>

          </div>
        </section>

        {/* ── PROGRAMMES ──────────────────────────────────────────────────── */}
        <section id="programmes" className="rule-top" aria-labelledby="prog-title">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">Programmes</span>
              <h2 id="prog-title">Coaching with a plan behind it</h2>
              <p className="lede">
                Every session belongs to a programme. Nothing is a one-off drill for the sake
                of it; each block builds the technical foundations a goalkeeper needs at their
                stage.
              </p>
            </div>
            <div className="prog-list">
              <div className="prog-row reveal">
                <span className="prog-tag">1-to-1</span>
                <h3>Individual sessions</h3>
                <p>
                  Focused technical work on the areas a goalkeeper needs most, from shot
                  stopping and handling to footwork and distribution, set at the player's pace.
                </p>
              </div>
              <div className="prog-row reveal reveal-delay-1">
                <span className="prog-tag">Group</span>
                <h3>Group sessions</h3>
                <p>
                  Small-group training that adds realism: crosses, one-on-ones and
                  communication under pressure, with goalkeepers pushing each other on.
                </p>
              </div>
              <div className="prog-row reveal reveal-delay-2">
                <span className="prog-tag">Programme</span>
                <h3>Development programmes</h3>
                <p>
                  Structured blocks of sessions with clear objectives, so parents and players
                  can see what is being worked on and why, week by week.
                </p>
              </div>
              <div className="prog-row reveal reveal-delay-3">
                <span className="prog-tag">Match prep</span>
                <h3>Performance development</h3>
                <p>
                  Longer-term progression for committed goalkeepers, connecting evaluations,
                  development priorities and training focus into one pathway.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── PERFORMANCE ─────────────────────────────────────────────────── */}
        <section id="performance" aria-labelledby="perf-title">
          <div className="wrap perf-grid">
            <div className="perf-copy reveal">
              <span className="eyebrow">Performance tracking</span>
              <h2 id="perf-title">See the progress, not just the sessions</h2>
              <p className="lede">
                After evaluations, coaches rate each goalkeeper across ten categories and
                record strengths, priorities and notes. Parents see it all in one place.
              </p>
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

        {/* ── CREDITS / HOW IT WORKS ──────────────────────────────────────── */}
        <section id="credits" className="rule-top" aria-labelledby="credit-title">
          <div className="wrap">
            <div className="section-head reveal">
              <span className="eyebrow">How it works</span>
              <h2 id="credit-title">Credits in. Sessions booked. Sorted.</h2>
              <p className="lede">
                Parents manage everything from one account: buy a session or a package of
                credits, book the sessions that suit you, and amend when plans change.
              </p>
            </div>
            <div className="credit-grid">
              <article className="credit-card reveal">
                <span className="k">Step 1</span>
                <h3>Buy credits</h3>
                <p>
                  Purchase a single session or a package. Your credit balance and expiry dates
                  are always visible in your account, so there are no surprises.
                </p>
              </article>
              <article className="credit-card reveal reveal-delay-1">
                <span className="k">Step 2</span>
                <h3>Book sessions</h3>
                <p>
                  See available sessions and book directly. Managing more than one goalkeeper?
                  Book different players onto different sessions from the same account.
                </p>
              </article>
              <article className="credit-card reveal reveal-delay-2">
                <span className="k">Step 3</span>
                <h3>Stay in the loop</h3>
                <p>
                  Confirmations, reminders and evaluation updates arrive automatically. If
                  plans change, eligible bookings can be amended within the permitted window.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── COACH / CREDIBILITY ─────────────────────────────────────────── */}
        <section className="coach" aria-labelledby="coach-title">
          <div className="wrap coach-grid">
            <div className="reveal">
              <span className="eyebrow">The coaching</span>
              <h2 id="coach-title" style={{ margin: '1.1rem 0 1.6rem' }}>
                Goalkeeping is its own game
              </h2>
              <p className="coach-quote">
                "Goalkeepers are made in the details:{' '}
                <span className="accent">set position, first touch, one more save</span>{' '}
                than the striker expects."
              </p>
              <p className="coach-name">
                <strong>Matthew Towns</strong>, Head Coach, Premier Performance Goalkeeping
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
          <div className="wrap inner reveal">
            <span className="eyebrow" style={{ justifyContent: 'center' }}>Get started</span>
            <h2 id="cta-title">Give your goalkeeper a coach of their own</h2>
            <p className="lede">
              Create an account, add your player's profile and book their first session in
              minutes.
            </p>
            <div className="hero-actions" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-solid" to="/register">Create an account</Link>
              <a className="btn btn-ghost" href="#programmes">Explore programmes first</a>
            </div>
          </div>
        </section>

      </main>

      <footer>
        <div className="wrap foot">
          <span className="mono">PPGK &middot; Premier Performance Goalkeeping</span>
          <span>Specialist goalkeeper coaching, Malta</span>
          <span className="mono">ppgk.app</span>
        </div>
      </footer>

    </div>
  );
}
