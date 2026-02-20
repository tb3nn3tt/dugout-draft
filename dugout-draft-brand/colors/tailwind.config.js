/**
 * DUGOUT DRAFT - Tailwind CSS Theme Extension
 * 
 * Usage: Merge this into your tailwind.config.js
 * 
 * module.exports = {
 *   theme: {
 *     extend: {
 *       ...require('./dugout-draft-brand/colors/tailwind.config.js')
 *     }
 *   }
 * }
 */

module.exports = {
  colors: {
    // Primary palette
    'dd-navy': {
      900: '#0a1628',
      800: '#0f1f3d',
      700: '#152952',
      600: '#1c3568',
    },
    'dd-royal': {
      500: '#1e5fbb',
      400: '#2872db',
      300: '#4a90e8',
    },
    'dd-powder': {
      300: '#7eb8f4',
      200: '#a8d1f8',
      100: '#d4e8fc',
    },
    
    // Accents
    'dd-orange': {
      600: '#c75a1c',
      500: '#e8682a',
      400: '#f4813f',
      300: '#f99d5c',
    },
    'dd-yellow': {
      500: '#f0b429',
      400: '#f9c846',
      300: '#fcd968',
    },
    
    // Tiers
    'dd-tier-diamond': '#a78bfa',
    'dd-tier-gold': '#f0b429',
    'dd-tier-silver': '#94a3b8',
    'dd-tier-bronze': '#e8682a',
    
    // Players
    'dd-player1': '#2872db',
    'dd-player2': '#e8682a',
    
    // Positions
    'dd-pos-pitcher': '#1e5fbb',
    'dd-pos-catcher': '#7c3aed',
    'dd-pos-infield': '#dc2626',
    'dd-pos-outfield': '#16a34a',
    'dd-pos-dh': '#f0b429',
  },
  
  fontFamily: {
    'dd-display': ['Russo One', 'sans-serif'],
    'dd-headline': ['Teko', 'sans-serif'],
    'dd-subhead': ['Barlow Condensed', 'sans-serif'],
    'dd-body': ['Barlow', 'sans-serif'],
  },
  
  boxShadow: {
    'dd-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
    'dd-md': '0 4px 12px rgba(0, 0, 0, 0.4)',
    'dd-lg': '0 10px 30px rgba(0, 0, 0, 0.5)',
    'dd-xl': '0 20px 50px rgba(0, 0, 0, 0.6)',
    'dd-glow-diamond': '0 0 30px rgba(167, 139, 250, 0.4)',
    'dd-glow-gold': '0 0 30px rgba(240, 180, 41, 0.4)',
    'dd-glow-silver': '0 0 25px rgba(148, 163, 184, 0.3)',
    'dd-glow-bronze': '0 0 25px rgba(232, 104, 42, 0.4)',
  },
  
  backgroundImage: {
    'dd-gradient-gold': 'linear-gradient(180deg, #fcd968 0%, #f0b429 50%, #c99a1d 100%)',
    'dd-gradient-button': 'linear-gradient(135deg, #e8682a 0%, #c75a1c 100%)',
  },
};
