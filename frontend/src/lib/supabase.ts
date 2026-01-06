// lib/supabase.ts
// Supabase client initialization for LatticeIQ

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials in environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for Relationship Intelligence
export interface Contact {
  id: string
  name: string
  email: string
  company: string
  engagement_score: number
  engagement_status: 'hot' | 'warm' | 'cold'
  last_interaction: string
  last_contacted_date?: string
  response_rate?: number
  created_at: string
}

export interface EngagementMetric {
  id: string
  week_starting: string
  total_contacts: number
  engaged_contacts: number
  engagement_percentage: number
  response_rate: number
  response_time_days: number
  healthy_relationships_pct: number
  created_at: string
}

export interface OutreachTip {
  id: string
  title: string
  content: string
  category: string
  contact_type?: 'hot' | 'warm' | 'cold'
  created_at: string
}

// Fetch engagement velocity (hero metric)
export async function fetchEngagementVelocity() {
  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('*')
    .order('week_starting', { ascending: false })
    .limit(7)

  if (error) {
    console.error('Error fetching engagement velocity:', error)
    return null
  }

  return data
}

// Fetch top contacts for "Call Today"
export async function fetchCallTodayContacts(limit = 3) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('engagement_score', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching call today contacts:', error)
    return []
  }

  return (data || []) as Contact[]
}

// Fetch current week's engagement percentage
export async function fetchCurrentEngagementPercentage() {
  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('engagement_percentage')
    .order('week_starting', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching engagement percentage:', error)
    return 34 // fallback
  }

  return data?.engagement_percentage || 34
}

// Fetch relationship health metrics
export async function fetchRelationshipHealthMetrics() {
  const { data, error } = await supabase
    .from('engagement_metrics')
    .select('*')
    .order('week_starting', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching health metrics:', error)
    return null
  }

  return data
}

// Fetch daily outreach tips
export async function fetchOutreachTips(limit = 6) {
  const { data, error } = await supabase
    .from('outreach_tips')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching outreach tips:', error)
    return []
  }

  return (data || []) as OutreachTip[]
}

// Get contacts by engagement status
export async function fetchContactsByStatus(status: 'hot' | 'warm' | 'cold') {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('engagement_status', status)
    .order('engagement_score', { ascending: false })

  if (error) {
    console.error(`Error fetching ${status} contacts:`, error)
    return []
  }

  return (data || []) as Contact[]
}

// Real-time subscription to engagement metrics
export function subscribeToEngagementMetrics(
  callback: (data: EngagementMetric[]) => void
) {
  const subscription = supabase
    .from('engagement_metrics')
    .on('*', (payload) => {
      console.log('Engagement metrics updated:', payload)
      // Re-fetch latest data
      fetchEngagementVelocity().then((data) => {
        if (data) callback(data)
      })
    })
    .subscribe()

  return subscription
}

// Real-time subscription to contact updates
export function subscribeToContacts(callback: (data: Contact[]) => void) {
  const subscription = supabase
    .from('contacts')
    .on('*', (payload) => {
      console.log('Contacts updated:', payload)
      // Re-fetch call today contacts
      fetchCallTodayContacts().then((data) => {
        if (data) callback(data)
      })
    })
    .subscribe()

  return subscription
}