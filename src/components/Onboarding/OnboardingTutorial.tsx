import { useState } from 'react';
import './OnboardingTutorial.css';

const SLIDES = [
  {
    icon: '\u26BE',
    title: 'Welcome to Dugout Draft!',
    text: 'Build your dream baseball team by drafting players from card pools.',
  },
  {
    icon: '\u{1F3B4}',
    title: 'Draft Your Team',
    text: 'Tap a player to scout them, then draft! Fill every position on your roster.',
  },
  {
    icon: '\u{1F3C6}',
    title: 'Win the Game!',
    text: 'Your team plays a real simulated baseball game. Hit homers, strike out batters, win!',
  },
];

const STORAGE_KEY = 'dugout-draft-tutorial';

export function hasSeenTutorial(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'seen';
}

export function markTutorialSeen(): void {
  localStorage.setItem(STORAGE_KEY, 'seen');
}

interface OnboardingTutorialProps {
  onComplete: () => void;
}

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [slideIndex, setSlideIndex] = useState(0);

  const slide = SLIDES[slideIndex];
  const isLast = slideIndex === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      markTutorialSeen();
      onComplete();
    } else {
      setSlideIndex(slideIndex + 1);
    }
  };

  const handleSkip = () => {
    markTutorialSeen();
    onComplete();
  };

  return (
    <div className="onboarding-overlay" onClick={handleNext}>
      <div className="onboarding-slide" key={slideIndex} onClick={e => e.stopPropagation()}>
        <div className="onboarding-icon">{slide.icon}</div>
        <h2>{slide.title}</h2>
        <p>{slide.text}</p>

        <div className="onboarding-dots">
          {SLIDES.map((_, i) => (
            <div key={i} className={`onboarding-dot ${i === slideIndex ? 'active' : ''}`} />
          ))}
        </div>

        <div className="onboarding-actions">
          <button className="onboarding-btn primary" onClick={handleNext}>
            {isLast ? "Let's Play!" : 'Next'}
          </button>
          {!isLast && (
            <button className="onboarding-skip" onClick={handleSkip}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
