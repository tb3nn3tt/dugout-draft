import { useState, useEffect } from 'react';
import { Player } from '../../types';
import { getOverallRating, getPositionColor, isPitcher, getSpecialtyBadge } from '../../utils/helpers';
import './MysteryReveal.css';

interface MysteryRevealProps {
  player: Player;
  onDismiss: () => void;
}

type Tier = 'diamond' | 'gold' | 'silver' | 'bronze';

function getPlayerTier(overall: number): Tier {
  if (overall >= 90) return 'diamond';
  if (overall >= 85) return 'gold';
  if (overall >= 80) return 'silver';
  return 'bronze';
}

const TIER_CONFIG: Record<Tier, { label: string; color: string; icon: string }> = {
  diamond: { label: 'DIAMOND', color: '#00d4ff', icon: '\u{1F48E}' },
  gold: { label: 'GOLD', color: '#ffd700', icon: '\u{1F947}' },
  silver: { label: 'SILVER', color: '#c0c0c0', icon: '\u{1F948}' },
  bronze: { label: 'BRONZE', color: '#cd7f32', icon: '\u{1F949}' },
};

export function MysteryReveal({ player, onDismiss }: MysteryRevealProps) {
  const [phase, setPhase] = useState<'drumroll' | 'reveal'>('drumroll');
  const rating = getOverallRating(player.overall);
  const tier = getPlayerTier(player.overall);
  const tierInfo = TIER_CONFIG[tier];
  const pitcher = isPitcher(player);
  const specialty = getSpecialtyBadge(player);

  useEffect(() => {
    const timer = setTimeout(() => setPhase('reveal'), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss after 4 seconds total (1.2s drumroll + 2.8s reveal)
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(), 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="mystery-reveal-overlay" onClick={phase === 'reveal' ? onDismiss : undefined}>
      <div className="mystery-reveal-modal" onClick={e => e.stopPropagation()}>
        {phase === 'drumroll' ? (
          <div className="drumroll">
            <div className="drumroll-icon">{'\u2753'}</div>
            <div className="drumroll-text">Revealing your pick...</div>
            <div className="drumroll-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        ) : (
          <div className={`mr-reveal-content mr-tier-${tier}`}>
            <div className="mr-tier-badge" style={{ color: tierInfo.color }}>
              <span>{tierInfo.icon}</span>
              <span>{tierInfo.label}!</span>
            </div>
            <div className="mr-card" style={{ borderColor: tierInfo.color }}>
              <div className="mr-overall" style={{ backgroundColor: rating.color }}>
                {player.overall}
              </div>
              <div className="mr-info">
                <div className="mr-name">{player.name}</div>
                {player.nickname && (
                  <div className="mr-nickname">"{player.nickname}"</div>
                )}
                <div className="mr-meta">
                  <span className="mr-pos" style={{ backgroundColor: getPositionColor(player.positions[0]) }}>
                    {player.positions.join('/')}
                  </span>
                  <span className="mr-team">{player.team}</span>
                  {player.era && <span className="mr-era">{player.era}</span>}
                </div>
                {specialty && <div className="mr-specialty">{specialty}</div>}
                <div className="mr-type">{pitcher ? 'Pitcher' : 'Position Player'}</div>
              </div>
            </div>
            {player.funFact && (
              <div className="mr-fun-fact">{player.funFact}</div>
            )}
            <button className="mr-dismiss" onClick={onDismiss}>Continue</button>
          </div>
        )}
      </div>
    </div>
  );
}
