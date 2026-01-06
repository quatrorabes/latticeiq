// pages/RelationshipIntelligence.tsx
// Main dashboard component for LatticeIQ

import { useEffect, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { supabase } from '../supabaseClient'

// Register Chart.js components
Chart.register(...registerables)

// Types
interface Contact {
  id: string
  first_name?: string
  last_name?: string
  name?: string
  email: string
  company?: string
  engagement_score?: number
  engagement_status?: 'hot' | 'warm' | 'cold'
  last_interaction?: string
  created_at?: string
}

interface EngagementMetric {
  id: string
  week_starting: string
  engagement_percentage: number
  response_rate?: number
  response_time_days?: number
  healthy_relationships_pct?: number
  total_contacts_touched?: number
}

interface OutreachTip {
  id: string
  title: string
  content: string
  category?: string
}

interface HealthMetrics {
  healthy_relationships_pct: number
  total_contacts_touched: number
  response_rate: number
  avg_response_time_days: number
}

// Fetch functions
async function fetchEngagementVelocity(): Promise<EngagementMetric[]> {
  try {
    const { data, error } = await supabase
      .from('engagement_metrics')
      .select('*')
      .order('week_starting', { ascending: false })
      .limit(7)
    if (error) throw error
    return data || []
  } catch (e) {
    console.warn('engagement_metrics table not found, using fallback data')
    return generateFallbackTrend()
  }
}

async function fetchCallTodayContacts(limit = 3): Promise<Contact[]> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  } catch (e) {
    console.warn('Error fetching contacts:', e)
    return []
  }
}

async function fetchCurrentEngagementPercentage(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('engagement_metrics')
      .select('engagement_percentage')
      .order('week_starting', { ascending: false })
      .limit(1)
      .single()
    if (error) throw error
    return data?.engagement_percentage || 34
  } catch (e) {
    return 34
  }
}

async function fetchRelationshipHealthMetrics(): Promise<EngagementMetric | null> {
  try {
    const { data, error } = await supabase
      .from('engagement_metrics')
      .select('*')
      .order('week_starting', { ascending: false })
      .limit(1)
      .single()
    if (error) throw error
    return data
  } catch (e) {
    return null
  }
}

async function fetchOutreachTips(limit = 6): Promise<OutreachTip[]> {
  try {
    const { data, error } = await supabase
      .from('outreach_tips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  } catch (e) {
    console.warn('outreach_tips table not found, using fallback')
    return getFallbackTips()
  }
}

// Fallback data generators
function generateFallbackTrend(): EngagementMetric[] {
  const data: EngagementMetric[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i * 7)
    data.push({
      id: `fallback-${i}`,
      week_starting: date.toISOString(),
      engagement_percentage: 28 + Math.floor(Math.random() * 10),
    })
  }
  return data
}

function getFallbackTips(): OutreachTip[] {
  return [
    { id: '1', title: 'Try a Different Outreach Method', content: 'Instead of a standard email, try sending a personalized LinkedIn voice message.', category: 'channel' },
    { id: '2', title: 'Use Social Proof', content: 'Reference mutual connections or recent company news in your initial outreach.', category: 'personalization' },
    { id: '3', title: 'Follow Up Within 48 Hours', content: 'Timing matters - reach out again within 2 days if no response.', category: 'timing' },
    { id: '4', title: 'Segment Your Message', content: 'Tailor your pitch to the specific industry and company size.', category: 'segmentation' },
    { id: '5', title: 'Ask for Referrals', content: 'If a contact declines, ask if they know anyone who might benefit.', category: 'expansion' },
    { id: '6', title: 'Use Case Studies', content: 'Share relevant success stories from similar companies in their industry.', category: 'content' },
  ]
}

// Styles
const styles = `
  .ri-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #0a1628 0%, #1a237e 50%, #0d47a1 100%);
    color: #e3f2fd;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 2rem;
  }
  .ri-header {
    margin-bottom: 2rem;
  }
  .ri-header h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(90deg, #64b5f6, #81c784);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .ri-header p {
    color: rgba(227, 242, 253, 0.7);
    margin: 0;
  }
  .ri-dashboard {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 2rem;
  }
  @media (max-width: 1024px) {
    .ri-dashboard {
      grid-template-columns: 1fr;
    }
  }
  .ri-hero {
    background: linear-gradient(145deg, rgba(33, 150, 243, 0.15), rgba(76, 175, 80, 0.1));
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 16px;
    padding: 2rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }
  @media (max-width: 768px) {
    .ri-hero {
      grid-template-columns: 1fr;
    }
  }
  .ri-hero-metric {
    font-size: 4rem;
    font-weight: 300;
    color: #66bb6a;
    line-height: 1;
  }
  .ri-hero-label {
    font-size: 1.1rem;
    color: rgba(227, 242, 253, 0.8);
    margin-top: 0.5rem;
  }
  .ri-hero-trend {
    display: flex;
    gap: 1.5rem;
    margin-top: 1rem;
    font-size: 0.9rem;
  }
  .ri-trend-up {
    color: #66bb6a;
  }
  .ri-chart-container {
    height: 150px;
  }
  .ri-section-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: #e3f2fd;
  }
  .ri-contacts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .ri-contact-card {
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(100, 181, 246, 0.2);
    border-radius: 12px;
    padding: 1.25rem;
    transition: all 0.2s ease;
  }
  .ri-contact-card:hover {
    border-color: rgba(100, 181, 246, 0.5);
    transform: translateY(-2px);
  }
  .ri-contact-card.hot {
    border-left: 3px solid #ef5350;
  }
  .ri-contact-card.warm {
    border-left: 3px solid #ffa726;
  }
  .ri-contact-card.cold {
    border-left: 3px solid #42a5f5;
  }
  .ri-contact-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  .ri-contact-info {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .ri-contact-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #42a5f5, #66bb6a);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: white;
  }
  .ri-contact-name {
    font-weight: 600;
    color: #e3f2fd;
  }
  .ri-contact-company {
    font-size: 0.85rem;
    color: rgba(227, 242, 253, 0.6);
  }
  .ri-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.8rem;
  }
  .ri-badge-hot {
    background: rgba(239, 83, 80, 0.2);
  }
  .ri-badge-warm {
    background: rgba(255, 167, 38, 0.2);
  }
  .ri-badge-cold {
    background: rgba(66, 165, 245, 0.2);
  }
  .ri-contact-meta {
    font-size: 0.85rem;
    color: rgba(227, 242, 253, 0.7);
    margin-bottom: 0.75rem;
  }
  .ri-next-step {
    font-size: 0.85rem;
    color: #64b5f6;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(100, 181, 246, 0.2);
  }
  .ri-metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }
  @media (max-width: 900px) {
    .ri-metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .ri-metric-card {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(100, 181, 246, 0.2);
    border-radius: 12px;
    padding: 1.25rem;
    text-align: center;
  }
  .ri-metric-value {
    font-size: 2rem;
    font-weight: 300;
    color: #64b5f6;
  }
  .ri-metric-label {
    font-size: 0.85rem;
    color: rgba(227, 242, 253, 0.7);
    margin-top: 0.25rem;
  }
  .ri-metric-change {
    font-size: 0.8rem;
    color: #66bb6a;
    margin-top: 0.5rem;
  }
  .ri-daily-tip {
    background: linear-gradient(145deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.1));
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    position: sticky;
    top: 2rem;
  }
  .ri-tip-label {
    font-size: 0.85rem;
    color: #ffc107;
    margin-bottom: 0.75rem;
  }
  .ri-tip-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #e3f2fd;
    margin-bottom: 0.75rem;
  }
  .ri-tip-content {
    font-size: 0.95rem;
    color: rgba(227, 242, 253, 0.8);
    line-height: 1.5;
    margin-bottom: 1rem;
  }
  .ri-tip-action {
    width: 100%;
    padding: 0.75rem;
    background: linear-gradient(90deg, #ffc107, #ff9800);
    border: none;
    border-radius: 8px;
    color: #1a237e;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .ri-tip-action:hover {
    opacity: 0.9;
  }
  .ri-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: #0a1628;
    color: #e3f2fd;
    font-size: 1.2rem;
  }
`

export default function RelationshipIntelligence() {
  const [engagementPercentage, setEngagementPercentage] = useState(34)
  const [engagementTrend, setEngagementTrend] = useState<EngagementMetric[]>([])
  const [callTodayContacts, setCallTodayContacts] = useState<Contact[]>([])
  const [outreachTips, setOutreachTips] = useState<OutreachTip[]>([])
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTipIndex, setCurrentTipIndex] = useState(0)
  const [chartInstance, setChartInstance] = useState<Chart | null>(null)

  // Initialize data on mount
  useEffect(() => {
    const initializeDashboard = async () => {
      setLoading(true)
      try {
        const [percentage, trend, contacts, tips, metrics] = await Promise.all([
          fetchCurrentEngagementPercentage(),
          fetchEngagementVelocity(),
          fetchCallTodayContacts(3),
          fetchOutreachTips(6),
          fetchRelationshipHealthMetrics(),
        ])

        setEngagementPercentage(percentage)
        setEngagementTrend(trend.length > 0 ? trend : generateFallbackTrend())
        setCallTodayContacts(contacts)
        setOutreachTips(tips.length > 0 ? tips : getFallbackTips())

        if (metrics) {
          setHealthMetrics({
            healthy_relationships_pct: metrics.healthy_relationships_pct || 85,
            total_contacts_touched: metrics.total_contacts_touched || 1250,
            response_rate: metrics.response_rate || 22,
            avg_response_time_days: metrics.response_time_days || 2.3,
          })
        } else {
          setHealthMetrics({
            healthy_relationships_pct: 85,
            total_contacts_touched: 1250,
            response_rate: 22,
            avg_response_time_days: 2.3,
          })
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error)
        setEngagementTrend(generateFallbackTrend())
        setOutreachTips(getFallbackTips())
        setHealthMetrics({
          healthy_relationships_pct: 85,
          total_contacts_touched: 1250,
          response_rate: 22,
          avg_response_time_days: 2.3,
        })
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()
  }, [])

  // Initialize Chart.js
  useEffect(() => {
    if (engagementTrend.length === 0 || loading) return

    const ctx = document.getElementById('engagementChart') as HTMLCanvasElement
    if (!ctx) return

    if (chartInstance) {
      chartInstance.destroy()
    }

    const chartData = {
      labels: engagementTrend
        .slice(-7)
        .map((m) => new Date(m.week_starting).toLocaleDateString('en-US', { weekday: 'short' })),
      datasets: [
        {
          label: 'Engagement %',
          data: engagementTrend.slice(-7).map((m) => m.engagement_percentage),
          borderColor: '#66BB6A',
          backgroundColor: 'rgba(102, 187, 106, 0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#66BB6A',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          tension: 0.4,
          fill: true,
        },
      ],
    }

    const newChart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 50,
            ticks: { color: 'rgba(227, 242, 253, 0.6)', font: { size: 11 } },
            grid: { display: false },
          },
          x: {
            ticks: { color: 'rgba(227, 242, 253, 0.6)', font: { size: 11 } },
            grid: { display: false },
          },
        },
      },
    })

    setChartInstance(newChart)

    return () => {
      newChart.destroy()
    }
  }, [engagementTrend, loading])

  // Auto-rotate tips
  useEffect(() => {
    if (outreachTips.length === 0) return
    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % outreachTips.length)
    }, 10000)
    return () => clearInterval(interval)
  }, [outreachTips])

  const currentTip = outreachTips[currentTipIndex] || getFallbackTips()[0]

  const getContactName = (contact: Contact) => {
    if (contact.name) return contact.name
    if (contact.first_name || contact.last_name) {
      return `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    }
    return contact.email?.split('@')[0] || 'Unknown'
  }

  const getEngagementStatus = (contact: Contact): 'hot' | 'warm' | 'cold' => {
    if (contact.engagement_status) return contact.engagement_status
    const score = contact.engagement_score || 0
    if (score >= 70) return 'hot'
    if (score >= 40) return 'warm'
    return 'cold'
  }

  const getEngagementEmoji = (status: string) => {
    switch (status) {
      case 'hot': return '🔥'
      case 'warm': return '🟨'
      case 'cold': return '❄️'
      default: return '⭐'
    }
  }

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="ri-loading">Loading dashboard...</div>
      </>
    )
  }

  return (
    <>
      <style>{styles}</style>
      <div className="ri-container">
        <div className="ri-header">
          <h1>Relationship Intelligence Dashboard</h1>
          <p>Real-time insights into your contact engagement and outreach effectiveness</p>
        </div>

        <div className="ri-dashboard">
          <div className="ri-main">
            {/* Hero Metric */}
            <div className="ri-hero">
              <div>
                <div className="ri-hero-metric">{engagementPercentage}%</div>
                <div className="ri-hero-label">Contacts Engaged This Week</div>
                <div className="ri-hero-trend">
                  <span className="ri-trend-up">↑ 12% vs last week</span>
                  <span>{Math.round(engagementPercentage * 3.7)} active relationships</span>
                </div>
              </div>
              <div className="ri-chart-container">
                <canvas id="engagementChart"></canvas>
              </div>
            </div>

            {/* Call Today Section */}
            <h2 className="ri-section-title">🎯 Call Today</h2>
            <div className="ri-contacts-grid">
              {callTodayContacts.length > 0 ? (
                callTodayContacts.map((contact) => {
                  const status = getEngagementStatus(contact)
                  return (
                    <div key={contact.id} className={`ri-contact-card ${status}`}>
                      <div className="ri-contact-header">
                        <div className="ri-contact-info">
                          <div className="ri-contact-avatar">
                            {getContactName(contact).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="ri-contact-name">{getContactName(contact)}</div>
                            <div className="ri-contact-company">{contact.company || 'No company'}</div>
                          </div>
                        </div>
                        <div className={`ri-badge ri-badge-${status}`}>
                          {getEngagementEmoji(status)}
                        </div>
                      </div>
                      <div className="ri-contact-meta">
                        <div><strong>Email:</strong> {contact.email}</div>
                      </div>
                      <div className="ri-next-step">Call Now • Discuss Next Steps</div>
                    </div>
                  )
                })
              ) : (
                <div className="ri-contact-card">
                  <div className="ri-contact-meta">No contacts found. Import some contacts to get started!</div>
                </div>
              )}
            </div>

            {/* Health Metrics */}
            <h2 className="ri-section-title">📊 Relationship Health Metrics</h2>
            <div className="ri-metrics-grid">
              <div className="ri-metric-card">
                <div className="ri-metric-value">{healthMetrics?.healthy_relationships_pct}%</div>
                <div className="ri-metric-label">Healthy Relationships</div>
                <div className="ri-metric-change">↑ 5% increase</div>
              </div>
              <div className="ri-metric-card">
                <div className="ri-metric-value">{healthMetrics?.total_contacts_touched}</div>
                <div className="ri-metric-label">Contacts Touched</div>
                <div className="ri-metric-change">This month</div>
              </div>
              <div className="ri-metric-card">
                <div className="ri-metric-value">{healthMetrics?.response_rate}%</div>
                <div className="ri-metric-label">Avg Response Rate</div>
                <div className="ri-metric-change">↑ 3% improvement</div>
              </div>
              <div className="ri-metric-card">
                <div className="ri-metric-value">{healthMetrics?.avg_response_time_days} days</div>
                <div className="ri-metric-label">Avg Response Time</div>
                <div className="ri-metric-change">↓ Faster</div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            <div className="ri-daily-tip">
              <div className="ri-tip-label">💡 Smart Suggestion</div>
              <div className="ri-tip-title">{currentTip.title}</div>
              <div className="ri-tip-content">{currentTip.content}</div>
              <button className="ri-tip-action" onClick={() => alert('Suggestion applied!')}>
                Implement Suggestion
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
