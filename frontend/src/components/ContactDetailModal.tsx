import React, { useState, useEffect } from 'react'
import { X, Building2, Target, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, User, Zap, MessageSquare, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Contact } from '../types'  // <-- ADD THIS IMPORT


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


// DELETED: The local Contact interface that was here - now using shared type


interface ContactDetailModalProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
  onUpdate?: (contact: Contact) => void
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


  // Load enrichment data from contact record
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


  // Deep Enrichment handler
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


  // Section Renderers
  const renderContactProfile = (data: ContactProfileBox | undefined) => {
    if (!data) return null
    return (
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-5 h-5 text-indigo-400" />
          <h4 className="text-white font-medium">Contact Profile</h4>
        </div>
        <div className="space-y-3">
          {data.headline && <p className="text-slate-300 font-medium">{data.headline}</p>}
          {data.role_summary && <p className="text-slate-400 text-sm">{data.role_summary}</p>}
          {data.seniority && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-xs uppercase">Seniority</span>
              <span className="text-slate-300 text-sm">{data.seniority}</span>
            </div>
          )}
          {data.background_bullets && data.background_bullets.length > 0 && (
            <div className="mt-3">
              <span className="text-slate-500 text-xs uppercase block mb-2">Background</span>
              <ul className="space-y-1">
                {data.background_bullets.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">•</span>
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
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <h4 className="text-white font-medium">Company Profile</h4>
        </div>
        <div className="space-y-3">
          {data.one_liner && <p className="text-slate-300">{data.one_liner}</p>}
          <div className="grid grid-cols-2 gap-3">
            {data.industry && (
              <div>
                <span className="text-slate-500 text-xs uppercase block">Industry</span>
                <span className="text-slate-300 text-sm">{data.industry}</span>
              </div>
            )}
            {data.size_segment && (
              <div>
                <span className="text-slate-500 text-xs uppercase block">Size</span>
                <span className="text-slate-300 text-sm">{data.size_segment}</span>
              </div>
            )}
            {data.region && (
              <div>
                <span className="text-slate-500 text-xs uppercase block">Region</span>
                <span className="text-slate-300 text-sm">{data.region}</span>
              </div>
            )}
          </div>
          {data.key_products_or_services && data.key_products_or_services.length > 0 && (
            <div className="mt-3">
              <span className="text-slate-500 text-xs uppercase block mb-2">Products & Services</span>
              <div className="flex flex-wrap gap-2">
                {data.key_products_or_services.map((item, i) => (
                  <span key={i} className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded text-xs">
                    {getBulletText(item)}
                  </span>
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
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-amber-400" />
          <h4 className="text-white font-medium">Current Focus</h4>
        </div>
        <div className="space-y-4">
          {data.strategic_initiatives && data.strategic_initiatives.length > 0 && (
            <div>
              <span className="text-green-400 text-xs uppercase block mb-2">Strategic Initiatives</span>
              <ul className="space-y-1">
                {data.strategic_initiatives.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.recent_projects && data.recent_projects.length > 0 && (
            <div>
              <span className="text-slate-500 text-xs uppercase block mb-2">Recent Projects</span>
              <ul className="space-y-1">
                {data.recent_projects.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.primary_kpis && data.primary_kpis.length > 0 && (
            <div>
              <span className="text-slate-500 text-xs uppercase block mb-2">Primary KPIs</span>
              <ul className="space-y-1">
                {data.primary_kpis.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
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
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-green-400" />
          <h4 className="text-white font-medium">Buying Signals</h4>
        </div>
        <div className="space-y-4">
          {data.recent_news && data.recent_news.length > 0 && (
            <div>
              <span className="text-green-400 text-xs uppercase block mb-2">Recent News</span>
              <ul className="space-y-1">
                {data.recent_news.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-green-400 mt-1">•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.timing_triggers && data.timing_triggers.length > 0 && (
            <div>
              <span className="text-amber-400 text-xs uppercase block mb-2">Timing Triggers</span>
              <ul className="space-y-1">
                {data.timing_triggers.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.hiring_signals && data.hiring_signals.length > 0 && (
            <div>
              <span className="text-slate-500 text-xs uppercase block mb-2">Hiring Signals</span>
              <ul className="space-y-1">
                {data.hiring_signals.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
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
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <h4 className="text-white font-medium">Risks & Objections</h4>
        </div>
        <div className="space-y-4">
          {data.risk_bullets && data.risk_bullets.length > 0 && (
            <div>
              <span className="text-amber-400 text-xs uppercase block mb-2">Risk Factors</span>
              <ul className="space-y-1">
                {data.risk_bullets.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.likely_objections && data.likely_objections.length > 0 && (
            <div>
              <span className="text-slate-500 text-xs uppercase block mb-2">Likely Objections</span>
              <ul className="space-y-1">
                {data.likely_objections.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.landmines && data.landmines.length > 0 && (
            <div>
              <span className="text-red-400 text-xs uppercase block mb-2">Landmines to Avoid</span>
              <ul className="space-y-1">
                {data.landmines.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-red-400 mt-1">⚠</span>
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
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-purple-400" />
          <h4 className="text-white font-medium">Recommended Messaging</h4>
        </div>
        <div className="space-y-4">
          {data.cold_openers && data.cold_openers.length > 0 && (
            <div>
              <span className="text-green-400 text-xs uppercase block mb-2">Cold Openers (click to copy)</span>
              <ul className="space-y-2">
                {data.cold_openers.map((item, i) => (
                  <li 
                    key={i} 
                    className="text-slate-300 text-sm bg-slate-700/50 p-2 rounded cursor-pointer hover:bg-slate-700 transition-colors flex items-start gap-2"
                    onClick={() => copyToClipboard(getBulletText(item), `opener-${i}`)}
                  >
                    <span className="flex-1">{getBulletText(item)}</span>
                    {copiedField === `opener-${i}` && (
                      <span className="text-green-400 text-xs">Copied!</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.value_props && data.value_props.length > 0 && (
            <div>
              <span className="text-slate-500 text-xs uppercase block mb-2">Value Props</span>
              <ul className="space-y-1">
                {data.value_props.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-purple-400 mt-1">•</span>
                    <span>{getBulletText(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.call_to_action_ideas && data.call_to_action_ideas.length > 0 && (
            <div>
              <span className="text-slate-500 text-xs uppercase block mb-2">Call to Action Ideas</span>
              <ul className="space-y-1">
                {data.call_to_action_ideas.map((item, i) => (
                  <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                    <span className="text-blue-400 mt-1">→</span>
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


  // Main render - use snake_case fields (now from shared Contact type)
  const contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email?.split('@')[0] || 'Unknown'
  const initials = contactName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'XX'


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-slate-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-slate-800 p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                {initials}
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">{contactName}</h2>
                <p className="text-slate-400 text-sm">
                  {contact.title && <span>{contact.title}</span>}
                  {contact.title && contact.company && <span> at </span>}
                  {contact.company && <span className="text-indigo-400">{contact.company}</span>}
                </p>
              </div>
            </div>
            <button className="text-slate-400 hover:text-white p-2" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          {(['overview', 'enrichment', 'outreach', 'scores'] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab 
                  ? 'text-indigo-400 border-b-2 border-indigo-400' 
                  : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'enrichment' ? 'Deep Enrichment' : tab}
              {tab === 'enrichment' && enrichmentData && (
                <CheckCircle2 className="w-4 h-4 ml-1 inline text-emerald-400" />
              )}
            </button>
          ))}
        </div>


        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    isEnriching 
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                  onClick={handleDeepEnrich} 
                  disabled={isEnriching}
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing... (10-18s)
                    </>
                  ) : enrichmentData ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Re-Enrich Contact
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4" />
                      Deep Enrich Contact
                    </>
                  )}
                </button>
                {enrichmentData?.meta?.generated_at && (
                  <span className="text-slate-500 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last enriched {formatDate(enrichmentData.meta.generated_at)}
                  </span>
                )}
              </div>


              {enrichmentError && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {enrichmentError}
                </div>
              )}


              {isEnriching && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
                  <p className="text-slate-300 mb-2">Analyzing contact from multiple sources...</p>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span className="text-indigo-400">● Gathering data</span>
                    <span>○ Analyzing market</span>
                    <span>○ Building profile</span>
                  </div>
                </div>
              )}


              {enrichmentData && !isEnriching && (
                <div className="space-y-4">
                  {renderContactProfile(enrichmentData.contact_profile)}
                  {renderCompanyProfile(enrichmentData.company_profile)}
                  {renderCurrentFocus(enrichmentData.current_focus)}
                  {renderBuyingSignals(enrichmentData.buying_signals)}
                  {renderRisksAndObjections(enrichmentData.risks_and_objections)}
                  {renderMessaging(enrichmentData.messaging)}
                </div>
              )}


              {!enrichmentData && !isEnriching && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Building2 className="w-12 h-12 text-slate-600 mb-4" />
                  <h3 className="text-slate-300 font-medium mb-2">No Enrichment Data</h3>
                  <p className="text-slate-500 text-sm max-w-md">
                    Click "Deep Enrich Contact" to gather comprehensive intelligence including 
                    contact profile, company details, buying signals, and personalized messaging.
                  </p>
                </div>
              )}
            </div>
          )}


          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <span className="text-slate-500 text-xs uppercase block mb-1">Email</span>
                <span className="text-slate-300">{contact.email || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <span className="text-slate-500 text-xs uppercase block mb-1">Phone</span>
                <span className="text-slate-300">{contact.phone || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <span className="text-slate-500 text-xs uppercase block mb-1">Company</span>
                <span className="text-slate-300">{contact.company || 'N/A'}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <span className="text-slate-500 text-xs uppercase block mb-1">Title</span>
                <span className="text-slate-300">{contact.title || 'N/A'}</span>
              </div>
            </div>
          )}


          {/* Outreach Tab */}
          {activeTab === 'outreach' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-slate-300 font-medium mb-2">Outreach Templates</h3>
              <p className="text-slate-500 text-sm">Coming soon...</p>
            </div>
          )}


          {/* Scores Tab */}
          {activeTab === 'scores' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 text-center">
                <span className="text-slate-500 text-xs uppercase block mb-2">MDCP Score</span>
                <span className="text-3xl font-bold text-indigo-400">{contact.mdcp_score ?? 0}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 text-center">
                <span className="text-slate-500 text-xs uppercase block mb-2">BANT Score</span>
                <span className="text-3xl font-bold text-emerald-400">{contact.bant_score ?? 0}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 text-center">
                <span className="text-slate-500 text-xs uppercase block mb-2">SPICE Score</span>
                <span className="text-3xl font-bold text-amber-400">{contact.spice_score ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
