import { Activity, Building2, Gauge, Zap } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Facility, Category, FacilityStatus } from '../types'
import { categories } from '../types'

type AnalyticsPanelProps = { facilities: Facility[] }

const statusColors: Record<FacilityStatus, string> = {
  Active: '#4dbb91',
  Maintenance: '#e8b45d',
  Offline: '#ef7b67',
}

export default function AnalyticsPanel({ facilities }: AnalyticsPanelProps) {
  const active = facilities.filter((facility) => facility.properties.status === 'Active').length
  const averageRisk = facilities.length
    ? Math.round(facilities.reduce((sum, item) => sum + item.properties.riskScore, 0) / facilities.length)
    : 0
  const totalCapacity = facilities.reduce((sum, item) => sum + item.properties.capacity, 0)
  const categoryData = (Object.keys(categories) as Category[]).map((category) => ({
    name: categories[category].label,
    count: facilities.filter((facility) => facility.properties.category === category).length,
    fill: categories[category].color,
  }))
  const statusData = (Object.keys(statusColors) as FacilityStatus[]).map((status) => ({
    name: status,
    value: facilities.filter((facility) => facility.properties.status === status).length,
    fill: statusColors[status],
  }))

  return (
    <section className="analytics-panel" aria-label="Facility analytics">
      <div className="section-heading">
        <div><p className="eyebrow">AT A GLANCE</p><h2>Network analytics</h2></div>
        <span className="demo-tag">DEMO DATA</span>
      </div>
      <div className="kpi-grid">
        <article className="kpi-card">
          <span className="kpi-icon violet"><Building2 size={17} /></span>
          <span className="kpi-label">Total facilities</span>
          <strong>{facilities.length.toLocaleString()}</strong>
          <small>Within current filters</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon green"><Activity size={17} /></span>
          <span className="kpi-label">Active assets</span>
          <strong>{active.toLocaleString()}</strong>
          <small>{facilities.length ? Math.round((active / facilities.length) * 100) : 0}% operational</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon amber"><Gauge size={17} /></span>
          <span className="kpi-label">Average risk</span>
          <strong>{averageRisk}<em>/100</em></strong>
          <small>Simulated risk index</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon blue"><Zap size={17} /></span>
          <span className="kpi-label">Total capacity</span>
          <strong>{totalCapacity.toLocaleString()}</strong>
          <small>Service capacity units</small>
        </article>
      </div>
      <div className="chart-grid">
        <article className="chart-card">
          <div className="chart-heading"><h3>Facilities by type</h3><span>Filtered</span></div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} interval={0} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ background: 'var(--surface)', borderColor: 'var(--line)', borderRadius: 9, color: 'var(--text)' }} />
                <Bar dataKey="count" name="Facilities" radius={[5, 5, 0, 0]}>
                  {categoryData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="chart-card status-chart-card">
          <div className="chart-heading"><h3>Operational status</h3><span>By count</span></div>
          <div className="status-chart-content">
            <div className="donut-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={47} outerRadius={63} paddingAngle={4} stroke="none">
                    {statusData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface)', borderColor: 'var(--line)', borderRadius: 9, color: 'var(--text)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-total"><strong>{facilities.length}</strong><span>assets</span></div>
            </div>
            <div className="status-legend">
              {statusData.map((item) => <div key={item.name}><i style={{ backgroundColor: item.fill }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
