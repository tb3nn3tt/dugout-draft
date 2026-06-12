import { Player } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getGradeColor } from '../domain/sim/helpers';
import { getRatings } from '../domain/ratings';
import { RatingRadar, axesFor } from './RatingRadar';

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

const V = ({ n }: { n: number }) => <b style={{ color: getGradeColor(n) }}>{n}</b>;

function Rating({ l, v }: { l: string; v: number }) {
  return <span className="rg__cell"><span className="rg__l">{l}</span><span className="rg__v" style={{ color: getGradeColor(v) }}>{v}</span></span>;
}

function Body({ player, color }: { player: Player; color: string }) {
  const r = getRatings(player);
  return (
    <div className="tile__detail">
      <div className="tile__radar"><RatingRadar axes={axesFor(player)} color={color} size={86} showLabels={false} /></div>
      <div className="tile__info-col">
        {r.kind === 'hitter' ? (
          <>
            <div className="rg">
              <Rating l="CON" v={Math.round((r.conVL + r.conVR) / 2)} />
              <Rating l="HR" v={Math.round((r.hrVL + r.hrVR) / 2)} />
              <Rating l="GAP" v={Math.round((r.gapVL + r.gapVR) / 2)} />
              <Rating l="EYE" v={r.eye} />
              <Rating l="RUN" v={r.run} />
              <Rating l="FLD" v={r.field} />
            </div>
            <div className="splitrow">
              <span className="splitrow__tag">vs LHP</span> CON <V n={r.conVL} /> · HR <V n={r.hrVL} /> · GAP <V n={r.gapVL} />
            </div>
            <div className="splitrow">
              <span className="splitrow__tag">vs RHP</span> CON <V n={r.conVR} /> · HR <V n={r.hrVR} /> · GAP <V n={r.gapVR} />
            </div>
            <div className="splitrow dim">BNT {r.bunt}</div>
          </>
        ) : (
          <>
            <div className="rg">
              <Rating l="STUFF" v={Math.round((r.stuffVL + r.stuffVR) / 2)} />
              <Rating l="CTL" v={r.control} />
              <Rating l="CMD" v={Math.round((r.cmdVL + r.cmdVR) / 2)} />
              <Rating l="GB%" v={r.gb} />
            </div>
            <div className="splitrow">
              <span className="splitrow__tag">vs LHB</span> STUFF <V n={r.stuffVL} /> · CMD <V n={r.cmdVL} />
            </div>
            <div className="splitrow">
              <span className="splitrow__tag">vs RHB</span> STUFF <V n={r.stuffVR} /> · CMD <V n={r.cmdVR} />
            </div>
            <div className="splitrow dim">IP/G {r.ipg.toFixed(1)}</div>
          </>
        )}
      </div>
    </div>
  );
}

/** Detailed, draftable card: mini radar + ratings + vL/vR splits + stats. */
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
            {player.coachEffect && `${player.coachEffect.style} · +${player.coachEffect.offensiveBonus}% OFF · +${player.coachEffect.pitchingBonus}% PIT · +${player.coachEffect.clutchBonus} CLT`}
            {player.parkEffect && `${player.parkEffect.name} · HR ×${player.parkEffect.hrFactor} · 2B ×${player.parkEffect.doublesFactor} · runs ×${player.parkEffect.runFactor}`}
          </div>
        ) : (
          <Body player={player} color={tierColor} />
        )}
      </button>
      {onInfo && <button className="tile__info" onClick={() => onInfo(player)} aria-label="Player details">ℹ</button>}
    </div>
  );
}
