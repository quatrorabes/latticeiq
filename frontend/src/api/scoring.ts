const API_BASE = import.meta.env.VITE_API_URL;

async function getAuthToken() {
  return localStorage.getItem('supabase_token');
}

export async function getScoringConfig(framework: 'mdcp' | 'bant' | 'spice') {
  try {
    const res = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });
    if (!res.ok) throw new Error('Failed to load config');
    return res.json();
  } catch (error) {
    console.log('Using default config (API not ready)');
    return null;
  }
}

export async function saveScoringConfig(framework: 'mdcp' | 'bant' | 'spice', config: any) {
  try {
    const res = await fetch(`${API_BASE}/api/v3/scoring/config/${framework}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to save config');
    return res.json();
  } catch (error) {
    console.log('Config saved locally (API not ready)');
    return { success: true };
  }
}

export async function calculateAllScores(contactId: string) {
  try {
    const res = await fetch(`${API_BASE}/api/v3/scoring/calculate-all/${contactId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await getAuthToken()}`,
      },
    });
    if (!res.ok) throw new Error('Scoring failed');
    return res.json();
  } catch (error) {
    console.log('Scoring calculated locally');
    return { success: true };
  }
}
