import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getDisplayName, isPitcher } from '../domain/sim/helpers';
import { inferGradesFromStats } from '../domain/sim/simulation';

const POS_LABEL: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  BC: 'C', PH: 'PH', PR: 'PR', IFD: 'IF', OFD: 'OF',
  SP: 'SP', CL: 'CL', SU: 'SU', MRP: 'RP', LRP: 'RP', LOOGY: 'LHP', HC: 'MGR', ST: 'PARK',
};

// Two top grades to surface inline so the card has substance at a glance.
function topGrades(p: Player): string {
  if (p.positions.includes('HC') || p.positions.includes('ST')) return '';
  const g = p.grades ?? inferGradesFromStats(p);
  const pairs: [string, number][] = isPitcher(p)
    ? [['VELO', g.fastball ?? 50], ['BRK', g.breaking ?? 50], ['CTL', g.control ?? 50]]
    : [['CON', g.contact ?? 50], ['POW', g.power ?? 50], ['SPD', g.speed ?? 50]];
  return pairs.sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${v}`).join('  ');
}

/** A draftable card: tap the body to draft, tap ℹ for the full breakdown. */
export function CardTile({ player, onPick, onInfo }: {
  player: Player;
  onPick?: (p: Player) => void;
  onInfo?: (p: Player) => void;
}) {
  const tier = getTier(player.overall);
  const tierColor = TIER_COLORS[tier];
  const pos = player.positions[0];
  const subtitle = player.nickname || player.specialty || player.era || player.team;
  const grades = topGrades(player);

  return (
    <div className="tile" style={{ borderColor: tierColor }}>
      <button className="tile__main" onClick={onPick ? () => onPick(player) : undefined} disabled={!onPick}>
        <div className="tile__ovr" style={{ background: tierColor }}>{player.overall}</div>
        <div className="tile__body">
          <div className="tile__name">{getDisplayName(player.name)}</div>
          <div className="tile__sub dim">{subtitle}</div>
          {grades && <div className="tile__grades">{grades}</div>}
        </div>
        <div className="tile__pos" style={{ color: tierColor }}>{POS_LABEL[pos] ?? pos}</div>
      </button>
      {onInfo && (
        <button className="tile__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>
      )}
    </div>
  );
}
