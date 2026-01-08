import React, { useState, useEffect } from 'react'
import { X, Building2, Target, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, User, Zap, MessageSquare, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Contact } from '../types'


interface EnrichmentBullet {
  text: string
  evidence?: string | null
  strength?: number | null
}


interface ContactProfileBox {
  headline?: string | null
  role_summary?: string | null
  seniority?: string | null
  background_bullets?: EnrichmentBullet[]
}


interface CompanyProfileBox {
  one_liner?: string | null
  industry?: string | null
  size_segment?: string | null
  region?: string | null
  key_products_or_services?: EnrichmentBullet[]
}


interface CurrentFocusBox {
  strategic_initiatives?: EnrichmentBullet[]
  recent_projects?: EnrichmentBullet[]
  primary_kpis?: EnrichmentBullet[]
}


interface BuyingSignalsBox {
  recent_news?: EnrichmentBullet[]
  hiring_signals?: EnrichmentBullet[]
  tech_changes?: EnrichmentBullet[]
  timing_triggers?: EnrichmentBullet[]
}


interface RisksAndObjectionsBox {
  risk_bullets?: EnrichmentBullet[]
  likely_objections?: EnrichmentBullet[]
  landmines?: EnrichmentBullet[]
}


interface MessagingBox {
  cold_openers?: EnrichmentBullet[]
  value_props?: EnrichmentBullet[]
  call_to_action_ideas?: EnrichmentBullet[]
}


interface EnrichmentMeta {
  generated_at?: string
  source?: string
  model?: string
  provider?: string
}


interface UnifiedEnrichmentResult {
  contact_id?: string
  contact_profile?: ContactProfileBox
  company_profile?: CompanyProfileBox
  current_focus?: CurrentFocusBox
  buying_signals?: BuyingSignalsBox
  risks_and_objections?: RisksAndObjectionsBox
  messaging?: MessagingBox
  meta?: EnrichmentMeta
}


interface ContactDetailModalProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
  onUpdate?: (contact: Contact) => void
}


// Styles object
const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    backgroundColor: '#0f172a',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '48rem',
    maxHeight: '90vh',
    overflow: 'hidden',
    border: '1px solid #334155',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  header: {
    backgroundColor: '#1e293b',
    padding: '1rem',
    borderBottom: '1px solid #334155',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    backgroundColor: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 700,
    fontSize: '1rem',
  },
  headerName: {
    color: 'white',
    fontWeight: 600,
    fontSize: '1.125rem',
    margin: 0,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: '0.875rem',
    margin: 0,
  },
  closeBtn: {
    color: '#94a3b8',
    padding: '0.5rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid #334155',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  tab: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#94a3b8',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textTransform: 'capitalize' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  tabActive: {
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#818cf8',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #818cf8',
    cursor: 'pointer',
    textTransform: 'capitalize' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  content: {
    padding: '1rem',
    overflowY: 'auto' as const,
    maxHeight: 'calc(90vh - 180px)',
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: '8px',
    padding: '1rem',
    border: '1px solid #334155',
    marginBottom: '1rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  cardTitle: {
    color: 'white',
    fontWeight: 500,
    fontSize: '1rem',
    margin: 0,
  },
  label: {
    color: '#64748b',
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: '0.25rem',
  },
  value: {
    color: '#cbd5e1',
    fontSize: '0.875rem',
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
  },
  bulletList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  bulletItem: {
    color: '#cbd5e1',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginBottom: '0.25rem',
  },
  tag: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#6ee7b7',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    display: 'inline-block',
    marginRight: '0.5rem',
    marginBottom: '0.5rem',
  },
  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontWeight: 500,
    backgroundColor: '#4f46e5',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  btnDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontWeight: 500,
    backgroundColor: '#334155',
    color: '#94a3b8',
    border: 'none',
    cursor: 'not-allowed',
    fontSize: '0.875rem',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    color: '#fca5a5',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1rem',
    textAlign: 'center' as const,
  },
  emptyTitle: {
    color: '#cbd5e1',
    fontWeight: 500,
    marginBottom: '0.5rem',
  },
  emptyText: {
    color: '#64748b',
    fontSize: '0.875rem',
    maxWidth: '24rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 1rem',
    textAlign: 'center' as const,
  },
  scoreValue: {
    fontSize: '1.875rem',
    fontWeight: 700,
  },
  copyableItem: {
    color: '#cbd5e1',
    fontSize: '0.875rem',
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    padding: '0.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  metaText: {
    color: '#64748b',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  actionBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  sectionLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: '0.5rem',
  },
}


export default function ContactDetailModal({ 
  contact, 
  isOpen, 
  onClose, 
  onUpdate 
}: ContactDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'outreach' | 'scores'>('overview')
  const [enrichmentData, setEnrichmentData] = useState<UnifiedEnrichmentResult | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle')
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)


  useEffect(() => {
    if (contact?.enrichment_data) {
      const data = (contact.enrichment_data as any)?.data || contact.enrichment_data
      if (data && typeof data === 'object') {
        setEnrichmentData(data as UnifiedEnrichmentResult)
        setEnrichmentStatus('completed')
      }
    } else {
      setEnrichmentData(null)
      setEnrichmentStatus('idle')
    }
  }, [contact?.id, contact?.enrichment_data])


  if (!isOpen) return null


  const handleDeepEnrich = async () => {
    setIsEnriching(true)
    setEnrichmentStatus('processing')
    setEnrichmentError(null)

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(
        `${API_URL}/api/v3/enrichment/deep-enrich/${contact.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Enrichment failed: ${response.status}`)
      }

      let attempts = 0
      const maxAttempts = 30

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))

        const resultResponse = await fetch(
          `${API_URL}/api/v3/enrichment/deep-enrich/${contact.id}/result`,
          {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` })
            }
          }
        )

        if (resultResponse.ok) {
          const result = await resultResponse.json()
          const enrichData =
            result?.contact_profile ? result :
            result?.data?.contact_profile ? result.data :
            null

          if (enrichData && enrichData.contact_profile) {
            setEnrichmentData(enrichData as UnifiedEnrichmentResult)
            setEnrichmentStatus('completed')
            if (onUpdate) {
              onUpdate({ ...contact, enrichment_data: { data: enrichData } } as Contact)
            }
            setIsEnriching(false)
            return
          }
        }

        attempts++
      }

      throw new Error('Enrichment timed out. Please try again.')
    } catch (error) {
      console.error('Deep enrichment error:', error)
      setEnrichmentError(error instanceof Error ? error.message : 'Unknown error')
      setEnrichmentStatus('failed')
    } finally {
      setIsEnriching(false)
    }
  }


  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric' 
    })
  }


  const getBulletText = (bullet: any): string => {
    if (typeof bullet === 'string') return bullet
    if (bullet?.text) return bullet.text
    return String(bullet)
  }


  const renderContactProfile = (data: ContactProfileBox | undefined) => {
    if (!data) return null
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <User style={{ width: 20, height: 20, color: '#818cf8' }} />
          <h4 style={styles.cardTitle}>Contact Profile</h4>
        </div>
        <div>
          {data.headline && <p style={{ color: '#cbd5e1', fontWeight: 500, marginBottom: '0.5rem' }}>{data.headline}</p>}
          {data.role_summary && <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{data.role_summary}</p>}
          {data.seniority && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={styles.label}>Seniority</span>
              <span style={styles.value}>{data.seniority}</span>
            </div>
          )}
          {data.background_bullets && data.background_bullets.length > 0 && (
            <div>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Background</span>
              <ul style={styles.bulletList}>
                {data.background_bullets.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#818cf8' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }


  const renderCompanyProfile = (data: CompanyProfileBox | undefined) => {
    if (!data) return null
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Building2 style={{ width: 20, height: 20, color: '#34d399' }} />
          <h4 style={styles.cardTitle}>Company Profile</h4>
        </div>
        <div>
          {data.one_liner && <p style={{ color: '#cbd5e1', marginBottom: '0.75rem' }}>{data.one_liner}</p>}
          <div style={styles.grid2}>
            {data.industry && (
              <div>
                <span style={styles.label}>Industry</span>
                <span style={styles.value}>{data.industry}</span>
              </div>
            )}
            {data.size_segment && (
              <div>
                <span style={styles.label}>Size</span>
                <span style={styles.value}>{data.size_segment}</span>
              </div>
            )}
            {data.region && (
              <div>
                <span style={styles.label}>Region</span>
                <span style={styles.value}>{data.region}</span>
              </div>
            )}
          </div>
          {data.key_products_or_services && data.key_products_or_services.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Products & Services</span>
              <div>
                {data.key_products_or_services.map((item, i) => (
                  <span key={i} style={styles.tag}>{getBulletText(item)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }


  const renderCurrentFocus = (data: CurrentFocusBox | undefined) => {
    if (!data) return null
    const hasContent = data.strategic_initiatives?.length || data.recent_projects?.length || data.primary_kpis?.length
    if (!hasContent) return null
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Target style={{ width: 20, height: 20, color: '#fbbf24' }} />
          <h4 style={styles.cardTitle}>Current Focus</h4>
        </div>
        <div>
          {data.strategic_initiatives && data.strategic_initiatives.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#34d399' }}>Strategic Initiatives</span>
              <ul style={styles.bulletList}>
                {data.strategic_initiatives.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#34d399' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.recent_projects && data.recent_projects.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Recent Projects</span>
              <ul style={styles.bulletList}>
                {data.recent_projects.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#fbbf24' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.primary_kpis && data.primary_kpis.length > 0 && (
            <div>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Primary KPIs</span>
              <ul style={styles.bulletList}>
                {data.primary_kpis.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#60a5fa' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }


  const renderBuyingSignals = (data: BuyingSignalsBox | undefined) => {
    if (!data) return null
    const hasContent = data.recent_news?.length || data.hiring_signals?.length || data.tech_changes?.length || data.timing_triggers?.length
    if (!hasContent) return null
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <Zap style={{ width: 20, height: 20, color: '#34d399' }} />
          <h4 style={styles.cardTitle}>Buying Signals</h4>
        </div>
        <div>
          {data.recent_news && data.recent_news.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#34d399' }}>Recent News</span>
              <ul style={styles.bulletList}>
                {data.recent_news.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#34d399' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.timing_triggers && data.timing_triggers.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#fbbf24' }}>Timing Triggers</span>
              <ul style={styles.bulletList}>
                {data.timing_triggers.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#fbbf24' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.hiring_signals && data.hiring_signals.length > 0 && (
            <div>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Hiring Signals</span>
              <ul style={styles.bulletList}>
                {data.hiring_signals.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#60a5fa' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }


  const renderRisksAndObjections = (data: RisksAndObjectionsBox | undefined) => {
    if (!data) return null
    const hasContent = data.risk_bullets?.length || data.likely_objections?.length || data.landmines?.length
    if (!hasContent) return null
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <ShieldAlert style={{ width: 20, height: 20, color: '#f87171' }} />
          <h4 style={styles.cardTitle}>Risks & Objections</h4>
        </div>
        <div>
          {data.risk_bullets && data.risk_bullets.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#fbbf24' }}>Risk Factors</span>
              <ul style={styles.bulletList}>
                {data.risk_bullets.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#fbbf24' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.likely_objections && data.likely_objections.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Likely Objections</span>
              <ul style={styles.bulletList}>
                {data.likely_objections.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#f87171' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.landmines && data.landmines.length > 0 && (
            <div>
              <span style={{ ...styles.sectionLabel, color: '#f87171' }}>Landmines to Avoid</span>
              <ul style={styles.bulletList}>
                {data.landmines.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#f87171' }}>⚠</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }


  const renderMessaging = (data: MessagingBox | undefined) => {
    if (!data) return null
    const hasContent = data.cold_openers?.length || data.value_props?.length || data.call_to_action_ideas?.length
    if (!hasContent) return null
    return (
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <MessageSquare style={{ width: 20, height: 20, color: '#a78bfa' }} />
          <h4 style={styles.cardTitle}>Recommended Messaging</h4>
        </div>
        <div>
          {data.cold_openers && data.cold_openers.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#34d399' }}>Cold Openers (click to copy)</span>
              <div>
                {data.cold_openers.map((item, i) => (
                  <div
                    key={i}
                    style={styles.copyableItem}
                    onClick={() => copyToClipboard(getBulletText(item), `opener-${i}`)}
                  >
                    <span style={{ flex: 1 }}>{getBulletText(item)}</span>
                    {copiedField === `opener-${i}` && (
                      <span style={{ color: '#34d399', fontSize: '0.75rem' }}>Copied!</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.value_props && data.value_props.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Value Props</span>
              <ul style={styles.bulletList}>
                {data.value_props.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#a78bfa' }}>•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.call_to_action_ideas && data.call_to_action_ideas.length > 0 && (
            <div>
              <span style={{ ...styles.sectionLabel, color: '#64748b' }}>Call to Action Ideas</span>
              <ul style={styles.bulletList}>
                {data.call_to_action_ideas.map((item, i) => (
                  <li key={i} style={styles.bulletItem}>
                    <span style={{ color: '#60a5fa' }}>→</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }


  const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email?.split('@')[0] || 'Unknown'
  const initials = contactName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'XX'


  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.headerLeft}>
              <div style={styles.avatar}>{initials}</div>
              <div>
                <h2 style={styles.headerName}>{contactName}</h2>
                <p style={styles.headerSubtitle}>
                  {contact.title && <span>{contact.title}</span>}
                  {contact.title && contact.company && <span> at </span>}
                  {contact.company && <span style={{ color: '#818cf8' }}>{contact.company}</span>}
                </p>
              </div>
            </div>
            <button style={styles.closeBtn} onClick={onClose}>
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabsContainer}>
          {(['overview', 'enrichment', 'outreach', 'scores'] as const).map(tab => (
            <button
              key={tab}
              style={activeTab === tab ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'enrichment' ? 'Deep Enrichment' : tab}
              {tab === 'enrichment' && enrichmentData && (
                <CheckCircle2 style={{ width: 16, height: 16, color: '#34d399', marginLeft: '0.25rem' }} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div>
              <div style={styles.actionBar}>
                <button
                  style={isEnriching ? styles.btnDisabled : styles.btnPrimary}
                  onClick={handleDeepEnrich}
                  disabled={isEnriching}
                >
                  {isEnriching ? (
                    <>
                      <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                      Analyzing... (10-18s)
                    </>
                  ) : enrichmentData ? (
                    <>
                      <RefreshCw style={{ width: 16, height: 16 }} />
                      Re-Enrich Contact
                    </>
                  ) : (
                    <>
                      <Target style={{ width: 16, height: 16 }} />
                      Deep Enrich Contact
                    </>
                  )}
                </button>
                {enrichmentData?.meta?.generated_at && (
                  <span style={styles.metaText}>
                    <Clock style={{ width: 12, height: 12 }} />
                    Last enriched {formatDate(enrichmentData.meta.generated_at)}
                  </span>
                )}
              </div>

              {enrichmentError && (
                <div style={styles.errorBox}>
                  <AlertCircle style={{ width: 16, height: 16 }} />
                  {enrichmentError}
                </div>
              )}

              {isEnriching && (
                <div style={styles.loadingContainer}>
                  <Loader2 style={{ width: 40, height: 40, color: '#818cf8', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>Analyzing contact from multiple sources...</p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
                    <span style={{ color: '#818cf8' }}>● Gathering data</span>
                    <span>○ Analyzing market</span>
                    <span>○ Building profile</span>
                  </div>
                </div>
              )}

              {enrichmentData && !isEnriching && (
                <div>
                  {renderContactProfile(enrichmentData.contact_profile)}
                  {renderCompanyProfile(enrichmentData.company_profile)}
                  {renderCurrentFocus(enrichmentData.current_focus)}
                  {renderBuyingSignals(enrichmentData.buying_signals)}
                  {renderRisksAndObjections(enrichmentData.risks_and_objections)}
                  {renderMessaging(enrichmentData.messaging)}
                </div>
              )}

              {!enrichmentData && !isEnriching && (
                <div style={styles.emptyState}>
                  <Building2 style={{ width: 48, height: 48, color: '#475569', marginBottom: '1rem' }} />
                  <h3 style={styles.emptyTitle}>No Enrichment Data</h3>
                  <p style={styles.emptyText}>
                    Click "Deep Enrich Contact" to gather comprehensive intelligence including
                    contact profile, company details, buying signals, and personalized messaging.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={styles.grid2}>
              <div style={styles.card}>
                <span style={styles.label}>Email</span>
                <span style={styles.value}>{contact.email || 'N/A'}</span>
              </div>
              <div style={styles.card}>
                <span style={styles.label}>Phone</span>
                <span style={styles.value}>{contact.phone || 'N/A'}</span>
              </div>
              <div style={styles.card}>
                <span style={styles.label}>Company</span>
                <span style={styles.value}>{contact.company || 'N/A'}</span>
              </div>
              <div style={styles.card}>
                <span style={styles.label}>Title</span>
                <span style={styles.value}>{contact.title || 'N/A'}</span>
              </div>
            </div>
          )}

          {/* Outreach Tab */}
          {activeTab === 'outreach' && (
            <div style={styles.emptyState}>
              <MessageSquare style={{ width: 48, height: 48, color: '#475569', marginBottom: '1rem' }} />
              <h3 style={styles.emptyTitle}>Outreach Templates</h3>
              <p style={styles.emptyText}>Coming soon...</p>
            </div>
          )}

          {/* Scores Tab */}
          {activeTab === 'scores' && (
            <div style={styles.grid3}>
              <div style={{ ...styles.card, textAlign: 'center' as const }}>
                <span style={styles.label}>MDCP Score</span>
                <span style={{ ...styles.scoreValue, color: '#818cf8' }}>{contact.mdcp_score ?? 0}</span>
              </div>
              <div style={{ ...styles.card, textAlign: 'center' as const }}>
                <span style={styles.label}>BANT Score</span>
                <span style={{ ...styles.scoreValue, color: '#34d399' }}>{contact.bant_score ?? 0}</span>
              </div>
              <div style={{ ...styles.card, textAlign: 'center' as const }}>
                <span style={styles.label}>SPICE Score</span>
                <span style={{ ...styles.scoreValue, color: '#fbbf24' }}>{contact.spice_score ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
