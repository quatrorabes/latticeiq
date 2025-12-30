const handleScoreAllContacts = async () => {
  setIsScoring(true);
  setScoringMessage(null);
  setError(null);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('Please log in');
    }

    const url = new URL(`${API_BASE}/api/v3/scoring/score-all`);
    url.searchParams.append('framework', selectedFramework);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Scoring failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Scoring complete:', result);
    
    // Show success
    setScoringMessage(`✅ Scored ${result.scored} contacts`);
    
    // Refresh after 2 seconds to see results
    setTimeout(() => {
      fetchContacts();
      setScoringMessage(null);
    }, 2000);

  } catch (err: any) {
    console.error('❌ Scoring error:', err);
    setError(err.message);
  } finally {
    setIsScoring(false);
  }
};
