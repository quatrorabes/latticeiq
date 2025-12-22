// Create this file to wrap scoring API calls
const API_BASE = import.meta.env.VITE_API_URL;

export interface ScoringResult {
  mdcp_score: number;
  mdcp_tier: 'Hot' | 'Warm' | 'Cold';
  bant_score: number;
  bant_tier: 'Hot' | 'Warm' | 'Cold';
  spice_score: number;
  spice_tier: 'Hot' | 'Warm' | 'Cold';
  calculated_at: string;
}

export const scoringApi = {
  calculateAll: async (contactId: string, contactData: any): Promise<ScoringResult> => {
    const response = await fetch(`${API_BASE}/api/v3/scoring/calculate-all/${contactId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ contact_data: contactData })
    });
    
    if (!response.ok) throw new Error('Scoring failed');
    return response.json();
  },
  
  getHealth: async () => {
    const response = await fetch(`${API_BASE}/api/v3/scoring/health`);
    return response.json();
  }
};
