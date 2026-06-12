import { DraftEntry } from '../state/gauntletReducer';
import { Position } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getDisplayName } from '../domain/sim/helpers';

// Defensive diamond layout the user asked for:
//   LF  CF  RF
//   SS  P   2B
//   3B  C   1B
const GRID: Position[] = ['LF', 'CF', 'RF', 'SS', 'P', '2B', '3B', 'C', '1B'] as Position[];

export function FieldChart({ draftLog, activeRole }: { draftLog: DraftEntry[]; activeRole?: Position }) {
  const byRole = new Map<string, DraftEntry[]>();
  for (const e of draftLog) {
    const arr = byRole.get(e.role) ?? [];
    arr.push(e);
    byRole.set(e.role, arr);
  }
  const first = (role: string) => byRole.get(role)?.[0]?.player;
  const list = (role: string) => byRole.get(role) ?? [];

  const Cell = ({ pos }: { pos: Position }) => {
    // The "P" cell summarizes the rotation (ace + count).
    if (pos === ('P' as Position)) {
      const sps = list('SP');
      const ace = sps[0]?.player;
      const color = ace ? TIER_COLORS[getTier(ace.overall)] : 'var(--line)';
      return (
        <div className="fc__cell" style={{ borderColor: color }}>
          <div className="fc__pos">P</div>
          {ace ? <><div className="fc__ovr" style={{ color }}>{ace.overall}</div>
            <div className="fc__nm">{getDisplayName(ace.name)}</div>
            <div className="fc__sub">{sps.length}/4 SP</div></>
            : <div className="fc__empty">—</div>}
        </div>
      );
    }
    const p = first(pos);
    const color = p ? TIER_COLORS[getTier(p.overall)] : 'var(--line)';
    const isNext = !p && pos === activeRole;
    return (
      <div className={`fc__cell ${isNext ? 'fc__cell--next' : ''}`} style={{ borderColor: color }}>
        <div className="fc__pos">{pos}</div>
        {p ? <><div className="fc__ovr" style={{ color }}>{p.overall}</div>
          <div className="fc__nm">{getDisplayName(p.name)}</div></>
          : <div className="fc__empty">—</div>}
      </div>
    );
  };

  const Line = ({ label, roles }: { label: string; roles: { role: string; tag: string }[] }) => {
    const cursor = new Map<string, number>();
    return (
      <div className="fc__line">
        <span className="fc__line-lbl">{label}</span>
        <span className="fc__line-vals">
          {roles.map(({ role, tag }, i) => {
            const idx = cursor.get(role) ?? 0;
            cursor.set(role, idx + 1);
            const p = list(role)[idx]?.player;
            return (
              <span key={tag + i} className={`fc__pill ${p ? '' : 'fc__pill--empty'}`}>
                {p ? `${p.overall} ${getDisplayName(p.name)}` : tag}
              </span>
            );
          })}
        </span>
      </div>
    );
  };

  return (
    <div className="fc">
      <div className="fc__grid">
        {GRID.map((pos, i) => <Cell key={i} pos={pos} />)}
      </div>
      <div className="fc__lines">
        <Line label="DH" roles={[{ role: 'DH', tag: 'DH' }]} />
        <Line label="Rotation" roles={[1, 2, 3, 4].map(n => ({ role: 'SP', tag: `SP${n}` }))} />
        <Line label="Bullpen" roles={[
          { role: 'CL', tag: 'CL' }, { role: 'SU', tag: 'SU' }, { role: 'SU', tag: 'SU' },
          { role: 'MRP', tag: 'MRP' }, { role: 'MRP', tag: 'MRP' }, { role: 'LRP', tag: 'LRP' }, { role: 'LOOGY', tag: 'LHP' },
        ]} />
        <Line label="Bench" roles={[
          { role: 'BC', tag: 'BC' }, { role: 'PH', tag: 'PH' }, { role: 'PH', tag: 'PH' },
          { role: 'PR', tag: 'PR' }, { role: 'IFD', tag: 'IF' }, { role: 'OFD', tag: 'OF' },
        ]} />
        <Line label="Staff" roles={[{ role: 'HC', tag: 'MGR' }, { role: 'ST', tag: 'PARK' }]} />
      </div>
    </div>
  );
}
