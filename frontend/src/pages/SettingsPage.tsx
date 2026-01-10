// ============================================================================
// FILE: frontend/src/pages/SettingsPage.tsx
// PURPOSE: Settings page with Data Sources tab - FIXED buttons, filters, limits
// VERSION: 2.2.1 - Fixed HubSpot status endpoint and status check
// ============================================================================

import { useState, useEffect } from 'react';
import { 
  User, Database, Bell, Users, Mail, Briefcase, CheckCircle, XCircle, 
  Loader2, RefreshCw, Eye, Upload, Link2, BarChart3, Linkedin, Filter,
  Calendar, ChevronDown
} from 'lucide-react';
import BusinessProfileForm from '../components/BusinessProfileForm';
import { API_URL } from '../lib/constants';
import { supabase } from '../lib/supabaseClient';

type TabType = 'profile' | 'business' | 'data-sources' | 'notifications' | 'workspace';


// ============================================================================
// SHARED STYLES
// ============================================================================

const sharedStyles = {
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  
  btnPrimaryDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(99, 102, 241, 0.3)',
    border: 'none',
    borderRadius: '10px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '10px',
    color: '#f8fafc',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  
  btnSecondaryDisabled: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(148, 163, 184, 0.1)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '10px',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'not-allowed',
  } as React.CSSProperties,

  btnDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px',
    color: '#ef4444',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,

  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '10px',
    color: '#94a3b8',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,

  tabActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: '#6366f1',
    border: '1px solid #6366f1',
    borderRadius: '10px',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    background: '#0f172a',
    border: '1px solid rgba(148, 163, 184, 0.15)',
    borderRadius: '10px',
    color: '#f8fafc',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  } as React.CSSProperties,

  select: {
    padding: '0.875rem 1rem',
    background: '#0f172a',
    border: '1px solid rgba(148, 163, 184, 0.15)',
    borderRadius: '10px',
    color: '#f8fafc',
    fontSize: '0.95rem',
    cursor: 'pointer',
    outline: 'none',
  } as React.CSSProperties,

  fileInput: {
    display: 'none',
  } as React.CSSProperties,

  fileLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: 'rgba(99, 102, 241, 0.05)',
    border: '2px dashed rgba(99, 102, 241, 0.3)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#94a3b8',
    gap: '0.75rem',
  } as React.CSSProperties,
};


export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile');

  const pageStyles = {
    page: {
      minHeight: '100vh',
      background: '#0f172a',
      padding: '2rem',
      color: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } as React.CSSProperties,

    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginBottom: '2rem',
      paddingBottom: '1.5rem',
      borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
    } as React.CSSProperties,

    headerIcon: {
      width: '48px',
      height: '48px',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6366f1',
    } as React.CSSProperties,

    title: {
      fontSize: '2rem',
      fontWeight: 800,
      margin: 0,
      letterSpacing: '-0.02em',
    } as React.CSSProperties,

    subtitle: {
      fontSize: '0.95rem',
      color: '#94a3b8',
      margin: '0.25rem 0 0 0',
    } as React.CSSProperties,

    tabs: {
      display: 'flex',
      gap: '0.75rem',
      marginBottom: '2rem',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,

    content: {
      maxWidth: '1200px',
    } as React.CSSProperties,
  };

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.header}>
        <div style={pageStyles.headerIcon}>
          <User size={24} />
        </div>
        <div>
          <h1 style={pageStyles.title}>Settings</h1>
          <p style={pageStyles.subtitle}>Manage your account and workspace preferences</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={pageStyles.tabs}>
        {[
          { id: 'profile', label: 'Profile', icon: User },
          { id: 'business', label: 'Business', icon: Briefcase },
          { id: 'data-sources', label: 'Data Sources', icon: Database },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'workspace', label: 'Workspace', icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            style={activeTab === id ? sharedStyles.tabActive : sharedStyles.tab}
            onClick={() => setActiveTab(id as TabType)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={pageStyles.content}>
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'business' && <BusinessProfileForm />}
        {activeTab === 'data-sources' && <DataSourcesTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'workspace' && <WorkspaceTab />}
      </div>
    </div>
  );
}


// ============================================================================
// PROFILE TAB
// ============================================================================

function ProfileTab() {
  const [name, setName] = useState('John Doe');
  const [email, setEmail] = useState('john@example.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const styles = {
    section: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: 700,
      margin: '0 0 0.5rem 0',
      color: '#f8fafc',
    } as React.CSSProperties,

    sectionDesc: {
      fontSize: '0.9rem',
      color: '#94a3b8',
      margin: '0 0 1.5rem 0',
    } as React.CSSProperties,

    formGroup: {
      marginBottom: '1.25rem',
    } as React.CSSProperties,

    label: {
      display: 'block',
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#94a3b8',
      marginBottom: '0.5rem',
    } as React.CSSProperties,
  };

  const handleSaveProfile = () => {
    alert('Profile updated successfully!');
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    alert('Password changed successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div>
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Profile Information</h2>
        <p style={styles.sectionDesc}>Update your personal information</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={sharedStyles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={sharedStyles.input}
          />
        </div>

        <button onClick={handleSaveProfile} style={sharedStyles.btnPrimary}>
          Save Changes
        </button>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Change Password</h2>
        <p style={styles.sectionDesc}>Ensure your account stays secure</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={sharedStyles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={sharedStyles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={sharedStyles.input}
          />
        </div>

        <button onClick={handleChangePassword} style={sharedStyles.btnPrimary}>
          Change Password
        </button>
      </div>
    </div>
  );
}


// ============================================================================
// DATA SOURCES TAB - WITH FILTERS & FIXED LIMITS
// ============================================================================

interface TestResult {
  success: boolean;
  provider: string;
  account_id?: string;
  account_name?: string;
  contact_count?: number;
  error?: string;
}

interface ImportPreview {
  total_contacts: number;
  valid_contacts: number;
  rejected_contacts: number;
  rejection_reasons: Record<string, number>;
  sample_contacts: any[];
}

interface ImportResult {
  success: boolean;
  import_id: string;
  total_processed: number;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  rejection_reasons: Record<string, number>;
}

function DataSourcesTab() {
  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  
  // HubSpot state
  const [hubspotToken, setHubspotToken] = useState('');
  const [batchSize, setBatchSize] = useState(50);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  // NEW: Import Filters
  const [showFilters, setShowFilters] = useState(false);
  const [createdAfter, setCreatedAfter] = useState('');
  const [modifiedAfter, setModifiedAfter] = useState('');
  const [leadStatus, setLeadStatus] = useState<string[]>([]);
  const [lifecycleStage, setLifecycleStage] = useState<string[]>([]);
  
  // Connection state
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  
  // Import state
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const styles = {
    section: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    sectionHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: 700,
      margin: '0 0 0.5rem 0',
      color: '#f8fafc',
    } as React.CSSProperties,

    sectionDesc: {
      fontSize: '0.9rem',
      color: '#94a3b8',
      margin: 0,
    } as React.CSSProperties,

    formGroup: {
      marginBottom: '1.25rem',
    } as React.CSSProperties,

    formRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
    } as React.CSSProperties,

    label: {
      display: 'block',
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#94a3b8',
      marginBottom: '0.5rem',
    } as React.CSSProperties,

    labelSm: {
      display: 'block',
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#64748b',
      marginBottom: '0.5rem',
    } as React.CSSProperties,

    hint: {
      fontSize: '0.85rem',
      color: '#64748b',
      marginTop: '0.5rem',
    } as React.CSSProperties,

    buttonRow: {
      display: 'flex',
      gap: '1rem',
      flexWrap: 'wrap' as const,
      marginTop: '1.5rem',
    } as React.CSSProperties,

    alert: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      padding: '1rem 1.25rem',
      borderRadius: '10px',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    alertSuccess: {
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      color: '#22c55e',
    } as React.CSSProperties,

    alertError: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      color: '#ef4444',
    } as React.CSSProperties,

    statusBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.4rem 0.9rem',
      borderRadius: '6px',
      fontSize: '0.85rem',
      fontWeight: 600,
      background: 'rgba(34, 197, 94, 0.15)',
      color: '#22c55e',
      border: '1px solid rgba(34, 197, 94, 0.3)',
    } as React.CSSProperties,

    connectionInfo: {
      background: 'rgba(99, 102, 241, 0.05)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '10px',
      padding: '1rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.5rem 0',
      borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
    } as React.CSSProperties,

    infoLabel: {
      color: '#94a3b8',
      fontSize: '0.9rem',
    } as React.CSSProperties,

    infoValue: {
      color: '#f8fafc',
      fontWeight: 600,
      fontSize: '0.9rem',
    } as React.CSSProperties,

    checkbox: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      cursor: 'pointer',
    } as React.CSSProperties,

    infoBox: {
      background: 'rgba(99, 102, 241, 0.05)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '10px',
      padding: '1rem',
      marginTop: '1.5rem',
    } as React.CSSProperties,

    // Filter section
    filterToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 1rem',
      background: 'rgba(99, 102, 241, 0.1)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '8px',
      color: '#f8fafc',
      fontSize: '0.9rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as React.CSSProperties,

    filterPanel: {
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '10px',
      padding: '1.25rem',
      marginBottom: '1.5rem',
      marginTop: '1rem',
    } as React.CSSProperties,

    filterTitle: {
      fontSize: '0.95rem',
      fontWeight: 600,
      color: '#f8fafc',
      margin: '0 0 1rem 0',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    } as React.CSSProperties,

    // Preview box
    previewBox: {
      background: 'rgba(99, 102, 241, 0.05)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '10px',
      padding: '1.25rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    previewStats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1rem',
      marginTop: '1rem',
    } as React.CSSProperties,

    stat: {
      textAlign: 'center' as const,
      padding: '1rem',
      background: 'rgba(148, 163, 184, 0.05)',
      borderRadius: '8px',
    } as React.CSSProperties,

    statValue: {
      display: 'block',
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#f8fafc',
    } as React.CSSProperties,

    statLabel: {
      display: 'block',
      fontSize: '0.8rem',
      color: '#94a3b8',
      marginTop: '0.25rem',
    } as React.CSSProperties,

    // Coming soon
    comingSoonGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
    } as React.CSSProperties,

    comingSoonCard: {
      background: 'rgba(99, 102, 241, 0.05)',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      borderRadius: '12px',
      padding: '1.25rem',
      textAlign: 'center' as const,
      transition: 'all 0.2s ease',
    } as React.CSSProperties,

    comingSoonIcon: {
      width: '48px',
      height: '48px',
      background: 'rgba(99, 102, 241, 0.1)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 0.75rem',
      color: '#6366f1',
    } as React.CSSProperties,

    comingSoonTitle: {
      fontSize: '1rem',
      fontWeight: 600,
      color: '#f8fafc',
      margin: '0 0 0.25rem 0',
    } as React.CSSProperties,

    comingSoonDesc: {
      fontSize: '0.85rem',
      color: '#94a3b8',
      margin: '0 0 0.75rem 0',
    } as React.CSSProperties,

    comingSoonBadge: {
      display: 'inline-block',
      padding: '0.25rem 0.75rem',
      background: 'rgba(148, 163, 184, 0.1)',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#64748b',
    } as React.CSSProperties,
  };

  // ============================================================================
  // AUTH HELPER
  // ============================================================================

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated - please log in again');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  };

  // ============================================================================
  // CHECK EXISTING CONNECTION ON MOUNT
  // ============================================================================

  useEffect(() => {
    checkExistingConnection();
  }, []);

  const checkExistingConnection = async () => {
    try {
      const headers = await getAuthHeaders();
      // FIXED: Changed from /hubspot/status to /hubspot (the actual backend endpoint)
      const response = await fetch(`${API_URL}/api/v3/integrations/hubspot`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        // FIXED: Changed from 'active' to 'connected' (matching IntegrationStatus enum)
        if (data && data.status === 'connected') {
          setIsConnected(true);
          setConnectionInfo(data);
        }
      }
    } catch (err) {
      console.log('No existing HubSpot connection');
    }
  };

  // ============================================================================
  // CSV UPLOAD
  // ============================================================================

  const handleCsvUpload = async () => {
    if (!csvFile) {
      alert('Please select a CSV file');
      return;
    }

    setCsvUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('file', csvFile);

      const response = await fetch(`${API_URL}/api/v3/import/csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Successfully imported ${result.imported_count} contacts!`);
        setCsvFile(null);
      } else {
        const error = await response.json();
        alert(`❌ Import failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally {
      setCsvUploading(false);
    }
  };

  // ============================================================================
  // HUBSPOT TEST CONNECTION
  // ============================================================================

  const handleTestConnection = async () => {
    if (!hubspotToken) {
      alert('Please enter your HubSpot API token');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ api_key: hubspotToken })
      });

      const result = await response.json();
      setTestResult(result);

    } catch (err) {
      setTestResult({
        success: false,
        provider: 'hubspot',
        error: err instanceof Error ? err.message : 'Connection test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  // ============================================================================
  // HUBSPOT CONNECT (SAVE CREDENTIALS)
  // ============================================================================

  const handleConnect = async () => {
    if (!testResult?.success) {
      alert('Please test the connection first');
      return;
    }

    setTesting(true);

    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_URL}/api/v3/integrations/hubspot/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ api_key: hubspotToken })
      });

      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);
        setConnectionInfo(data);
        setHubspotToken('');
        setTestResult(null);
        alert('✅ HubSpot connected successfully!');
      } else {
        const error = await response.json();
        alert(`❌ Connection failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Connection failed'}`);
    } finally {
      setTesting(false);
    }
  };

  // ============================================================================
  // BUILD FILTERS OBJECT
  // ============================================================================

  const buildFilters = () => {
    const filters: any = {
      require_email: true,
      skip_existing: skipDuplicates,
      limit: batchSize
    };

    if (createdAfter) {
      filters.created_after = new Date(createdAfter).toISOString();
    }
    if (modifiedAfter) {
      filters.modified_after = new Date(modifiedAfter).toISOString();
    }
    if (leadStatus.length > 0) {
      filters.lead_statuses = leadStatus;
    }
    if (lifecycleStage.length > 0) {
      filters.lifecycle_stages = lifecycleStage;
    }

    return filters;
  };

  // ============================================================================
  // HUBSPOT PREVIEW IMPORT
  // ============================================================================

  const handlePreviewImport = async () => {
    setPreviewing(true);
    setImportPreview(null);

    try {
      const headers = await getAuthHeaders();
      
      if (!isConnected && hubspotToken) {
        headers['X-HubSpot-API-Key'] = hubspotToken;
      }

      const response = await fetch(`${API_URL}/api/v3/hubspot/preview?sample_size=50`, { 
        headers 
      });

      if (response.ok) {
        const data = await response.json();
        setImportPreview({
          total_contacts: data.total_available || 0,
          valid_contacts: data.valid_count || 0,
          rejected_contacts: data.invalid_count || 0,
          rejection_reasons: data.rejection_reasons || {},
          sample_contacts: data.sample_contacts || []
        });
      } else {
        const error = await response.json();
        alert(`❌ Preview failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Preview failed'}`);
    } finally {
      setPreviewing(false);
    }
  };

  // ============================================================================
  // HUBSPOT IMPORT - FIXED with proper filters
  // ============================================================================

  const handleHubspotImport = async () => {
    if (!isConnected && !hubspotToken) {
      alert('Please enter your HubSpot API token or connect your account first');
      return;
    }

    const confirmMsg = importPreview 
      ? `Import ${Math.min(importPreview.valid_contacts, batchSize)} contacts from HubSpot?`
      : `Import up to ${batchSize} contacts from HubSpot?`;
    
    if (!confirm(confirmMsg)) return;

    setImporting(true);
    setImportResult(null);

    try {
      const headers = await getAuthHeaders();
      
      if (!isConnected && hubspotToken) {
        headers['X-HubSpot-API-Key'] = hubspotToken;
      }

      const body = {
        filters: buildFilters()
      };

      const response = await fetch(`${API_URL}/api/v3/hubspot/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const result = await response.json();
        setImportResult(result);
        setImportPreview(null);
        checkExistingConnection();
      } else {
        const error = await response.json();
        alert(`❌ Import failed: ${error.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Import failed'}`);
    } finally {
      setImporting(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div>
      {/* CSV Upload Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Upload CSV File</h2>
            <p style={styles.sectionDesc}>Import contacts from a CSV file</p>
          </div>
        </div>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
          style={sharedStyles.fileInput}
          id="csv-upload"
        />
        <label htmlFor="csv-upload" style={sharedStyles.fileLabel}>
          <Upload size={40} />
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>
            {csvFile ? csvFile.name : 'Click to select'}
          </span>
          <span>Supports .csv files</span>
        </label>

        {csvFile && (
          <div style={styles.buttonRow}>
            <button 
              onClick={handleCsvUpload} 
              style={csvUploading ? sharedStyles.btnPrimaryDisabled : sharedStyles.btnPrimary}
              disabled={csvUploading}
            >
              {csvUploading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload CSV
                </>
              )}
            </button>
          </div>
        )}

        <div style={styles.infoBox}>
          <strong style={{ color: '#f8fafc' }}>CSV Format Requirements:</strong>
          <ul style={{ margin: '0.75rem 0 0 1.25rem', color: '#94a3b8', lineHeight: 1.8 }}>
            <li>Must include: first_name, last_name</li>
            <li>At least ONE of: email, phone, company, linkedin_url</li>
            <li>Optional: job_title, industry, city, state</li>
            <li>First row should contain column headers</li>
          </ul>
        </div>
      </div>

      {/* HubSpot Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>HubSpot Connection</h2>
            <p style={styles.sectionDesc}>Connect your HubSpot account to import contacts</p>
          </div>
          {isConnected && (
            <span style={styles.statusBadge}>
              <CheckCircle size={16} />
              Connected
            </span>
          )}
        </div>

        {/* Connection info if connected */}
        {isConnected && connectionInfo && (
          <div style={styles.connectionInfo}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Account:</span>
              <span style={styles.infoValue}>{connectionInfo.account_name || connectionInfo.account_id}</span>
            </div>
            {connectionInfo.total_imported > 0 && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Total Imported:</span>
                <span style={styles.infoValue}>{connectionInfo.total_imported?.toLocaleString()} contacts</span>
              </div>
            )}
            {connectionInfo.last_sync_at && (
              <div style={{...styles.infoRow, borderBottom: 'none'}}>
                <span style={styles.infoLabel}>Last Import:</span>
                <span style={styles.infoValue}>{new Date(connectionInfo.last_sync_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Token input - only show if not connected */}
        {!isConnected && (
          <>
            <div style={styles.formGroup}>
              <label style={styles.label}>HubSpot Private App Token</label>
              <input
                type="password"
                value={hubspotToken}
                onChange={(e) => setHubspotToken(e.target.value)}
                style={sharedStyles.input}
                placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p style={styles.hint}>
                HubSpot → Settings → Integrations → Private Apps → Create app with "crm.objects.contacts.read" scope
              </p>
            </div>

            {/* Test Result */}
            {testResult && (
              <div style={{
                ...styles.alert,
                ...(testResult.success ? styles.alertSuccess : styles.alertError)
              }}>
                {testResult.success ? (
                  <>
                    <CheckCircle size={20} />
                    <div>
                      <strong>Connection successful!</strong>
                      <p style={{ margin: '0.25rem 0 0 0' }}>Account: Portal {testResult.account_id}</p>
                      {testResult.contact_count !== undefined && (
                        <p style={{ margin: '0.25rem 0 0 0' }}>{testResult.contact_count.toLocaleString()} contacts available</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle size={20} />
                    <span>{testResult.error}</span>
                  </>
                )}
              </div>
            )}

            {/* Test & Connect buttons */}
            <div style={styles.buttonRow}>
              <button
                onClick={handleTestConnection}
                style={!hubspotToken || testing ? sharedStyles.btnSecondaryDisabled : sharedStyles.btnSecondary}
                disabled={!hubspotToken || testing}
              >
                {testing ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Test Connection
                  </>
                )}
              </button>

              <button
                onClick={handleConnect}
                style={!testResult?.success || testing ? sharedStyles.btnPrimaryDisabled : sharedStyles.btnPrimary}
                disabled={!testResult?.success || testing}
              >
                <CheckCircle size={16} />
                Save Connection
              </button>
            </div>
          </>
        )}

        {/* Import Settings - show if connected OR has valid test */}
        {(isConnected || testResult?.success) && (
          <>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '2rem 0 1rem 0' }}>
              Import Settings
            </h3>

            {/* Batch Size */}
            <div style={styles.formGroup}>
              <label style={styles.labelSm}>Batch Size</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value))}
                style={{...sharedStyles.select, width: '200px'}}
              >
                <option value={25}>25 contacts</option>
                <option value={50}>50 contacts</option>
                <option value={100}>100 contacts</option>
                <option value={200}>200 contacts</option>
                <option value={500}>500 contacts</option>
                <option value={1000}>1,000 contacts</option>
                <option value={5000}>5,000 contacts</option>
              </select>
              <p style={styles.hint}>Start with 25-50 for testing, increase once verified</p>
            </div>

            {/* Skip Duplicates */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={styles.checkbox}>
                <input 
                  type="checkbox" 
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                />
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>Skip Duplicates</span>
              </label>
              <p style={{...styles.hint, marginLeft: '1.75rem'}}>Skip contacts that already exist (by email)</p>
            </div>

            {/* Filter Toggle */}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              style={styles.filterToggle}
            >
              <Filter size={16} />
              {showFilters ? 'Hide Filters' : 'Show Import Filters'}
              <ChevronDown 
                size={16} 
                style={{ 
                  transform: showFilters ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }} 
              />
            </button>

            {/* Filter Panel */}
            {showFilters && (
              <div style={styles.filterPanel}>
                <h4 style={styles.filterTitle}>
                  <Calendar size={16} />
                  Import Filters
                </h4>
                
                <div style={styles.formRow}>
                  <div>
                    <label style={styles.labelSm}>Created After</label>
                    <input
                      type="date"
                      value={createdAfter}
                      onChange={(e) => setCreatedAfter(e.target.value)}
                      style={sharedStyles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.labelSm}>Modified After</label>
                    <input
                      type="date"
                      value={modifiedAfter}
                      onChange={(e) => setModifiedAfter(e.target.value)}
                      style={sharedStyles.input}
                    />
                  </div>
                </div>

                <div style={{...styles.formRow, marginTop: '1rem'}}>
                  <div>
                    <label style={styles.labelSm}>Lead Status</label>
                    <select
                      multiple
                      value={leadStatus}
                      onChange={(e) => setLeadStatus(Array.from(e.target.selectedOptions, opt => opt.value))}
                      style={{...sharedStyles.select, height: '100px'}}
                    >
                      <option value="NEW">New</option>
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="OPEN_DEAL">Open Deal</option>
                      <option value="UNQUALIFIED">Unqualified</option>
                      <option value="ATTEMPTED_TO_CONTACT">Attempted to Contact</option>
                      <option value="CONNECTED">Connected</option>
                      <option value="BAD_TIMING">Bad Timing</option>
                    </select>
                    <p style={styles.hint}>Ctrl+click to select multiple</p>
                  </div>
                  <div>
                    <label style={styles.labelSm}>Lifecycle Stage</label>
                    <select
                      multiple
                      value={lifecycleStage}
                      onChange={(e) => setLifecycleStage(Array.from(e.target.selectedOptions, opt => opt.value))}
                      style={{...sharedStyles.select, height: '100px'}}
                    >
                      <option value="subscriber">Subscriber</option>
                      <option value="lead">Lead</option>
                      <option value="marketingqualifiedlead">Marketing Qualified Lead</option>
                      <option value="salesqualifiedlead">Sales Qualified Lead</option>
                      <option value="opportunity">Opportunity</option>
                      <option value="customer">Customer</option>
                      <option value="evangelist">Evangelist</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Import Preview */}
            {importPreview && (
              <div style={styles.previewBox}>
                <h4 style={{ margin: 0, color: '#f8fafc' }}>Import Preview</h4>
                <div style={styles.previewStats}>
                  <div style={styles.stat}>
                    <span style={styles.statValue}>{importPreview.total_contacts.toLocaleString()}</span>
                    <span style={styles.statLabel}>Total in HubSpot</span>
                  </div>
                  <div style={{...styles.stat, background: 'rgba(34, 197, 94, 0.1)'}}>
                    <span style={{...styles.statValue, color: '#22c55e'}}>{importPreview.valid_contacts.toLocaleString()}</span>
                    <span style={styles.statLabel}>Valid to Import</span>
                  </div>
                  <div style={{...styles.stat, background: 'rgba(245, 158, 11, 0.1)'}}>
                    <span style={{...styles.statValue, color: '#f59e0b'}}>{importPreview.rejected_contacts.toLocaleString()}</span>
                    <span style={styles.statLabel}>Will be Skipped</span>
                  </div>
                </div>
                
                {Object.keys(importPreview.rejection_reasons).length > 0 && (
                  <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                    <strong>Skip Reasons:</strong>
                    <ul style={{ margin: '0.5rem 0 0 1.25rem' }}>
                      {Object.entries(importPreview.rejection_reasons).map(([reason, count]) => (
                        <li key={reason}>
                          {reason.replace(/_/g, ' ')}: {count}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div style={{...styles.alert, ...styles.alertSuccess}}>
                <CheckCircle size={20} />
                <div>
                  <strong>Import Complete!</strong>
                  <p style={{ margin: '0.25rem 0 0 0' }}>
                    Successfully imported {importResult.imported_count.toLocaleString()} contacts.
                  </p>
                  {importResult.skipped_count > 0 && (
                    <p style={{ margin: '0.25rem 0 0 0' }}>
                      {importResult.skipped_count} skipped (duplicates or invalid)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={styles.buttonRow}>
              <button
                onClick={handlePreviewImport}
                style={previewing || importing ? sharedStyles.btnSecondaryDisabled : sharedStyles.btnSecondary}
                disabled={previewing || importing}
              >
                {previewing ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    Loading Preview...
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    Preview Import
                  </>
                )}
              </button>

              <button 
                onClick={handleHubspotImport} 
                style={importing || previewing ? sharedStyles.btnPrimaryDisabled : sharedStyles.btnPrimary}
                disabled={importing || previewing}
              >
                {importing ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    Import {importPreview ? Math.min(importPreview.valid_contacts, batchSize).toLocaleString() : batchSize} Contacts
                  </>
                )}
              </button>
            </div>
          </>
        )}

        <div style={styles.infoBox}>
          <strong style={{ color: '#f8fafc' }}>Need help getting your HubSpot API key?</strong>
          <a 
            href="https://developers.hubspot.com/docs/api/private-apps" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ display: 'block', marginTop: '0.5rem', color: '#6366f1' }}
          >
            View HubSpot Private Apps Documentation →
          </a>
        </div>
      </div>

      {/* Coming Soon Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Coming Soon</h2>
            <p style={styles.sectionDesc}>Additional data source integrations</p>
          </div>
        </div>

        <div style={styles.comingSoonGrid}>
          <div style={styles.comingSoonCard}>
            <div style={styles.comingSoonIcon}>
              <BarChart3 size={24} />
            </div>
            <h3 style={styles.comingSoonTitle}>Salesforce</h3>
            <p style={styles.comingSoonDesc}>Sync contacts and deals</p>
            <span style={styles.comingSoonBadge}>Q1 2026</span>
          </div>
          
          <div style={styles.comingSoonCard}>
            <div style={styles.comingSoonIcon}>
              <Link2 size={24} />
            </div>
            <h3 style={styles.comingSoonTitle}>Pipedrive</h3>
            <p style={styles.comingSoonDesc}>Import pipeline data</p>
            <span style={styles.comingSoonBadge}>Q1 2026</span>
          </div>
          
          <div style={styles.comingSoonCard}>
            <div style={styles.comingSoonIcon}>
              <Linkedin size={24} />
            </div>
            <h3 style={styles.comingSoonTitle}>LinkedIn</h3>
            <p style={styles.comingSoonDesc}>Extract lead information</p>
            <span style={styles.comingSoonBadge}>Q2 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// NOTIFICATIONS TAB
// ============================================================================

function NotificationsTab() {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [hotLeadAlerts, setHotLeadAlerts] = useState(true);
  const [enrichmentComplete, setEnrichmentComplete] = useState(true);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [minScore, setMinScore] = useState(70);

  const styles = {
    section: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: 700,
      margin: '0 0 0.5rem 0',
      color: '#f8fafc',
    } as React.CSSProperties,

    sectionDesc: {
      fontSize: '0.9rem',
      color: '#94a3b8',
      margin: '0 0 1.5rem 0',
    } as React.CSSProperties,

    formGroup: {
      marginBottom: '1.25rem',
    } as React.CSSProperties,

    label: {
      display: 'block',
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#94a3b8',
      marginBottom: '0.5rem',
    } as React.CSSProperties,

    hint: {
      fontSize: '0.85rem',
      color: '#64748b',
      marginTop: '0.5rem',
    } as React.CSSProperties,

    checkbox: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '1rem',
      cursor: 'pointer',
    } as React.CSSProperties,
  };

  const handleSaveNotifications = () => {
    alert('Notification settings saved!');
  };

  return (
    <div>
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Email Notifications</h2>
        <p style={styles.sectionDesc}>Control when we send you emails</p>

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
          />
          <span style={{ color: '#f8fafc' }}>Enable email notifications</span>
        </label>

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={hotLeadAlerts}
            onChange={(e) => setHotLeadAlerts(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
          />
          <span style={{ color: '#f8fafc' }}>Notify for hot leads (score ≥ 70)</span>
        </label>

        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={enrichmentComplete}
            onChange={(e) => setEnrichmentComplete(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
          />
          <span style={{ color: '#f8fafc' }}>Notify when enrichment completes</span>
        </label>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Slack Integration</h2>
        <p style={styles.sectionDesc}>Get real-time alerts in Slack</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Slack Webhook URL</label>
          <input
            type="text"
            value={slackWebhook}
            onChange={(e) => setSlackWebhook(e.target.value)}
            style={sharedStyles.input}
            placeholder="https://hooks.slack.com/services/..."
          />
          <p style={styles.hint}>
            Get your webhook URL from{' '}
            <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
              Slack's incoming webhooks page
            </a>
          </p>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Minimum score for notifications</label>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(parseInt(e.target.value))}
            style={{...sharedStyles.input, width: '150px'}}
            min="0"
            max="100"
          />
          <p style={styles.hint}>Only notify for leads with ICP score above this threshold</p>
        </div>

        <button onClick={handleSaveNotifications} style={sharedStyles.btnPrimary}>
          Save Notification Settings
        </button>
      </div>
    </div>
  );
}


// ============================================================================
// WORKSPACE TAB
// ============================================================================

function WorkspaceTab() {
  const [workspaceName, setWorkspaceName] = useState('Acme Corp Sales');
  const [teamSize, setTeamSize] = useState('5-10');

  const styles = {
    section: {
      background: '#1e293b',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    dangerSection: {
      background: 'rgba(239, 68, 68, 0.05)',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    } as React.CSSProperties,

    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: 700,
      margin: '0 0 0.5rem 0',
      color: '#f8fafc',
    } as React.CSSProperties,

    dangerTitle: {
      fontSize: '1.25rem',
      fontWeight: 700,
      margin: '0 0 0.5rem 0',
      color: '#ef4444',
    } as React.CSSProperties,

    sectionDesc: {
      fontSize: '0.9rem',
      color: '#94a3b8',
      margin: '0 0 1.5rem 0',
    } as React.CSSProperties,

    formGroup: {
      marginBottom: '1.25rem',
    } as React.CSSProperties,

    label: {
      display: 'block',
      fontSize: '0.9rem',
      fontWeight: 600,
      color: '#94a3b8',
      marginBottom: '0.5rem',
    } as React.CSSProperties,

    infoBox: {
      background: 'rgba(99, 102, 241, 0.05)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '10px',
      padding: '1rem',
      color: '#94a3b8',
    } as React.CSSProperties,
  };

  const handleSaveWorkspace = () => {
    alert('Workspace settings saved!');
  };

  return (
    <div>
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Workspace Settings</h2>
        <p style={styles.sectionDesc}>Manage your team workspace</p>

        <div style={styles.formGroup}>
          <label style={styles.label}>Workspace Name</label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            style={sharedStyles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Team Size</label>
          <select
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
            style={sharedStyles.select}
          >
            <option value="1">Just me</option>
            <option value="2-5">2-5 people</option>
            <option value="5-10">5-10 people</option>
            <option value="10-25">10-25 people</option>
            <option value="25+">25+ people</option>
          </select>
        </div>

        <button onClick={handleSaveWorkspace} style={sharedStyles.btnPrimary}>
          Save Workspace Settings
        </button>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Team Members</h2>
        <p style={styles.sectionDesc}>Manage who has access to your workspace</p>

        <div style={styles.infoBox}>
          <strong style={{ color: '#f8fafc' }}>Coming Soon:</strong> Invite team members, manage roles and permissions
        </div>
      </div>

      <div style={styles.dangerSection}>
        <h2 style={styles.dangerTitle}>Danger Zone</h2>
        <p style={styles.sectionDesc}>Irreversible actions</p>

        <button style={sharedStyles.btnDanger}>
          Delete Workspace
        </button>
      </div>
    </div>
  );
}
