import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getDisplayName } from '../domain/sim/helpers';

const POS_LABEL: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  BC: 'C', PH: 'PH', PR: 'PR', IFD: 'IF', OFD: 'OF',
  SP: 'SP', CL: 'CL', SU: 'SU', MRP: 'RP', LRP: 'RP', LOOGY: 'LHP', HC: 'MGR', ST: 'PARK',
};

/** A tappable player/manager/stadium card. Big touch target, tier-colored. */
export function CardTile({
  player, onPick, selected, compact,
}: {
  player: Player;
  onPick?: (p: Player) => void;
  selected?: boolean;
  compact?: boolean;
}) {
  const tier = getTier(player.overall);
  const tierColor = TIER_COLORS[tier];
  const pos = player.positions[0];
  const subtitle = player.nickname || player.specialty || player.era || player.team;

  return (
    <button
      className={`tile ${selected ? 'tile--selected' : ''} ${compact ? 'tile--compact' : ''}`}
      style={{ borderColor: tierColor }}
      onClick={onPick ? () => onPick(player) : undefined}
      disabled={!onPick}
    >
      <div className="tile__ovr" style={{ background: tierColor }}>{player.overall}</div>
      <div className="tile__body">
        <div className="tile__name">{getDisplayName(player.name)}</div>
        <div className="tile__sub dim">{subtitle}</div>
      </div>
      <div className="tile__pos" style={{ color: tierColor }}>{POS_LABEL[pos] ?? pos}</div>
    </button>
  );
}
