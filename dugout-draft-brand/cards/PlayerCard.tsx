/**
 * DUGOUT DRAFT - Player Card Component
 * 
 * A styled player card component with tier-based theming.
 * Uses the brand color system.
 */

import React from 'react';

type Tier = 'diamond' | 'gold' | 'silver' | 'bronze';
type Position = 'SP' | 'RP' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';

interface PlayerCardProps {
  name: string;
  rating: number;
  tier: Tier;
  position: Position;
  team?: string;
  cardSet?: string;
  imageUrl?: string;
  onClick?: () => void;
}

const tierStyles: Record<Tier, {
  border: string;
  glow: string;
  bg: string;
  text: string;
  badgeBg: string;
}> = {
  diamond: {
    border: '#a78bfa',
    glow: '0 0 30px rgba(167, 139, 250, 0.4)',
    bg: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, transparent 50%), linear-gradient(45deg, #0f1535 0%, #1a1f4a 50%, #0f1535 100%)',
    text: '#a78bfa',
    badgeBg: 'rgba(167, 139, 250, 0.2)',
  },
  gold: {
    border: '#f0b429',
    glow: '0 0 30px rgba(240, 180, 41, 0.4)',
    bg: 'linear-gradient(135deg, rgba(240, 180, 41, 0.15) 0%, transparent 50%), linear-gradient(45deg, #1a1608 0%, #2a2010 50%, #1a1608 100%)',
    text: '#f0b429',
    badgeBg: 'rgba(240, 180, 41, 0.2)',
  },
  silver: {
    border: '#94a3b8',
    glow: '0 0 25px rgba(148, 163, 184, 0.3)',
    bg: 'linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, transparent 50%), linear-gradient(45deg, #121620 0%, #1e2433 50%, #121620 100%)',
    text: '#94a3b8',
    badgeBg: 'rgba(148, 163, 184, 0.2)',
  },
  bronze: {
    border: '#e8682a',
    glow: '0 0 25px rgba(232, 104, 42, 0.4)',
    bg: 'linear-gradient(135deg, rgba(232, 104, 42, 0.15) 0%, transparent 50%), linear-gradient(45deg, #1a1008 0%, #2a1a10 50%, #1a1008 100%)',
    text: '#e8682a',
    badgeBg: 'rgba(232, 104, 42, 0.2)',
  },
};

const positionColors: Record<string, string> = {
  SP: '#1e5fbb',
  RP: '#1e5fbb',
  C: '#7c3aed',
  '1B': '#dc2626',
  '2B': '#dc2626',
  '3B': '#dc2626',
  SS: '#dc2626',
  LF: '#16a34a',
  CF: '#16a34a',
  RF: '#16a34a',
  DH: '#f0b429',
};

export const PlayerCard: React.FC<PlayerCardProps> = ({
  name,
  rating,
  tier,
  position,
  team,
  cardSet,
  imageUrl,
  onClick,
}) => {
  const styles = tierStyles[tier];
  const posColor = positionColors[position] || '#64748b';
  const isDH = position === 'DH';

  return (
    <div
      onClick={onClick}
      style={{
        width: 240,
        height: 340,
        borderRadius: 16,
        border: `2px solid ${styles.border}`,
        background: styles.bg,
        boxShadow: styles.glow,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Barlow', sans-serif",
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-8px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
      }}>
        {/* Tier badge */}
        <span style={{
          fontFamily: "'Teko', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: 'uppercase',
          padding: '4px 10px',
          borderRadius: 4,
          background: styles.badgeBg,
          color: styles.text,
          border: `1px solid ${styles.border}40`,
        }}>
          {tier}
        </span>
        
        {/* Rating */}
        <span style={{
          fontFamily: "'Russo One', sans-serif",
          fontSize: 32,
          color: styles.text,
          lineHeight: 1,
        }}>
          {rating}
        </span>
      </div>

      {/* Photo area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
      }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            style={{
              width: 110,
              height: 150,
              objectFit: 'cover',
              borderRadius: 8,
            }}
          />
        ) : (
          <div style={{
            width: 110,
            height: 150,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="70" height="90" viewBox="0 0 24 24" fill="rgba(255,255,255,0.2)">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Info area */}
      <div style={{
        textAlign: 'center',
        padding: '12px 16px 16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Position badge */}
        <span style={{
          display: 'inline-block',
          fontFamily: "'Teko', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 1,
          padding: '3px 10px',
          borderRadius: 4,
          background: posColor,
          color: isDH ? '#0a1628' : '#ffffff',
          marginBottom: 8,
        }}>
          {position}
        </span>

        {/* Name */}
        <div style={{
          fontFamily: "'Russo One', sans-serif",
          fontSize: 22,
          color: '#ffffff',
          letterSpacing: 1,
          lineHeight: 1.1,
        }}>
          {name}
        </div>

        {/* Team/Set */}
        {(team || cardSet) && (
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 12,
            color: '#94a3b8',
            letterSpacing: 1,
            marginTop: 4,
          }}>
            {cardSet && <span>{cardSet}</span>}
            {cardSet && team && <span> • </span>}
            {team && <span>{team}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;
