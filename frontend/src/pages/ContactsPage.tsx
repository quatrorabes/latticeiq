// src/pages/ContactsPage.tsx (Enhanced)
// Table with scores, enrichment status, bulk actions

import React, { useState, useEffect } from 'react';
import { Contact, getContacts, scoreAllContacts, bulkEnrich } from '@/services/contactService';
import { ContactDetailModal } from '@/components/ContactDetailModal';
import { AddContactModal } from '@/components/AddContactModal';

export function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkAction, setBulkAction] = useState<'enrich' | 'score' | null>(null);

  useEffect(() => {
    loadContacts();
  }, [page]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await getContacts(limit, page * limit);
      setContacts(response.contacts);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEnrich = async () => {
    const ids = Array.from(selectedRows);
    if (ids.length === 0) return;

    try {
      setBulkLoading(true);
      setBulkAction('enrich');
      await bulkEnrich(ids);
      
      // Poll and refresh
      await new Promise(resolve => setTimeout(resolve, 3000));
      await loadContacts();
      setSelectedRows(new Set());
    } catch (error) {
      console.error('Failed to bulk enrich:', error);
    } finally {
      setBulkLoading(false);
      setBulkAction(null);
    }
  };

  const handleBulkScore = async () => {
    const ids = Array.from(selectedRows);
    if (ids.length === 0) return;

    try {
      setBulkLoading(true);
      setBulkAction('score');
      
      // Score each contact
      for (const id of ids) {
        // TODO: Add bulk scoring endpoint to backend
        // For now, just refresh
      }
      
      await loadContacts();
      setSelectedRows(new Set());
    } catch (error) {
      console.error('Failed to bulk score:', error);
    } finally {
      setBulkLoading(false);
      setBulkAction(null);
    }
  };

  const toggleRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === contacts.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(contacts.map(c => c.id)));
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'hot':
        return 'bg-red-100 text-red-800';
      case 'warm':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEnrichmentColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'enriching':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 font-medium"
        >
          + Add Contact
        </button>
      </div>

      {/* Bulk Actions */}
      {selectedRows.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
          <p className="text-blue-900 font-medium">
            {selectedRows.size} contact{selectedRows.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBulkEnrich}
              disabled={bulkLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 hover:bg-blue-600"
            >
              {bulkLoading && bulkAction === 'enrich' ? 'Enriching...' : 'Enrich Selected'}
            </button>
            <button
              onClick={handleBulkScore}
              disabled={bulkLoading}
              className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50 hover:bg-purple-600"
            >
              {bulkLoading && bulkAction === 'score' ? 'Scoring...' : 'Score Selected'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No contacts yet. Add one to get started.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === contacts.length && contacts.length > 0}
                    onChange={toggleAllRows}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Company</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">MDCP</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">BANT</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">SPICE</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Enrichment</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(contact.id)}
                      onChange={() => toggleRow(contact.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {contact.firstname} {contact.lastname}
                    </p>
                    <p className="text-sm text-gray-500">{contact.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{contact.company || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{contact.title || '—'}</td>
                  <td className="px-6 py-4">
                    {contact.mdcpscore ? (
                      <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${getTierColor(contact.matchtier)}`}>
                        {Math.round(contact.mdcpscore)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {contact.bantscore ? (
                      <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${getTierColor(
                        contact.bantscore >= 80 ? 'hot' : contact.bantscore >= 60 ? 'warm' : undefined
                      )}`}>
                        {Math.round(contact.bantscore)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {contact.spicescore ? (
                      <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${getTierColor(
                        contact.spicescore >= 80 ? 'hot' : contact.spicescore >= 60 ? 'warm' : undefined
                      )}`}>
                        {Math.round(contact.spicescore)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getEnrichmentColor(contact.enrichmentstatus)}`}>
                      {contact.enrichmentstatus || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => {
                        setSelectedContact(contact.id);
                        setShowDetail(true);
                      }}
                      className="text-teal-600 hover:text-teal-700 font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t">
            <p className="text-sm text-gray-600">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total} contacts
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * limit >= total}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddContactModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setShowAddModal(false);
          loadContacts();
        }}
      />

      {selectedContact && (
        <ContactDetailModal
          contactId={selectedContact}
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
          onRefresh={loadContacts}
        />
      )}
    </div>
  );
}
