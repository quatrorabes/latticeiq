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

  const fullName = `${contact.first_name} ${contact.last_name}`;
  const enrichmentData = contact.enrichment_data?.synthesized;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-white">{fullName}</h2>
            {contact.title && contact.company && (
              <p className="text-gray-400 text-sm mt-1">
                {contact.title} at {contact.company}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <EnrichButton
              contactId={contact.id}
              currentStatus={contact.enrichment_status}
              onEnrichmentComplete={onEnrichComplete}
              size="md"
            />
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <InfoItem icon={Mail} label="Email" value={contact.email} />
            <InfoItem icon={Phone} label="Phone" value={contact.phone} />
            <InfoItem icon={Building2} label="Company" value={contact.company} />
            <InfoItem icon={Briefcase} label="Title" value={contact.title} />
            <InfoItem icon={Linkedin} label="LinkedIn" value={contact.linkedin_url} isLink />
            <InfoItem icon={Globe} label="Website" value={contact.website} isLink />
            <InfoItem icon={Target} label="Vertical" value={contact.vertical} />
            <InfoItem icon={TrendingUp} label="Persona" value={contact.persona_type} />
          </div>

          {(contact.apex_score != null || contact.mdc_score != null || contact.rss_score != null) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Scores</h3>
              <div className="flex gap-4">
                {contact.apex_score != null && (
                  <ScoreBadge label="APEX" score={contact.apex_score} color="purple" />
                )}
                {contact.mdc_score != null && (
                  <ScoreBadge label="MDC" score={contact.mdc_score} color="blue" />
                )}
                {contact.rss_score != null && (
                  <ScoreBadge label="RSS" score={contact.rss_score} color="green" />
                )}
              </div>
            </div>
          )}

          {(contact.bant_budget_confirmed != null || contact.bant_authority_level || contact.bant_need || contact.bant_timeline) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">BANT Qualification</h3>
              <div className="grid grid-cols-2 gap-3">
                <BantItem
                  label="Budget"
                  value={contact.bant_budget_confirmed ? "Confirmed" : "Not confirmed"}
                  confirmed={contact.bant_budget_confirmed ?? false}
                />
                <BantItem label="Authority" value={contact.bant_authority_level} />
                <BantItem label="Need" value={contact.bant_need} />
                <BantItem label="Timeline" value={contact.bant_timeline} />
              </div>
            </div>
          )}

          {enrichmentData && (
            <div className="space-y-6">
              {enrichmentData.summary && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Summary</h3>
                  <p className="text-gray-300 text-sm leading-relaxed bg-gray-800/50 rounded-lg p-4">
                    {enrichmentData.summary}
                  </p>
                </div>
              )}

              {enrichmentData.hooks && enrichmentData.hooks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Opening Hooks</h3>
                  <ul className="space-y-2">
                    {enrichmentData.hooks.map((hook, idx) => (
                      <li key={idx} className="text-gray-300 text-sm bg-gray-800/50 rounded-lg p-3 border-l-2 border-purple-500">
                        &quot;{hook}&quot;
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {enrichmentData.talking_points && enrichmentData.talking_points.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Talking Points</h3>
                  <ul className="space-y-2">
                    {enrichmentData.talking_points.map((point, idx) => (
                      <li key={idx} className="text-gray-300 text-sm flex items-start gap-2">
                        <span className="text-purple-400 mt-1">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {enrichmentData.objections && enrichmentData.objections.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Common Objections</h3>
                  <div className="space-y-3">
                    {enrichmentData.objections.map((obj, idx) => (
                      <div key={idx} className="bg-gray-800/50 rounded-lg p-4">
                        <p className="text-red-400 text-sm font-medium mb-1">&quot;{obj.objection}&quot;</p>
                        <p className="text-green-400 text-sm">→ {obj.response}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!enrichmentData && contact.enrichment_status !== "completed" && (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-4">
                No enrichment data yet. Click Enrich to gather AI-powered insights.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500">
            Status: <span className="capitalize">{contact.enrichment_status}</span>
            {contact.enriched_at && (
              <span> · Enriched {new Date(contact.enriched_at).toLocaleDateString()}</span>
            )}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
  isLink = false,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  isLink?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="text-gray-500 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        {isLink ? (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-400 hover:text-purple-300 truncate block max-w-[200px]"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm text-gray-300 truncate max-w-[200px]">{value}</p>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: "purple" | "blue" | "green";
}) {
  const colorClasses: Record<string, string> = {
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <div className={`px-4 py-2 rounded-lg border text-center ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{score}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}

function BantItem({
  label,
  value,
  confirmed,
}: {
  label: string;
  value?: string | null;
  confirmed?: boolean;
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-sm ${confirmed ? "text-green-400" : "text-gray-300"}`}>
        {value || "—"}
      </p>
    </div>
  );
}
