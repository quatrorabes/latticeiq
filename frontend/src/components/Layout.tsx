/**
 * Layout.tsx - Premium Dark Sidebar Layout
 */

import React, { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { injectAnimations } from '../styles';
import { colors, gradients, spacing, radius, fontSizes, fontWeights, transitions } from '../styles/theme';
import { supabase } from '../lib/supabase';

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: gradients.bgMain,
  },
  sidebar: {
    width: '260px',
    background: gradients.bgSidebar,
    borderRight: `1px solid ${colors.borderSubtle}`,
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
  },
  logo: {
    padding: spacing.lg,
    borderBottom: `1px solid ${colors.borderSubtle}`,
  },
  logoText: {
    fontSize: '24px',
    fontWeight: fontWeights.extrabold,
    background: gradients.textShine,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nav: {
    flex: 1,
    padding: spacing.md,
    overflowY: 'auto',
  },
  navSection: {
    marginBottom: spacing.lg,
  },
  navSectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: `${spacing.sm} ${spacing.md}`,
    marginBottom: spacing.xs,
  },
  navItem: {
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
    marginBottom: '2px',
  },
  navItemActive: {
    background: colors.accentLight,
    color: colors.textPrimary,
  },
  navItemIcon: {
    fontSize: '18px',
    width: '24px',
    textAlign: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTop: `1px solid ${colors.borderSubtle}`,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: radius.full,
    background: gradients.accentPrimary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: 'white',
  },
  userName: {
    flex: 1,
    overflow: 'hidden',
  },
  userNameText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.textPrimary,
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userEmail: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  logoutBtn: {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: radius.md,
    color: colors.error,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    cursor: 'pointer',
    transition: transitions.fast,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  main: {
    flex: 1,
    marginLeft: '260px',
    padding: spacing.xl,
    minHeight: '100vh',
  },
};

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const mainNavItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/contacts', label: 'Contacts', icon: '👥' },
  { path: '/analytics', label: 'Analytics', icon: '📈' },
];

const toolsNavItems: NavItem[] = [
  { path: '/import', label: 'Import Data', icon: '📥' },
  { path: '/hubspot', label: 'HubSpot Sync', icon: '🔄' },
];

const settingsNavItems: NavItem[] = [
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = React.useState<string>('');

  useEffect(() => {
    injectAnimations();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || '');
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getInitials = () => {
    if (!userEmail) return '?';
    return userEmail.slice(0, 2).toUpperCase();
  };

  const renderNavItem = (item: NavItem) => (
    <NavLink
      key={item.path}
      to={item.path}
      style={({ isActive }) => ({
        ...styles.navItem,
        ...(isActive ? styles.navItemActive : {}),
      })}
    >
      <span style={styles.navItemIcon}>{item.icon}</span>
      {item.label}
    </NavLink>
  );

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <h1 style={styles.logoText}>
            <span>💎</span> LatticeIQ
          </h1>
        </div>
        <nav style={styles.nav}>
          <div style={styles.navSection}>
            <div style={styles.navSectionTitle}>Main</div>
            {mainNavItems.map(renderNavItem)}
          </div>
          <div style={styles.navSection}>
            <div style={styles.navSectionTitle}>Tools</div>
            {toolsNavItems.map(renderNavItem)}
          </div>
          <div style={styles.navSection}>
            <div style={styles.navSectionTitle}>Account</div>
            {settingsNavItems.map(renderNavItem)}
          </div>
        </nav>
        <div style={styles.footer}>
          <div style={styles.userInfo}>
            <div style={styles.userAvatar}>{getInitials()}</div>
            <div style={styles.userName}>
              <p style={styles.userNameText}>{userEmail?.split('@')[0] || 'User'}</p>
              <p style={styles.userEmail}>{userEmail || 'Not signed in'}</p>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;