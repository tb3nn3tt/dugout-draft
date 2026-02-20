import { useEffect } from 'react';
import { PowerCard } from '../../types';
import { getCardColor, getCardRarity } from '../../utils/powerCards';
import './PowerCardAnnouncement.css';

interface PowerCardAnnouncementProps {
  card: PowerCard;
  player: 'player1' | 'player2';
  teamName: string;
  onDismiss: () => void;
}

export function PowerCardAnnouncement({ card, player, teamName, onDismiss }: PowerCardAnnouncementProps) {
  const color = getCardColor(card.type);
  const rarity = getCardRarity(card.type);

  // Auto-dismiss after 2.5s
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="pca-overlay" onClick={onDismiss}>
      <div className="pca-content" onClick={e => e.stopPropagation()}>
        <div className={`pca-who ${player}`}>
          {teamName} plays a card!
        </div>
        <div
          className={`pca-icon-wrap ${rarity === 'legendary' ? 'pca-legendary' : ''}`}
          style={{ '--card-color': color } as React.CSSProperties}
        >
          <span className="pca-icon">{card.icon}</span>
        </div>
        <div className="pca-name" style={{ color }}>
          {card.name}
        </div>
        <div className="pca-desc">{card.description}</div>
        <div className="pca-tap">Tap to continue</div>
      </div>
    </div>
  );
}
