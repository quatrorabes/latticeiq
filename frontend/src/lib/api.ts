// frontend/src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'https://latticeiq-backend.onrender.com';

export async function apiCall(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add origin header explicitly
  if (typeof window !== 'undefined') {
    headers['Origin'] = window.location.origin;
  }

  // Add auth token if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',  // Include cookies
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  return response;
}

export async function get(endpoint: string, token?: string) {
  const response = await apiCall(endpoint, { method: 'GET' }, token);
  return response.json();
}

export async function post(endpoint: string, body?: any, token?: string) {
  const response = await apiCall(
    endpoint,
    {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    },
    token
  );
  return response.json();
}
