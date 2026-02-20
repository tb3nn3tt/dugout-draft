import { useState } from 'react';
import { useCollection } from '../../contexts/CollectionContext';
import { PackType } from '../../types';
import { getShopPacks, getXPShopPacks } from '../../utils/collection';
import { PackOpening } from './PackOpening';
import './PackShop.css';

const PACK_DISPLAY: Record<PackType, { name: string; icon: string; color: string; image?: string }> = {
  standard: { name: 'Standard', icon: '\u{1F4E6}', color: '#3498db', image: '/pack-standard.png' },
  premium: { name: 'Premium', icon: '\u2728', color: '#ffd700', image: '/pack-premium.png' },
  legends: { name: 'Legends', icon: '\u{1F3C6}', color: '#ffd700', image: '/pack-legends.png' },
  fictional: { name: 'Fictional', icon: '\u{1F3AC}', color: '#9b59b6', image: '/pack-fictional.png' },
  decade: { name: 'Decade', icon: '\u{1F4FB}', color: '#cd853f', image: '/pack-decade.png' },
  international: { name: "Int'l", icon: '\u{1F30D}', color: '#00acc1', image: '/pack-international.png' },
  steroid_era: { name: 'Steroid', icon: '\u{1F4AA}', color: '#ff1744', image: '/pack-steroid_era.png' },
  playoff: { name: 'Playoff', icon: '\u{1F3DF}\uFE0F', color: '#228b22', image: '/pack-playoff.png' },
  allstar: { name: 'All-Star', icon: '\u{1F31F}', color: '#ffd700', image: '/pack-allstar.png' },
};

interface PackShopProps {
  onBack: () => void;
}

export function PackShop({ onBack }: PackShopProps) {
  const { collection, addStubs, addPacks, spendXP, xpLevel, xpCurrent, xpNextLevel, xpTotal, hasPacksToOpen, totalPacks } = useCollection();
  const [openingPack, setOpeningPack] = useState<PackType | null>(null);
  const [buyMessage, setBuyMessage] = useState<string | null>(null);

  const shopPacks = getShopPacks();
  const xpShopPacks = getXPShopPacks();

  const handleBuy = (type: PackType, cost: number) => {
    if (collection.stubs < cost) {
      setBuyMessage('Not enough stubs!');
      setTimeout(() => setBuyMessage(null), 2000);
      return;
    }
    addStubs(-cost);
    addPacks([{ type, count: 1, reason: 'Shop Purchase' }]);
    setBuyMessage(null);
    setOpeningPack(type);
  };

  const handleBuyWithXP = (type: PackType, xpCost: number) => {
    if (xpTotal < xpCost) {
      setBuyMessage('Not enough XP!');
      setTimeout(() => setBuyMessage(null), 2000);
      return;
    }
    spendXP(xpCost);
    addPacks([{ type, count: 1, reason: 'XP Purchase' }]);
    setBuyMessage(null);
    setOpeningPack(type);
  };

  // If opening a pack, show the pack opening screen
  if (openingPack) {
    return <PackOpening packType={openingPack} onDone={() => setOpeningPack(null)} />;
  }

  // Get pack inventory that has > 0
  const ownedPacks = (Object.keys(collection.packs) as PackType[])
    .filter(type => collection.packs[type] > 0);

  const xpPercent = xpNextLevel > 0 ? Math.round((xpCurrent / xpNextLevel) * 100) : 0;

  return (
    <div className="pack-shop-screen">
      <div className="shop-header">
        <button className="shop-back" onClick={onBack}>Back</button>
        <h2>Pack Shop</h2>
        <div className="shop-currencies">
          <div className="shop-stubs">
            <span className="stubs-icon">🪙</span>
            <span className="stubs-amount">{collection.stubs}</span>
          </div>
          <div className="shop-xp-badge">
            <span className="xp-icon">Lv.{xpLevel}</span>
            <span className="xp-amount">{xpTotal} XP</span>
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="xp-progress-section">
        <div className="xp-progress-label">
          <span>Level {xpLevel}</span>
          <span>{xpCurrent}/{xpNextLevel} XP</span>
        </div>
        <div className="xp-progress-bar">
          <div className="xp-progress-fill" style={{ width: `${xpPercent}%` }} />
        </div>
      </div>

      {/* Owned Packs */}
      {hasPacksToOpen && (
        <div className="shop-section">
          <h3 className="shop-section-title">My Packs ({totalPacks})</h3>
          <div className="pack-inventory">
            {ownedPacks.map(type => {
              const info = PACK_DISPLAY[type];
              return (
                <button
                  key={type}
                  className="inventory-pack"
                  onClick={() => setOpeningPack(type)}
                  style={{ '--pack-color': info.color } as React.CSSProperties}
                >
                  <div className="inv-pack-icon">
                    {info.image ? (
                      <img className="inv-pack-art" src={info.image} alt={info.name} />
                    ) : (
                      <span>{info.icon}</span>
                    )}
                    <span className="inv-pack-count">{collection.packs[type]}</span>
                  </div>
                  <span className="inv-pack-name">{info.name}</span>
                  <span className="inv-pack-open">Open</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* XP Shop */}
      <div className="shop-section">
        <h3 className="shop-section-title">XP Shop</h3>
        <p className="shop-section-desc">Spend XP earned from games on themed packs</p>
        <div className="shop-grid">
          {xpShopPacks.map(pack => {
            const canAfford = xpTotal >= pack.xpCost;
            const packDisplay = PACK_DISPLAY[pack.type];
            return (
              <div
                key={`xp-${pack.type}`}
                className={`shop-pack xp-shop-pack ${!canAfford ? 'cant-afford' : ''}`}
              >
                {packDisplay?.image ? (
                  <img className="shop-pack-art" src={packDisplay.image} alt={pack.name} />
                ) : (
                  <div className="shop-pack-icon">{pack.icon}</div>
                )}
                <span className="shop-pack-name">{pack.name}</span>
                <button
                  className="shop-buy-btn xp-buy-btn"
                  onClick={() => handleBuyWithXP(pack.type, pack.xpCost)}
                  disabled={!canAfford}
                >
                  <span className="buy-cost xp-cost">{pack.xpCost} XP</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stubs Shop */}
      <div className="shop-section">
        <h3 className="shop-section-title">Stubs Shop</h3>
        <div className="shop-grid">
          {shopPacks.map(pack => {
            const canAfford = collection.stubs >= pack.cost;
            const packDisplay = PACK_DISPLAY[pack.type];
            return (
              <div
                key={pack.type}
                className={`shop-pack ${!canAfford ? 'cant-afford' : ''}`}
              >
                {packDisplay?.image ? (
                  <img className="shop-pack-art" src={packDisplay.image} alt={pack.name} />
                ) : (
                  <div className="shop-pack-icon">{pack.icon}</div>
                )}
                <span className="shop-pack-name">{pack.name}</span>
                <button
                  className="shop-buy-btn"
                  onClick={() => handleBuy(pack.type, pack.cost)}
                  disabled={!canAfford}
                >
                  <span className="buy-cost">{pack.cost} 🪙</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {buyMessage && (
        <div className="shop-message">{buyMessage}</div>
      )}
    </div>
  );
}
