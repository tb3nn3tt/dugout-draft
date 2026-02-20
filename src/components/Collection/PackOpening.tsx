import { useState, useCallback, useEffect, useRef } from 'react';
import { useCollection } from '../../contexts/CollectionContext';
import { PackType, Player } from '../../types';
import { getOverallRating, getPositionColor, getCategoryBadge } from '../../utils/helpers';
import { getPlayerTier } from '../../utils/draftLogic';
import { useSound } from '../../contexts/SoundContext';
import './PackOpening.css';

interface PackOpeningProps {
  packType: PackType;
  onDone: () => void;
}

const PACK_DISPLAY: Record<PackType, { name: string; icon: string; color: string; image?: string }> = {
  standard: { name: 'Standard Pack', icon: '\u{1F4E6}', color: '#3498db', image: '/pack-standard.png' },
  premium: { name: 'Premium Pack', icon: '\u2728', color: '#ffd700', image: '/pack-premium.png' },
  legends: { name: 'Legends Pack', icon: '\u{1F3C6}', color: '#ffd700', image: '/pack-legends.png' },
  fictional: { name: 'Fictional Pack', icon: '\u{1F3AC}', color: '#9b59b6', image: '/pack-fictional.png' },
  decade: { name: 'Decade Pack', icon: '\u{1F4FB}', color: '#cd853f', image: '/pack-decade.png' },
  international: { name: 'International Pack', icon: '\u{1F30D}', color: '#00acc1', image: '/pack-international.png' },
  steroid_era: { name: 'Steroid Era Pack', icon: '\u{1F4AA}', color: '#ff1744', image: '/pack-steroid_era.png' },
  playoff: { name: 'Playoff Pack', icon: '\u{1F3DF}\uFE0F', color: '#228b22', image: '/pack-playoff.png' },
  allstar: { name: 'All-Star Pack', icon: '\u{1F31F}', color: '#ffd700', image: '/pack-allstar.png' },
};

const TIER_STUBS: Record<string, number> = {
  common: 10,
  bronze: 25,
  silver: 50,
  gold: 100,
  diamond: 250,
};

const TIER_ORDER: Record<string, number> = {
  diamond: 5,
  gold: 4,
  silver: 3,
  bronze: 2,
  common: 1,
};

export function PackOpening({ packType, onDone }: PackOpeningProps) {
  const { openPack, collection } = useCollection();
  const { playSound } = useSound();
  const [phase, setPhase] = useState<'unopened' | 'revealing' | 'summary'>('unopened');
  const [revealedCards, setRevealedCards] = useState<{ player: Player; isNew: boolean; stubs: number }[]>([]);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [totalNew, setTotalNew] = useState(0);
  const [totalStubs, setTotalStubs] = useState(0);
  const [isAutoRevealing, setIsAutoRevealing] = useState(false);
  const autoRevealRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const packInfo = PACK_DISPLAY[packType];

  // Cleanup auto-reveal on unmount
  useEffect(() => {
    return () => {
      if (autoRevealRef.current) clearInterval(autoRevealRef.current);
    };
  }, []);

  const handleOpen = useCallback(() => {
    const result = openPack(packType);
    if (!result) return;

    const cards: { player: Player; isNew: boolean; stubs: number }[] = [];
    for (const p of result.newPlayers) {
      cards.push({ player: p, isNew: true, stubs: 0 });
    }
    for (const p of result.duplicates) {
      cards.push({ player: p, isNew: false, stubs: TIER_STUBS[getPlayerTier(p.overall)] || 10 });
    }

    // Shuffle so it's not always new first then dupes
    cards.sort(() => Math.random() - 0.5);

    setRevealedCards(cards);
    setTotalNew(result.newPlayers.length);
    setTotalStubs(result.stubsEarned);
    setPhase('revealing');
    setRevealIndex(-1);
    playSound('pack_open');
  }, [openPack, packType, playSound]);

  const handleRevealNext = useCallback(() => {
    if (isAutoRevealing) return;
    if (revealIndex < revealedCards.length - 1) {
      setRevealIndex(prev => prev + 1);
      playSound('card_flip');
    }
  }, [revealIndex, revealedCards.length, isAutoRevealing, playSound]);

  // Reveal All: rapid stagger instead of instant jump
  const handleRevealAll = useCallback(() => {
    if (isAutoRevealing) return;
    setIsAutoRevealing(true);
    let idx = revealIndex + 1;
    autoRevealRef.current = setInterval(() => {
      if (idx >= revealedCards.length) {
        if (autoRevealRef.current) clearInterval(autoRevealRef.current);
        autoRevealRef.current = null;
        setIsAutoRevealing(false);
        return;
      }
      setRevealIndex(idx);
      idx++;
    }, 200);
  }, [revealIndex, revealedCards.length, isAutoRevealing]);

  const allRevealed = revealIndex >= revealedCards.length - 1;

  // Best card for summary highlight
  const bestCard = revealedCards.length > 0
    ? revealedCards.reduce((best, card) => card.player.overall > best.player.overall ? card : best, revealedCards[0])
    : null;

  // Sort summary cards by tier (best first)
  const sortedCards = [...revealedCards].sort((a, b) => {
    const tierA = TIER_ORDER[getPlayerTier(a.player.overall)] || 0;
    const tierB = TIER_ORDER[getPlayerTier(b.player.overall)] || 0;
    return tierB - tierA;
  });

  const canOpenAnother = collection.packs[packType] > 0;

  return (
    <div className="pack-opening-overlay" onClick={phase === 'revealing' && !isAutoRevealing ? handleRevealNext : undefined}>
      {phase === 'unopened' && (
        <div className="pack-unopened" onClick={e => e.stopPropagation()}>
          {packInfo.image ? (
            <img className="pack-art" src={packInfo.image} alt={packInfo.name} />
          ) : (
            <div className="pack-icon-large" style={{ '--pack-color': packInfo.color } as React.CSSProperties}>
              <span className="pack-emoji">{packInfo.icon}</span>
            </div>
          )}
          <h2 className="pack-title">{packInfo.name}</h2>
          <p className="pack-subtitle">Tap to open!</p>
          <button className="pack-open-btn" onClick={handleOpen} style={{ backgroundColor: packInfo.color }}>
            Open Pack
          </button>
        </div>
      )}

      {phase === 'revealing' && (
        <div className="pack-reveal">
          <div className="reveal-cards">
            {revealedCards.map((card, i) => {
              const rating = getOverallRating(card.player.overall);
              const isRevealed = i <= revealIndex;
              const isCurrentReveal = i === revealIndex;
              const badge = getCategoryBadge(card.player.category);
              const tier = getPlayerTier(card.player.overall);
              const isHighTier = tier === 'diamond' || tier === 'gold';

              return (
                <div
                  key={card.player.id}
                  className={`reveal-card ${isRevealed ? 'flipped' : ''} ${isCurrentReveal ? 'current' : ''} ${isRevealed && isHighTier ? 'high-tier' : ''}`}
                  style={{ '--card-tier-color': rating.color } as React.CSSProperties}
                >
                  <div className="reveal-card-inner">
                    {/* Back of card */}
                    <div className="reveal-card-back" style={{ borderColor: packInfo.color }}>
                      {packInfo.image ? (
                        <img className="card-back-art" src={packInfo.image} alt="" />
                      ) : (
                        <span className="card-back-icon">{packInfo.icon}</span>
                      )}
                    </div>

                    {/* Front of card */}
                    <div className="reveal-card-front" style={{ borderColor: rating.color }}>
                      <div className="reveal-ovr" style={{ backgroundColor: rating.color }}>
                        {card.player.overall}
                      </div>
                      {badge && <span className="reveal-badge">{badge}</span>}
                      <span className="reveal-name">{card.player.name}</span>
                      <span
                        className="reveal-pos"
                        style={{ backgroundColor: getPositionColor(card.player.positions[0]) }}
                      >
                        {card.player.positions[0]}
                      </span>
                      <span className="reveal-tier" style={{ color: rating.color }}>
                        {rating.label}
                      </span>

                      {card.isNew ? (
                        <span className="reveal-new-badge">NEW!</span>
                      ) : (
                        <span className="reveal-dupe-badge">DUPE +{card.stubs} 🪙</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="reveal-controls" onClick={e => e.stopPropagation()}>
            <p className="reveal-hint">
              {!allRevealed
                ? 'Tap anywhere to reveal next card'
                : 'All cards revealed!'}
            </p>
            <div className="reveal-buttons">
              {!allRevealed && !isAutoRevealing && (
                <button className="reveal-skip-btn" onClick={handleRevealAll}>
                  Reveal All
                </button>
              )}
              {allRevealed && (
                <button className="reveal-done-btn" onClick={() => setPhase('summary')}>
                  View Results
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'summary' && (
        <div className="pack-summary" onClick={e => e.stopPropagation()}>
          <h2 className="summary-title">Pack Results</h2>

          {/* Best Pull Highlight */}
          {bestCard && bestCard.player.overall >= 80 && (
            <div className="best-pull" style={{ '--best-color': getOverallRating(bestCard.player.overall).color } as React.CSSProperties}>
              <div className="best-pull-label">Best Pull</div>
              <div className="best-pull-ovr" style={{ backgroundColor: getOverallRating(bestCard.player.overall).color }}>
                {bestCard.player.overall}
              </div>
              <div className="best-pull-name">{bestCard.player.name}</div>
              <div className="best-pull-meta">
                <span className="best-pull-pos" style={{ backgroundColor: getPositionColor(bestCard.player.positions[0]) }}>
                  {bestCard.player.positions[0]}
                </span>
                <span className="best-pull-tier" style={{ color: getOverallRating(bestCard.player.overall).color }}>
                  {getOverallRating(bestCard.player.overall).label}
                </span>
              </div>
              {bestCard.isNew && <span className="best-pull-new">NEW!</span>}
            </div>
          )}

          <div className="summary-cards">
            {sortedCards.map(card => {
              const rating = getOverallRating(card.player.overall);
              return (
                <div key={card.player.id} className={`summary-card ${card.isNew ? 'new' : 'dupe'}`}>
                  <div className="summary-ovr" style={{ backgroundColor: rating.color }}>
                    {card.player.overall}
                  </div>
                  <div className="summary-info">
                    <span className="summary-name">{card.player.name}</span>
                    <span className="summary-meta">
                      <span className="summary-pos-badge" style={{ backgroundColor: getPositionColor(card.player.positions[0]) }}>
                        {card.player.positions[0]}
                      </span>
                      <span className="summary-tier" style={{ color: rating.color }}>{rating.label}</span>
                    </span>
                  </div>
                  {card.isNew ? (
                    <span className="summary-new">NEW</span>
                  ) : (
                    <span className="summary-stubs">+{card.stubs} 🪙</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="summary-totals">
            <div className="summary-total-item">
              <span className="summary-total-value new-value">{totalNew}</span>
              <span className="summary-total-label">New</span>
            </div>
            <div className="summary-total-item">
              <span className="summary-total-value dupe-value">{revealedCards.length - totalNew}</span>
              <span className="summary-total-label">Dupes</span>
            </div>
            {totalStubs > 0 && (
              <div className="summary-total-item">
                <span className="summary-total-value stubs-value">+{totalStubs}</span>
                <span className="summary-total-label">Stubs 🪙</span>
              </div>
            )}
          </div>

          <div className="summary-actions">
            {canOpenAnother && (
              <button
                className="summary-open-btn"
                onClick={() => {
                  setPhase('unopened');
                  setRevealedCards([]);
                  setRevealIndex(-1);
                }}
                style={{ backgroundColor: packInfo.color }}
              >
                Open Another ({collection.packs[packType]})
              </button>
            )}
            <button className="summary-done-btn" onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
