import { PackReward, MilestoneReward, PackType } from '../../types';
import './RewardModal.css';

interface RewardModalProps {
  packs: PackReward[];
  stubs: number;
  xp?: number;
  milestones: MilestoneReward[];
  onOpenPacks: () => void;
  onDismiss: () => void;
}

const PACK_ICONS: Record<PackType, string> = {
  standard: '📦',
  premium: '✨',
  legends: '🏆',
  fictional: '🎬',
  decade: '📻',
  international: '🌍',
  steroid_era: '💪',
  playoff: '🏟️',
  allstar: '🌟',
};

export function RewardModal({ packs, stubs, xp, milestones, onOpenPacks, onDismiss }: RewardModalProps) {
  const hasPacks = packs.length > 0;
  const hasMilestones = milestones.length > 0;

  return (
    <div className="reward-modal-overlay" onClick={onDismiss}>
      <div className="reward-modal" onClick={e => e.stopPropagation()}>
        <h2 className="reward-title">Game Rewards!</h2>

        {/* Pack rewards */}
        {hasPacks && (
          <div className="reward-section">
            {packs.map((pack, i) => (
              <div key={i} className="reward-item reward-pack">
                <span className="reward-icon">{PACK_ICONS[pack.type]}</span>
                <div className="reward-details">
                  <span className="reward-name">{pack.count}x {pack.type === 'standard' ? 'Standard' : pack.type === 'premium' ? 'Premium' : pack.type} Pack</span>
                  <span className="reward-reason">{pack.reason}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stubs + XP row */}
        {(stubs > 0 || (xp && xp > 0)) && (
          <div className="reward-currencies-row">
            {stubs > 0 && (
              <div className="reward-item reward-stubs">
                <span className="reward-icon">🪙</span>
                <div className="reward-details">
                  <span className="reward-name">+{stubs} Stubs</span>
                </div>
              </div>
            )}
            {xp && xp > 0 && (
              <div className="reward-item reward-xp">
                <span className="reward-icon">⚡</span>
                <div className="reward-details">
                  <span className="reward-name">+{xp} XP</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Milestones */}
        {hasMilestones && (
          <div className="reward-section reward-milestones">
            <h3 className="milestone-header">Milestone Unlocked!</h3>
            {milestones.map(m => (
              <div key={m.id} className="reward-item reward-milestone">
                <span className="reward-icon">🏅</span>
                <div className="reward-details">
                  <span className="reward-name">{m.name}</span>
                  {m.stubs > 0 && <span className="reward-reason">+{m.stubs} stubs</span>}
                  {m.packs.length > 0 && (
                    <span className="reward-reason">
                      +{m.packs.map(p => `${p.count}x ${p.type}`).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="reward-actions">
          {hasPacks && (
            <button className="reward-open-btn" onClick={onOpenPacks}>
              Open Packs Now
            </button>
          )}
          <button className="reward-later-btn" onClick={onDismiss}>
            {hasPacks ? 'Later' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
