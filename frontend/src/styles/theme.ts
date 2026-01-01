/**
 * LatticeIQ Premium Design System
 * Glassmorphism dark theme with purple accents
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================
export const colors = {
  bgPrimary: '#0f0f1a',
  bgSecondary: '#1a1a2e',
  bgTertiary: '#16213e',
  bgCard: 'rgba(255, 255, 255, 0.05)',
  bgCardHover: 'rgba(255, 255, 255, 0.08)',
  bgOverlay: 'rgba(0, 0, 0, 0.7)',
  
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderMedium: 'rgba(255, 255, 255, 0.2)',
  
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.85)',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  textSubtle: 'rgba(255, 255, 255, 0.4)',
  
  accentPrimary: '#667eea',
  accentSecondary: '#764ba2',
  accentLight: 'rgba(102, 126, 234, 0.2)',
  accentMedium: 'rgba(102, 126, 234, 0.4)',
  
  success: '#4ade80',
  successBg: 'rgba(34, 197, 94, 0.2)',
  successBorder: 'rgba(34, 197, 94, 0.3)',
  
  warning: '#fbbf24',
  warningBg: 'rgba(251, 191, 36, 0.2)',
  warningBorder: 'rgba(251, 191, 36, 0.3)',
  
  error: '#f87171',
  errorBg: 'rgba(239, 68, 68, 0.2)',
  errorBorder: 'rgba(239, 68, 68, 0.3)',
  
  info: '#60a5fa',
  infoBg: 'rgba(59, 130, 246, 0.2)',
  infoBorder: 'rgba(59, 130, 246, 0.3)',
  
  tierHot: '#f87171',
  tierHotBg: 'rgba(239, 68, 68, 0.2)',
  tierHotBorder: 'rgba(239, 68, 68, 0.3)',
  
  tierWarm: '#fbbf24',
  tierWarmBg: 'rgba(251, 191, 36, 0.2)',
  tierWarmBorder: 'rgba(251, 191, 36, 0.3)',
  
  tierCold: '#60a5fa',
  tierColdBg: 'rgba(59, 130, 246, 0.2)',
  tierColdBorder: 'rgba(59, 130, 246, 0.3)',
};

// =============================================================================
// GRADIENTS
// =============================================================================
export const gradients = {
  bgMain: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
  bgCard: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  bgSidebar: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
  
  accentPrimary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  accentHover: 'linear-gradient(135deg, #7c8ff0 0%, #8b5cb8 100%)',
  accentSubtle: 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
  
  textShine: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  
  glow: 'radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%)',
  headerPattern: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
};

// =============================================================================
// SHADOWS
// =============================================================================
export const shadows = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.3)',
  md: '0 4px 16px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.5)',
  xl: '0 25px 80px rgba(0, 0, 0, 0.5)',
  
  accentSm: '0 2px 10px rgba(102, 126, 234, 0.3)',
  accentMd: '0 4px 20px rgba(102, 126, 234, 0.4)',
  accentLg: '0 8px 40px rgba(102, 126, 234, 0.5)',
  
  card: '0 4px 16px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
  cardHover: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
};

// =============================================================================
// SPACING
// =============================================================================
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};

// =============================================================================
// BORDER RADIUS
// =============================================================================
export const radius = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  full: '9999px',
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================
export const typography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  
  // Font sizes
  xs: '12px',
  sm: '13px',
  md: '14px',
  lg: '16px',
  xl: '20px',
  xxl: '26px',
  xxxl: '32px',
  display: '48px',
  
  // Font weights
  weightNormal: '400',
  weightMedium: '500',
  weightSemibold: '600',
  weightBold: '700',
  weightExtrabold: '800',
  
  // Line heights
  lineHeightTight: '1.2',
  lineHeightNormal: '1.5',
  lineHeightRelaxed: '1.6',
};

// =============================================================================
// TRANSITIONS
// =============================================================================
export const transitions = {
  fast: '0.15s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
  bounce: '0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

// =============================================================================
// Z-INDEX LAYERS
// =============================================================================
export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  modal: 1000,
  tooltip: 1100,
  toast: 1200,
};

// =============================================================================
// BREAKPOINTS
// =============================================================================
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  xxl: '1536px',
};

// =============================================================================
// COMBINED THEME EXPORT
// =============================================================================
export const theme = {
  colors,
  gradients,
  shadows,
  spacing,
  radius,
  typography,
  transitions,
  zIndex,
  breakpoints,
};

export default theme;