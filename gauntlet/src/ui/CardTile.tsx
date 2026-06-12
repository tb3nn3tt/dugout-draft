import { Player, ScoutingGrades } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { isPitcher, getGradeColor, formatBattingAvg, formatERA } from '../domain/sim/helpers';
import { inferGradesFromStats } from '../domain/sim/simulation';

const POS_LABEL: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  BC: 'C', PH: 'PH', PR: 'PR', IFD: 'IF', OFD: 'OF',
  SP: 'SP', CL: 'CL', SU: 'SU', MRP: 'RP', LRP: 'RP', LOOGY: 'LHP', HC: 'MGR', ST: 'PARK',
};

const TIER_LABEL: Record<string, string> = {
  diamond: 'DIAMOND', gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', common: 'COMMON',
};

// Strip a trailing parenthetical era/category tag baked into some names, e.g.
// "Iván Rodríguez (Peak)" -> "Iván Rodríguez".
function cleanName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
}

const HIT_GRADES: { k: keyof ScoutingGrades; l: string }[] = [
  { k: 'contact', l: 'CON' }, { k: 'power', l: 'POW' }, { k: 'speed', l: 'SPD' }, { k: 'eye', l: 'EYE' },
];
const PIT_GRADES: { k: keyof ScoutingGrades; l: string }[] = [
  { k: 'fastball', l: 'VELO' }, { k: 'breaking', l: 'BRK' }, { k: 'control', l: 'CTL' }, { k: 'stamina', l: 'STA' },
];

function GradeChips({ player }: { player: Player }) {
  const g = player.grades ?? inferGradesFromStats(player);
  const set = isPitcher(player) ? PIT_GRADES : HIT_GRADES;
  return (
    <div className="tile__chips">
      {set.map(({ k, l }) => {
        const v = g[k] ?? 50;
        return (
          <span key={k} className="chipg">
            <span className="chipg__l">{l}</span>
            <span className="chipg__v" style={{ color: getGradeColor(v) }}>{v}</span>
          </span>
        );
      })}
    </div>
  );
}

function StatRow({ player }: { player: Player }) {
  const s = player.stats;
  const parts = isPitcher(player)
    ? [
        s.era != null ? `${formatERA(s.era)} ERA` : null,
        s.k9 != null ? `${s.k9.toFixed(1)} K/9` : null,
        s.whip != null ? `${s.whip.toFixed(2)} WHIP` : null,
      ]
    : [
        s.avg != null ? `${formatBattingAvg(s.avg)} AVG` : null,
        s.hr != null ? `${s.hr} HR` : null,
        s.obp != null ? `${formatBattingAvg(s.obp)} OBP` : null,
      ];
  const text = parts.filter(Boolean).join('  ·  ');
  return text ? <div className="tile__stats">{text}</div> : null;
}

/** A detailed, draftable card: grades + stats on the face, ℹ for the full radar. */
export function CardTile({ player, onPick, onInfo }: {
  player: Player;
  onPick?: (p: Player) => void;
  onInfo?: (p: Player) => void;
}) {
  const tier = getTier(player.overall);
  const tierColor = TIER_COLORS[tier];
  const pos = player.positions[0];
  const isStaff = pos === 'HC' || pos === 'ST';

  return (
    <div className="tile" style={{ borderColor: tierColor }}>
      <button className="tile__main" onClick={onPick ? () => onPick(player) : undefined} disabled={!onPick}>
        <div className="tile__top">
          <div className="tile__ovr" style={{ background: tierColor }}>{player.overall}</div>
          <div className="tile__id">
            <div className="tile__name">{cleanName(player.name)}</div>
            <div className="tile__meta dim">
              {player.nickname ? `“${player.nickname}” · ` : ''}{player.team}
              {player.era ? ` · ${player.era}` : ''}
            </div>
          </div>
          <div className="tile__right">
            <div className="tile__pos" style={{ color: tierColor }}>{POS_LABEL[pos] ?? pos}</div>
            <div className="tile__tier" style={{ color: tierColor }}>{TIER_LABEL[tier]}</div>
          </div>
        </div>

        {isStaff ? (
          <div className="tile__stats">
            {player.coachEffect && `${player.coachEffect.style} · +${player.coachEffect.offensiveBonus}% OFF · +${player.coachEffect.pitchingBonus}% PIT`}
            {player.parkEffect && `${player.parkEffect.name} · HR ×${player.parkEffect.hrFactor} · runs ×${player.parkEffect.runFactor}`}
          </div>
        ) : (
          <>
            <GradeChips player={player} />
            <StatRow player={player} />
          </>
        )}
      </button>
      {onInfo && (
        <button className="tile__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>
      )}
    </div>
  );
}
