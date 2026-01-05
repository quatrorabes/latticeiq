// frontend/src/api/enrichment.ts

import { UnifiedEnrichmentResult } from "../types/enrichment";

const API_URL = import.meta.env.VITE_API_URL;

export async function deepEnrichContact(contactId: string, token: string) {
  const resp = await fetch(
    `${API_URL}/api/v3/enrichment/deep-enrich/${contactId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!resp.ok) {
    throw new Error(`Deep enrich failed: ${resp.status}`);
  }
  return await resp.json();
}

export async function getEnrichmentResult(
  contactId: string,
  token: string
): Promise<UnifiedEnrichmentResult> {
  const resp = await fetch(
    `${API_URL}/api/v3/enrichment/deep-enrich/${contactId}/result`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!resp.ok) {
    throw new Error(`Fetch enrichment result failed: ${resp.status}`);
  }
  return await resp.json();
}

// Quick enrichment (single contact)
export async function enrichContact(contactId: string) {
  const API_URL = import.meta.env.VITE_API_URL;
  const response = await fetch(
    `${API_URL}/api/v3/enrichment/quick-enrich/${contactId}`,
    { method: 'POST' }
  );
  if (!response.ok) {
    throw new Error(`Quick enrich failed: ${response.status}`);
  }
  return response.json();
}

// Batch enrichment (multiple contacts)
export async function enrichContacts(contactIds: string[]) {
  const results = await Promise.all(
    contactIds.map(id => enrichContact(id))
  );
  return results;
}
