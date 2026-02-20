import { useState, useEffect } from 'react';
import { DraftRoundType } from '../../types';
import './SpecialRoundOnboarding.css';

const ROUND_INFO: Record<string, { icon: string; name: string; description: string }> = {
  mystery: {
    icon: '❓',
    name: 'Mystery Round',
    description: 'Only one stat is revealed per player. Choose wisely — the rest are hidden until you draft them!',
  },
  auction: {
    icon: '💰',
    name: 'Auction Round',
    description: 'An elite player is up for grabs! Each manager offers one of their drafted players as a bid. Highest overall bid wins the star.',
  },
  legends: {
    icon: '🏆',
    name: 'Legends Round',
    description: 'All-time greats from baseball history. These Hall of Famers bring legendary talent to your roster.',
  },
  peak: {
    icon: '⭐',
    name: 'Peak Season Round',
    description: 'Players at their single-season best. These cards capture career-defining performances.',
  },
  fictional: {
    icon: '🎬',
    name: 'Fictional Round',
    description: 'Stars from movies, TV, and fiction. From Roy Hobbs to Pedro Cerrano — anything goes!',
  },
  niners: {
    icon: '⚾',
    name: 'Niners Round',
    description: "Coach's 12U All-Stars. These kids are the best of the best from youth baseball.",
  },
  decade_classic: {
    icon: '📻',
    name: 'Classic Decade Round',
    description: 'Stars from the 1960s and 70s. The golden age of pitching meets raw power.',
  },
  decade_modern: {
    icon: '📼',
    name: 'Modern Decade Round',
    description: 'Icons of the 1980s and 90s. Big hair, bigger swings, and unforgettable moments.',
  },
  playoff_heroes: {
    icon: '🏟️',
    name: 'Playoff Heroes Round',
    description: 'Players who defined October baseball. When it mattered most, these legends delivered.',
  },
  one_year_wonders: {
    icon: '⚡',
    name: 'One-Year Wonders Round',
    description: 'Incredible single-season breakouts. They may not have sustained it, but what a year it was!',
  },
  busts: {
    icon: '💔',
    name: 'What Could Have Been',
    description: "Can't-miss prospects who missed. These players had all the talent but couldn't put it together.",
  },
  steroid_era: {
    icon: '💪',
    name: 'Tainted Legends',
    description: "The controversial greats of baseball's steroid era. Tainted legacy, undeniable talent — 762 HR don't hit themselves.",
  },
  international: {
    icon: '🌍',
    name: 'International Legends',
    description: 'Stars from NPB, KBO, Cuba, and the Negro Leagues. Sadaharu Oh, Josh Gibson, and global greatness.',
  },
  coach: {
    icon: '📋',
    name: 'Coach Round',
    description: 'Draft a Head Coach for your team! Each coach brings unique bonuses to your roster throughout the World Series.',
  },
  stadium: {
    icon: '🏟️',
    name: 'Stadium Round',
    description: 'Pick your home stadium! Park effects shape home games — Coors Field boosts homers, Oracle Park suppresses them. In the World Series, your park hosts games 1, 2, 6, and 7.',
  },
};

const STORAGE_KEY = 'dugout-draft-seen-rounds';

function getSeenRounds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markRoundSeen(roundType: string) {
  const seen = getSeenRounds();
  seen.add(roundType);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]));
}

interface SpecialRoundOnboardingProps {
  roundType: DraftRoundType;
  onDismiss: () => void;
}

export function SpecialRoundOnboarding({ roundType, onDismiss }: SpecialRoundOnboardingProps) {
  const info = ROUND_INFO[roundType];
  if (!info) return null;

  const handleDismiss = () => {
    markRoundSeen(roundType);
    onDismiss();
  };

  return (
    <div className="onboarding-overlay" onClick={handleDismiss}>
      <div className="onboarding-modal" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-icon">{info.icon}</div>
        <h3 className="onboarding-title">{info.name}</h3>
        <p className="onboarding-description">{info.description}</p>
        <button className="onboarding-btn" onClick={handleDismiss}>
          Got it!
        </button>
      </div>
    </div>
  );
}

export function useSpecialRoundOnboarding(roundType: DraftRoundType) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (roundType === 'normal') {
      setShowOnboarding(false);
      return;
    }
    const seen = getSeenRounds();
    if (!seen.has(roundType) && ROUND_INFO[roundType]) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [roundType]);

  return {
    showOnboarding,
    dismissOnboarding: () => {
      markRoundSeen(roundType);
      setShowOnboarding(false);
    },
  };
}
