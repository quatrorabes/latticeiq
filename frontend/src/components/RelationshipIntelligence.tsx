// components/RelationshipIntelligence.tsx
// Main dashboard component wired to Supabase

'use client'

import { useEffect, useState } from 'react'
import Chart from 'chart.js/auto'
import {
  fetchEngagementVelocity,
  fetchCallTodayContacts,
  fetchCurrentEngagementPercentage,
  fetchRelationshipHealthMetrics,
  fetchOutreachTips,
  subscribeToEngagementMetrics,
  subscribeToContacts,
  type Contact,
  type EngagementMetric,
  type OutreachTip,
} from '@/lib/supabase'

interface HealthMetrics {
  healthy_relationships_pct: number
  total_contacts_touched: number
  response_rate: number
  avg_response_time_days: number
}

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
        // Fetch all data in parallel
        const [percentage, trend, contacts, tips, metrics] = await Promise.all([
          fetchCurrentEngagementPercentage(),
          fetchEngagementVelocity(),
          fetchCallTodayContacts(3),
          fetchOutreachTips(6),
          fetchRelationshipHealthMetrics(),
        ])

        setEngagementPercentage(percentage)
        setEngagementTrend(trend || [])
        setCallTodayContacts(contacts)
        setOutreachTips(tips)

        if (metrics) {
          setHealthMetrics({
            healthy_relationships_pct: metrics.healthy_relationships_pct || 85,
            total_contacts_touched: metrics.total_contacts_touched || 1250,
            response_rate: metrics.response_rate || 22,
            avg_response_time_days: metrics.response_time_days || 2.3,
          })
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeDashboard()

    // Subscribe to real-time updates
    const metricsSubscription = subscribeToEngagementMetrics((data) => {
      if (data.length > 0) {
        setEngagementPercentage(data[0].engagement_percentage)
        setEngagementTrend(data)
      }
    })

    const contactsSubscription = subscribeToContacts((data) => {
      setCallTodayContacts(data.slice(0, 3))
    })

    return () => {
      metricsSubscription?.unsubscribe()
      contactsSubscription?.unsubscribe()
    }
  }, [])

  // Initialize Chart.js
  useEffect(() => {
    if (engagementTrend.length === 0) return

    const ctx = document.getElementById('engagementChart') as HTMLCanvasElement
    if (!ctx) return

    // Destroy previous chart instance
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
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 40,
            ticks: {
              color: 'rgba(227, 242, 253, 0.6)',
              font: { size: 11 },
            },
            grid: {
              color: 'rgba(66, 165, 245, 0.1)',
              drawBorder: false,
            },
          },
          x: {
            ticks: {
              color: 'rgba(227, 242, 253, 0.6)',
              font: { size: 11 },
            },
            grid: {
              display: false,
              drawBorder: false,
            },
          },
        },
      },
    })

    setChartInstance(newChart)

    return () => {
      newChart.destroy()
    }
  }, [engagementTrend])

  // Auto-rotate tips every 10 seconds
  useEffect(() => {
    if (outreachTips.length === 0) return

    const interval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % outreachTips.length)
    }, 10000)

    return () => clearInterval(interval)
  }, [outreachTips])

  const currentTip = outreachTips[currentTipIndex] || {
    title: 'Try a Different Outreach Method',
    content: 'Instead of a standard email, try sending a personalized LinkedIn voice message.',
  }

  const getEngagementEmoji = (status: string) => {
    switch (status) {
      case 'hot':
        return '🔥'
      case 'warm':
        return '🟨'
      case 'cold':
        return '❄️'
      default:
        return '⭐'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading dashboard...</div>
  }

  return (
    <div className="container">
      {/* Top Navigation */}
      <div className="nav-bar">
        <div className="logo">
          ⭐ <span>RELATION FLOW</span>
        </div>
        <div className="nav-menu">
          <div className="nav-item active">Home</div>
          <div className="nav-item">Contacts</div>
          <div className="nav-item">Analytics</div>
          <div className="nav-item">Campaigns</div>
          <div className="nav-item">Settings</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        <div className="header">
          <h1>Relationship Intelligence Dashboard</h1>
          <p>Real-time insights into your contact engagement and outreach effectiveness</p>
        </div>

        <div className="dashboard-wrapper">
          <div className="dashboard-left">
            {/* Hero Metric */}
            <div className="hero-metric">
              <div className="hero-content">
                <div className="hero-metric-large">{engagementPercentage}%</div>
                <div className="hero-metric-label">Contacts Engaged This Week</div>
                <div className="hero-trend">
                  <div className="trend-item">
                    <span className="trend-up">↑ 12% vs last week</span>
                  </div>
                  <div className="trend-item">
                    <span>{Math.round(engagementPercentage * 3.7)} active relationships</span>
                  </div>
                </div>
              </div>
              <div className="hero-chart">
                <canvas id="engagementChart"></canvas>
              </div>
            </div>

            {/* Call Today Section */}
            <div>
              <h2 className="section-title">🎯 Call Today</h2>
              <div className="contacts-grid">
                {callTodayContacts.map((contact) => (
                  <div key={contact.id} className={`contact-card ${contact.engagement_status}`}>
                    <div className="contact-header">
                      <div className="contact-info">
                        <div className="contact-avatar">
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="contact-name-group">
                          <div className="contact-name">{contact.name}</div>
                          <div className="contact-company">{contact.company}</div>
                        </div>
                      </div>
                      <div className={`engagement-badge badge-${contact.engagement_status}`}>
                        {getEngagementEmoji(contact.engagement_status)}
                      </div>
                    </div>
                    <div className="contact-meta">
                      <div className="meta-item">
                        <strong>Last interaction:</strong>{' '}
                        {new Date(contact.last_interaction).toLocaleDateString()}
                      </div>
                      <div className="meta-item">
                        <strong>Engagement:</strong>{' '}
                        <span style={{ color: `var(--accent-${contact.engagement_status})` }}>
                          {contact.engagement_status.charAt(0).toUpperCase() +
                            contact.engagement_status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div className="next-step">Call Now • Discuss Next Steps</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Relationship Health Metrics */}
            <div>
              <h2 className="section-title">📊 Relationship Health Metrics</h2>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{healthMetrics?.healthy_relationships_pct || 85}%</div>
                  <div className="metric-label">Healthy Relationships</div>
                  <div className="metric-change">↑ 5% increase</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{healthMetrics?.total_contacts_touched || 1250}</div>
                  <div className="metric-label">Contacts Touched</div>
                  <div className="metric-change">This month</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{healthMetrics?.response_rate || 22}%</div>
                  <div className="metric-label">Avg Response Rate</div>
                  <div className="metric-change">↑ 3% improvement</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">
                    {healthMetrics?.avg_response_time_days || 2.3} days
                  </div>
                  <div className="metric-label">Avg Response Time</div>
                  <div className="metric-change">↓ Faster</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Daily Tip */}
          <div>
            <div className="daily-tip">
              <div className="tip-label">💡 Smart Suggestion</div>
              <div className="tip-title">{currentTip.title}</div>
              <div className="tip-content">{currentTip.content}</div>
              <button className="tip-action" onClick={() => alert('Suggestion applied!')}>
                Implement Suggestion
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}