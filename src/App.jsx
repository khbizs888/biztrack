import { useState } from 'react'

const TABS = ['Dashboard', 'Inventory', 'CRM', 'Orders']

const mockInventory = [
  { name: 'Claw Machine Pro', sku: 'CM-001', stock: 12, price: 'RM 580', status: 'OK' },
  { name: 'Mini Claw', sku: 'CM-002', stock: 3, price: 'RM 160', status: 'Low Stock' },
  { name: 'Token Pack (50)', sku: 'TK-050', stock: 88, price: 'RM 25', status: 'OK' },
  { name: 'Plush Toy Set A', sku: 'PT-A01', stock: 2, price: 'RM 45', status: 'Low Stock' },
]

const mockCustomers = [
  { name: 'Siti Aminah', phone: '+60 12-345 6789', orders: 4, spent: 'RM 1,820', last: '3 days ago' },
  { name: 'Ahmad Fariz', phone: '+60 11-234 5678', orders: 2, spent: 'RM 640', last: 'Today' },
  { name: 'Wei Lin', phone: '+60 16-789 0123', orders: 7, spent: 'RM 2,340', last: '1 week ago' },
]

const mockOrders = [
  { id: '#1042', customer: 'Siti Aminah', product: 'Claw Machine Pro', qty: 1, amount: 'RM 580', status: 'Shipped' },
  { id: '#1041', customer: 'Ahmad Fariz', product: 'Mini Claw', qty: 2, amount: 'RM 320', status: 'Processing' },
  { id: '#1040', customer: 'Wei Lin', product: 'Token Pack', qty: 5, amount: 'RM 125', status: 'Pending' },
]

const statusColor = {
  'OK': '#3B6D11', 'Low Stock': '#A32D2D', 'Shipped': '#185FA5',
  'Processing': '#854F0B', 'Pending': '#5F5E5A', 'Delivered': '#3B6D11'
}
const statusBg = {
  'OK': '#EAF3DE', 'Low Stock': '#FCEBEB', 'Shipped': '#E6F1FB',
  'Processing': '#FAEEDA', 'Pending': '#F1EFE8', 'Delivered': '#EAF3DE'
}

function Badge({ status }) {
  return (
    <span style={{
      background: statusBg[status] || '#F1EFE8',
      color: statusColor[status] || '#444',
      padding: '2px 10px', borderRadius: 99,
      fontSize: 12, fontWeight: 500
    }}>{status}</span>
  )
}

export default function App() {
  const [tab, setTab] = useState('Dashboard')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([
    { role: 'ai', text: 'Hi! Ask me anything about your inventory, customers or orders.' }
  ])
  const [loading, setLoading] = useState(false)

  async function sendAI() {
    if (!aiInput.trim()) return
    const userMsg = aiInput.trim()
    setAiInput('')
    setAiMessages(m => [...m, { role: 'user', text: userMsg }])
    setLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: `You are a business assistant. Data:
INVENTORY: Claw Machine Pro (12 units, RM580), Mini Claw (3 units LOW STOCK, RM160), Token Pack (88 units, RM25), Plush Toy Set A (2 units LOW STOCK, RM45)
CUSTOMERS: Siti Aminah (4 orders RM1820), Ahmad Fariz (2 orders RM640), Wei Lin (7 orders RM2340 top customer)
ORDERS: #1042 Shipped, #1041 Processing, #1040 Pending
Answer concisely under 60 words.`,
          messages: [{ role: 'user', content: userMsg }]
        })
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'No response.'
      setAiMessages(m => [...m, { role: 'ai', text: reply }])
    } catch {
      setAiMessages(m => [...m, { role: 'ai', text: 'Error connecting. Check API key.' }])
    }
    setLoading(false)
  }

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
        <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 16 }}>{tab}</span>
          <button onClick={() => setAiOpen(o => !o)} style={{ background: '#378ADD', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13 }}>
            AI Assistant
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {tab === 'Dashboard' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[['Total Orders', '124', '+8 this week'], ['Revenue', 'RM 18,240', '+12% vs last month'], ['Customers', '67', '5 new this week'], ['Low Stock', '3', 'items need restock']].map(([label, val, sub]) => (
                  <div key={label} style={{ background: '#f5f5f3', borderRadius: 10, padding: 16 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 600 }}>{val}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontWeight: 500, marginBottom: 12 }}>Recent Orders</div>
              <Table headers={['Order', 'Customer', 'Product', 'Amount', 'Status']} rows={mockOrders.map(o => [o.id, o.customer, o.product, o.amount, <Badge status={o.status} />])} />
            </div>
          )}
          {tab === 'Inventory' && <Table headers={['Product', 'SKU', 'Stock', 'Price', 'Status']} rows={mockInventory.map(i => [i.name, i.sku, i.stock, i.price, <Badge status={i.status} />])} />}
          {tab === 'CRM' && <Table headers={['Name', 'Phone', 'Orders', 'Total Spent', 'Last Order']} rows={mockCustomers.map(c => [c.name, c.phone, c.orders, c.spent, c.last])} />}
          {tab === 'Orders' && <Table headers={['Order ID', 'Customer', 'Product', 'Qty', 'Amount', 'Status']} rows={mockOrders.map(o => [o.id, o.customer, o.product, o.qty, o.amount, <Badge status={o.status} />])} />}
        </div>
      </div>

      {aiOpen && (
        <div style={{ width: 300, background: '#fff', borderLeft: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>AI Assistant</span>
            <button onClick={() => setAiOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aiMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? '#378ADD' : '#f5f5f3',
                color: m.role === 'user' ? '#fff' : '#111',
                padding: '8px 12px', borderRadius: 10, fontSize: 13, maxWidth: '85%', lineHeight: 1.5
              }}>{m.text}</div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', background: '#f5f5f3', padding: '8px 12px', borderRadius: 10, fontSize: 13, color: '#888' }}>Thinking...</div>}
          </div>
          <div style={{ padding: 10, borderTop: '1px solid #e5e5e5', display: 'flex', gap: 6 }}>
            <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAI()}
              placeholder="Ask anything..." style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 13, outline: 'none' }} />
            <button onClick={sendAI} style={{ background: '#378ADD', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>Send</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Table({ headers, rows }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e5e5', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>{headers.map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#888', background: '#fafafa', borderBottom: '1px solid #e5e5e5', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              {row.map((cell, j) => <td key={j} style={{ padding: '10px 16px', color: '#222' }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}