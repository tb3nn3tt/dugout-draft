import { Player, SeriesOutcome } from '../domain/types';
import { FitName } from './FitName';

const PITCHER_POS = new Set(['SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY', 'RP']);
const isPitcher = (p: Player) => PITCHER_POS.has(p.positions[0]);

function Line({ p }: { p: Player }) {
  return (
    <div className="tdt__row">
      <span className="tdt__pos">{p.positions[0]}</span>
      <FitName name={p.name} className="tdt__name" />
      <span className="tdt__sub">{p.positions.slice(0, 3).join('/')} · {p.bats}/{p.throws}</span>
    </div>
  );
}

/**
 * Read-only roster + (optional) series view for a leaderboard / hall-of-fame
 * team. The caller hydrates the player list; this just lays it out.
 */
export function TeamDetail({ teamName, subtitle, roster, manager, stadium, series, onClose }: {
  teamName: string;
  subtitle?: string;
  roster: Player[];
  manager: Player | null;
  stadium: Player | null;
  series?: SeriesOutcome[];
  onClose: () => void;
}) {
  const hitters = roster.filter(p => !isPitcher(p));
  const pitchers = roster.filter(isPitcher);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__card" onClick={e => e.stopPropagation()}>
        <div className="tdt__hd">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{teamName}</div>
            {subtitle && <div className="dim" style={{ fontSize: 12 }}>{subtitle}</div>}
          </div>
          <button className="sheetwrap__x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {hitters.length > 0 && (
          <div className="tdt__sec">
            <div className="tdt__h">LINEUP</div>
            {hitters.map((p, i) => <Line key={i} p={p} />)}
          </div>
        )}
        {pitchers.length > 0 && (
          <div className="tdt__sec">
            <div className="tdt__h">PITCHING</div>
            {pitchers.map((p, i) => <Line key={i} p={p} />)}
          </div>
        )}
        {(manager || stadium) && (
          <div className="tdt__sec">
            <div className="tdt__h">STAFF</div>
            {manager && <div className="tdt__row"><span className="tdt__pos">MGR</span><FitName name={manager.name} className="tdt__name" /><span className="tdt__sub">{manager.coachEffect?.style ?? ''}</span></div>}
            {stadium && <div className="tdt__row"><span className="tdt__pos">PARK</span><FitName name={stadium.name} className="tdt__name" /><span className="tdt__sub">{stadium.parkEffect ? `runs ×${stadium.parkEffect.runFactor.toFixed(2)}` : ''}</span></div>}
          </div>
        )}

        {series && series.length > 0 && (
          <div className="tdt__sec">
            <div className="tdt__h">GAUNTLET SERIES</div>
            {series.map((s, i) => (
              <div key={i} className="tdt__srow">
                <span style={{ color: s.won ? 'var(--win)' : 'var(--loss)', fontWeight: 800 }}>{s.won ? '✓' : '✕'}</span>
                <span className="tdt__name">{s.opponentName}</span>
                <span className="tdt__sub">{s.wins}–{s.losses} · {s.runsFor >= s.runsAgainst ? '+' : ''}{s.runsFor - s.runsAgainst}</span>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
