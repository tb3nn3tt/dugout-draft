import { DraftEntry } from '../state/gauntletReducer';
import { Position } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';
import { getDisplayName } from '../domain/sim/helpers';

// Grouped roster template — the order/labels shown on the board as it fills.
const GROUPS: { title: string; slots: { role: Position; label: string }[] }[] = [
  { title: 'Lineup', slots: [
    { role: 'C', label: 'C' }, { role: '1B', label: '1B' }, { role: '2B', label: '2B' },
    { role: '3B', label: '3B' }, { role: 'SS', label: 'SS' }, { role: 'LF', label: 'LF' },
    { role: 'CF', label: 'CF' }, { role: 'RF', label: 'RF' }, { role: 'DH', label: 'DH' },
  ]},
  { title: 'Rotation', slots: [
    { role: 'SP', label: 'SP1' }, { role: 'SP', label: 'SP2' }, { role: 'SP', label: 'SP3' }, { role: 'SP', label: 'SP4' },
  ]},
  { title: 'Bullpen', slots: [
    { role: 'CL', label: 'CL' }, { role: 'SU', label: 'SU' }, { role: 'SU', label: 'SU' },
    { role: 'MRP', label: 'MRP' }, { role: 'MRP', label: 'MRP' }, { role: 'LRP', label: 'LRP' }, { role: 'LOOGY', label: 'LHP' },
  ]},
  { title: 'Bench', slots: [
    { role: 'BC', label: 'BC' }, { role: 'PH', label: 'PH' }, { role: 'PH', label: 'PH' },
    { role: 'PR', label: 'PR' }, { role: 'IFD', label: 'IF' }, { role: 'OFD', label: 'OF' },
  ]},
  { title: 'Staff', slots: [
    { role: 'HC', label: 'MGR' }, { role: 'ST', label: 'PARK' },
  ]},
];

export function RosterBoard({ draftLog, activeRole }: { draftLog: DraftEntry[]; activeRole?: Position }) {
  // Consume draftLog entries per role in order to fill slots.
  const byRole = new Map<string, DraftEntry[]>();
  for (const e of draftLog) {
    const arr = byRole.get(e.role) ?? [];
    arr.push(e);
    byRole.set(e.role, arr);
  }
  const cursor = new Map<string, number>();
  let firstEmptyMarked = false;

  return (
    <div className="board">
      {GROUPS.map(group => (
        <div key={group.title} className="board__group">
          <div className="board__title">{group.title}</div>
          <div className="board__cells">
            {group.slots.map((slot, i) => {
              const idx = cursor.get(slot.role) ?? 0;
              const entry = byRole.get(slot.role)?.[idx];
              cursor.set(slot.role, idx + 1);
              const filled = !!entry;
              const isNext = !filled && !firstEmptyMarked && slot.role === activeRole;
              if (isNext) firstEmptyMarked = true;
              const color = filled ? TIER_COLORS[getTier(entry!.player.overall)] : 'var(--line)';
              return (
                <div
                  key={i}
                  className={`cell ${filled ? 'cell--on' : ''} ${isNext ? 'cell--next' : ''}`}
                  style={{ borderColor: color }}
                  title={filled ? entry!.player.name : slot.label}
                >
                  {filled ? (
                    <>
                      <span className="cell__ovr" style={{ color }}>{entry!.player.overall}</span>
                      <span className="cell__nm">{getDisplayName(entry!.player.name)}</span>
                    </>
                  ) : (
                    <span className="cell__lbl">{slot.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
