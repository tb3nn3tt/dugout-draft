# Dugout Draft — Brand Kit

**"Every Legend. One Draft."**

A complete brand identity package for Dugout Draft, a two-player baseball draft simulation game featuring players from all of baseball history — real legends, fictional heroes, and everything in between.

---

## 📁 Package Contents

```
dugout-draft-brand/
├── README.md                    # This file
├── colors/
│   ├── theme.css               # CSS variables for all brand colors
│   ├── theme.ts                # TypeScript/JS color constants
│   └── tailwind.config.js      # Tailwind CSS theme extension
├── logos/
│   ├── logo-full.svg           # Primary logo (icon + wordmark stacked)
│   ├── logo-full-light.svg     # Light background version
│   ├── logo-horizontal.svg     # Compact horizontal layout
│   ├── logo-stacked.svg        # Wordmark only, stacked
│   └── logo-icon.svg           # DD monogram icon only
├── icons/
│   ├── app-icon-512.svg        # App store icon (scale as needed)
│   └── favicon.svg             # Favicon (32x32 optimized)
├── cards/
│   └── PlayerCard.tsx          # React component with tier styling
└── social/
    └── (social templates in brand-kit.html)
```

---

## 🎨 Color System

### Primary Palette — "Stadium Nights"

| Name | Hex | Usage |
|------|-----|-------|
| Navy 900 | `#0a1628` | Main app background |
| Navy 800 | `#0f1f3d` | Cards, modals |
| Navy 700 | `#152952` | Elevated surfaces |
| Royal 500 | `#1e5fbb` | Primary buttons, links |
| Royal 400 | `#2872db` | Button hover |
| Powder 300 | `#7eb8f4` | Secondary text on dark |
| Powder 200 | `#a8d1f8` | Subtle highlights |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| Orange 500 | `#e8682a` | **Primary accent**, CTAs, energy |
| Orange 400 | `#f4813f` | Hover states |
| Yellow 500 | `#f0b429` | **Rare highlights**, gold tier, special moments |
| Yellow 300 | `#fcd968` | Glow effects |

### Tier System

| Tier | Color | Hex |
|------|-------|-----|
| Diamond | Purple | `#a78bfa` |
| Gold | Yellow | `#f0b429` |
| Silver | Gray | `#94a3b8` |
| Bronze | Orange | `#e8682a` |

### Player Colors

| Player | Color | Hex |
|--------|-------|-----|
| Player 1 (Away) | Royal Blue | `#2872db` |
| Player 2 (Home) | Orange | `#e8682a` |

### Position Colors

| Position | Color | Hex |
|----------|-------|-----|
| Pitcher (SP/RP) | Royal Blue | `#1e5fbb` |
| Catcher | Purple | `#7c3aed` |
| Infield (1B/2B/3B/SS) | Red | `#dc2626` |
| Outfield (LF/CF/RF) | Green | `#16a34a` |
| DH | Gold | `#f0b429` |

---

## 🔤 Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Display | **Russo One** | 400 | Logo, headlines, player names |
| Headline | **Teko** | 500-700 | UI labels, stats, round titles |
| Subhead | **Barlow Condensed** | 500-600 | Taglines, navigation |
| Body | **Barlow** | 400-600 | Descriptions, UI copy |

### Google Fonts Import

```html
<link href="https://fonts.googleapis.com/css2?family=Russo+One&family=Teko:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## 🔧 Integration

### CSS Variables

Import `colors/theme.css` into your project:

```css
@import './dugout-draft-brand/colors/theme.css';

body {
  background: var(--dd-navy-900);
  color: var(--dd-white);
  font-family: var(--dd-font-body);
}

.btn-primary {
  background: var(--dd-gradient-button);
  color: white;
}

.tier-badge.diamond {
  background: var(--dd-tier-diamond);
}
```

### TypeScript/JavaScript

```typescript
import { colors, gradients, shadows } from './dugout-draft-brand/colors/theme';

const cardStyle = {
  background: colors.navy[800],
  borderColor: colors.tier.diamond.color,
  boxShadow: shadows.glow.diamond,
};
```

### Tailwind CSS

Extend your `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      ...require('./dugout-draft-brand/colors/tailwind.config.js')
    }
  }
}
```

Then use in your markup:

```html
<div class="bg-dd-navy-900 text-white">
  <button class="bg-dd-orange-500 hover:bg-dd-orange-400">
    Draft Player
  </button>
</div>
```

---

## 📐 Logo Usage

### Clear Space

Maintain padding around the logo equal to the height of the "D" in DRAFT.

### Minimum Sizes

- Full logo: 200px wide minimum
- Horizontal: 160px wide minimum
- Icon only: 32px minimum

### Do's

✅ Use gold gradient on dark backgrounds  
✅ Use light version on light/white backgrounds  
✅ Scale proportionally  
✅ Use turf green as supporting accent  

### Don'ts

❌ Stretch or skew the logo  
❌ Place on busy photo backgrounds  
❌ Change the brand colors  
❌ Add effects (shadows, outlines, etc.)  

---

## 📱 App Icon

The app icon uses the **DD monogram** inside a diamond shape:

- White "D" + Orange "D"
- Royal blue diamond outline
- Navy gradient background with subtle blue/orange glow

Export sizes needed:
- iOS: 1024x1024 (App Store), 180x180 (iPhone), 167x167 (iPad Pro)
- Android: 512x512 (Play Store), 192x192, 144x144, 96x96, 72x72, 48x48
- Web: 512x512, 192x192, 32x32 (favicon)

---

## 🏷️ Tagline Options

| Tagline | Best For |
|---------|----------|
| **Every Legend. One Draft.** | Primary — communicates scope |
| Draft The Impossible | Action-forward, magical |
| Build Your Legacy | Aspirational, all ages |
| Your Squad. Your Era. | Emphasizes time-spanning roster |
| Who You Got? | Social, conversational |

---

## 📱 Social Handles

Recommended handles to secure:

- X/Twitter: `@DugoutDraft`
- Instagram: `@DugoutDraft`
- TikTok: `@DugoutDraft`
- Reddit: `r/DugoutDraft`
- Discord: `DugoutDraft`

---

## 🎬 Card Set Visual Identity

Each card set has its own visual accent:

| Set | Icon | Theme Color |
|-----|------|-------------|
| The Show | ⭐ | Diamond blue |
| Hall of Famers | 🏆 | Gold |
| Lightning in a Bottle | ⚡ | Electric yellow |
| Hollywood Stars | 🎬 | Red/gold |
| October Legends | 🍂 | Orange |
| Niners 12U | ⚾ | Turf green |
| Throwback | 📼 | Sepia/warm |
| Wild Cards | 🃏 | Multicolor chaos |
| Mystery Round | ❓ | Purple |
| Auction Round | 💰 | Gold |

---

## 📄 License

This brand kit is for use in the Dugout Draft project. All assets are original creations.

---

**Built with ⚾ for baseball fans everywhere.**
