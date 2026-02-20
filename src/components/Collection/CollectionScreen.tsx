import { useState, useMemo } from 'react';
import { useCollection } from '../../contexts/CollectionContext';
import { buildAllPlayersMap } from '../../utils/draftLogic';
import { getOverallRating, getPositionColor, getCategoryBadge } from '../../utils/helpers';
import { Player, PlayerCategory } from '../../types';
import { PlayerScoutingModal } from '../Draft/PlayerScoutingModal';
import './CollectionScreen.css';

type FilterTab = 'all' | 'owned' | 'unowned';
type SortMode = 'ovr' | 'name' | 'tier' | 'position';
type SetFilter = 'all' | PlayerCategory | 'current';

const SET_TABS: { key: SetFilter; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'All', icon: '', color: '' },
  { key: 'current', label: 'The Show', icon: '⚾', color: '#3498db' },
  { key: 'legend', label: 'Legends', icon: '🏆', color: '#ffd700' },
  { key: 'peak', label: 'Peak', icon: '⭐', color: '#ff6b6b' },
  { key: 'fictional', label: 'Fictional', icon: '🎬', color: '#9b59b6' },
  { key: 'niners', label: 'Niners', icon: '⚾', color: '#00bfff' },
  { key: 'decade', label: 'Classic', icon: '📻', color: '#cd853f' },
  { key: 'playoff', label: 'Playoff', icon: '🏟️', color: '#228b22' },
  { key: 'oddity', label: 'Oddity', icon: '⚡', color: '#ff6b35' },
  { key: 'busts', label: 'Busts', icon: '💔', color: '#dc2626' },
  { key: 'international', label: "Int'l", icon: '🌍', color: '#00acc1' },
];

export function CollectionScreen({ onBack }: { onBack: () => void }) {
  const { collection, hasPlayer, setProgress, collectionPercent, totalPlayers } = useCollection();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [setFilter, setSetFilter] = useState<SetFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('ovr');
  const [search, setSearch] = useState('');
  const [previewPlayer, setPreviewPlayer] = useState<Player | null>(null);

  const allPlayersMap = useMemo(() => buildAllPlayersMap(), []);
  const allPlayersList = useMemo(() => Array.from(allPlayersMap.values()), [allPlayersMap]);

  const filteredPlayers = useMemo(() => {
    let players = allPlayersList;

    // Filter by set/category
    if (setFilter !== 'all') {
      if (setFilter === 'current') {
        players = players.filter(p => !p.category || p.category === 'current');
      } else {
        players = players.filter(p => p.category === setFilter);
      }
    }

    // Filter by owned/unowned
    if (filterTab === 'owned') {
      players = players.filter(p => hasPlayer(p.id));
    } else if (filterTab === 'unowned') {
      players = players.filter(p => !hasPlayer(p.id));
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      players = players.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.positions.some(pos => pos.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (sortMode) {
      case 'ovr':
        players = [...players].sort((a, b) => b.overall - a.overall);
        break;
      case 'name':
        players = [...players].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'tier':
        players = [...players].sort((a, b) => b.overall - a.overall);
        break;
      case 'position':
        players = [...players].sort((a, b) => {
          const posOrder = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP', 'CL', 'SU', 'MRP', 'LRP', 'LOOGY'];
          return posOrder.indexOf(a.positions[0]) - posOrder.indexOf(b.positions[0]);
        });
        break;
    }

    return players;
  }, [allPlayersList, setFilter, filterTab, search, sortMode, hasPlayer]);

  const ownedCount = collection.ownedPlayerIds.length;

  return (
    <div className="collection-screen">
      <div className="collection-header">
        <button className="collection-back" onClick={onBack}>Back</button>
        <div className="collection-title">
          <h2>My Collection</h2>
          <div className="collection-overall">
            <div className="collection-progress-bar">
              <div className="collection-progress-fill" style={{ width: `${collectionPercent}%` }} />
            </div>
            <span className="collection-count">{ownedCount}/{totalPlayers} ({collectionPercent}%)</span>
          </div>
        </div>
        <div className="collection-stubs">
          <span className="stubs-icon">🪙</span>
          <span className="stubs-amount">{collection.stubs}</span>
        </div>
      </div>

      {/* Set progress cards */}
      <div className="set-progress-row">
        {setProgress.map(s => {
          const pct = s.totalPlayers > 0 ? Math.round((s.ownedPlayers / s.totalPlayers) * 100) : 0;
          return (
            <button
              key={s.name}
              className={`set-progress-card ${setFilter === s.category ? 'active' : ''}`}
              onClick={() => setSetFilter(setFilter === s.category ? 'all' : s.category as SetFilter)}
              style={{ '--set-color': s.color } as React.CSSProperties}
            >
              <span className="set-icon">{s.icon}</span>
              <span className="set-name">{s.name}</span>
              <div className="set-bar">
                <div className="set-bar-fill" style={{ width: `${pct}%`, backgroundColor: s.color }} />
              </div>
              <span className="set-count">{s.ownedPlayers}/{s.totalPlayers}</span>
            </button>
          );
        })}
      </div>

      {/* Filter controls */}
      <div className="collection-filters">
        <div className="filter-tabs">
          {(['all', 'owned', 'unowned'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              className={`filter-tab ${filterTab === tab ? 'active' : ''}`}
              onClick={() => setFilterTab(tab)}
            >
              {tab === 'all' ? `All (${allPlayersList.length})` :
               tab === 'owned' ? `Owned (${ownedCount})` :
               `Locked (${totalPlayers - ownedCount})`}
            </button>
          ))}
        </div>

        <div className="filter-right">
          <input
            type="text"
            className="collection-search"
            placeholder="Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="collection-sort"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
          >
            <option value="ovr">Sort: OVR</option>
            <option value="name">Sort: Name</option>
            <option value="position">Sort: Position</option>
          </select>
        </div>
      </div>

      {/* Set filter pills (mobile-friendly horizontal scroll) */}
      <div className="set-filter-pills">
        {SET_TABS.map(tab => (
          <button
            key={tab.key}
            className={`set-pill ${setFilter === tab.key ? 'active' : ''}`}
            onClick={() => setSetFilter(tab.key)}
            style={tab.color ? { '--pill-color': tab.color } as React.CSSProperties : undefined}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div className="collection-grid">
        {filteredPlayers.map(player => {
          const owned = hasPlayer(player.id);
          const rating = getOverallRating(player.overall);
          const badge = getCategoryBadge(player.category);
          return (
            <div
              key={player.id}
              className={`collection-card ${owned ? 'owned' : 'locked'}`}
              onClick={() => owned ? setPreviewPlayer(player) : undefined}
            >
              {/* Tier glow border */}
              <div className="card-tier-border" style={{ borderColor: owned ? rating.color : 'transparent' }} />

              {/* Overall badge */}
              <div className="card-ovr" style={{ backgroundColor: owned ? rating.color : '#333' }}>
                {owned ? player.overall : '?'}
              </div>

              {/* Category badge */}
              {badge && <span className="card-badge">{badge}</span>}

              {/* Player info */}
              <div className="card-info">
                <span className={`card-name ${!owned ? 'locked-name' : ''}`}>
                  {player.name}
                </span>
                <div className="card-meta">
                  <span
                    className="card-pos"
                    style={{ backgroundColor: owned ? getPositionColor(player.positions[0]) : '#444' }}
                  >
                    {player.positions[0]}
                  </span>
                  <span className="card-team">{owned ? player.team : '???'}</span>
                </div>
              </div>

              {/* Locked overlay */}
              {!owned && (
                <div className="card-locked-overlay">
                  <span className="lock-icon">🔒</span>
                </div>
              )}

              {/* Tier label */}
              <span className="card-tier-label" style={{ color: rating.color }}>
                {rating.label}
              </span>
            </div>
          );
        })}
      </div>

      {filteredPlayers.length === 0 && (
        <div className="collection-empty">
          <p>No players found matching your filters.</p>
        </div>
      )}

      {/* Player preview modal */}
      {previewPlayer && (
        <PlayerScoutingModal
          player={previewPlayer}
          onDraft={() => setPreviewPlayer(null)}
          onClose={() => setPreviewPlayer(null)}
        />
      )}
    </div>
  );
}
