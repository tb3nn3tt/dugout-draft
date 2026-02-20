import { DraftRoundType } from '../../types';
import './SpecialRoundBanner.css';

interface SpecialRoundBannerProps {
  roundType: DraftRoundType;
  roundNumber: number;
}

const ROUND_CONFIG: Record<DraftRoundType, {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
}> = {
  normal: {
    title: 'Draft Round',
    subtitle: 'Current MLB Players',
    icon: '⚾',
    color: '#3498db',
  },
  legends: {
    title: 'LEGENDS ROUND',
    subtitle: 'Baseball Hall of Famers',
    icon: '🏆',
    color: '#ffd700',
  },
  niners: {
    title: 'THE NINERS',
    subtitle: "Coach's 12U All-Stars",
    icon: '⚾',
    color: '#00bfff',
  },
  peak: {
    title: 'PEAK PERFORMANCE',
    subtitle: 'Single-Season Greats',
    icon: '⭐',
    color: '#ff6b6b',
  },
  decade_classic: {
    title: 'CLASSIC ERA',
    subtitle: 'Stars of the 60s & 70s',
    icon: '📻',
    color: '#cd853f',
  },
  decade_modern: {
    title: 'MODERN ERA',
    subtitle: 'Stars of the 80s & 90s',
    icon: '📼',
    color: '#ff4500',
  },
  fictional: {
    title: 'MOVIE MAGIC',
    subtitle: 'Baseball Movie Heroes',
    icon: '🎬',
    color: '#9b59b6',
  },
  playoff_heroes: {
    title: 'PLAYOFF HEROES',
    subtitle: 'October Legends',
    icon: '🏟️',
    color: '#228b22',
  },
  one_year_wonders: {
    title: 'ONE-YEAR WONDERS',
    subtitle: 'Lightning Struck Once',
    icon: '⚡',
    color: '#ff6b35',
  },
  busts: {
    title: 'WHAT COULD HAVE BEEN',
    subtitle: "Can't Miss Prospects Who Missed",
    icon: '💔',
    color: '#dc2626',
  },
  mystery: {
    title: 'MYSTERY ROUND',
    subtitle: 'Draft Blind - Info Hidden!',
    icon: '❓',
    color: '#8b5cf6',
  },
  auction: {
    title: 'AUCTION ROUND',
    subtitle: 'Bid for an Elite Player!',
    icon: '💰',
    color: '#10b981',
  },
  steroid_era: {
    title: 'TAINTED LEGENDS',
    subtitle: 'Controversial Greats of the Steroid Era',
    icon: '💪',
    color: '#ff1744',
  },
  international: {
    title: 'INTERNATIONAL LEGENDS',
    subtitle: 'NPB, Negro Leagues & Cuba',
    icon: '🌍',
    color: '#00acc1',
  },
  coach: {
    title: 'COACH ROUND',
    subtitle: 'Draft Your Head Coach',
    icon: '📋',
    color: '#2c3e50',
  },
};

export function SpecialRoundBanner({ roundType, roundNumber }: SpecialRoundBannerProps) {
  const config = ROUND_CONFIG[roundType];

  if (roundType === 'normal') {
    return null;
  }

  return (
    <div className={`special-round-banner ${roundType}-round`}>
      <div className="banner-glow" style={{ '--glow-color': config.color } as React.CSSProperties} />
      <div className="banner-content">
        <span className="banner-icon">{config.icon}</span>
        <div className="banner-text">
          <h3 className="banner-title">{config.title}</h3>
          <p className="banner-subtitle">{config.subtitle}</p>
        </div>
        <span className="banner-round">Round {roundNumber}</span>
      </div>
      <div className="banner-decoration">
        <span className="star">✦</span>
        <span className="star">✦</span>
        <span className="star">✦</span>
      </div>
    </div>
  );
}

export function getRoundType(pickNumber: number): DraftRoundType {
  const roundNumber = Math.ceil(pickNumber / 2);

  // Special rounds schedule:
  if (roundNumber === 3) return 'legends';
  if (roundNumber === 5) return 'niners';
  if (roundNumber === 7) return 'peak';
  if (roundNumber === 9) return 'decade_classic';
  if (roundNumber === 11) return 'coach';
  if (roundNumber === 13) return 'decade_modern';
  if (roundNumber === 14) return 'fictional';
  if (roundNumber === 16) return 'mystery';
  if (roundNumber === 18) return 'playoff_heroes';
  if (roundNumber === 20) return 'one_year_wonders';
  if (roundNumber === 22) return 'busts';
  if (roundNumber === 24) return 'auction';
  if (roundNumber === 25) return 'steroid_era';
  if (roundNumber === 26) return 'international';

  return 'normal';
}

export function isSpecialRound(pickNumber: number): boolean {
  return getRoundType(pickNumber) !== 'normal';
}
