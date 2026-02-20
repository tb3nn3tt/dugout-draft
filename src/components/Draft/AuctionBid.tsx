import { useState, useEffect, useRef, useCallback } from 'react';
import { AuctionState, Player } from '../../types';
import { getOverallRating, getPositionColor } from '../../utils/helpers';
import './AuctionBid.css';

interface AuctionBidProps {
  auctionState: AuctionState;
  currentPick: 'player1' | 'player2';
  onBid: (player: 'player1' | 'player2', bid: Player) => void;
  onResolve: () => void;
  onConsolationPick: (playerId: string) => void;
}

function ElitePlayerCard({ player }: { player: Player }) {
  const rating = getOverallRating(player.overall);

  return (
    <div className="auction-elite-card">
      <div className="elite-glow" />
      <div className="elite-overall" style={{ backgroundColor: rating.color }}>
        {player.overall}
      </div>
      <div className="elite-info">
        <div className="elite-name">{player.name}</div>
        <div className="elite-meta">
          <span className="elite-pos" style={{ backgroundColor: getPositionColor(player.positions[0]) }}>
            {player.positions.join('/')}
          </span>
          <span className="elite-team">{player.team}</span>
        </div>
        {player.nickname && (
          <div className="elite-nickname">"{player.nickname}"</div>
        )}
      </div>
      <div className="elite-tier" style={{ color: rating.color }}>
        {rating.label}
      </div>
    </div>
  );
}

const OFFER_TIMER_SECONDS = 20;

function RosterOfferSelector({ roster, eliteOverall, onSubmit }: { roster: Player[]; eliteOverall: number; onSubmit: (player: Player) => void }) {
  const [selected, setSelected] = useState<Player | null>(null);
  const [timer, setTimer] = useState(OFFER_TIMER_SECONDS);
  const submitted = useRef(false);

  // Sort ascending so lowest-OVR (best offer) is first
  const sorted = [...roster].sort((a, b) => a.overall - b.overall);
  const bestOfferId = sorted.length > 0 ? sorted[0].id : null;

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-submit when timer expires
  useEffect(() => {
    if (timer > 0 || submitted.current) return;
    submitted.current = true;
    // Submit selected player, or lowest OVR as default
    const pick = selected ?? sorted[0];
    if (pick) onSubmit(pick);
  }, [timer, selected, sorted, onSubmit]);

  return (
    <div className="offer-selector">
      <p className="offer-instruction">Offer your weakest player to maximize value</p>
      <div className={`auction-timer ${timer <= 5 ? 'timer-critical' : timer <= 10 ? 'timer-warning' : ''}`}>
        {timer}s
      </div>
      <div className="offer-roster">
        {sorted.map((player) => {
          const rating = getOverallRating(player.overall);
          const isBest = player.id === bestOfferId;
          const netValue = eliteOverall - player.overall;
          return (
            <div
              key={player.id}
              className={`offer-card ${selected?.id === player.id ? 'selected' : ''} ${isBest ? 'best-offer' : ''}`}
              onClick={() => setSelected(player)}
            >
              {isBest && <span className="best-offer-tag">BEST OFFER</span>}
              <div className="offer-overall" style={{ backgroundColor: rating.color }}>
                {player.overall}
              </div>
              <div className="offer-player-info">
                <span className="offer-name">{player.name}</span>
                <span className="offer-pos" style={{ backgroundColor: getPositionColor(player.positions[0]) }}>
                  {player.positions.join('/')}
                </span>
              </div>
              <span className={`offer-net-value ${netValue > 0 ? 'positive' : 'negative'}`}>
                {netValue > 0 ? '+' : ''}{netValue}
              </span>
            </div>
          );
        })}
      </div>
      <button
        className="offer-submit"
        disabled={!selected}
        onClick={() => selected && onSubmit(selected)}
      >
        Lock In Offer
      </button>
    </div>
  );
}

interface AuctionBidWithRosterProps extends AuctionBidProps {
  player1Roster: Player[];
  player2Roster: Player[];
  onDismiss?: () => void;
  isCPU?: boolean;
  team1Name?: string;
  team2Name?: string;
}

export function AuctionBid({
  auctionState,
  onBid,
  onResolve,
  player1Roster,
  player2Roster,
  onDismiss,
  isCPU = false,
  team1Name = 'Team 1',
  team2Name = 'Team 2',
}: AuctionBidWithRosterProps) {
  const { elitePlayer, phase, player1Offer, player2Offer, winner } = auctionState;

  // Auto-advance reveal phase after 4 seconds
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleResolve = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    onResolve();
  }, [onResolve]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    revealTimerRef.current = setTimeout(() => {
      onResolve();
    }, 4000);
    return () => { if (revealTimerRef.current) clearTimeout(revealTimerRef.current); };
  }, [phase, onResolve]);

  // Auto-advance done phase after 5 seconds
  useEffect(() => {
    if (phase !== 'done' || !onDismiss) return;
    const t = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(t);
  }, [phase, onDismiss]);

  if (phase === 'offer_p1') {
    return (
      <div className="auction-container">
        <div className="auction-header">
          <span className="auction-icon">💰</span>
          <h2>Auction Round</h2>
          <p>Offer one of your players to win the elite!</p>
        </div>
        <ElitePlayerCard player={elitePlayer} />
        <div className="bid-phase">
          <div className="bid-turn-label player1">
            {team1Name} - Make Your Offer
          </div>
          <p className="bid-hint">{team2Name}, please look away!</p>
          <RosterOfferSelector
            roster={player1Roster}
            eliteOverall={elitePlayer.overall}
            onSubmit={(player) => onBid('player1', player)}
          />
        </div>
      </div>
    );
  }

  if (phase === 'offer_p2') {
    // In CPU mode, show "CPU thinking" instead of manual picker
    if (isCPU) {
      return (
        <div className="auction-container">
          <div className="auction-header">
            <span className="auction-icon">💰</span>
            <h2>Auction Round</h2>
            <p>CPU is considering their offer...</p>
          </div>
          <ElitePlayerCard player={elitePlayer} />
          <div className="bid-phase">
            <div className="cpu-thinking-auction">
              <span className="cpu-icon">🤖</span>
              <span className="cpu-text">CPU is evaluating roster...</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="auction-container">
        <div className="auction-header">
          <span className="auction-icon">💰</span>
          <h2>Auction Round</h2>
          <p>Offer one of your players to win the elite!</p>
        </div>
        <ElitePlayerCard player={elitePlayer} />
        <div className="bid-phase">
          <div className="bid-turn-label player2">
            {team2Name} - Make Your Offer
          </div>
          <p className="bid-hint">{team1Name}, please look away!</p>
          <RosterOfferSelector
            roster={player2Roster}
            eliteOverall={elitePlayer.overall}
            onSubmit={(player) => onBid('player2', player)}
          />
        </div>
      </div>
    );
  }

  if (phase === 'reveal') {
    const p1Rating = player1Offer ? getOverallRating(player1Offer.overall) : null;
    const p2Rating = player2Offer ? getOverallRating(player2Offer.overall) : null;
    const p1Higher = player1Offer && player2Offer && player1Offer.overall > player2Offer.overall;
    const p2Higher = player1Offer && player2Offer && player2Offer.overall > player1Offer.overall;

    return (
      <div className="auction-container">
        <div className="auction-header">
          <span className="auction-icon">🎭</span>
          <h2>The Offers Are In!</h2>
          <p>Highest overall wins the elite player</p>
        </div>
        <ElitePlayerCard player={elitePlayer} />
        <div className="bid-reveal">
          <div className="bid-result">
            <div className={`bid-card player1 ${p1Higher ? 'winning' : p2Higher ? 'losing' : ''}`}>
              <span className="bid-label">{isCPU ? 'You Offer' : `${team1Name} Offers`}</span>
              {player1Offer && (
                <>
                  <div className="bid-overall-badge" style={{ backgroundColor: p1Rating?.color }}>
                    {player1Offer.overall}
                  </div>
                  <span className="bid-player-name">{player1Offer.name}</span>
                  <span className="bid-pos" style={{ backgroundColor: getPositionColor(player1Offer.positions[0]) }}>
                    {player1Offer.positions.join('/')}
                  </span>
                </>
              )}
            </div>
            <span className="vs-text">VS</span>
            <div className={`bid-card player2 ${p2Higher ? 'winning' : p1Higher ? 'losing' : ''}`}>
              <span className="bid-label">{isCPU ? 'CPU Offers' : `${team2Name} Offers`}</span>
              {player2Offer && (
                <>
                  <div className="bid-overall-badge" style={{ backgroundColor: p2Rating?.color }}>
                    {player2Offer.overall}
                  </div>
                  <span className="bid-player-name">{player2Offer.name}</span>
                  <span className="bid-pos" style={{ backgroundColor: getPositionColor(player2Offer.positions[0]) }}>
                    {player2Offer.positions.join('/')}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className="auction-resolve-btn" onClick={handleResolve}>
            See Who Wins!
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done' && winner) {
    const winnerOffer = winner === 'player1' ? player1Offer : player2Offer;
    const tied = player1Offer && player2Offer && player1Offer.overall === player2Offer.overall;
    const winnerLabel = winner === 'player1' ? team1Name : team2Name;
    const winnerOfferRating = winnerOffer ? getOverallRating(winnerOffer.overall) : null;
    const eliteRating = getOverallRating(elitePlayer.overall);

    return (
      <div className="auction-container auction-winner-screen">
        <div className="winner-confetti">
          <span>🎉</span><span>🏆</span><span>🎉</span>
        </div>
        <h2 className="winner-headline">{winnerLabel} Wins the Auction!</h2>
        {tied && <p className="winner-coinflip">Won by coin flip!</p>}
        <div className="swap-visual">
          <div className="swap-card swap-out">
            <div className="swap-label">Gave Up</div>
            {winnerOffer && (
              <>
                <div className="swap-overall" style={{ backgroundColor: winnerOfferRating?.color }}>
                  {winnerOffer.overall}
                </div>
                <div className="swap-name">{winnerOffer.name}</div>
                <div className="swap-pos" style={{ backgroundColor: getPositionColor(winnerOffer.positions[0]) }}>
                  {winnerOffer.positions.join('/')}
                </div>
              </>
            )}
          </div>
          <div className="swap-arrow">
            <span>→</span>
          </div>
          <div className="swap-card swap-in">
            <div className="swap-label">Received</div>
            <div className="swap-overall" style={{ backgroundColor: eliteRating.color }}>
              {elitePlayer.overall}
            </div>
            <div className="swap-name">{elitePlayer.name}</div>
            <div className="swap-pos" style={{ backgroundColor: getPositionColor(elitePlayer.positions[0]) }}>
              {elitePlayer.positions.join('/')}
            </div>
            {elitePlayer.nickname && (
              <div className="swap-nickname">"{elitePlayer.nickname}"</div>
            )}
          </div>
        </div>
        <button className="auction-resolve-btn" onClick={() => onDismiss && onDismiss()}>
          Continue Draft
        </button>
      </div>
    );
  }

  return null;
}
