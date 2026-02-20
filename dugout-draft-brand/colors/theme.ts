/**
 * DUGOUT DRAFT - Brand Colors
 * TypeScript/JavaScript constants for programmatic use
 */

export const colors = {
  // ========================================
  // PRIMARY PALETTE - "Stadium Nights"
  // ========================================
  
  navy: {
    900: '#0a1628',  // Darkest - main app background
    800: '#0f1f3d',  // Card backgrounds, modals
    700: '#152952',  // Elevated surfaces
    600: '#1c3568',  // Hover states on dark
  },
  
  royal: {
    500: '#1e5fbb',  // Primary buttons, links
    400: '#2872db',  // Button hover
    300: '#4a90e8',  // Active states
  },
  
  powder: {
    300: '#7eb8f4',  // Secondary text on dark
    200: '#a8d1f8',  // Subtle highlights
    100: '#d4e8fc',  // Very light accents
  },
  
  // ========================================
  // ACCENT COLORS
  // ========================================
  
  orange: {
    600: '#c75a1c',  // Darker orange for text on light
    500: '#e8682a',  // Primary accent
    400: '#f4813f',  // Hover/glow states
    300: '#f99d5c',  // Light accent
  },
  
  yellow: {
    500: '#f0b429',  // Championship gold
    400: '#f9c846',  // Bright highlight
    300: '#fcd968',  // Glow effects
  },
  
  // ========================================
  // TIER SYSTEM
  // ========================================
  
  tier: {
    diamond: {
      color: '#a78bfa',
      glow: 'rgba(167, 139, 250, 0.4)',
      bg: 'rgba(167, 139, 250, 0.2)',
      border: 'rgba(167, 139, 250, 0.4)',
    },
    gold: {
      color: '#f0b429',
      glow: 'rgba(240, 180, 41, 0.4)',
      bg: 'rgba(240, 180, 41, 0.2)',
      border: 'rgba(240, 180, 41, 0.4)',
    },
    silver: {
      color: '#94a3b8',
      glow: 'rgba(148, 163, 184, 0.3)',
      bg: 'rgba(148, 163, 184, 0.2)',
      border: 'rgba(148, 163, 184, 0.4)',
    },
    bronze: {
      color: '#e8682a',
      glow: 'rgba(232, 104, 42, 0.4)',
      bg: 'rgba(232, 104, 42, 0.2)',
      border: 'rgba(232, 104, 42, 0.4)',
    },
  },
  
  // ========================================
  // PLAYER COLORS
  // ========================================
  
  player: {
    1: {
      color: '#2872db',
      bg: 'rgba(40, 114, 219, 0.15)',
    },
    2: {
      color: '#e8682a',
      bg: 'rgba(232, 104, 42, 0.15)',
    },
  },
  
  // ========================================
  // POSITION COLORS
  // ========================================
  
  position: {
    pitcher: '#1e5fbb',
    catcher: '#7c3aed',
    infield: '#dc2626',
    outfield: '#16a34a',
    dh: '#f0b429',
  },
  
  // ========================================
  // NEUTRALS
  // ========================================
  
  white: '#ffffff',
  
  gray: {
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  
  // ========================================
  // SEMANTIC
  // ========================================
  
  semantic: {
    success: { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.15)' },
    warning: { color: '#f0b429', bg: 'rgba(240, 180, 41, 0.15)' },
    error: { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.15)' },
    info: { color: '#2872db', bg: 'rgba(40, 114, 219, 0.15)' },
  },
} as const;


// ========================================
// GRADIENTS
// ========================================

export const gradients = {
  // Logo "DRAFT" text gradient
  gold: 'linear-gradient(180deg, #fcd968 0%, #f0b429 50%, #c99a1d 100%)',
  
  // Primary button
  button: 'linear-gradient(135deg, #e8682a 0%, #c75a1c 100%)',
  
  // App background
  background: `
    radial-gradient(ellipse at 20% 20%, rgba(30, 95, 187, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(232, 104, 42, 0.06) 0%, transparent 50%),
    #0a1628
  `,
  
  // Card backgrounds by tier
  card: {
    diamond: `
      linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, transparent 50%),
      linear-gradient(45deg, #0f1535 0%, #1a1f4a 50%, #0f1535 100%)
    `,
    gold: `
      linear-gradient(135deg, rgba(240, 180, 41, 0.15) 0%, transparent 50%),
      linear-gradient(45deg, #1a1608 0%, #2a2010 50%, #1a1608 100%)
    `,
    silver: `
      linear-gradient(135deg, rgba(148, 163, 184, 0.12) 0%, transparent 50%),
      linear-gradient(45deg, #121620 0%, #1e2433 50%, #121620 100%)
    `,
    bronze: `
      linear-gradient(135deg, rgba(232, 104, 42, 0.15) 0%, transparent 50%),
      linear-gradient(45deg, #1a1008 0%, #2a1a10 50%, #1a1008 100%)
    `,
  },
} as const;


// ========================================
// SHADOWS
// ========================================

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 30px rgba(0, 0, 0, 0.5)',
  xl: '0 20px 50px rgba(0, 0, 0, 0.6)',
  
  glow: {
    diamond: '0 0 30px rgba(167, 139, 250, 0.4)',
    gold: '0 0 30px rgba(240, 180, 41, 0.4)',
    silver: '0 0 25px rgba(148, 163, 184, 0.3)',
    bronze: '0 0 25px rgba(232, 104, 42, 0.4)',
  },
} as const;


// ========================================
// TYPOGRAPHY
// ========================================

export const fonts = {
  display: "'Russo One', sans-serif",
  headline: "'Teko', sans-serif",
  subhead: "'Barlow Condensed', sans-serif",
  body: "'Barlow', sans-serif",
} as const;


// ========================================
// SPACING & SIZING
// ========================================

export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '9999px',
} as const;

export const cardSize = {
  width: 240,
  height: 340,
  ratio: 0.706,
} as const;


// Default export for convenience
export default {
  colors,
  gradients,
  shadows,
  fonts,
  radius,
  cardSize,
};
