const API_BASE = import.meta.env.VITE_API_URL;

async function getAuthToken() {
  return localStorage.getItem('supabase_token') || '';
}

export async function getScoringConfig(framework: 'MDCP' | 'BANT' | 'SPICE') {
  const res = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
    headers: { Authorization: `Bearer ${await getAuthToken()}` },
  });
  if (!res.ok) throw new Error('Failed to load config');
  return res.json();
}

export async function saveScoringConfig(
  framework: 'MDCP' | 'BANT' | 'SPICE',
  config: any,
) {
  const res = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save config');
  return res.json();
}

export async function calculateAllScores(contactId: string) {
  const res = await fetch(
    `${API_BASE}/api/v3/scoring/calculate-all/${contactId}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${await getAuthToken()}` },
    },
  );
  if (!res.ok) throw new Error('Scoring failed');
  return res.json();
}
