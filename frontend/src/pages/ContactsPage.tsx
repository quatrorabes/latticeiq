
import { useState, useEffect } from 'react'
import { Contact } from '@typings/index'
import { useContacts } from '@hooks/useContacts'
import { useEnrichment } from '@hooks/useEnrichment'
import { apiCall } from '@services/api'
import { API_ENDPOINTS } from '@lib/constants'
import ContactsTable from '@components/ContactsTable'
import ContactDetailModal from '@components/ContactDetailModal'
import Card from '@components/Card'
import Button from '@components/Button'
import Toast from '@components/Toast'
import { Plus } from 'lucide-react'

export default function ContactsPage() {
  const { contacts, loading, error: contactsError, fetchContacts } = useContacts()
  const { enrich, enriching, error: enrichError } = useEnrichment()
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact)
    setIsModalOpen(true)
  }

  const handleEnrich = async (contact: Contact) => {
    setEnrichingIds(prev => new Set([...prev, contact.id]))
    try {
      const enrichedContact = await enrich(contact.id)
      // Update contact in list
      await fetchContacts()
      setToast({
        type: 'success',
        message: 'Contact enriched successfully!',
      })
      // Update modal if it's open
      if (selectedContact?.id === contact.id) {
        setSelectedContact(enrichedContact)
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to enrich contact',
      })
    } finally {
      setEnrichingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(contact.id)
        return newSet
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiCall<void>(API_ENDPOINTS.CONTACTS_DELETE(id), {
        method: 'DELETE',
      })
      await fetchContacts()
      setToast({
        type: 'success',
        message: 'Contact deleted',
      })
      if (selectedContact?.id === id) {
        setIsModalOpen(false)
      }
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to delete contact',
      })
    }
  }

  const handleEnrichComplete = async () => {
    await fetchContacts()
    setToast({
      type: 'success',
      message: 'Contact enriched!',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Contacts</h1>
          <p className="text-slate-400">Manage and enrich your sales contacts</p>
        </div>
        <Button>
          <Plus className="w-5 h-5" />
          Add Contact
        </Button>
      </div>

      {contactsError && (
        <Card variant="default" className="bg-error/10 border-error/30">
          <p className="text-error">{contactsError}</p>
        </Card>
      )}

      <ContactsTable
        contacts={contacts}
        loading={loading}
        onSelectContact={handleSelectContact}
        onEnrich={handleEnrich}
        onDelete={handleDelete}
        enrichingIds={enrichingIds}
      />

      <ContactDetailModal
        contact={selectedContact}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEnrichComplete={handleEnrichComplete}
      />

      {(toast || enrichError) && (
        <Toast
          message={toast?.message || enrichError || ''}
          type={toast?.type || 'error'}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}