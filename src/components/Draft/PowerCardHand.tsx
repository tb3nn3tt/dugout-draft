import { useState } from 'react';
import { PowerCard, PowerCardState, PowerCardType, Player } from '../../types';
import { canUseCard, getCardColor, getCardRarity } from '../../utils/powerCards';
import './PowerCardHand.css';

interface PowerCardHandProps {
  hand: PowerCard[];
  state: PowerCardState;
  currentTurn: number;
  currentPlayer: 'player1' | 'player2';
  playerRoster: Player[];
  onUseCard: (card: PowerCard) => void;
  isMyTurn: boolean;
  isOnline?: boolean;
  suggestions?: Map<PowerCardType, string>;
}

function CardGrid({
  hand,
  state,
  currentTurn,
  currentPlayer,
  playerRoster,
  onUseCard,
  isMyTurn,
  suggestions,
}: Omit<PowerCardHandProps, 'isOnline'>) {
  return (
    <div className="cards-container">
      {hand.map((card) => {
        const { canUse, reason } = canUseCard(card, state, currentTurn, currentPlayer, playerRoster);
        const rarity = getCardRarity(card.type);
        const isDisabled = card.used || !canUse || !isMyTurn;
        const suggestion = suggestions?.get(card.type);
        const isSuggested = !!suggestion && canUse && !card.used;

        return (
          <button
            key={card.id}
            className={`power-card ${rarity} ${card.used ? 'used' : ''} ${!canUse ? 'cooldown' : ''} ${isSuggested ? 'suggested' : ''}`}
            style={{ '--card-color': getCardColor(card.type) } as React.CSSProperties}
            onClick={() => !isDisabled && onUseCard(card)}
            disabled={isDisabled}
            title={card.used ? 'Already used' : reason || suggestion || card.description}
          >
            {isSuggested && <span className="suggest-badge">USE NOW</span>}
            <span className="card-icon">{card.icon}</span>
            <span className="card-name">{card.name}</span>
            {isSuggested && <span className="suggest-tip">{suggestion}</span>}
            {card.used && <span className="used-overlay">USED</span>}
            {!card.used && !canUse && reason && (
              <span className="cooldown-overlay">{reason}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PowerCardHand({
  hand,
  state,
  currentTurn,
  currentPlayer,
  playerRoster,
  onUseCard,
  isMyTurn,
  isOnline: _isOnline,
  suggestions,
}: PowerCardHandProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unusedCount = hand.filter(c => !c.used).length;
  const hasSuggestion = suggestions && suggestions.size > 0;

  return (
    <>
      {/* Desktop: full display */}
      <div className="power-card-hand desktop-cards">
        <div className="hand-header">
          <span className="hand-icon">🃏</span>
          <span className="hand-title">Power Cards</span>
          {hasSuggestion && <span className="suggest-dot" title="A card is recommended!" />}
          <span className="card-count">{unusedCount}</span>
        </div>
        <CardGrid
          hand={hand}
          state={state}
          currentTurn={currentTurn}
          currentPlayer={currentPlayer}
          playerRoster={playerRoster}
          onUseCard={onUseCard}
          isMyTurn={isMyTurn}
          suggestions={suggestions}
        />
        {!isMyTurn && (
          <div className="not-your-turn">Wait for your turn to use cards</div>
        )}
      </div>

      {/* Mobile: badge button + drawer */}
      <button className={`power-card-badge-btn mobile-only ${hasSuggestion ? 'has-suggestion' : ''}`} onClick={() => setDrawerOpen(true)}>
        🃏 <span className="badge-count">{unusedCount}</span>
        {hasSuggestion && <span className="badge-suggest-dot" />}
      </button>

      {drawerOpen && (
        <div className="power-card-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="power-card-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="hand-icon">🃏</span>
              <span className="hand-title">Power Cards</span>
              <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            <CardGrid
              hand={hand}
              state={state}
              currentTurn={currentTurn}
              currentPlayer={currentPlayer}
              playerRoster={playerRoster}
              onUseCard={(card) => {
                onUseCard(card);
                setDrawerOpen(false);
              }}
              isMyTurn={isMyTurn}
              suggestions={suggestions}
            />
            {!isMyTurn && (
              <div className="not-your-turn">Wait for your turn to use cards</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface PowerCardPreviewProps {
  card: PowerCard;
  onConfirm: () => void;
  onCancel: () => void;
  suggestion?: string;
}

export function PowerCardPreview({ card, onConfirm, onCancel, suggestion }: PowerCardPreviewProps) {
  const rarity = getCardRarity(card.type);

  return (
    <div className="power-card-preview-overlay" onClick={onCancel}>
      <div className="power-card-preview" onClick={e => e.stopPropagation()}>
        <div className={`preview-card ${rarity}`} style={{ '--card-color': getCardColor(card.type) } as React.CSSProperties}>
          <span className="preview-icon">{card.icon}</span>
          <h3 className="preview-name">{card.name}</h3>
          <p className="preview-description">{card.description}</p>
          {suggestion && (
            <p className="preview-suggestion">{suggestion}</p>
          )}
        </div>
        <div className="preview-actions">
          <button className="preview-action-btn cancel" onClick={onCancel}>Cancel</button>
          <button className="preview-action-btn confirm" onClick={onConfirm}>Use Card</button>
        </div>
      </div>
    </div>
  );
}
