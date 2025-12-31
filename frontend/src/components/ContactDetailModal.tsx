
import { useState, useEffect } from 'react'
import { Contact, EnrichmentData } from '@types/index'
import Modal from './Modal'
import Button from './Button'
import Badge from './Badge'
import Card from './Card'
import { useEnrichment } from '@hooks/useEnrichment'
import { getDisplayName, formatDate } from '@lib/utils'
import { Copy, Check } from 'lucide-react'

interface ContactDetailModalProps {
  contact: Contact | null
  isOpen: boolean
  onClose: () => void
  onEnrichComplete?: (contact: Contact) => void
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onEnrichComplete,
}: ContactDetailModalProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'raw'>('profile')
  const { enrich, enriching, error } = useEnrichment()

  if (!contact) return null

  const handleEnrich = async () => {
    try {
      const enrichedContact = await enrich(contact.id)
      onEnrichComplete?.(enrichedContact)
    } catch (err) {
      console.error('Enrichment failed:', err)
    }
  }

  const handleCopyJson = () => {
    const json = JSON.stringify(contact.enrichment_data, null, 2)
    navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const enrichmentData = contact.enrichment_data || {}

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getDisplayName(contact.first_name, contact.last_name)}
      size="lg"
    >
      <div className="space-y-6">
        {/* Contact Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-slate-400 text-sm">Email</p>
            <p className="text-white font-medium">{contact.email}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Company</p>
            <p className="text-white font-medium">{contact.company || '-'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Title</p>
            <p className="text-white font-medium">{contact.title || '-'}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Status</p>
            <Badge
              variant={
                contact.enrichment_status === 'completed'
                  ? 'success'
                  : contact.enrichment_status === 'processing'
                  ? 'warning'
                  : 'default'
              }
              size="sm"
            >
              {contact.enrichment_status}
            </Badge>
          </div>
        </div>

        {/* Enrichment Actions */}
        <div className="flex gap-2">
          {contact.enrichment_status !== 'completed' && (
            <Button
              onClick={handleEnrich}
              isLoading={enriching === contact.id}
              disabled={enriching === contact.id}
            >
              {contact.enrichment_status === 'processing' ? 'Enriching...' : 'Enrich Contact'}
            </Button>
          )}
        </div>

        {error && (
          <Card variant="default" className="bg-error/10 border-error/30">
            <p className="text-error text-sm">{error}</p>
          </Card>
        )}

        {/* Enrichment Data Tabs */}
        {contact.enrichment_status === 'completed' && (
          <div className="space-y-4">
            <div className="flex gap-2 border-b border-slate-800">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activeTab === 'profile'
                    ? 'text-primary-400 border-b-primary-400'
                    : 'text-slate-400 border-b-transparent hover:text-slate-300'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activeTab === 'raw'
                    ? 'text-primary-400 border-b-primary-400'
                    : 'text-slate-400 border-b-transparent hover:text-slate-300'
                }`}
              >
                Raw Data
              </button>
            </div>

            {activeTab === 'profile' && (
              <div className="space-y-4">
                {enrichmentData.summary && (
                  <Card>
                    <p className="text-slate-400 text-sm mb-2">Summary</p>
                    <p className="text-white">{enrichmentData.summary}</p>
                  </Card>
                )}

                {enrichmentData.opening_line && (
                  <Card>
                    <p className="text-slate-400 text-sm mb-2">Opening Line</p>
                    <p className="text-white">{enrichmentData.opening_line}</p>
                  </Card>
                )}

                {enrichmentData.talking_points && enrichmentData.talking_points.length > 0 && (
                  <Card>
                    <p className="text-slate-400 text-sm mb-3">Talking Points</p>
                    <ul className="space-y-2">
                      {enrichmentData.talking_points.map((point, idx) => (
                        <li key={idx} className="flex gap-2 text-white text-sm">
                          <span className="text-primary-400 font-bold">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}

                {enrichmentData.bant && (
                  <Card>
                    <p className="text-slate-400 text-sm mb-3">BANT Qualification</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(enrichmentData.bant).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <p className="text-slate-400">{key.toUpperCase()}</p>
                          <p className="text-white font-medium">{value || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'raw' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-slate-400 text-sm">Raw Enrichment Data</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyJson}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy JSON
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-slate-800 p-4 rounded-lg text-slate-300 text-xs overflow-auto max-h-96">
                  {JSON.stringify(enrichmentData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Created Date */}
        <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          Created {formatDate(contact.created_at)}
          {contact.enriched_at && ` • Enriched ${formatDate(contact.enriched_at)}`}
        </div>
      </div>
    </Modal>
  )
}