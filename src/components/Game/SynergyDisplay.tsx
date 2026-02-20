import { SynergyBonus, ActiveSynergies } from '../../types';
import './SynergyDisplay.css';

interface SynergyDisplayProps {
  synergies: ActiveSynergies;
  teamName: string;
}

function SynergyBadge({ synergy }: { synergy: SynergyBonus }) {
  const isTeamSynergy = synergy.type === 'team';

  return (
    <div className={`synergy-badge ${synergy.type}-synergy`}>
      <span className="synergy-icon">{isTeamSynergy ? '⚾' : '🔋'}</span>
      <div className="synergy-info">
        <span className="synergy-label">
          {isTeamSynergy
            ? `${synergy.team} (${synergy.players.length})`
            : 'Battery'}
        </span>
        <span className="synergy-bonus">+{synergy.bonus}%</span>
      </div>
    </div>
  );
}

export function SynergyDisplay({ synergies, teamName }: SynergyDisplayProps) {
  const hasAnySynergy =
    synergies.teamSynergies.length > 0 || synergies.batteryBonus !== null;

  if (!hasAnySynergy) {
    return null;
  }

  return (
    <div className="synergy-display">
      <div className="synergy-header">
        <span className="synergy-glow">✨</span>
        <span className="synergy-title">{teamName} Synergies</span>
      </div>
      <div className="synergy-list">
        {synergies.teamSynergies.map((synergy, idx) => (
          <SynergyBadge key={`team-${idx}`} synergy={synergy} />
        ))}
        {synergies.batteryBonus && (
          <SynergyBadge synergy={synergies.batteryBonus} />
        )}
      </div>
    </div>
  );
}

interface SynergyBannerProps {
  synergies: ActiveSynergies;
}

export function SynergyBanner({ synergies }: SynergyBannerProps) {
  const activeSynergies = [
    ...synergies.teamSynergies,
    ...(synergies.batteryBonus ? [synergies.batteryBonus] : []),
  ];

  if (activeSynergies.length === 0) {
    return null;
  }

  return (
    <div className="synergy-banner">
      {activeSynergies.map((synergy, idx) => (
        <div key={idx} className="synergy-banner-item">
          <span className="banner-glow" />
          <span className="banner-text">{synergy.description}</span>
        </div>
      ))}
    </div>
  );
}

interface PlayerSynergyGlowProps {
  playerId: string;
  synergies: SynergyBonus[];
  children: React.ReactNode;
}

export function PlayerSynergyGlow({
  playerId,
  synergies,
  children,
}: PlayerSynergyGlowProps) {
  const hasSynergy = synergies.some(s =>
    s.players.some(p => p.id === playerId)
  );

  return (
    <div className={`player-synergy-wrapper ${hasSynergy ? 'has-synergy' : ''}`}>
      {children}
      {hasSynergy && <div className="synergy-glow-effect" />}
    </div>
  );
}
