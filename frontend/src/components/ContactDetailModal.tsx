// Contact Detail Modal with Enrichment Display
import { Fragment } from 'react';
import { Contact } from '../types/contact';
import { EnrichButton } from './EnrichButton';
import { 
  X, 
  Mail, 
  Phone, 
  Building2, 
  Briefcase, 
  Linkedin, 
  Globe,
  Target,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  User,
  FileText
} from 'lucide-react';

interface ContactDetailModalProps {
  contact: Contact;
  onClose: () => void;
  onEnrichComplete?: () => void;
}

export function ContactDetailModal({ contact, onClose, onEnrichComplete }: ContactDetailModalProps) {
  const enrichment = contact.enrichment_data;
  const isEnriched = contact.enrichment_status === 'completed' && enrichment;

  const ScoreCard = ({ label, score, color }: { label: string; score?: number; color: string }) => (
    <div className={`p-3 rounded-lg ${color}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold">{score ?? '—'}</p>
    </div>
  );

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="mb-6">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
        <Icon className="w-4 h-4" />
        {title}
      </h4>
      <div className="text-gray-600 text-sm leading-relaxed">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {contact.firstname} {contact.lastname}
              </h2>
              <p className="text-gray-500">{contact.title} at {contact.company}</p>
            </div>
            <div className="flex items-center gap-3">
              <EnrichButton
                contactId={contact.id}
                enrichmentStatus={contact.enrichment_status || undefined}
                onEnrichComplete={onEnrichComplete}
                variant="button"
              />
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            {/* Contact Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <div className="truncate">
                  <p className="text-xs text-gray-500">Email</p>
                  <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline truncate block">
                    {contact.email}
                  </a>
                </div>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <a href={`tel:${contact.phone}`} className="text-sm text-blue-600 hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}
              {contact.linkedin_url && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Linkedin className="w-5 h-5 text-gray-400" />
                  <div className="truncate">
                    <p className="text-xs text-gray-500">LinkedIn</p>
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                      Profile
                    </a>
                  </div>
                </div>
              )}
              {contact.website && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div className="truncate">
                    <p className="text-xs text-gray-500">Website</p>
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate block">
                      {new URL(contact.website).hostname}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Scores */}
            {isEnriched && (
              <div className="grid grid-cols-5 gap-3 mb-8">
                <ScoreCard label="APEX" score={contact.apex_score} color="bg-purple-100 text-purple-800" />
                <ScoreCard label="MDCP" score={contact.mdcp_score} color="bg-blue-100 text-blue-800" />
                <ScoreCard label="RSS" score={contact.rss_score} color="bg-green-100 text-green-800" />
                <ScoreCard label="BANT" score={contact.bant_score} color="bg-yellow-100 text-yellow-800" />
                <ScoreCard label="SPICE" score={contact.spice_score} color="bg-orange-100 text-orange-800" />
              </div>
            )}

            {/* Enrichment Data */}
            {isEnriched ? (
              <div className="space-y-6">
                {/* Executive Summary */}
                {enrichment.executive_summary && (
                  <Section title="Executive Summary" icon={FileText}>
                    <p className="whitespace-pre-wrap">{enrichment.executive_summary}</p>
                  </Section>
                )}

                {/* Role & Responsibilities */}
                {enrichment.role_responsibilities && (
                  <Section title="Role & Responsibilities" icon={Briefcase}>
                    <p className="whitespace-pre-wrap">{enrichment.role_responsibilities}</p>
                  </Section>
                )}

                {/* Company Intelligence */}
                {enrichment.company_intelligence && (
                  <Section title="Company Intelligence" icon={Building2}>
                    <p className="whitespace-pre-wrap">{enrichment.company_intelligence}</p>
                  </Section>
                )}

                {/* Deal Triggers */}
                {enrichment.deal_triggers && enrichment.deal_triggers.length > 0 && (
                  <Section title="Deal Triggers" icon={Target}>
                    <ul className="list-disc list-inside space-y-1">
                      {enrichment.deal_triggers.map((trigger, i) => (
                        <li key={i}>{trigger}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Objection Handlers */}
                {enrichment.objection_handlers && enrichment.objection_handlers.length > 0 && (
                  <Section title="Objection Handlers" icon={AlertTriangle}>
                    <ul className="list-disc list-inside space-y-1">
                      {enrichment.objection_handlers.map((handler, i) => (
                        <li key={i}>{handler}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Connection Angles */}
                {enrichment.connection_angles && enrichment.connection_angles.length > 0 && (
                  <Section title="Connection Angles" icon={Lightbulb}>
                    <ul className="list-disc list-inside space-y-1">
                      {enrichment.connection_angles.map((angle, i) => (
                        <li key={i}>{angle}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Enriched At */}
                {contact.enriched_at && (
                  <p className="text-xs text-gray-400 mt-6">
                    Last enriched: {new Date(contact.enriched_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Enrichment Data Yet</h3>
                <p className="text-gray-500 mb-6">
                  Click "Enrich" to gather sales intelligence from 5 parallel AI queries
                </p>
                <EnrichButton
                  contactId={contact.id}
                  enrichmentStatus={contact.enrichment_status || undefined}
                  onEnrichComplete={onEnrichComplete}
                  variant="button"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
