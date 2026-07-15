import badge from '@/assets/hero-logo/badge.png';
import ball from '@/assets/hero-logo/ball.png';
import glow from '@/assets/hero-logo/glow.png';

/**
 * Animated PPGK crest: the badge fades in, then the ball flies in from the
 * top right trailing its glow, landing on the crest with a brief flash and
 * impact bump. Plays once on mount; a static assembled state is shown when
 * prefers-reduced-motion is set (see LandingPage.css).
 */
export default function PPGKHeroLogo() {
  return (
    <div className="hero-logo">
      <div className="hero-logo-comet">
        <img src={glow} alt="" className="hero-logo-glow" />
        <div className="hero-logo-ball">
          <img src={ball} alt="" />
        </div>
        <img src={badge} alt="" className="hero-logo-badge hero-logo-badge-top" />
      </div>
      <img src={badge} alt="" className="hero-logo-badge hero-logo-badge-bottom" />
      <div className="hero-logo-flash" />
    </div>
  );
}
