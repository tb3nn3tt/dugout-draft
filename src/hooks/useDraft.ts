import { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { Position, ROSTER_REQUIREMENTS, QUICK_ROSTER_REQUIREMENTS, RosterRequirements, TOTAL_ROSTER_SIZE, QUICK_ROSTER_SIZE } from '../types';

export function useDraft() {
  const { state, dispatch } = useGame();

  const isQuick = state.gameMode === 'quick';
  const rosterSize = isQuick ? QUICK_ROSTER_SIZE : TOTAL_ROSTER_SIZE;
  const reqs = isQuick ? QUICK_ROSTER_REQUIREMENTS : ROSTER_REQUIREMENTS;

  const currentTeam = state.currentPick === 'player1' ? state.team1 : state.team2;

  const positionCounts = useMemo(() => {
    const counts: Record<Position, number> = {
      C: 0, '1B': 0, '2B': 0, '3B': 0, SS: 0,
      LF: 0, CF: 0, RF: 0, DH: 0,
      BC: 0, PH: 0, PR: 0, IFD: 0, OFD: 0,
      SP: 0, CL: 0, SU: 0, MRP: 0, LRP: 0, LOOGY: 0,
      HC: 0,
    };

    currentTeam.roster.forEach(player => {
      // Count only the primary position for roster requirements
      if (player.positions.length > 0) {
        const primaryPos = player.positions[0];
        counts[primaryPos]++;
      }
    });

    return counts;
  }, [currentTeam.roster]);

  const filledPositions = useMemo(() => {
    const filled: Record<Position, boolean> = {
      C: false, '1B': false, '2B': false, '3B': false, SS: false,
      LF: false, CF: false, RF: false, DH: false,
      BC: false, PH: false, PR: false, IFD: false, OFD: false,
      SP: false, CL: false, SU: false, MRP: false, LRP: false, LOOGY: false,
      HC: false,
    };

    (Object.keys(reqs) as Position[]).forEach(pos => {
      filled[pos] = positionCounts[pos] >= (reqs[pos] || 0);
    });

    return filled;
  }, [positionCounts, reqs]);

  const neededPositions = useMemo(() => {
    const needed: Position[] = [];
    (Object.keys(reqs) as Position[]).forEach(pos => {
      const required = reqs[pos] || 0;
      const current = positionCounts[pos];
      if (current < required) {
        needed.push(pos);
      }
    });
    return needed;
  }, [positionCounts, reqs]);

  const pickPlayer = (playerId: string) => {
    dispatch({ type: 'PICK_PLAYER', playerId });
  };

  const remainingNeedCount = useMemo(() => {
    let needs = 0;
    (Object.keys(reqs) as Position[]).forEach(pos => {
      const deficit = (reqs[pos] || 0) - positionCounts[pos];
      if (deficit > 0) needs += deficit;
    });
    return needs;
  }, [positionCounts, reqs]);

  const isDraftComplete = currentTeam.roster.length >= rosterSize;
  const remainingPicks = rosterSize - currentTeam.roster.length;
  const mustFillNeed = remainingPicks <= remainingNeedCount;

  const progress = {
    team1: state.team1.roster.length,
    team2: state.team2.roster.length,
    total: rosterSize,
  };

  return {
    cardPool: state.cardPool,
    currentPick: state.currentPick,
    pickNumber: state.pickNumber,
    currentTeam,
    positionCounts,
    filledPositions,
    neededPositions,
    pickPlayer,
    isDraftComplete,
    remainingPicks,
    remainingNeedCount,
    mustFillNeed,
    progress,
    requirements: reqs as RosterRequirements,
  };
}
