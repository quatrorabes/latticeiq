// frontend/src/components/ContactDetailModal.tsx
import { X, Mail, Phone, Building2, Briefcase, Linkedin, Globe, Target, TrendingUp } from "lucide-react";
import type { Contact } from "../types/contact";
import EnrichButton from "./EnrichButton";

interface ContactDetailModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete?: () => void;
}

export default function ContactDetailModal({
  contact,
  isOpen,
  onClose,
  onEnrichComplete,
}: ContactDetailModalProps) {
  if (!isOpen || !contact) return null;

  const fullName = `${contact.firstname || contact.first_name || ""} ${contact.lastname || contact.last_name || ""}`.trim();
  
  // Support both V3 (synthesized) and quick_enrich data structures
  const enrichmentData = contact.enrichment_data?.synthesized || contact.enrichment_data?.quick_enrich;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 transition-opacity" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-gray-900 rounded-xl shadow-2xl border border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-white">{fullName || "Unknown Contact"}</h2>
              {(contact.title || contact.company) && (
                <p className="text-gray-400 text-sm mt-1">
                  {contact.title}{contact.title && contact.company && " at "}{contact.company}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Contact Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon={<Mail className="w-4 h-4" />} label="Email" value={contact.email} isLink />
              <InfoItem icon={<Phone className="w-4 h-4" />} label="Phone" value={contact.phone} />
              <InfoItem icon={<Building2 className="w-4 h-4" />} label="Company" value={contact.company} />
              <InfoItem icon={<Briefcase className="w-4 h-4" />} label="Title" value={contact.title} />
              <InfoItem icon={<Linkedin className="w-4 h-4" />} label="LinkedIn" value={contact.linkedin_url} isLink />
              <InfoItem icon={<Globe className="w-4 h-4" />} label="Website" value={contact.website} isLink />
            </div>

            {/* Scores */}
            {(contact.apex_score || contact.enrichment_status === "completed") && (
              <div className="flex gap-4">
                {contact.apex_score && (
                  <ScoreBadge label="APEX" score={contact.apex_score} color="indigo" />
                )}
                {contact.mdc_score && (
                  <ScoreBadge label="MDC" score={contact.mdc_score} color="emerald" />
                )}
                {contact.rss_score && (
                  <ScoreBadge label="RSS" score={contact.rss_score} color="amber" />
                )}
              </div>
            )}

            {/* Enrichment Data */}
            {enrichmentData ? (
              <div className="space-y-4">
                {/* Summary */}
                {enrichmentData.summary && (
                  <Section title="Summary" icon={<Target className="w-4 h-4" />}>
                    <p className="text-gray-300">{enrichmentData.summary}</p>
                  </Section>
                )}

                {/* Opening Line */}
                {enrichmentData.opening_line && (
                  <Section title="Opening Line" icon={<TrendingUp className="w-4 h-4" />}>
                    <p className="text-gray-300 italic">"{enrichmentData.opening_line}"</p>
                  </Section>
                )}

                {/* Talking Points */}
                {enrichmentData.talking_points && enrichmentData.talking_points.length > 0 && (
                  <Section title="Talking Points">
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                      {enrichmentData.talking_points.map((point: string, i: number) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Objections (V3 format) */}
                {enrichmentData.objections && enrichmentData.objections.length > 0 && (
                  <Section title="Objection Handlers">
                    <div className="space-y-3">
                      {enrichmentData.objections.map((obj: { objection: string; response: string }, i: number) => (
                        <div key={i} className="bg-gray-800 rounded-lg p-3">
                          <p className="text-red-400 text-sm">"{obj.objection}"</p>
                          <p className="text-green-400 text-sm mt-1">→ {obj.response}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Persona & Vertical (quick_enrich) */}
                {(enrichmentData.persona_type || enrichmentData.vertical) && (
                  <div className="flex gap-4">
                    {enrichmentData.persona_type && (
                      <span className="px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-sm">
                        {enrichmentData.persona_type}
                      </span>
                    )}
                    {enrichmentData.vertical && (
                      <span className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm">
                        {enrichmentData.vertical}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <p className="text-gray-400 mb-4">
                  No enrichment data yet. Click Enrich to gather AI-powered insights.
                </p>
              </div>
            )}

            {/* Status Footer */}
            <div className="text-sm text-gray-500 border-t border-gray-700 pt-4">
              Status: <span className="text-gray-300">{contact.enrichment_status || "pending"}</span>
              {contact.enriched_at && (
                <span> · Enriched {new Date(contact.enriched_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 p-6 border-t border-gray-700">
            <EnrichButton
              contactId={contact.id}
              onComplete={onEnrichComplete}
              variant="modal"
            />
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function InfoItem({ icon, label, value, isLink }: { icon: React.ReactNode; label: string; value?: string | null; isLink?: boolean }) {
  if (!value) return null;
  
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        {isLink ? (
          <a href={value.startsWith("http") ? value : `mailto:${value}`} className="text-indigo-400 hover:underline text-sm" target="_blank" rel="noopener noreferrer">
            {value}
          </a>
        ) : (
          <p className="text-gray-300 text-sm">{value}</p>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ label, score, color }: { label: string; score: number; color: string }) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-900/50 text-indigo-300",
    emerald: "bg-emerald-900/50 text-emerald-300",
    amber: "bg-amber-900/50 text-amber-300",
  };
  
  return (
    <div className={`px-3 py-2 rounded-lg ${colorClasses[color] || colorClasses.indigo}`}>
      <p className="text-2xl font-bold">{score}</p>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}
