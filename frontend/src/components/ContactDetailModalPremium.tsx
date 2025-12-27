// frontend/src/components/ContactDetailModalPremium.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import type { Contact } from '../types/contact';

interface ContactNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactActivity {
  id: string;
  type: 'enrichment' | 'call' | 'email' | 'note' | 'update';
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ContactCustomField {
  id: string;
  name: string;
  value: any;
  type: 'text' | 'number' | 'date' | 'select';
}

interface ContactDetailModalPremiumProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrichComplete?: () => void;
  onContactUpdate?: (updatedContact: Contact) => void;
}

export const ContactDetailModalPremium: React.FC<ContactDetailModalPremiumProps> = ({
  contact,
  isOpen,
  onClose,
  onEnrichComplete,
  onContactUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'enrichment' | 'bant' | 'spice' | 'notes' | 'activity' | 'custom'>('overview');
  const [isEnriching, setIsEnriching] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [updatedContact, setUpdatedContact] = useState<Contact | null>(contact);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [activity, setActivity] = useState<ContactActivity[]>([]);
  const [customFields, setCustomFields] = useState<ContactCustomField[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Contact>>({});
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUpdatedContact(contact);
    if (contact) {
      loadNotes(contact.id);
      loadActivity(contact.id);
      loadCustomFields(contact.id);
      setEditFormData(contact);
    }
  }, [contact]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotes = (contactId: string) => {
    const stored = localStorage.getItem(`contact_notes_${contactId}`);
    setNotes(stored ? JSON.parse(stored) : []);
  };

  const saveNotes = (contactId: string, notesData: ContactNote[]) => {
    localStorage.setItem(`contact_notes_${contactId}`, JSON.stringify(notesData));
    setNotes(notesData);
  };

  const addNote = () => {
    if (!newNote.trim() || !contact) return;
    const note: ContactNote = {
      id: Date.now().toString(),
      text: newNote,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...notes, note];
    saveNotes(contact.id, updated);
    addActivityLog('note', `Note added: "${newNote.substring(0, 50)}..."`);
    setNewNote('');
  };

  const loadActivity = (contactId: string) => {
    const stored = localStorage.getItem(`contact_activity_${contactId}`);
    setActivity(stored ? JSON.parse(stored) : []);
  };

  const addActivityLog = (type: ContactActivity['type'], description: string, metadata?: Record<string, any>) => {
    if (!contact) return;
    const log: ContactActivity = {
      id: Date.now().toString(),
      type,
      description,
      timestamp: new Date().toISOString(),
      metadata,
    };
    const updated = [log, ...activity];
    localStorage.setItem(`contact_activity_${contact.id}`, JSON.stringify(updated));
    setActivity(updated);
  };

  const loadCustomFields = (contactId: string) => {
    const stored = localStorage.getItem(`contact_custom_${contactId}`);
    setCustomFields(stored ? JSON.parse(stored) : []);
  };

  const updateCustomField = (fieldId: string, value: any) => {
    let updated = customFields.map(f => f.id === fieldId ? { ...f, value } : f);
    if (!updated.find(f => f.id === fieldId)) {
      updated = [...customFields, { id: fieldId, name: fieldId, value, type: 'text' }];
    }
    localStorage.setItem(`contact_custom_${contact?.id}`, JSON.stringify(updated));
    setCustomFields(updated);
  };

  const handleEnrich = async () => {
    setIsEnriching(true);
    setEnrichmentError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // In handleEnrich function around line 180
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v3/enrichment/enrich/${contact?.id}`,  // ✅ v3 endpoint
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            first_name: contact?.first_name,
            last_name: contact?.last_name,
            email: contact?.email,
            company: contact?.company,
            job_title: contact?.job_title,
          }),
        }
      );

      if (!response.ok) throw new Error(`Enrichment failed: ${response.statusText}`);

      const enrichedData = await response.json();
      const updated = {
        ...updatedContact,
        enrichment_status: 'completed',
        enrichment_data: enrichedData.result,
        apex_score: enrichedData.result?.apex_score || updatedContact?.apex_score,
      } as Contact;

      setUpdatedContact(updated);
      addActivityLog('enrichment', 'Contact enriched successfully', enrichedData.result);
      onEnrichComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Enrichment failed';
      setEnrichmentError(message);
      console.error('Enrichment error:', error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleEditSave = async () => {
    if (!updatedContact) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v2/contacts/${contact?.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editFormData),
        }
      );

      if (!response.ok) throw new Error('Failed to update contact');

      const saved = { ...updatedContact, ...editFormData };
      setUpdatedContact(saved);
      setEditFormData(saved);
      setIsEditMode(false);
      addActivityLog('update', 'Contact information updated');
      onContactUpdate?.(saved);
    } catch (error) {
      console.error('Save error:', error);
      setEnrichmentError(error instanceof Error ? error.message : 'Save failed');
    }
  };

  const exportToPDF = () => {
    if (!updatedContact) return;
    const doc = `
CONTACT PROFILE REPORT
${new Date().toLocaleDateString()}

NAME: ${updatedContact.first_name} ${updatedContact.last_name}
EMAIL: ${updatedContact.email}
PHONE: ${updatedContact.phone || 'N/A'}
COMPANY: ${updatedContact.company || 'N/A'}
JOB TITLE: ${updatedContact.job_title || 'N/A'}

SCORES:
- APEX: ${updatedContact.apex_score || 'N/A'}
- MDC: ${updatedContact.mdc_score || 'N/A'}
- RSS: ${updatedContact.rss_score || 'N/A'}

STATUS: ${updatedContact.enrichment_status}
LAST ENRICHED: ${updatedContact.enriched_at || 'Never'}

ENRICHMENT DATA:
${(updatedContact.enrichment_data as any)?.summary || 'No enrichment data'}

NOTES:
${notes.map(n => `- ${n.text}`).join('\n')}
    `.trim();

    const blob = new Blob([doc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${updatedContact.first_name}_${updatedContact.last_name}_profile.txt`;
    a.click();
    setShowExportMenu(false);
  };

  const exportToJSON = () => {
    if (!updatedContact) return;
    const data = {
      contact: updatedContact,
      notes,
      activity,
      customFields,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${updatedContact.first_name}_${updatedContact.last_name}_profile.json`;
    a.click();
    setShowExportMenu(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return 'text-gray-500';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getActivityIcon = (type: ContactActivity['type']) => {
    switch (type) {
      case 'enrichment': return '🔬';
      case 'call': return '📞';
      case 'email': return '📧';
      case 'note': return '📝';
      case 'update': return '✏️';
      default: return '📌';
    }
  };

  if (!isOpen || !updatedContact) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 p-6 flex justify-between items-start shrink-0">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white">
              {updatedContact.first_name} {updatedContact.last_name}
            </h2>
            <p className="text-slate-300 mt-1">
              {updatedContact.job_title || 'No title'} {updatedContact.company && `at ${updatedContact.company}`}
            </p>
          </div>
          <div className="flex gap-3 items-start">
            {/* Export Menu */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-2 hover:bg-slate-600 rounded-lg transition-colors text-slate-300 hover:text-white"
                title="Export contact"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2m0 0v-8m0 8l-6-4m6 4l6-4" />
                </svg>
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
                  <button
                    onClick={exportToPDF}
                    className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border-b border-slate-700"
                  >
                    📄 Export as Text
                  </button>
                  <button
                    onClick={exportToJSON}
                    className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    📋 Export as JSON
                  </button>
                </div>
              )}
            </div>

            {/* Edit Button */}
            <button
              onClick={() => {
                setIsEditMode(!isEditMode);
                setEditFormData(updatedContact);
              }}
              className="p-2 hover:bg-slate-600 rounded-lg transition-colors text-slate-300 hover:text-white"
              title={isEditMode ? 'Cancel edit' : 'Edit contact'}
            >
              {isEditMode ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-600 rounded-lg transition-colors text-slate-300 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Info Bar */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Email</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-white font-mono text-sm truncate">{updatedContact.email}</p>
                <button
                  onClick={() => copyToClipboard(updatedContact.email || '')}
                  className="text-slate-400 hover:text-white text-xs"
                  title="Copy email"
                >
                  📋
                </button>
              </div>
            </div>
            {updatedContact.phone && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide">Phone</p>
                <p className="text-white text-sm mt-1">{updatedContact.phone}</p>
              </div>
            )}
            {updatedContact.linkedin_url && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide">LinkedIn</p>
                <a href={updatedContact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm mt-1">
                  View →
                </a>
              </div>
            )}
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Status</p>
              <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full mt-1 ${getStatusColor(updatedContact.enrichment_status)}`}>
                {updatedContact.enrichment_status || 'pending'}
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">APEX Score</p>
              <p className={`text-xl font-bold mt-1 ${getScoreColor(updatedContact.apex_score)}`}>
                {updatedContact.apex_score?.toFixed(0) || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {enrichmentError && (
          <div className="bg-red-900 text-red-100 px-6 py-3 border-b border-red-800 flex justify-between items-center">
            <p className="text-sm">{enrichmentError}</p>
            <button onClick={() => setEnrichmentError(null)} className="text-red-300 hover:text-red-100">
              ✕
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-slate-700 flex overflow-x-auto shrink-0">
          {['overview', 'enrichment', 'bant', 'spice', 'notes', 'activity', 'custom'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`px-4 py-3 font-medium text-sm uppercase tracking-wide transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'custom' ? '⚙️ Custom' : tab}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {isEditMode ? (
                <div className="space-y-4 bg-slate-800 p-6 rounded-lg border border-slate-700">
                  <h3 className="text-white font-semibold text-lg mb-4">Edit Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={editFormData.first_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                      className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={editFormData.last_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                      className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={editFormData.email || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="col-span-2 bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={editFormData.phone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Company"
                      value={editFormData.company || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                      className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Job Title"
                      value={editFormData.job_title || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, job_title: e.target.value })}
                      className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Vertical"
                      value={editFormData.vertical || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, vertical: e.target.value })}
                      className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Persona Type"
                      value={editFormData.persona_type || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, persona_type: e.target.value })}
                      className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={handleEditSave}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                    >
                      ✓ Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setIsEditMode(false);
                        setEditFormData(updatedContact);
                      }}
                      className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Company</p>
                    <p className="text-white text-lg">{updatedContact.company || 'Not provided'}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Job Title</p>
                    <p className="text-white text-lg">{updatedContact.job_title || 'Not provided'}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Vertical</p>
                    <p className="text-white text-lg">{updatedContact.vertical || 'Not provided'}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4">
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Persona</p>
                    <p className="text-white text-lg">{updatedContact.persona_type || 'Not provided'}</p>
                  </div>
                </div>
              )}

              {/* Scoring Cards */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-white font-semibold mb-4">Lead Scoring Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-slate-700 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase mb-2">APEX Score</p>
                    <p className={`text-4xl font-bold ${getScoreColor(updatedContact.apex_score)}`}>
                      {updatedContact.apex_score?.toFixed(0) || '—'}
                    </p>
                    <p className="text-slate-400 text-xs mt-2">Decision-making potential</p>
                  </div>
                  <div className="text-center p-4 bg-slate-700 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase mb-2">MDC Score</p>
                    <p className={`text-4xl font-bold ${getScoreColor(updatedContact.mdc_score)}`}>
                      {updatedContact.mdc_score?.toFixed(0) || '—'}
                    </p>
                    <p className="text-slate-400 text-xs mt-2">Company fit assessment</p>
                  </div>
                  <div className="text-center p-4 bg-slate-700 rounded-lg">
                    <p className="text-slate-400 text-xs uppercase mb-2">RSS Score</p>
                    <p className={`text-4xl font-bold ${getScoreColor(updatedContact.rss_score)}`}>
                      {updatedContact.rss_score?.toFixed(0) || '—'}
                    </p>
                    <p className="text-slate-400 text-xs mt-2">Strategic signals detected</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ENRICHMENT TAB */}
          {activeTab === 'enrichment' && (
            <div className="space-y-4">
              {updatedContact.enrichment_status === 'completed' && updatedContact.enrichment_data ? (
                <div className="space-y-4">
                  {(updatedContact.enrichment_data as any)?.summary && (
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-white font-semibold mb-2">Professional Summary</h3>
                      <p className="text-slate-300 text-sm leading-relaxed">{(updatedContact.enrichment_data as any).summary}</p>
                    </div>
                  )}
                  {(updatedContact.enrichment_data as any)?.openingline && (
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-white font-semibold mb-2">Recommended Opening</h3>
                      <p className="text-slate-300 text-sm italic font-medium">"{(updatedContact.enrichment_data as any).openingline}"</p>
                    </div>
                  )}
                  {(updatedContact.enrichment_data as any)?.talkingpoints && (updatedContact.enrichment_data as any).talkingpoints.length > 0 && (
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <h3 className="text-white font-semibold mb-3">Talking Points</h3>
                      <ul className="space-y-2">
                        {(updatedContact.enrichment_data as any).talkingpoints.map((point: string, idx: number) => (
                          <li key={idx} className="flex items-start text-slate-300 text-sm">
                            <span className="mr-3 text-blue-400 font-bold">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : updatedContact.enrichment_status === 'processing' ? (
                <div className="text-center py-12">
                  <div className="animate-spin mb-4 inline-block">
                    <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <p className="text-slate-300 text-lg">Enriching contact...</p>
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-800 rounded-lg border border-slate-700">
                  <p className="text-slate-400 mb-6">No enrichment data available yet</p>
                  <button
                    onClick={handleEnrich}
                    disabled={isEnriching}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                  >
                    {isEnriching ? 'Enriching...' : '🔬 Enrich This Contact'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BANT TAB */}
          {activeTab === 'bant' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {['Budget', 'Authority', 'Need', 'Timeline'].map((item) => (
                  <div key={item} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">{item}</p>
                    <input
                      type="text"
                      placeholder={`Enter ${item.toLowerCase()}`}
                      className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Overall BANT Score</p>
                <p className="text-5xl font-bold text-green-500">92/100</p>
                <p className="text-slate-400 text-sm mt-3">✓ Highly Qualified</p>
              </div>
            </div>
          )}

          {/* SPICE TAB */}
          {activeTab === 'spice' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {['Situation', 'Problem', 'Implication', 'Critical Event', 'Decision'].map((item) => (
                  <div key={item} className={item === 'Decision' ? 'col-span-2' : ''}>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <p className="text-slate-400 text-xs uppercase tracking-wide mb-3">{item}</p>
                      <textarea
                        placeholder={`Document ${item.toLowerCase()}`}
                        className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm h-20 resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-center">
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">SPICE Status</p>
                <p className="text-4xl font-bold text-yellow-500 mt-2">Advancing</p>
                <p className="text-slate-400 text-sm mt-3">78/100 Engagement Score</p>
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-semibold mb-3">Add Note</h3>
                <div className="flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note about this contact..."
                    className="flex-1 bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm h-20 resize-none"
                  />
                  <button
                    onClick={addNote}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors h-fit"
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {notes.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No notes yet</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                      <p className="text-slate-300 text-sm">{note.text}</p>
                      <p className="text-slate-500 text-xs mt-2">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No activity yet</p>
              ) : (
                activity.map((log) => (
                  <div key={log.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 flex items-start gap-3">
                    <span className="text-2xl">{getActivityIcon(log.type)}</span>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{log.description}</p>
                      <p className="text-slate-500 text-xs mt-1">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CUSTOM FIELDS TAB */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h3 className="text-white font-semibold mb-4">Custom Fields</h3>
                <div className="space-y-3">
                  {['annual_revenue', 'lead_status', 'lifecycle_stage'].map((field) => (
                    <div key={field}>
                      <label className="text-slate-400 text-xs uppercase tracking-wide block mb-1">
                        {field.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        value={customFields.find(f => f.name === field)?.value || ''}
                        onChange={(e) => updateCustomField(field, e.target.value)}
                        placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                        className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:border-blue-500 outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-800 border-t border-slate-700 px-6 py-4 flex gap-3 justify-end shrink-0">
          {updatedContact.enrichment_status !== 'processing' && !isEditMode && (
            <button
              onClick={handleEnrich}
              disabled={isEnriching}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              {isEnriching ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Enriching...
                </>
              ) : (
                <>🔬 Enrich</>
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ContactDetailModalPremium;
