
import { supabase } from '@lib/supabaseClient'
import { API_URL } from '@lib/constants'

export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
}

export async function apiCall<T>(
  endpoint: string,
  options: ApiRequestOptions = { method: 'GET' }
): Promise<T> {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = `${API_URL}${endpoint}`

  const fetchOptions: RequestInit = {
    method: options.method,
    headers,
  }

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, fetchOptions)

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorData.message || errorMessage
    } catch {
      // Keep default error message
    }
    throw new Error(errorMessage)
  }

  if (response.status === 204) {
    return undefined as any
  }

  try {
    return await response.json()
  } catch {
    return {} as T
  }
}

export async function apiGetJSON(endpoint: string) {
  return apiCall(endpoint, { method: 'GET' })
}

export async function apiPost(endpoint: string, body: any) {
  return apiCall(endpoint, { method: 'POST', body })
}

export async function apiPut(endpoint: string, body: any) {
  return apiCall(endpoint, { method: 'PUT', body })
}

export async function apiDelete(endpoint: string) {
  return apiCall(endpoint, { method: 'DELETE' })
}