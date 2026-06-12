import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getGradeColor, gradeToLetter } from '../domain/sim/helpers';
import { getRatings } from '../domain/ratings';
import { cardCost } from '../domain/salary';

const POS_LABEL: Record<string, string> = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF', DH: 'DH',
  BC: 'C', PH: 'PH', PR: 'PR', IFD: 'IF', OFD: 'OF',
  SP: 'SP', CL: 'CL', SU: 'SU', MRP: 'RP', LRP: 'RP', LOOGY: 'LHP', HC: 'MGR', ST: 'PARK',
};
const TIER_LABEL: Record<string, string> = {
  diamond: 'DIAMOND', gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE', common: 'COMMON',
};
const avg = (a: number, b: number) => Math.round((a + b) / 2);
const cleanName = (n: string) => n.replace(/\s*\([^)]*\)\s*$/, '').trim() || n;

/** One rating row: label · muted vL · bold colored OVR · muted vR, all aligned. */
function Row({ label, vL, total, vR }: { label: string; vL: number; total: number; vR: number }) {
  return (
    <div className="rt__row">
      <span className="rt__lbl">{label}</span>
      <span className="rt__side">{gradeToLetter(vL)}</span>
      <span className="rt__tot" style={{ color: getGradeColor(total) }}>{gradeToLetter(total)}</span>
      <span className="rt__side">{gradeToLetter(vR)}</span>
    </div>
  );
}

function Single({ label, v }: { label: string; v: number }) {
  return <span className="rt__single">{label}<b style={{ color: getGradeColor(v) }}>{gradeToLetter(v)}</b></span>;
}

function Body({ player }: { player: Player }) {
  const r = getRatings(player);
  if (r.kind === 'hitter') {
    return (
      <div className="rt">
        <div className="rt__head"><span /><span>vL</span><span>OVR</span><span>vR</span></div>
        <Row label="CONTACT" vL={r.conVL} total={avg(r.conVL, r.conVR)} vR={r.conVR} />
        <Row label="HR PWR" vL={r.hrVL} total={avg(r.hrVL, r.hrVR)} vR={r.hrVR} />
        <Row label="GAP PWR" vL={r.gapVL} total={avg(r.gapVL, r.gapVR)} vR={r.gapVR} />
        <div className="rt__singles">
          <Single label="EYE" v={r.eye} /><Single label="RUN" v={r.run} /><Single label="FLD" v={r.field} /><Single label="BUNT" v={r.bunt} />
        </div>
      </div>
    );
  }
  return (
    <div className="rt">
      <div className="rt__head"><span /><span>vL</span><span>OVR</span><span>vR</span></div>
      <Row label="STUFF" vL={r.stuffVL} total={avg(r.stuffVL, r.stuffVR)} vR={r.stuffVR} />
      <Row label="COMMAND" vL={r.cmdVL} total={avg(r.cmdVL, r.cmdVR)} vR={r.cmdVR} />
      <div className="rt__singles">
        <Single label="CTL" v={r.control} /><Single label="STAM" v={r.stamina} />
        <span className="rt__single">GB<b>{r.gb}%</b></span>
        <span className="rt__single">IP/G<b>{r.ipg.toFixed(1)}</b></span>
      </div>
    </div>
  );
}

function StaffBody({ player }: { player: Player }) {
  const c = player.coachEffect, p = player.parkEffect;
  return (
    <div className="rt">
      <div className="rt__style">{c?.style ?? p?.name}</div>
      <div className="rt__singles">
        {c && <>
          <span className="rt__single">OFF<b>+{c.offensiveBonus}%</b></span>
          <span className="rt__single">PIT<b>+{c.pitchingBonus}%</b></span>
          <span className="rt__single">CLT<b>+{c.clutchBonus}</b></span>
          <span className="rt__single">STA<b>+{c.staminaBonus}</b></span>
          <span className="rt__single">SPD<b>+{c.speedBonus}</b></span>
          <span className="rt__single">FLD<b>+{c.fieldingBonus}</b></span>
        </>}
        {p && <>
          <span className="rt__single">HR<b>×{p.hrFactor}</b></span>
          <span className="rt__single">2B<b>×{p.doublesFactor}</b></span>
          <span className="rt__single">3B<b>×{p.triplesFactor}</b></span>
          <span className="rt__single">RUN<b>×{p.runFactor}</b></span>
          <span className="rt__single">ERR<b>×{p.errorFactor}</b></span>
        </>}
      </div>
    </div>
  );
}

/** Draftable card: A-F ratings (vL · TOTAL · vR), grouped power; ℹ for full. */
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
            {!isStaff && <div className="tile__cost">💰{cardCost(player)}</div>}
          </div>
        </div>
        {isStaff ? <StaffBody player={player} /> : <Body player={player} />}
      </button>
      {onInfo && <button className="tile__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>}
    </div>
  );
}
