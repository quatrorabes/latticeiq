/**
 * LatticeIQ Global Styles
 * Pre-built style objects for common UI patterns
 * 
 * Usage:
 *   import { cardStyles, buttonStyles } from '../styles/globalStyles';
 *   <div style={cardStyles.base}>
 *   <button style={{...buttonStyles.primary, ...buttonStyles.md}}>
 */

import React from 'react';
import { colors, gradients, shadows, radius, spacing, typography, transitions } from './theme';

// =============================================================================
// CARD STYLES
// =============================================================================
export const cardStyles: { [key: string]: React.CSSProperties } = {
  base: {
    background: colors.bgCard,
    borderRadius: radius.lg,
    border: `1px solid ${colors.borderSubtle}`,
    padding: spacing.lg,
  },
  elevated: {
    background: gradients.bgCard,
    borderRadius: radius.xl,
    border: `1px solid ${colors.borderSubtle}`,
    boxShadow: shadows.card,
    padding: spacing.lg,
  },
  interactive: {
    background: colors.bgCard,
    borderRadius: radius.lg,
    border: `1px solid ${colors.borderSubtle}`,
    padding: spacing.lg,
    cursor: 'pointer',
    transition: transitions.normal,
  },
  glass: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(12px)',
    borderRadius: radius.xl,
    border: `1px solid ${colors.borderLight}`,
    padding: spacing.lg,
  },
  accent: {
    background: gradients.accentSubtle,
    borderRadius: radius.xl,
    border: `1px solid rgba(102, 126, 234, 0.3)`,
    padding: spacing.lg,
  },
};

// =============================================================================
// BUTTON STYLES
// =============================================================================
export const buttonStyles: { [key: string]: React.CSSProperties } = {
  // Variants
  primary: {
    background: gradients.accentPrimary,
    color: colors.textPrimary,
    border: 'none',
    fontWeight: typography.semibold,
    cursor: 'pointer',
    transition: transitions.normal,
    boxShadow: shadows.accentSm,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondary: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: colors.textPrimary,
    border: `1px solid ${colors.borderMedium}`,
    fontWeight: typography.semibold,
    cursor: 'pointer',
    transition: transitions.normal,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  ghost: {
    background: 'transparent',
    color: colors.textSecondary,
    border: 'none',
    fontWeight: typography.medium,
    cursor: 'pointer',
    transition: transitions.normal,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  danger: {
    background: colors.errorBg,
    color: colors.error,
    border: `1px solid ${colors.errorBorder}`,
    fontWeight: typography.semibold,
    cursor: 'pointer',
    transition: transitions.normal,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  
  // Sizes
  sm: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sm,
    borderRadius: radius.md,
  },
  md: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.md,
    borderRadius: radius.md,
  },
  lg: {
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: typography.lg,
    borderRadius: radius.lg,
  },
  
  // States
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

// =============================================================================
// INPUT STYLES
// =============================================================================
export const inputStyles: { [key: string]: React.CSSProperties } = {
  base: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.08)',
    border: `1px solid ${colors.borderMedium}`,
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.md}`,
    color: colors.textPrimary,
    fontSize: typography.md,
    outline: 'none',
    transition: transitions.fast,
  },
  focus: {
    borderColor: colors.accentPrimary,
    boxShadow: `0 0 0 3px ${colors.accentLight}`,
  },
  error: {
    borderColor: colors.error,
    boxShadow: `0 0 0 3px ${colors.errorBg}`,
  },
  textarea: {
    minHeight: '100px',
    resize: 'vertical' as const,
  },
  select: {
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '36px',
  },
};

// =============================================================================
// TABLE STYLES
// =============================================================================
export const tableStyles: { [key: string]: React.CSSProperties } = {
  container: {
    background: colors.bgCard,
    borderRadius: radius.xl,
    border: `1px solid ${colors.borderSubtle}`,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  thead: {
    background: 'rgba(0, 0, 0, 0.3)',
  },
  th: {
    padding: `${spacing.md} ${spacing.lg}`,
    textAlign: 'left' as const,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  thSortable: {
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  tr: {
    borderBottom: `1px solid ${colors.borderSubtle}`,
    transition: transitions.fast,
  },
  trHover: {
    background: colors.bgCardHover,
  },
  td: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  empty: {
    padding: spacing.xxl,
    textAlign: 'center' as const,
    color: colors.textMuted,
  },
};

// =============================================================================
// BADGE STYLES
// =============================================================================
export const badgeStyles: { [key: string]: React.CSSProperties } = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radius.full,
    fontSize: typography.xs,
    fontWeight: typography.semibold,
  },
  success: {
    background: colors.successBg,
    color: colors.success,
    border: `1px solid ${colors.successBorder}`,
  },
  warning: {
    background: colors.warningBg,
    color: colors.warning,
    border: `1px solid ${colors.warningBorder}`,
  },
  error: {
    background: colors.errorBg,
    color: colors.error,
    border: `1px solid ${colors.errorBorder}`,
  },
  info: {
    background: colors.infoBg,
    color: colors.info,
    border: `1px solid ${colors.infoBorder}`,
  },
  accent: {
    background: colors.accentLight,
    color: colors.accentPrimary,
    border: `1px solid rgba(102, 126, 234, 0.3)`,
  },
  // Tiers
  hot: {
    background: colors.tierHotBg,
    color: colors.tierHot,
    border: `1px solid ${colors.tierHotBorder}`,
  },
  warm: {
    background: colors.tierWarmBg,
    color: colors.tierWarm,
    border: `1px solid ${colors.tierWarmBorder}`,
  },
  cold: {
    background: colors.tierColdBg,
    color: colors.tierCold,
    border: `1px solid ${colors.tierColdBorder}`,
  },
};

// =============================================================================
// LAYOUT STYLES
// =============================================================================
export const layoutStyles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: gradients.bgMain,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily,
  },
  sidebar: {
    width: '260px',
    background: gradients.bgSidebar,
    borderRight: `1px solid ${colors.borderSubtle}`,
    height: '100vh',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  main: {
    marginLeft: '260px',
    padding: spacing.xl,
    minHeight: '100vh',
  },
  header: {
    background: gradients.accentPrimary,
    padding: `${spacing.lg} ${spacing.xl}`,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
};

// =============================================================================
// STAT CARD STYLES
// =============================================================================
export const statCardStyles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  card: {
    background: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    border: `1px solid ${colors.borderSubtle}`,
    position: 'relative' as const,
    overflow: 'hidden',
  },
  icon: {
    fontSize: '24px',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.xs,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: typography.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  glow: {
    position: 'absolute' as const,
    top: '-50%',
    right: '-50%',
    width: '100%',
    height: '100%',
    background: gradients.glow,
    pointerEvents: 'none' as const,
  },
};

// =============================================================================
// NAV STYLES
// =============================================================================
export const navStyles: { [key: string]: React.CSSProperties } = {
  logo: {
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    background: gradients.textShine,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  menu: {
    flex: 1,
    padding: `0 ${spacing.sm}`,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radius.md,
    color: colors.textMuted,
    textDecoration: 'none',
    fontSize: typography.md,
    fontWeight: typography.medium,
    transition: transitions.fast,
    marginBottom: spacing.xs,
    cursor: 'pointer',
  },
  itemActive: {
    background: colors.accentLight,
    color: colors.textPrimary,
  },
  itemHover: {
    background: colors.bgCardHover,
    color: colors.textSecondary,
  },
  footer: {
    padding: spacing.lg,
    borderTop: `1px solid ${colors.borderSubtle}`,
  },
};

// =============================================================================
// MODAL STYLES (for consistency with ContactDetailModal)
// =============================================================================
export const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: colors.bgOverlay,
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: spacing.lg,
  },
  container: {
    background: gradients.bgCard,
    borderRadius: radius.xxl,
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: shadows.xl,
    border: `1px solid ${colors.borderSubtle}`,
  },
  header: {
    background: gradients.accentPrimary,
    padding: spacing.lg,
    position: 'relative' as const,
  },
  body: {
    padding: spacing.lg,
    overflowY: 'auto' as const,
    maxHeight: '60vh',
  },
  footer: {
    padding: spacing.lg,
    background: 'rgba(0, 0, 0, 0.2)',
    borderTop: `1px solid ${colors.borderSubtle}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
};

// =============================================================================
// TOAST/NOTIFICATION STYLES
// =============================================================================
export const toastStyles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'fixed' as const,
    bottom: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing.sm,
  },
  toast: {
    background: colors.bgSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    boxShadow: shadows.lg,
    border: `1px solid ${colors.borderSubtle}`,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: '300px',
    animation: 'slideIn 0.3s ease',
  },
  success: { borderLeft: `4px solid ${colors.success}` },
  error: { borderLeft: `4px solid ${colors.error}` },
  warning: { borderLeft: `4px solid ${colors.warning}` },
  info: { borderLeft: `4px solid ${colors.info}` },
};

// =============================================================================
// EMPTY STATE STYLES
// =============================================================================
export const emptyStateStyles: { [key: string]: React.CSSProperties } = {
  container: {
    textAlign: 'center' as const,
    padding: spacing.xxl,
  },
  icon: {
    fontSize: '64px',
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.md,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    maxWidth: '400px',
    margin: '0 auto',
  },
};

