/**
 * LatticeIQ Global Styles
 */

import React from 'react';
import { colors, gradients, shadows, radius, spacing, fontSizes, fontWeights, transitions } from './theme';

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
    border: '1px solid rgba(102, 126, 234, 0.3)',
    padding: spacing.lg,
  },
};

export const buttonStyles: { [key: string]: React.CSSProperties } = {
  primary: {
    background: gradients.accentPrimary,
    color: colors.textPrimary,
    border: 'none',
    fontWeight: fontWeights.semibold,
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
    fontWeight: fontWeights.semibold,
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
    fontWeight: fontWeights.medium,
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
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    transition: transitions.normal,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  sm: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: fontSizes.sm,
    borderRadius: radius.md,
  },
  md: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: fontSizes.md,
    borderRadius: radius.md,
  },
  lg: {
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: fontSizes.lg,
    borderRadius: radius.lg,
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export const inputStyles: { [key: string]: React.CSSProperties } = {
  base: {
    width: '100%',
    background: 'rgba(255, 255, 255, 0.08)',
    border: `1px solid ${colors.borderMedium}`,
    borderRadius: radius.md,
    padding: `${spacing.sm} ${spacing.md}`,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    outline: 'none',
    transition: transitions.fast,
  },
};

export const tableStyles: { [key: string]: React.CSSProperties } = {
  container: {
    background: colors.bgCard,
    borderRadius: radius.xl,
    border: `1px solid ${colors.borderSubtle}`,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  thead: {
    background: 'rgba(0, 0, 0, 0.3)',
  },
  th: {
    padding: `${spacing.md} ${spacing.lg}`,
    textAlign: 'left',
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  tr: {
    borderBottom: `1px solid ${colors.borderSubtle}`,
    transition: transitions.fast,
  },
  td: {
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
};

export const badgeStyles: { [key: string]: React.CSSProperties } = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radius.full,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
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

export const layoutStyles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    background: gradients.bgMain,
    color: colors.textPrimary,
  },
};

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
    position: 'relative',
    overflow: 'hidden',
  },
  label: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  },
};

export const navStyles: { [key: string]: React.CSSProperties } = {
  logo: {
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.borderSubtle}`,
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    background: gradients.textShine,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radius.md,
    color: colors.textMuted,
    textDecoration: 'none',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    transition: transitions.fast,
    marginBottom: spacing.xs,
    cursor: 'pointer',
  },
  itemActive: {
    background: colors.accentLight,
    color: colors.textPrimary,
  },
};

export const modalStyles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
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
    position: 'relative',
  },
  body: {
    padding: spacing.lg,
    overflowY: 'auto',
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

export const emptyStateStyles: { [key: string]: React.CSSProperties } = {
  container: {
    textAlign: 'center',
    padding: spacing.xxl,
  },
  icon: {
    fontSize: '64px',
    marginBottom: spacing.md,
    opacity: 0.5,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    maxWidth: '400px',
    margin: '0 auto',
  },
};