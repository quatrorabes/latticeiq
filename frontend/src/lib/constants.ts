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
  
  // =========================================================================
  // CRM INTEGRATIONS (NEW v2.0 endpoints)
  // =========================================================================
  
  // Integration management (connect/disconnect/test)
  integrations: {
    health: '/api/v3/integrations/health',
    hubspot: {
      test: '/api/v3/integrations/hubspot/test',
      connect: '/api/v3/integrations/hubspot/connect',
      status: '/api/v3/integrations/hubspot/status',
      disconnect: '/api/v3/integrations/hubspot/disconnect',
    },
    pipedrive: {
      test: '/api/v3/integrations/pipedrive/test',
      connect: '/api/v3/integrations/pipedrive/connect',
      status: '/api/v3/integrations/pipedrive/status',
      disconnect: '/api/v3/integrations/pipedrive/disconnect',
    },
    salesforce: {
      test: '/api/v3/integrations/salesforce/test',
      connect: '/api/v3/integrations/salesforce/connect',
      status: '/api/v3/integrations/salesforce/status',
      disconnect: '/api/v3/integrations/salesforce/disconnect',
    },
  },
  
  // HubSpot Import
  hubspot: {
    health: '/api/v3/hubspot/health',
    preview: '/api/v3/hubspot/preview',
    import: '/api/v3/hubspot/import',
    lists: '/api/v3/hubspot/lists',
  },
  
  // CSV/Unified Import
  import: {
    health: '/api/v3/import/health',
    filterPresets: '/api/v3/import/filters/presets',
    csvPreview: '/api/v3/import/csv/preview',
    csv: '/api/v3/import/csv',
    history: '/api/v3/import/history',
    historyDetail: (importId: string) => `/api/v3/import/history/${importId}`,
  },
  
  // Legacy endpoints (keep for backwards compatibility)
  importHubSpot: '/api/v3/hubspot/import',
  importSalesforce: '/api/v3/crm/import/salesforce',
  importPipedrive: '/api/v3/crm/import/pipedrive',
  importCSV: '/api/v3/import/csv',
  importStatus: (jobId: string) => `/api/v3/import/history/${jobId}`,
  
  // Settings
  settingsCRM: '/api/v3/settings/crm/integrations',
  testCRM: (crmType: string) => `/api/v3/integrations/${crmType}/test`,
  
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

// CRM Integration providers
export const CRM_PROVIDERS = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: 'https://cdn.simpleicons.org/hubspot',
    description: 'Import contacts from your HubSpot CRM',
    authType: 'api_key',
    docUrl: 'https://developers.hubspot.com/docs/api/private-apps',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    icon: 'https://cdn.simpleicons.org/pipedrive',
    description: 'Import contacts from Pipedrive',
    authType: 'api_key',
    docUrl: 'https://pipedrive.readme.io/docs/core-api-concepts-authentication',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: 'https://cdn.simpleicons.org/salesforce',
    description: 'Import contacts from Salesforce',
    authType: 'oauth',
    docUrl: 'https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_flows.htm',
  },
]
