// src/components/ContactDetailModal.tsx
// Full contact detail view with scores, enrichment, tabs

import React, { useState, useEffect } from 'react';
import { Contact, getContact, enrichContact, getEnrichmentStatus, scoreContact } from '@/services/contactService';

interface ContactDetailModalProps {
  contactId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

type TabType = 'overview' | 'enrichment' | 'bant' | 'spice' | 'icp';

export function ContactDetailModal({
  contactId,
  isOpen,
  onClose,
  onRefresh,
}: ContactDetailModalProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState<string>('');

  useEffect(() => {
    if (isOpen && contactId) {
      loadContact();
    }
  }, [isOpen, contactId]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const data = await getContact(contactId);
      setContact(data);
    } catch (error) {
      console.error('Failed to load contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = async () => {
    if (!contact) return;

    try {
      setEnriching(true);
      setEnrichmentProgress('Starting enrichment...');

      // Trigger enrichment
      const { job_id } = await enrichContact(contact.id);

      // Poll status every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const status = await getEnrichmentStatus(contact.id);

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            setEnrichmentProgress('Enrichment complete!');
            setEnriching(false);

            // Reload contact with enriched data
            await loadContact();

            // Auto-trigger scoring if enriched
            if (contact.enrichmentstatus !== 'completed') {
              await scoreContact(contact.id, 'all');
              await loadContact();
            }

            onRefresh?.();
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setEnrichmentProgress('Enrichment failed');
            setEnriching(false);
          } else {
            const stage = status.progress?.current_stage || 'processing';
            setEnrichmentProgress(`${stage}...`);
          }
        } catch (error) {
          console.error('Error polling enrichment:', error);
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to enrich:', error);
      setEnriching(false);
      setEnrichmentProgress('Error starting enrichment');
    }
  };

  if (!isOpen || loading) {
    return null;
  }

  if (!contact) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <p>Contact not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-teal-500 to-teal-600 text-white p-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">
              {contact.firstname} {contact.lastname}
            </h2>
            <p className="text-teal-100">{contact.title} at {contact.company}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:text-teal-100"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b bg-gray-50 px-6 py-4 sticky top-[80px] z-40">
          {(['overview', 'enrichment', 'bant', 'spice', 'icp'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium rounded-t ${
                activeTab === tab
                  ? 'bg-teal-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'enrichment' && 'Enrichment'}
              {tab === 'bant' && 'BANT'}
              {tab === 'spice' && 'SPICE'}
              {tab === 'icp' && 'ICP Match'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab contact={contact} onEnrich={handleEnrich} enriching={enriching} />
          )}

          {activeTab === 'enrichment' && (
            <EnrichmentTab
              contact={contact}
              enriching={enriching}
              progress={enrichmentProgress}
              onEnrich={handleEnrich}
            />
          )}

          {activeTab === 'bant' && <BANTTab contact={contact} />}

          {activeTab === 'spice' && <SPICETab contact={contact} />}

          {activeTab === 'icp' && <ICPTab contact={contact} />}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TAB COMPONENTS
// ============================================================================

function OverviewTab({
  contact,
  onEnrich,
  enriching,
}: {
  contact: Contact;
  onEnrich: () => void;
  enriching: boolean;
}) {
  const tierColors = {
    hot: 'bg-red-100 text-red-800',
    warm: 'bg-yellow-100 text-yellow-800',
    cold: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      {/* Contact Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500 font-medium">Email</p>
          <p className="text-base">{contact.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">Phone</p>
          <p className="text-base">{contact.phone || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">Company</p>
          <p className="text-base">{contact.company || 'N/A'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">Industry</p>
          <p className="text-base">{contact.vertical || 'N/A'}</p>
        </div>
      </div>

      {/* Enrichment Status */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">Enrichment Status</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-3 py-1 rounded text-sm font-medium ${
                contact.enrichmentstatus === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : contact.enrichmentstatus === 'enriching'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {contact.enrichmentstatus || 'pending'}
              </span>
            </div>
          </div>
          <button
            onClick={onEnrich}
            disabled={enriching || contact.enrichmentstatus === 'enriching'}
            className="px-4 py-2 bg-teal-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-600"
          >
            {enriching ? 'Enriching...' : 'Enrich Contact'}
          </button>
        </div>
      </div>

      {/* Scores Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* MDCP */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <p className="text-xs text-purple-600 font-semibold uppercase">MDCP Score</p>
          <p className="text-3xl font-bold text-purple-900 mt-2">
            {contact.mdcpscore ? Math.round(contact.mdcpscore) : '—'}
          </p>
          {contact.matchtier && (
            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${tierColors[contact.matchtier]}`}>
              {contact.matchtier}
            </span>
          )}
        </div>

        {/* BANT */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-semibold uppercase">BANT Score</p>
          <p className="text-3xl font-bold text-blue-900 mt-2">
            {contact.bantscore ? Math.round(contact.bantscore) : '—'}
          </p>
          {contact.bantscore && (
            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
              contact.bantscore >= 80 ? tierColors.hot
              : contact.bantscore >= 60 ? tierColors.warm
              : tierColors.cold
            }`}>
              {contact.bantscore >= 80 ? 'hot' : contact.bantscore >= 60 ? 'warm' : 'cold'}
            </span>
          )}
        </div>

        {/* SPICE */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
          <p className="text-xs text-orange-600 font-semibold uppercase">SPICE Score</p>
          <p className="text-3xl font-bold text-orange-900 mt-2">
            {contact.spicescore ? Math.round(contact.spicescore) : '—'}
          </p>
          {contact.spicescore && (
            <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
              contact.spicescore >= 80 ? tierColors.hot
              : contact.spicescore >= 60 ? tierColors.warm
              : tierColors.cold
            }`}>
              {contact.spicescore >= 80 ? 'hot' : contact.spicescore >= 60 ? 'warm' : 'cold'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EnrichmentTab({
  contact,
  enriching,
  progress,
  onEnrich,
}: {
  contact: Contact;
  enriching: boolean;
  progress: string;
  onEnrich: () => void;
}) {
  const enrichmentData = contact.enrichmentdata;

  if (!enrichmentData || contact.enrichmentstatus !== 'completed') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">
          No enrichment data yet.{' '}
          {contact.enrichmentstatus === 'enriching' && 'Enrichment in progress...'}
        </p>
        {progress && <p className="text-sm text-blue-600 mb-4">{progress}</p>}
        <button
          onClick={onEnrich}
          disabled={enriching || contact.enrichmentstatus === 'enriching'}
          className="px-4 py-2 bg-teal-500 text-white rounded disabled:opacity-50 hover:bg-teal-600"
        >
          {enriching ? 'Enriching...' : 'Start Enrichment'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {enrichmentData.gpt4?.executive_summary && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
            {enrichmentData.gpt4.executive_summary}
          </p>
        </div>
      )}

      {enrichmentData.gpt4?.deal_triggers && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <h3 className="font-semibold text-red-900 mb-2">🔥 Deal Triggers</h3>
          <p className="text-red-800 text-sm whitespace-pre-line">
            {enrichmentData.gpt4.deal_triggers}
          </p>
        </div>
      )}

      {enrichmentData.gpt4?.objection_handlers && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-2">⚡ Objection Handlers</h3>
          <p className="text-yellow-800 text-sm whitespace-pre-line">
            {enrichmentData.gpt4.objection_handlers}
          </p>
        </div>
      )}

      {enrichmentData.gpt4?.connection_angles && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-900 mb-2">🤝 Connection Angles</h3>
          <p className="text-green-800 text-sm whitespace-pre-line">
            {enrichmentData.gpt4.connection_angles}
          </p>
        </div>
      )}
    </div>
  );
}

function BANTTab({ contact }: { contact: Contact }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-blue-900">BANT Score</h3>
          <span className="text-2xl font-bold text-blue-900">
            {contact.bantscore ? Math.round(contact.bantscore) : '—'}/100
          </span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${Math.min(100, contact.bantscore || 0)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: '💰 Budget', icon: '💰' },
          { label: '👤 Authority', icon: '👤' },
          { label: '📌 Need', icon: '📌' },
          { label: '⏰ Timeline', icon: '⏰' },
        ].map((item) => (
          <div key={item.label} className="bg-gray-50 p-3 rounded border border-gray-200">
            <p className="text-sm text-gray-600 font-medium">{item.label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">—</p>
            <p className="text-xs text-gray-500 mt-1">Add details from enrichment</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SPICETab({ contact }: { contact: Contact }) {
  return (
    <div className="space-y-4">
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-orange-900">SPICE Score</h3>
          <span className="text-2xl font-bold text-orange-900">
            {contact.spicescore ? Math.round(contact.spicescore) : '—'}/100
          </span>
        </div>
        <div className="w-full bg-orange-200 rounded-full h-2">
          <div
            className="bg-orange-600 h-2 rounded-full"
            style={{ width: `${Math.min(100, contact.spicescore || 0)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: '🎯 Situation', icon: '🎯' },
          { label: '⚠️ Problem', icon: '⚠️' },
          { label: '💡 Implication', icon: '💡' },
          { label: '🚨 Critical Event', icon: '🚨' },
          { label: '💵 Decision', icon: '💵' },
        ].map((item) => (
          <div key={item.label} className="bg-gray-50 p-3 rounded border border-gray-200">
            <p className="text-sm text-gray-600 font-medium">{item.label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">—</p>
            <p className="text-xs text-gray-500 mt-1">Add from enrichment</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ICPTab({ contact }: { contact: Contact }) {
  return (
    <div className="bg-teal-50 p-6 rounded-lg border border-teal-200 text-center">
      <p className="text-2xl font-bold text-teal-900">
        {contact.icpmatch ? Math.round(contact.icpmatch) : '—'}%
      </p>
      <p className="text-teal-700 mt-2">ICP Match Score</p>
      <p className="text-sm text-gray-600 mt-4">
        Based on company profile, industry, and enrichment data alignment with your ICP definition.
      </p>
    </div>
  );
}
