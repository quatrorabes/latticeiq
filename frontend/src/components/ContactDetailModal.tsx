import React, { useState, useEffect } from 'react'
import { X, Building2, Target, Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock, User } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Contact } from '../types'
import type { UnifiedEnrichmentResult } from '../types/enrichment'

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
  const [scores, setScores] = useState({ mdcp: contact.mdcpscore ?? 0, bant: contact.bantscore ?? 0, spice: contact.spicescore ?? 0 })
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // FIXED: Load enrichment data from contact record
  useEffect(() => {
    if (contact?.enrichmentdata) {
      // Handle nested data structure from database
      const data = contact.enrichmentdata?.data || contact.enrichmentdata
      if (data && typeof data === 'object') {
        setEnrichmentData(data as UnifiedEnrichmentResult)
        setEnrichmentStatus('completed')
      }
    } else {
      setEnrichmentData(null)
      setEnrichmentStatus('idle')
    }
    setScores({
      mdcp: contact.mdcpscore ?? 0,
      bant: contact.bantscore ?? 0,
      spice: contact.spicescore ?? 0
    })
  }, [contact.id, contact.enrichmentdata])

  if (!isOpen) return null

  // FIXED: Deep Enrichment with proper state handling
  const handleDeepEnrich = async () => {
    setIsEnriching(true)
    setEnrichmentStatus('processing')
    setEnrichmentError(null)

    try {
      const APIURL = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com'
      const { data: session } = await supabase.auth.getSession()
      const token = session?.access_token

      // Trigger deep enrichment
      const response = await fetch(
        `${APIURL}/api/v3/enrichment/deep-enrich/${contact.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Enrichment failed ${response.status}`)
      }

      // Poll for results with proper timing
      let attempts = 0
      const maxAttempts = 30

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000))

        const resultResponse = await fetch(
          `${APIURL}/api/v3/enrichment/deep-enrich/${contact.id}/result`,
          {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` })
            }
          }
        )

        if (resultResponse.ok) {
          const result = await resultResponse.json()

          // FIXED: Properly extract data from various response structures
          const enrichData =
            result?.contactprofile ? result :
            result?.data?.contactprofile ? result.data :
            result?.enrichmentdata ? result.enrichmentdata :
            null

          if (enrichData && enrichData.contactprofile) {
            // SUCCESS: Data is complete
            setEnrichmentData(enrichData as UnifiedEnrichmentResult)
            setEnrichmentStatus('completed')

            // Update scores if present
            const scoresData = result?.scores || result?.data?.scores || enrichData?.scores
            if (scoresData) {
              setScores({
                mdcp: scoresData.mdcp ?? 0,
                bant: scoresData.bant ?? 0,
                spice: scoresData.spice ?? 0
              })
            }

            // FIXED: Update parent component
            if (onUpdate) {
              onUpdate({
                ...contact,
                enrichmentdata: enrichData,
                mdcpscore: scoresData?.mdcp,
                bantscore: scoresData?.bant,
                spicescore: scoresData?.spice
              })
            }

            setIsEnriching(false)
            return
          }
        }

        if (result?.status === 'failed') {
          throw new Error(result?.error || 'Enrichment failed')
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

  // UTILITY: Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // UTILITY: Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'NA'
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // UTILITY: Extract bullet text
  const getBulletText = (bullet: any): string => {
    if (typeof bullet === 'string') return bullet
    if (bullet?.text) return bullet.text
    return String(bullet)
  }

  // SECTION RENDERERS - All 6 sections
  const renderContactProfile = (data: any) => {
    if (!data) return null
    
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <User className="w-5 h-5 text-indigo-400" />
          <h4>Contact Profile</h4>
        </div>
        <div className="section-content">
          {data.headline && <p className="description">{data.headline}</p>}
          {data.rolesummary && <p className="description">{data.rolesummary}</p>}
          
          <div className="detail-grid">
            {data.seniority && <div><span className="detail-label">Seniority</span><span className="detail-value">{data.seniority}</span></div>}
          </div>

          {Array.isArray(data.backgroundbullets) && data.backgroundbullets.length > 0 && (
            <div className="list-section">
              <span className="list-label">Background</span>
              <ul className="bullet-list">
                {data.backgroundbullets.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderCompanyProfile = (data: any) => {
    if (!data) return null
    
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <h4>Company Profile</h4>
        </div>
        <div className="section-content">
          {data.oneliner && <p className="description">{data.oneliner}</p>}
          
          <div className="detail-grid">
            {data.industry && <div><span className="detail-label">Industry</span><span className="detail-value">{data.industry}</span></div>}
            {data.sizesegment && <div><span className="detail-label">Size</span><span className="detail-value">{data.sizesegment}</span></div>}
            {data.region && <div><span className="detail-label">Region</span><span className="detail-value">{data.region}</span></div>}
          </div>

          {Array.isArray(data.keyproductsorservices) && data.keyproductsorservices.length > 0 && (
            <div className="list-section">
              <span className="list-label">Products / Services</span>
              <div className="tag-list">
                {data.keyproductsorservices.map((item: any, i: number) => (
                  <span key={i} className="tag">{getBulletText(item)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderCurrentFocus = (data: any) => {
    if (!data) return null
    
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Target className="w-5 h-5 text-amber-400" />
          <h4>Current Focus</h4>
        </div>
        <div className="section-content">
          {Array.isArray(data.strategicinitiatives) && data.strategicinitiatives.length > 0 && (
            <div className="list-section">
              <span className="list-label success">Strategic Initiatives</span>
              <ul className="bullet-list">
                {data.strategicinitiatives.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.recentprojects) && data.recentprojects.length > 0 && (
            <div className="list-section">
              <span className="list-label">Recent Projects</span>
              <ul className="bullet-list">
                {data.recentprojects.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.primarykpis) && data.primarykpis.length > 0 && (
            <div className="list-section">
              <span className="list-label">Primary KPIs</span>
              <ul className="bullet-list">
                {data.primarykpis.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderBuyingSignals = (data: any) => {
    if (!data) return null
    
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <Loader2 className="w-5 h-5 text-green-400" />
          <h4>Buying Signals</h4>
        </div>
        <div className="section-content">
          {Array.isArray(data.recentnews) && data.recentnews.length > 0 && (
            <div className="list-section">
              <span className="list-label success">Recent News</span>
              <ul className="bullet-list">
                {data.recentnews.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.timingtriggers) && data.timingtriggers.length > 0 && (
            <div className="list-section">
              <span className="list-label warning">Timing Triggers</span>
              <ul className="bullet-list">
                {data.timingtriggers.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.hiringsignals) && data.hiringsignals.length > 0 && (
            <div className="list-section">
              <span className="list-label">Hiring Signals</span>
              <ul className="bullet-list">
                {data.hiringsignals.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderRisksAndObjections = (data: any) => {
    if (!data) return null
    
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h4>Risks & Objections</h4>
        </div>
        <div className="section-content">
          {Array.isArray(data.riskbullets) && data.riskbullets.length > 0 && (
            <div className="list-section">
              <span className="list-label warning">Risk Factors</span>
              <ul className="bullet-list">
                {data.riskbullets.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.likelyobjections) && data.likelyobjections.length > 0 && (
            <div className="list-section">
              <span className="list-label">Likely Objections</span>
              <ul className="bullet-list">
                {data.likelyobjections.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.landmines) && data.landmines.length > 0 && (
            <div className="list-section">
              <span className="list-label">Landmines to Avoid</span>
              <ul className="bullet-list">
                {data.landmines.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderMessaging = (data: any) => {
    if (!data) return null
    
    return (
      <div className="enrichment-section">
        <div className="section-header">
          <CheckCircle2 className="w-5 h-5 text-purple-400" />
          <h4>Recommended Messaging</h4>
        </div>
        <div className="section-content">
          {Array.isArray(data.coldopeners) && data.coldopeners.length > 0 && (
            <div className="list-section">
              <span className="list-label success">Cold Openers</span>
              <ul className="bullet-list">
                {data.coldopeners.map((item: any, i: number) => (
                  <li 
                    key={i} 
                    className="copyable" 
                    onClick={() => copyToClipboard(getBulletText(item), `opener-${i}`)}
                  >
                    {getBulletText(item)}
                    {copiedField === `opener-${i}` && <span className="copied-badge">Copied!</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.valueprops) && data.valueprops.length > 0 && (
            <div className="list-section">
              <span className="list-label">Value Props</span>
              <ul className="bullet-list">
                {data.valueprops.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(data.calltoactionideas) && data.calltoactionideas.length > 0 && (
            <div className="list-section">
              <span className="list-label">Call to Action Ideas</span>
              <ul className="bullet-list">
                {data.calltoactionideas.map((item: any, i: number) => (
                  <li key={i}>{getBulletText(item)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  // MAIN RENDER
  const contactName = `${contact.firstname} ${contact.lastname}`.trim() || contact.email?.split('@')[0] || 'Unknown'
  const initials = contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'XX'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <div className="avatar">{initials}</div>
            <div className="header-info">
              <h2>{contactName}</h2>
              <p className="subtitle">
                <span>{contact.title}</span>
                {contact.title && contact.company && <span> at </span>}
                {contact.company && <span className="company">{contact.company}</span>}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`} 
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab ${activeTab === 'enrichment' ? 'active' : ''}`} 
            onClick={() => setActiveTab('enrichment')}
          >
            Deep Enrichment 
            {enrichmentData && <CheckCircle2 className="w-4 h-4 ml-1 text-emerald-400" />}
          </button>
          <button 
            className={`tab ${activeTab === 'outreach' ? 'active' : ''}`} 
            onClick={() => setActiveTab('outreach')}
          >
            Outreach
          </button>
          <button 
            className={`tab ${activeTab === 'scores' ? 'active' : ''}`} 
            onClick={() => setActiveTab('scores')}
          >
            Scores
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Enrichment Tab */}
          {activeTab === 'enrichment' && (
            <div className="enrichment-tab">
              <div className="enrich-action">
                <button 
                  className="enrich-btn" 
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
                {enrichmentData?.meta?.generatedat && (
                  <span className="enriched-at">
                    <Clock className="w-3 h-3" />
                    Last enriched {formatDate(enrichmentData.meta.generatedat)}
                  </span>
                )}
              </div>

              {enrichmentError && (
                <div className="error-banner">
                  <AlertCircle className="w-4 h-4" />
                  {enrichmentError}
                </div>
              )}

              {isEnriching && (
                <div className="processing-state">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <p>Analyzing contact from multiple sources...</p>
                  <div className="processing-steps">
                    <span className="step active">Gathering data</span>
                    <span className="step">Analyzing market</span>
                    <span className="step">Building profile</span>
                  </div>
                </div>
              )}

              {enrichmentData && !isEnriching && (
                <div className="enrichment-sections">
                  {renderContactProfile(enrichmentData.contactprofile)}
                  {renderCompanyProfile(enrichmentData.companyprofile)}
                  {renderCurrentFocus(enrichmentData.currentfocus)}
                  {renderBuyingSignals(enrichmentData.buyingsignals)}
                  {renderRisksAndObjections(enrichmentData.risksandobjections)}
                  {renderMessaging(enrichmentData.messaging)}
                </div>
              )}

              {!enrichmentData && !isEnriching && (
                <div className="empty-state">
                  <Building2 className="w-12 h-12 text-slate-600" />
                  <h3>No Enrichment Data</h3>
                  <p>Click Deep Enrich Contact to gather comprehensive intelligence including contact profile, company details, buying signals, and personalized messaging recommendations.</p>
                </div>
              )}
            </div>
          )}

          {/* Other tabs */}
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="info-grid">
                <div><span className="detail-label">Email</span><span className="detail-value">{contact.email}</span></div>
                <div><span className="detail-label">Phone</span><span className="detail-value">{contact.phone || 'NA'}</span></div>
                <div><span className="detail-label">Company</span><span className="detail-value">{contact.company || 'NA'}</span></div>
                <div><span className="detail-label">Title</span><span className="detail-value">{contact.title || 'NA'}</span></div>
              </div>
            </div>
          )}

          {activeTab === 'outreach' && <div className="outreach-tab">Outreach templates coming soon...</div>}
          {activeTab === 'scores' && <div className="scores-tab">Score details: MDCP {scores.mdcp} | BANT {scores.bant} | SPICE {scores.spice}</div>}
        </div>
      </div>
    </div>
  )
}
