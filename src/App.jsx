import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const TABS = ['Dashboard', 'Fior Package', 'Inventory', 'CRM', 'Orders']

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const [florPackage, setFlorPackage] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('Fior Package').select('*').then(({ data, error }) => {
      if (error) console.error('Error:', error)
      else setFlorPackage(data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f5f5f3' }}>
      <div style={{ width: 200, background: '#fff', borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #e5e5e5', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>BizTrack</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Business Manager</div>
        </div>
        {TABS.map(t => (
          <div key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', cursor: 'pointer', fontSize: 14,
            color: tab === t ? '#111' : '#666',
            background: tab === t ? '#f5f5f3' : 'transparent',
            fontWeight: tab === t ? 600 : 400,
            borderRight: tab === t ? '2px solid #378ADD' : '2px solid transparent'
          }}>{t}</div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '14px 24px' }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{tab}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {tab === 'Dashboard' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
                <div style={{ background: '#f5f5f3', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Total Packages</div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{florPackage.length}</div>
                </div>
                <div style={{ background: '#f5f5f3', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Total Boxes</div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{florPackage.reduce((s, i) => s + (Number(i['Fior Boxes']) || 0), 0)}</div>
                </div>
                <div style={{ background: '#f5f5f3', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase' }}>Avg Price</div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>RM {florPackage.length ? Math.round(florPackage.reduce((s, i) => s + (Number(i['Price']) || 0), 0) / florPackage.length) : 0}</div>
                </div>
              </div>
              {loading ? <div>Loading...</div> : <FlorTable data={florPackage} />}
            </div>
          )}
          {tab === 'Fior Package' && (loading ? <div>Loading...</div> : <FlorTable data={florPackage} />)}
          {tab === 'Inventory' && <div style={{ color: '#888' }}>Inventory coming soon</div>}
          {tab === 'CRM' && <div style={{ color: '#888' }}>CRM coming soon</div>}
          {tab === 'Orders' && <div style={{ color: '#888' }}>Orders coming soon</div>}
        </div>
      </div>
    </div>
  )
}

function FlorTable({ data }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['SKU', 'SKU Name', 'Price', 'Fior Boxes'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#888', background: '#fafafa', borderBottom: '1px solid #e5e5e5', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < data.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              <td style={{ padding: '10px 14px' }}>{row['SKU']}</td>
              <td style={{ padding: '10px 14px' }}>{row['SKU Name']}</td>
              <td style={{ padding: '10px 14px' }}>RM {row['Price']}</td>
              <td style={{ padding: '10px 14px' }}>{row['Fior Boxes']}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
