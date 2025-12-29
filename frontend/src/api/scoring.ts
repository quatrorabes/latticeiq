// frontend/src/api/scoring.ts

import { supabase } from '../lib/supabaseClient';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const getScoringConfig = async (framework: 'mdcp' | 'bant' | 'spice') => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/v3/scoring/config/${framework}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to load ${framework} config`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error loading ${framework} config:`, error);
    throw error;
  }
};

export const saveScoringConfig = async (
  framework: 'mdcp' | 'bant' | 'spice',
  config: any
) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/v3/scoring/config/${framework}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to save ${framework} config`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error saving ${framework} config:`, error);
    throw error;
  }
};
