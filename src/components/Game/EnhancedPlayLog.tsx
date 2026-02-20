import { useState, useEffect, useRef } from 'react';
import { PlayLogEntry, Player } from '../../types';
import './EnhancedPlayLog.css';

interface EnhancedPlayLogProps {
  plays: PlayLogEntry[];
  userPlayerIds: Set<string>;
  players: Map<string, Player>;
}

function getPlayColor(type: PlayLogEntry['type']): string {
  switch (type) {
    case 'homerun':
      return '#f6e05e';
    case 'triple':
      return '#ed8936';
    case 'double':
      return '#48bb78';
    case 'single':
      return '#68d391';
    case 'walk':
      return '#4299e1';
    case 'strikeout':
      return '#fc8181';
    case 'out':
      return '#a0aec0';
    case 'run':
      return '#9f7aea';
    default:
      return '#e2e8f0';
  }
}

function getPlayEmoji(type: PlayLogEntry['type']): string {
  switch (type) {
    case 'homerun':
      return '💥';
    case 'triple':
      return '🔥';
    case 'double':
      return '⚡';
    case 'single':
      return '✓';
    case 'walk':
      return '🚶';
    case 'strikeout':
      return '❌';
    case 'out':
      return '⬇';
    case 'run':
      return '🏃';
    case 'momentum':
      return '📈';
    default:
      return '';
  }
}

function getMomentumEmoji(event?: PlayLogEntry['momentumEvent']): string {
  switch (event) {
    case 'rally_building': return '🔥';
    case 'momentum_shift': return '⚡';
    case 'rally_killed': return '❄️';
    default: return '';
  }
}

function isDramaticPlay(type: PlayLogEntry['type']): boolean {
  return type === 'homerun' || type === 'triple';
}

interface InningGroup {
  inning: number;
  half: 'top' | 'bottom';
  plays: PlayLogEntry[];
}

function groupPlaysByInning(plays: PlayLogEntry[]): InningGroup[] {
  const groups: InningGroup[] = [];
  let currentGroup: InningGroup | null = null;

  for (const play of plays) {
    if (
      !currentGroup ||
      currentGroup.inning !== play.inning ||
      currentGroup.half !== play.half
    ) {
      currentGroup = {
        inning: play.inning,
        half: play.half,
        plays: [],
      };
      groups.push(currentGroup);
    }
    currentGroup.plays.push(play);
  }

  return groups;
}

function InningSection({
  group,
  userPlayerIds,
  isLatest,
  defaultExpanded,
}: {
  group: InningGroup;
  userPlayerIds: Set<string>;
  isLatest: boolean;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const halfLabel = group.half === 'top' ? 'Top' : 'Bot';

  useEffect(() => {
    if (isLatest) {
      setIsExpanded(true);
    }
  }, [isLatest]);

  return (
    <div className={`inning-section ${isLatest ? 'latest' : ''}`}>
      <button
        className="inning-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="inning-label">
          {halfLabel} {group.inning}
        </span>
        <span className="play-count">{group.plays.length} plays</span>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className="inning-plays">
          {group.plays.map((play, index) => (
            <PlayEntry
              key={`${play.inning}-${play.half}-${index}`}
              play={play}
              isUserPlayer={userPlayerIds.has(play.batterId)}
              isNew={isLatest && index === group.plays.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayEntry({
  play,
  isUserPlayer,
  isNew,
}: {
  play: PlayLogEntry;
  isUserPlayer: boolean;
  isNew: boolean;
}) {
  const isDramatic = isDramaticPlay(play.type);
  const color = getPlayColor(play.type);
  const emoji = getPlayEmoji(play.type);
  const momentumEmoji = getMomentumEmoji(play.momentumEvent);

  const isRunScoring = (play.runsScored ?? 0) > 0;

  return (
    <div
      className={`play-entry ${play.type} ${isDramatic ? 'dramatic' : ''} ${isUserPlayer ? 'user-player' : ''} ${isNew ? 'new' : ''} ${play.isClutch ? 'clutch' : ''} ${play.type === 'momentum' ? 'momentum-event' : ''} ${isRunScoring ? 'run-scoring' : ''}`}
      style={{ '--play-color': color } as React.CSSProperties}
    >
      {isUserPlayer && <span className="user-pick-badge">YOUR PICK</span>}
      {play.isClutch && <span className="clutch-badge">CLUTCH</span>}
      <span className="play-emoji">{momentumEmoji || emoji}</span>
      <span className="play-text">{play.description}</span>
    </div>
  );
}

export function EnhancedPlayLog({
  plays,
  userPlayerIds,
}: EnhancedPlayLogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const inningGroups = groupPlaysByInning(plays);

  // Auto-scroll to bottom when new plays arrive
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [plays, autoScroll]);

  // Detect if user scrolled away from bottom
  const handleScroll = () => {
    if (logRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  return (
    <div className="enhanced-play-log">
      <div className="play-log-header">
        <span className="log-title">Play-by-Play</span>
        <span className="play-total">{plays.length} plays</span>
      </div>

      <div className="play-log-content" ref={logRef} onScroll={handleScroll}>
        {inningGroups.length === 0 ? (
          <div className="no-plays">Game starting...</div>
        ) : (
          inningGroups.map((group, index) => (
            <InningSection
              key={`${group.inning}-${group.half}`}
              group={group}
              userPlayerIds={userPlayerIds}
              isLatest={index === inningGroups.length - 1}
              defaultExpanded={index >= inningGroups.length - 2}
            />
          ))
        )}
      </div>

      {!autoScroll && (
        <button
          className="scroll-to-bottom"
          onClick={() => {
            setAutoScroll(true);
            if (logRef.current) {
              logRef.current.scrollTop = logRef.current.scrollHeight;
            }
          }}
        >
          ↓ New plays
        </button>
      )}
    </div>
  );
}
