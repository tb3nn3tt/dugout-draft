import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getGradeColor, formatBattingAvg, formatERA } from '../domain/sim/helpers';
import { getRatings } from '../domain/ratings';
import { isPitcher } from '../domain/sim/helpers';

const POS_LABEL: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  BC: 'C', PH: 'PH', PR: 'PR', IFD: 'IF', OFD: 'OF',
  SP: 'SP', CL: 'CL', SU: 'SU', MRP: 'RP', LRP: 'RP', LOOGY: 'LHP', HC: 'MGR', ST: 'PARK',
};
const TIER_LABEL: Record<string, string> = {
  diamond: 'DIAMOND', gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', common: 'COMMON',
};

function cleanName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;
}

function Chip({ l, v }: { l: string; v: number }) {
  return (
    <span className="chipg">
      <span className="chipg__l">{l}</span>
      <span className="chipg__v" style={{ color: getGradeColor(v) }}>{v}</span>
    </span>
  );
}

function RatingChips({ player }: { player: Player }) {
  const r = getRatings(player);
  if (r.kind === 'pitcher') {
    return (
      <>
        <div className="tile__chips">
          <Chip l="STUFF" v={r.stuff} /><Chip l="CTL" v={r.control} />
          <Chip l="CMD" v={r.command} /><Chip l="STAM" v={r.stamina} />
        </div>
        <div className="tile__split">vs L <b style={{ color: getGradeColor(r.vsL) }}>{r.vsL}</b> · vs R <b style={{ color: getGradeColor(r.vsR) }}>{r.vsR}</b></div>
      </>
    );
  }
  const con = Math.round((r.conVL + r.conVR) / 2);
  const pow = Math.round((r.powVL + r.powVR) / 2);
  return (
    <>
      <div className="tile__chips">
        <Chip l="CON" v={con} /><Chip l="POW" v={pow} /><Chip l="EYE" v={r.eye} /><Chip l="RUN" v={r.run} />
      </div>
      <div className="tile__split">
        vL <b>{r.conVL}/{r.powVL}</b> · vR <b>{r.conVR}/{r.powVR}</b> · FLD {r.field} · BNT {r.bunt}
      </div>
    </>
  );
}

function StatRow({ player }: { player: Player }) {
  const s = player.stats;
  const parts = isPitcher(player)
    ? [s.era != null ? `${formatERA(s.era)} ERA` : null, s.k9 != null ? `${s.k9.toFixed(1)} K/9` : null, s.whip != null ? `${s.whip.toFixed(2)} WHIP` : null]
    : [s.avg != null ? `${formatBattingAvg(s.avg)} AVG` : null, s.hr != null ? `${s.hr} HR` : null, s.obp != null ? `${formatBattingAvg(s.obp)} OBP` : null];
  const text = parts.filter(Boolean).join('  ·  ');
  return text ? <div className="tile__stats">{text}</div> : null;
}

/** Detailed, draftable card: ratings + splits + stats on the face; ℹ for full. */
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
              {player.nickname ? `“${player.nickname}” · ` : ''}{player.team}{player.era ? ` · ${player.era}` : ''}
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
            <RatingChips player={player} />
            <StatRow player={player} />
          </>
        )}
      </button>
      {onInfo && <button className="tile__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>}
    </div>
  );
}
