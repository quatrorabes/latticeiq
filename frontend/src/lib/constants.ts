export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const API_ENDPOINTS = {
  // Auth
  AUTH_USER: '/auth/user',
  
  // Contacts
  CONTACTS_LIST: '/api/v3/contacts',
  CONTACTS_GET: (id: string) => `/api/v3/contacts/${id}`,
  CONTACTS_CREATE: '/api/v3/contacts',
  CONTACTS_UPDATE: (id: string) => `/api/v3/contacts/${id}`,
  CONTACTS_DELETE: (id: string) => `/api/v3/contacts/${id}`,
  
  // Enrichment
  ENRICH: (id: string) => `/api/v3/enrich/${id}`,
  ENRICH_STATUS: (id: string) => `/api/v3/enrich/${id}/status`,
  ENRICH_DATA: (id: string) => `/api/v3/enrich/${id}/data`,
  
  // Scoring
  SCORE_MDCP: '/api/v3/scoring/mdcp',
  SCORE_BANT: '/api/v3/scoring/bant',
  SCORE_SPICE: '/api/v3/scoring/spice',
  
  // CRM Import
  CRM_IMPORT: (type: string) => `/api/v3/crm/import/${type}`,
  CRM_IMPORT_STATUS: (jobId: string) => `/api/v3/crm/import/status/${jobId}`,
  CRM_SETTINGS: '/api/v3/settings/crm',
  
  // Health
  HEALTH: '/health',
}

export const FRAMEWORKS = {
  MDCP: {
    name: 'MDCP',
    full_name: 'Money, Decision-maker, Champion, Process',
    description: 'Enterprise sales qualification framework',
    hot_threshold: 80,
    warm_threshold: 60,
  },
  BANT: {
    name: 'BANT',
    full_name: 'Budget, Authority, Need, Timeline',
    description: 'Mid-market sales qualification framework',
    hot_threshold: 80,
    warm_threshold: 60,
  },
  SPICE: {
    name: 'SPICE',
    full_name: 'Situation, Problem, Implication, Consequence, Economics',
    description: 'Consultative sales qualification framework',
    hot_threshold: 85,
    warm_threshold: 65,
  },
}

export const ENRICHMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export const CRM_TYPES = ['hubspot', 'salesforce', 'pipedrive'] as const

export const TOAST_DURATION = 3000

export const PAGINATION = {
  PAGE_SIZE: 25,
  MAX_PAGES: 100,
}