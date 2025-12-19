// frontend/src/components/ContactDetailModal.tsx
/**
 * Contact Detail Modal
 * Shows full contact info with enrichment data and enrich button
 */

import { X, Mail, Phone, Building2, Briefcase, Linkedin, Globe, Target, TrendingUp } from "lucide-react";
import { Contact } from "../types/contact";
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
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

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Contact Info */}
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

          {/* Scores */}
          {(contact.apex_score !== null || contact.mdc_score !== null || contact.rss_score !== null) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Scores</h3>
              <div className="flex gap-4">
                {contact.apex_score !== null && (
                  <ScoreBadge label="APEX" score={contact.apex_score} color="purple" />
                )}
                {contact.mdc_score !== null && (
                  <ScoreBadge label="MDC" score={contact.mdc_score} color="blue" />
                )}
                {contact.rss_score !== null && (
                  <ScoreBadge label="RSS" score={contact.rss_score} color="green" />
                )}
              </div>
            </div>
          )}

          {/* BANT Qualification */}
          {(contact.bant_budget_confirmed !== null || contact.bant_authority_level || contact.bant_need || contact.bant_timeline) && (
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

          {/* Enrichment Data */}
          {enrichmentData && (
            <div className="space-y-6">
              {/* Summary */}
              {enrichmentData.summary && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Summary</h3>
                  <p className="text-gray-300 text-sm leading-relaxed bg-gray-800/50 rounded-lg p-4">
                    {enrichmentData.summary}
                  </p>
                </div>
              )}

              {/* Hooks */}
              {enrichmentData.hooks && enrich
