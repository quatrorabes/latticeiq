export const API_URL = 'https://latticeiq-backend.onrender.com'

export const API_ENDPOINTS = {
  // Contacts
  CONTACTS_LIST: '/api/v3/contacts',
  CONTACTS_CREATE: '/api/v3/contacts',
  CONTACTS_DELETE: (id: string) => `/api/v3/contacts/${id}`,
  contacts: '/api/v3/contacts',
  contact: (id: string) => `/api/v3/contacts/${id}`,
  
  // Enrichment - POST body, not query param
  ENRICH: '/api/v3/enrichment/enrich',
  ENRICH_STATUS: (contactId: string) => `/api/v3/enrichment/${contactId}/status`,
  enrich: '/api/v3/enrichment/enrich',
  enrichStatus: (id: string) => `/api/v3/enrichment/${id}/status`,
  enrichProfile: (id: string) => `/api/v3/enrichment/${id}/profile`,
  
  // Scoring
  scoringConfig: (framework: string) => `/api/v3/scoring/config/${framework}`,
  scoreAll: '/api/v3/scoring/score-all',
  
  // CRM Import
  importHubSpot: '/api/v3/crm/import/hubspot',
  importSalesforce: '/api/v3/crm/import/salesforce',
  importPipedrive: '/api/v3/crm/import/pipedrive',
  importCSV: '/api/v3/crm/import/csv',
  importStatus: (jobId: string) => `/api/v3/crm/import/status/${jobId}`,
  
  // Settings
  settingsCRM: '/api/v3/settings/crm/integrations',
  testCRM: (crmType: string) => `/api/v3/settings/crm/integrations/${crmType}/test`,
  
  // Health
  health: '/health',
}

// Scoring Frameworks
export const FRAMEWORKS = [
  {
    id: 'mdcp',
    name: 'MDCP',
    full_name: 'Money, Decision-Maker, Champion, Process',
    description: 'Best for enterprise SaaS with long sales cycles (90+ days).',
    hot_threshold: 80,
    warm_threshold: 60,
    dimensions: ['Money', 'Decision-Maker', 'Champion', 'Process'],
  },
  {
    id: 'bant',
    name: 'BANT',
    full_name: 'Budget, Authority, Need, Timeline',
    description: 'Best for mid-market with quick sales cycles (30-60 days).',
    hot_threshold: 80,
    warm_threshold: 60,
    dimensions: ['Budget', 'Authority', 'Need', 'Timeline'],
  },
  {
    id: 'spice',
    name: 'SPICE',
    full_name: 'Situation, Problem, Implication, Consequence, Economics',
    description: 'Best for consulting and complex solutions.',
    hot_threshold: 85,
    warm_threshold: 65,
    dimensions: ['Situation', 'Problem', 'Implication', 'Consequence', 'Economics'],
  },
]
