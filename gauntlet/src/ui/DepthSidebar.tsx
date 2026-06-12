import { DraftEntry } from '../state/gauntletReducer';
import { Position } from '../domain/types';
import { getTier, TIER_COLORS } from '../domain/players';

// All 28 slots, grouped, shown compactly: POS · F.Last · OVR.
const GROUPS: { title: string; slots: { role: Position; label: string }[] }[] = [
  { title: 'LINEUP', slots: [
    { role: 'C', label: 'C' }, { role: '1B', label: '1B' }, { role: '2B', label: '2B' },
    { role: '3B', label: '3B' }, { role: 'SS', label: 'SS' }, { role: 'LF', label: 'LF' },
    { role: 'CF', label: 'CF' }, { role: 'RF', label: 'RF' }, { role: 'DH', label: 'DH' },
  ]},
  { title: 'ROTATION', slots: [
    { role: 'SP', label: 'SP1' }, { role: 'SP', label: 'SP2' }, { role: 'SP', label: 'SP3' }, { role: 'SP', label: 'SP4' },
  ]},
  { title: 'BULLPEN', slots: [
    { role: 'CL', label: 'CL' }, { role: 'SU', label: 'SU' }, { role: 'SU', label: 'SU' },
    { role: 'MRP', label: 'MR' }, { role: 'MRP', label: 'MR' }, { role: 'LRP', label: 'LR' }, { role: 'LOOGY', label: 'LHP' },
  ]},
  { title: 'BENCH', slots: [
    { role: 'BC', label: 'BC' }, { role: 'PH', label: 'PH' }, { role: 'PH', label: 'PH' },
    { role: 'PR', label: 'PR' }, { role: 'IFD', label: 'IF' }, { role: 'OFD', label: 'OF' },
  ]},
  { title: 'STAFF', slots: [{ role: 'HC', label: 'MGR' }, { role: 'ST', label: 'PRK' }] },
];

function initialLast(name: string): string {
  const clean = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = clean.split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

export function DepthSidebar({ draftLog, activeRole }: { draftLog: DraftEntry[]; activeRole?: Position }) {
  const byRole = new Map<string, DraftEntry[]>();
  for (const e of draftLog) {
    const arr = byRole.get(e.role) ?? [];
    arr.push(e);
    byRole.set(e.role, arr);
  }
  const cursor = new Map<string, number>();
  let nextMarked = false;

  return (
    <div className="depth">
      {GROUPS.map(group => (
        <div key={group.title} className="depth__group">
          <div className="depth__title">{group.title}</div>
          {group.slots.map((slot, i) => {
            const idx = cursor.get(slot.role) ?? 0;
            cursor.set(slot.role, idx + 1);
            const entry = byRole.get(slot.role)?.[idx];
            const filled = !!entry;
            const isNext = !filled && !nextMarked && slot.role === activeRole;
            if (isNext) nextMarked = true;
            const color = filled ? TIER_COLORS[getTier(entry!.player.overall)] : 'var(--text-dim)';
            return (
              <div key={i} className={`depth__row ${isNext ? 'depth__row--next' : ''}`}>
                <span className="depth__pos">{slot.label}</span>
                <span className="depth__nm">{filled ? initialLast(entry!.player.name) : '—'}</span>
                <span className="depth__ovr" style={{ color }}>{filled ? entry!.player.overall : ''}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
