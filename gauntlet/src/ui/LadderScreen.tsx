import { useState, useEffect, useCallback } from 'react';
import { ensureAuth } from '../firebase/firebase';
import { getLadder, getChamp, tickLadder, LadderTeam } from '../firebase/ladder';

export function LadderScreen({ onBack }: { onBack: () => void }) {
  const [teams, setTeams] = useState<LadderTeam[]>([]);
  const [champ, setChamp] = useState<LadderTeam | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const [c, t] = await Promise.all([getChamp(), getLadder(50)]);
    setChamp(c); setTeams(t);
  }, []);

  const runMatches = useCallback(async () => {
    setSyncing(true);
    try { await tickLadder(5); await refresh(); } catch { /* ignore */ }
    setSyncing(false);
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureAuth();
        await tickLadder(5);          // pitch in as a worker on open
        if (!alive) return;
        await refresh();
        if (alive) setStatus('ready');
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  return (
    <div className="stack" style={{ marginTop: 16, gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 26 }}>🌐 Global Ladder</h1>
        <button className="btn btn--ghost" style={{ width: 'auto', minHeight: 40, padding: '0 14px' }} onClick={onBack}>Back</button>
      </div>

      {status === 'loading' && <div className="stack center" style={{ marginTop: 40, gap: 12 }}><div className="spinner" /><p className="dim">Syncing the ladder…</p></div>}
      {status === 'error' && <p className="dim center" style={{ marginTop: 30 }}>Couldn't reach the ladder. Check your connection and try again.</p>}

      {status === 'ready' && (
        <>
          {champ ? (
            <div className="card stack" style={{ gap: 4, borderColor: 'var(--accent)' }}>
              <span className="dim" style={{ fontSize: 12, letterSpacing: 1 }}>👑 REIGNING CHAMP (undefeated)</span>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: 18 }}>{champ.teamName}</strong>
                <strong style={{ color: 'var(--accent)' }}>{champ.wins}-0</strong>
              </div>
              <span className="dim" style={{ fontSize: 12 }}>by {champ.ownerName} · entered at {champ.gauntletStreak} gauntlet wins</span>
            </div>
          ) : (
            <p className="dim center">No teams on the ladder yet. Be the first to send one up.</p>
          )}

          {teams.length > 0 && (
            <div className="lb">
              <div className="lb__row lb__row--head">
                <span className="lb__rank">#</span>
                <span className="lb__team">Team</span>
                <span>W</span><span>RD</span><span>ST</span>
              </div>
              {teams.map((t, i) => (
                <div key={t.id} className="lb__row">
                  <span className="lb__rank">{i + 1}</span>
                  <span className="lb__team">
                    <span className="lb__name">{t.teamName}</span>
                    <span className="lb__streak dim">{t.ownerName}</span>
                  </span>
                  <span><b>{t.wins}</b></span>
                  <span style={{ color: t.runsFor - t.runsAgainst >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                    {t.runsFor - t.runsAgainst >= 0 ? '+' : ''}{t.runsFor - t.runsAgainst}
                  </span>
                  <span className="dim" style={{ fontSize: 10 }}>{t.status === 'queued' ? 'ALIVE' : 'OUT'}</span>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn--ghost" onClick={runMatches} disabled={syncing}>
            {syncing ? 'Running matches…' : '▶ Advance the ladder (run 5 matches)'}
          </button>
        </>
      )}
    </div>
  );
}
