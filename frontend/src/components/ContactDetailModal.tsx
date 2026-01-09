import React, { useState, useEffect } from 'react'
import { X, Building2, Target, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, User, Zap, MessageSquare, ShieldAlert, Mail, Phone, Copy, Send, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Contact } from '../types'
import { 
  generateEmails, 
  generateCallScripts,
  EmailVariant,
  CallScriptVariant 
} from '../api/outreach'


// Then continue with your existing interfaces below:
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


interface QuickEnrichResult {
  contact_id?: string
  summary?: string
  opening_line?: string
  talking_points?: string[]
  vertical?: string
  provider?: string
  generated_at?: string
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
  btnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontWeight: 500,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    color: '#a5b4fc',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  btnGreen: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    fontWeight: 500,
    backgroundColor: '#059669',
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
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
  },
  sectionLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: '0.5rem',
  },
  // Quick Enrich styles
  quickEnrichCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  quickEnrichHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  quickEnrichTitle: {
    color: '#6ee7b7',
    fontWeight: 600,
    fontSize: '0.875rem',
    margin: 0,
  },
  quickEnrichBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#6ee7b7',
    padding: '0.125rem 0.375rem',
    borderRadius: '4px',
    fontSize: '0.65rem',
    fontWeight: 600,
  },
  // Outreach-specific styles
  outreachSection: {
    marginBottom: '2rem',
  },
  outreachSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  outreachSectionTitle: {
    color: 'white',
    fontWeight: 600,
    fontSize: '1rem',
    margin: 0,
  },
  variantCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  variantHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  variantBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  styleBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    color: '#6ee7b7',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
  },
  qualityBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    color: '#fcd34d',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
  },
  emailContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderLeft: '3px solid #6366f1',
    padding: '1rem',
    marginBottom: '1rem',
    borderRadius: '0 6px 6px 0',
  },
  callScriptContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderLeft: '3px solid #10b981',
    padding: '1rem',
    marginBottom: '1rem',
    borderRadius: '0 6px 6px 0',
  },
  emailSubject: {
    color: '#f8fafc',
    fontWeight: 500,
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
  },
  emailBody: {
    color: '#cbd5e1',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
  },
  scriptSection: {
    marginBottom: '0.75rem',
  },
  scriptSectionLabel: {
    color: '#34d399',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    marginBottom: '0.25rem',
  },
  scriptText: {
    color: '#cbd5e1',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
  },
  variantActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '6px',
    color: '#a5b4fc',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.2)',
    borderRadius: '6px',
    color: '#86efac',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  callBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.375rem 0.75rem',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '6px',
    color: '#6ee7b7',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  fallbackSection: {
    marginTop: '1.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #334155',
  },
  fallbackLabel: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  noDataText: {
    color: '#64748b',
    fontSize: '0.875rem',
    textAlign: 'center' as const,
    padding: '1rem',
  },
}


const API_URL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'


export default function ContactDetailModal({ 
  contact, 
  isOpen, 
  onClose, 
  onUpdate 
}: ContactDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'outreach' | 'scores'>('overview')
  
  // Deep Enrichment state
  const [enrichmentData, setEnrichmentData] = useState<UnifiedEnrichmentResult | null>(null)
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null)
  
  // Quick Enrichment state
  const [quickEnrichData, setQuickEnrichData] = useState<QuickEnrichResult | null>(null)
  const [isQuickEnriching, setIsQuickEnriching] = useState(false)
  const [quickEnrichError, setQuickEnrichError] = useState<string | null>(null)
  
  // Scoring state
  const [isScoring, setIsScoring] = useState(false)
  const [scoringError, setScoringError] = useState<string | null>(null)
  
  // Local contact state for scores (to show updated scores without full refresh)
  const [localContact, setLocalContact] = useState<Contact>(contact)
  
  const [copiedField, setCopiedField] = useState<string | null>(null)
  
  // Outreach state - Emails
  const [generatedEmails, setGeneratedEmails] = useState<EmailVariant[]>([])
  const [isGeneratingEmails, setIsGeneratingEmails] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  
  // Outreach state - Call Scripts
  const [generatedCallScripts, setGeneratedCallScripts] = useState<CallScriptVariant[]>([])
  const [isGeneratingCallScripts, setIsGeneratingCallScripts] = useState(false)
  const [callScriptError, setCallScriptError] = useState<string | null>(null)
  

  useEffect(() => {
    // Update local contact when prop changes
    setLocalContact(contact)
    
    if (contact?.enrichment_data) {
      const data = (contact.enrichment_data as any)?.data || contact.enrichment_data
      if (data && typeof data === 'object') {
        // Check if it's deep enrichment (has contact_profile) or quick enrichment (has summary)
        if (data.contact_profile) {
          setEnrichmentData(data as UnifiedEnrichmentResult)
        } else if (data.summary || data.talking_points) {
          setQuickEnrichData(data as QuickEnrichResult)
        }
      }
    } else {
      setEnrichmentData(null)
      setQuickEnrichData(null)
    }
    // Reset errors
    setEnrichmentError(null)
    setQuickEnrichError(null)
    setScoringError(null)
    // Reset outreach state when contact changes
    setGeneratedEmails([])
    setEmailError(null)
    setGeneratedCallScripts([])
    setCallScriptError(null)
  }, [contact?.id, contact?.enrichment_data])


  if (!isOpen) return null


  const getAuthToken = async (): Promise<string | null> => {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData?.session?.access_token || null
  }


  // Score Contact - calls /api/v3/scoring/score-contact/{id}
  const handleScoreContact = async () => {
    setIsScoring(true)
    setScoringError(null)

    try {
      const token = await getAuthToken()
      
      const response = await fetch(
        `${API_URL}/api/v3/scoring/score-contact/${contact.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Scoring failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Scoring result:', result)
      
      // Extract scores from result - handle various response formats
      const scores = result.scores || result.data?.scores || result
      
      // Update local contact with new scores
      const updatedContact = {
        ...localContact,
        mdcp_score: scores.mdcp_score ?? scores.mdcp ?? localContact.mdcp_score,
        bant_score: scores.bant_score ?? scores.bant ?? localContact.bant_score,
        spice_score: scores.spice_score ?? scores.spice ?? localContact.spice_score,
      }
      
      setLocalContact(updatedContact)
      
      // Update parent if callback provided
      if (onUpdate) {
        onUpdate(updatedContact)
      }
      
      console.log('📊 Updated scores:', {
        mdcp: updatedContact.mdcp_score,
        bant: updatedContact.bant_score,
        spice: updatedContact.spice_score
      })
    } catch (error) {
      console.error('❌ Scoring error:', error)
      setScoringError(error instanceof Error ? error.message : 'Scoring failed')
    } finally {
      setIsScoring(false)
    }
  }


  // Quick Enrich - Fast, 3-5 seconds
  const handleQuickEnrich = async () => {
    setIsQuickEnriching(true)
    setQuickEnrichError(null)

    try {
      const token = await getAuthToken()
      
      const response = await fetch(
        `${API_URL}/api/v3/enrichment/quick-enrich/${contact.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Quick enrich failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Quick enrich result:', result)
      
      // The result might be directly the data or wrapped
      const enrichData = result.data || result
      setQuickEnrichData(enrichData as QuickEnrichResult)
      
      // Update parent if callback provided
      if (onUpdate) {
        onUpdate({ ...contact, enrichment_data: enrichData } as Contact)
      }
      
      // Auto-trigger scoring after successful quick enrich
      console.log('🎯 Auto-triggering scoring after Quick Enrich...')
      setTimeout(() => {
        handleScoreContact()
      }, 500) // Small delay to let UI update first
      
    } catch (error) {
      console.error('❌ Quick enrichment error:', error)
      setQuickEnrichError(error instanceof Error ? error.message : 'Quick enrichment failed')
    } finally {
      setIsQuickEnriching(false)
    }
  }


  // Deep Enrich - Comprehensive, 10-18 seconds
  const handleDeepEnrich = async () => {
    setIsEnriching(true)
    setEnrichmentError(null)

    try {
      const token = await getAuthToken()
      
      // Try the deep enrich endpoint
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
        // If 404, the endpoint might not be registered - provide helpful message
        if (response.status === 404) {
          throw new Error('Deep enrichment endpoint not available. Try Quick Enrich instead.')
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Enrichment failed: ${response.status}`)
      }

      // Poll for results
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
          console.log('📊 Deep enrich poll result:', result)
          
          const enrichData =
            result?.contact_profile ? result :
            result?.data?.contact_profile ? result.data :
            null

          if (enrichData && enrichData.contact_profile) {
            setEnrichmentData(enrichData as UnifiedEnrichmentResult)
            if (onUpdate) {
              onUpdate({ ...contact, enrichment_data: { data: enrichData } } as Contact)
            }
            setIsEnriching(false)
            
            // Auto-trigger scoring after successful deep enrich
            console.log('🎯 Auto-triggering scoring after Deep Enrich...')
            setTimeout(() => {
              handleScoreContact()
            }, 500) // Small delay to let UI update first
            
            return
          }
        }

        attempts++
      }

      throw new Error('Enrichment timed out. Please try again.')
    } catch (error) {
      console.error('❌ Deep enrichment error:', error)
      setEnrichmentError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsEnriching(false)
    }
  }


  // Generate emails handler
  const handleGenerateEmails = async () => {
  console.log('🚀 Starting email generation for contact:', contact.id)
  setIsGeneratingEmails(true)
  setEmailError(null) 
  try {
    const response = await generateEmails(contact.id, 3)
    console.log('📥 Full response from generateEmails:', response)
    console.log('📊 response.variants:', response.variants)
    
    // The API returns response.variants as an array
    if (response.variants && Array.isArray(response.variants)) {
      console.log('✅ Setting email variants with', response.variants.length, 'emails')
      setGeneratedEmails(response.variants)
    } else {
      console.error('❌ No variants array in response:', response)
      setEmailError('Invalid response format - no variants array')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate emails'
    console.error('❌ Email generation error:', message, error)
    setEmailError(message)
  } finally {
    setIsGeneratingEmails(false)
  }
}


  // Generate call scripts handler
const handleGenerateCallScripts = async () => {
  console.log('🚀 Starting call script generation for contact:', contact.id)
  setIsGeneratingCallScripts(true)
  setCallScriptError(null)
  try {
    const response = await generateCallScripts(contact.id, 3)
    console.log('📥 Full response from generateCallScripts:', response)
    console.log('📊 response.scripts:', response.scripts)
    
    if (response.scripts && Array.isArray(response.scripts)) {
      console.log('✅ Setting call scripts with', response.scripts.length, 'scripts')
      setGeneratedCallScripts(response.scripts)
    } else {
      console.error('❌ No scripts array in response:', response)
      setCallScriptError('Invalid response format - no scripts array')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate call scripts'
    console.error('❌ Call script generation error:', message, error)
    setCallScriptError(message)
  } finally {
    setIsGeneratingCallScripts(false)
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


  const formatCallScript = (script: CallScriptVariant): string => {
    return `OPENER:\n${script.opener}\n\nBODY:\n${script.body}\n\nCLOSER:\n${script.closer}`
  }


  // Render Quick Enrich Results
  const renderQuickEnrichResults = () => {
    if (!quickEnrichData) return null
    
    return (
      <div style={styles.quickEnrichCard}>
        <div style={styles.quickEnrichHeader}>
          <Sparkles style={{ width: 16, height: 16, color: '#6ee7b7' }} />
          <h4 style={styles.quickEnrichTitle}>Quick Intel</h4>
          <span style={styles.quickEnrichBadge}>FAST</span>
        </div>
        
        {quickEnrichData.summary && (
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ ...styles.label, color: '#6ee7b7' }}>Summary</span>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: 0 }}>{quickEnrichData.summary}</p>
          </div>
        )}
        
        {quickEnrichData.opening_line && (
          <div 
            style={{ ...styles.copyableItem, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
            onClick={() => copyToClipboard(quickEnrichData.opening_line!, 'opening-line')}
          >
            <span style={{ flex: 1 }}>
              <strong style={{ color: '#6ee7b7' }}>Opening Line:</strong> {quickEnrichData.opening_line}
            </span>
            {copiedField === 'opening-line' && (
              <span style={{ color: '#34d399', fontSize: '0.75rem' }}>Copied!</span>
            )}
          </div>
        )}
        
        {quickEnrichData.talking_points && quickEnrichData.talking_points.length > 0 && (
          <div>
            <span style={{ ...styles.label, color: '#6ee7b7' }}>Talking Points</span>
            <ul style={styles.bulletList}>
              {quickEnrichData.talking_points.map((point, i) => (
                <li key={i} style={styles.bulletItem}>
                  <span style={{ color: '#6ee7b7' }}>•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {quickEnrichData.vertical && (
          <div style={{ marginTop: '0.5rem' }}>
            <span style={styles.tag}>{quickEnrichData.vertical}</span>
          </div>
        )}
      </div>
    )
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
  const hasAnyEnrichment = enrichmentData || quickEnrichData


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
              {tab === 'enrichment' ? 'Enrichment' : tab}
              {tab === 'enrichment' && hasAnyEnrichment && (
                <CheckCircle2 style={{ width: 16, height: 16, color: '#34d399', marginLeft: '0.25rem' }} />
              )}
              {tab === 'outreach' && (generatedEmails.length > 0 || generatedCallScripts.length > 0) && (
                <CheckCircle2 style={{ width: 16, height: 16, color: '#34d399', marginLeft: '0.25rem' }} />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={styles.content}>
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

          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div>
              {/* Action Buttons */}
              <div style={styles.actionBar}>
                <div style={styles.buttonGroup}>
                  {/* Quick Enrich Button */}
                  <button
                    style={isQuickEnriching ? styles.btnDisabled : styles.btnGreen}
                    onClick={handleQuickEnrich}
                    disabled={isQuickEnriching || isEnriching}
                  >
                    {isQuickEnriching ? (
                      <>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        Quick... (3-5s)
                      </>
                    ) : (
                      <>
                        <Sparkles style={{ width: 16, height: 16 }} />
                        Quick Enrich
                      </>
                    )}
                  </button>
                  
                  {/* Deep Enrich Button */}
                  <button
                    style={isEnriching ? styles.btnDisabled : styles.btnPrimary}
                    onClick={handleDeepEnrich}
                    disabled={isEnriching || isQuickEnriching}
                  >
                    {isEnriching ? (
                      <>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        Deep... (10-18s)
                      </>
                    ) : enrichmentData ? (
                      <>
                        <RefreshCw style={{ width: 16, height: 16 }} />
                        Re-Enrich Deep
                      </>
                    ) : (
                      <>
                        <Target style={{ width: 16, height: 16 }} />
                        Deep Enrich
                      </>
                    )}
                  </button>
                </div>
                
                {enrichmentData?.meta?.generated_at && (
                  <span style={styles.metaText}>
                    <Clock style={{ width: 12, height: 12 }} />
                    Last enriched {formatDate(enrichmentData.meta.generated_at)}
                  </span>
                )}
              </div>

              {/* Errors */}
              {quickEnrichError && (
                <div style={styles.errorBox}>
                  <AlertCircle style={{ width: 16, height: 16 }} />
                  {quickEnrichError}
                </div>
              )}
              {enrichmentError && (
                <div style={styles.errorBox}>
                  <AlertCircle style={{ width: 16, height: 16 }} />
                  {enrichmentError}
                </div>
              )}

              {/* Loading States */}
              {isQuickEnriching && (
                <div style={styles.loadingContainer}>
                  <Loader2 style={{ width: 40, height: 40, color: '#34d399', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>Quick enriching {contact.first_name || 'contact'}...</p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Getting summary, opening line, and talking points</p>
                </div>
              )}

              {isEnriching && (
                <div style={styles.loadingContainer}>
                  <Loader2 style={{ width: 40, height: 40, color: '#818cf8', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>Deep analyzing contact...</p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#64748b' }}>
                    <span style={{ color: '#818cf8' }}>● Gathering data</span>
                    <span>○ Analyzing market</span>
                    <span>○ Building profile</span>
                  </div>
                </div>
              )}

              {/* Quick Enrich Results */}
              {quickEnrichData && !isQuickEnriching && !isEnriching && renderQuickEnrichResults()}

              {/* Deep Enrich Results */}
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

              {/* Empty State */}
              {!hasAnyEnrichment && !isEnriching && !isQuickEnriching && (
                <div style={styles.emptyState}>
                  <Building2 style={{ width: 48, height: 48, color: '#475569', marginBottom: '1rem' }} />
                  <h3 style={styles.emptyTitle}>No Enrichment Data</h3>
                  <p style={styles.emptyText}>
                    <strong>Quick Enrich</strong> (3-5s): Summary, opening line, talking points<br />
                    <strong>Deep Enrich</strong> (10-18s): Full profile, buying signals, messaging
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Outreach Tab */}
          {activeTab === 'outreach' && (
            <div>
              {/* ========== EMAIL GENERATION SECTION ========== */}
              <div style={styles.outreachSection}>
                <div style={styles.outreachSectionHeader}>
                  <Mail style={{ width: 20, height: 20, color: '#60a5fa' }} />
                  <h3 style={styles.outreachSectionTitle}>Email Outreach</h3>
                </div>

                {emailError && (
                  <div style={styles.errorBox}>
                    <AlertCircle style={{ width: 16, height: 16 }} />
                    {emailError}
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <button
                    style={isGeneratingEmails ? styles.btnDisabled : styles.btnPrimary}
                    onClick={handleGenerateEmails}
                    disabled={isGeneratingEmails}
                  >
                    {isGeneratingEmails ? (
                      <>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        Generating... (15-30s)
                      </>
                    ) : generatedEmails.length > 0 ? (
                      <>
                        <RefreshCw style={{ width: 16, height: 16 }} />
                        Regenerate Emails
                      </>
                    ) : (
                      <>
                        <Zap style={{ width: 16, height: 16 }} />
                        Generate Emails
                      </>
                    )}
                  </button>
                </div>

                {isGeneratingEmails && (
                  <div style={styles.loadingContainer}>
                    <Loader2 style={{ width: 40, height: 40, color: '#60a5fa', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>Generating personalized emails...</p>
                  </div>
                )}

                {generatedEmails.length > 0 && !isGeneratingEmails && (
                  <div>
                    <p style={{ color: '#a5b4fc', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      ✨ {generatedEmails.length} email variants generated
                    </p>
                    {generatedEmails.map((variant, idx) => (
                      <div key={idx} style={styles.variantCard}>
                        <div style={styles.variantHeader}>
                          <span style={styles.variantBadge}>Variant {variant.variant_number}</span>
                          <span style={styles.styleBadge}>{variant.style}</span>
                          <span style={styles.qualityBadge}>Quality: {variant.quality_score}/10</span>
                        </div>
                        <div style={styles.emailContent}>
                          <div style={styles.emailSubject}><strong>Subject:</strong> {variant.subject}</div>
                          <div style={styles.emailBody}>{variant.body}</div>
                        </div>
                        <div style={styles.variantActions}>
                          <button
                            style={styles.actionBtn}
                            onClick={() => copyToClipboard(`Subject: ${variant.subject}\n\n${variant.body}`, `email-${idx}`)}
                          >
                            <Copy style={{ width: 14, height: 14 }} />
                            {copiedField === `email-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}?subject=${encodeURIComponent(variant.subject)}&body=${encodeURIComponent(variant.body)}`}
                              style={styles.sendBtn}
                            >
                              <Send style={{ width: 14, height: 14 }} />
                              Send
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {generatedEmails.length === 0 && !isGeneratingEmails && (
                  <p style={styles.noDataText}>Click "Generate Emails" to create personalized outreach emails.</p>
                )}
              </div>

              {/* ========== CALL SCRIPT SECTION ========== */}
              <div style={styles.outreachSection}>
                <div style={styles.outreachSectionHeader}>
                  <Phone style={{ width: 20, height: 20, color: '#34d399' }} />
                  <h3 style={styles.outreachSectionTitle}>Call Scripts</h3>
                </div>

                {callScriptError && (
                  <div style={styles.errorBox}>
                    <AlertCircle style={{ width: 16, height: 16 }} />
                    {callScriptError}
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <button
                    style={isGeneratingCallScripts ? styles.btnDisabled : styles.btnGreen}
                    onClick={handleGenerateCallScripts}
                    disabled={isGeneratingCallScripts}
                  >
                    {isGeneratingCallScripts ? (
                      <>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        Generating... (15-30s)
                      </>
                    ) : generatedCallScripts.length > 0 ? (
                      <>
                        <RefreshCw style={{ width: 16, height: 16 }} />
                        Regenerate Scripts
                      </>
                    ) : (
                      <>
                        <Zap style={{ width: 16, height: 16 }} />
                        Generate Scripts
                      </>
                    )}
                  </button>
                </div>

                {isGeneratingCallScripts && (
                  <div style={styles.loadingContainer}>
                    <Loader2 style={{ width: 40, height: 40, color: '#34d399', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>Generating call scripts...</p>
                  </div>
                )}

                {generatedCallScripts.length > 0 && !isGeneratingCallScripts && (
                  <div>
                    <p style={{ color: '#6ee7b7', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      📞 {generatedCallScripts.length} call scripts generated
                    </p>
                    {generatedCallScripts.map((script, idx) => (
                      <div key={idx} style={styles.variantCard}>
                        <div style={styles.variantHeader}>
                          <span style={styles.variantBadge}>Variant {script.variant_number}</span>
                          <span style={styles.styleBadge}>{script.style}</span>
                          <span style={styles.qualityBadge}>Quality: {script.quality_score}/10</span>
                        </div>
                        <div style={styles.callScriptContent}>
                          <div style={styles.scriptSection}>
                            <div style={styles.scriptSectionLabel}>Opener</div>
                            <div style={styles.scriptText}>{script.opener}</div>
                          </div>
                          <div style={styles.scriptSection}>
                            <div style={styles.scriptSectionLabel}>Body</div>
                            <div style={styles.scriptText}>{script.body}</div>
                          </div>
                          <div style={styles.scriptSection}>
                            <div style={styles.scriptSectionLabel}>Closer</div>
                            <div style={styles.scriptText}>{script.closer}</div>
                          </div>
                        </div>
                        <div style={styles.variantActions}>
                          <button
                            style={styles.actionBtn}
                            onClick={() => copyToClipboard(formatCallScript(script), `script-${idx}`)}
                          >
                            <Copy style={{ width: 14, height: 14 }} />
                            {copiedField === `script-${idx}` ? 'Copied!' : 'Copy'}
                          </button>
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} style={styles.callBtn}>
                              <Phone style={{ width: 14, height: 14 }} />
                              Call
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {generatedCallScripts.length === 0 && !isGeneratingCallScripts && (
                  <p style={styles.noDataText}>Click "Generate Scripts" to create personalized call scripts.</p>
                )}
              </div>
            </div>
          )}

          {/* Scores Tab */}
          {activeTab === 'scores' && (
            <div>
              {/* Rescore Action Bar */}
              <div style={styles.actionBar}>
                <div style={styles.buttonGroup}>
                  <button
                    style={isScoring ? styles.btnDisabled : styles.btnPrimary}
                    onClick={handleScoreContact}
                    disabled={isScoring}
                  >
                    {isScoring ? (
                      <>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        Scoring... (3-5s)
                      </>
                    ) : (
                      <>
                        <RefreshCw style={{ width: 16, height: 16 }} />
                        Rescore Contact
                      </>
                    )}
                  </button>
                </div>
                <span style={styles.metaText}>
                  Scores based on enrichment data
                </span>
              </div>

              {/* Scoring Error */}
              {scoringError && (
                <div style={styles.errorBox}>
                  <AlertCircle style={{ width: 16, height: 16 }} />
                  {scoringError}
                </div>
              )}

              {/* Loading State */}
              {isScoring && (
                <div style={styles.loadingContainer}>
                  <Loader2 style={{ width: 40, height: 40, color: '#818cf8', marginBottom: '1rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>Calculating scores...</p>
                  <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Analyzing MDCP, BANT, and SPICE criteria</p>
                </div>
              )}

              {/* Scores Grid */}
              {!isScoring && (
                <div style={styles.grid3}>
                  <div style={{ ...styles.card, textAlign: 'center' as const }}>
                    <span style={styles.label}>MDCP Score</span>
                    <span style={{ ...styles.scoreValue, color: '#818cf8' }}>{localContact.mdcp_score ?? 0}</span>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                      Market, Decision, Competition, Process
                    </p>
                  </div>
                  <div style={{ ...styles.card, textAlign: 'center' as const }}>
                    <span style={styles.label}>BANT Score</span>
                    <span style={{ ...styles.scoreValue, color: '#34d399' }}>{localContact.bant_score ?? 0}</span>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                      Budget, Authority, Need, Timeline
                    </p>
                  </div>
                  <div style={{ ...styles.card, textAlign: 'center' as const }}>
                    <span style={styles.label}>SPICE Score</span>
                    <span style={{ ...styles.scoreValue, color: '#fbbf24' }}>{localContact.spice_score ?? 0}</span>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                      Situation, Pain, Impact, Critical Event
                    </p>
                  </div>
                </div>
              )}

              {/* Helpful Info */}
              {!hasAnyEnrichment && !isScoring && (
                <div style={{ ...styles.card, backgroundColor: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                  <p style={{ color: '#fcd34d', fontSize: '0.875rem', margin: 0 }}>
                    💡 <strong>Tip:</strong> Enrich this contact first to get more accurate scores. 
                    Go to the Enrichment tab and run Quick or Deep Enrich.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
