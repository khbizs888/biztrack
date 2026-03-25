import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://alzrtdyayhqspdaaxdla.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenJ0ZHlheWhxc3BkYWF4ZGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTAyNzcsImV4cCI6MjA4OTcyNjI3N30.qET8aoQDdbibSYGs1djSwA4p9P_I3rVRuHwGKcVJAO8')

const TABS = ['Dashboard','Fior Package','Orders']
const EMPTY_ORDER = {'\u7ebf\u4e0a\u5355\u53f7':'','Date':'','Name':'','Phone number':'','Package':'','Total Price':'','Fior boxes':'','Channel':'','new/repeat Manual':'','Purchase reason':''}

export default function App() {
  const [tab,setTab]=useState('Dashboard')
  const [flor,setFlor]=useState([])
  const [orders,setOrders]=useState([])
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [form,setForm]=useState(EMPTY_ORDER)
  const [saving,setSaving]=useState(false)
  const [msg,setMsg]=useState('')

  useEffect(()=>{ load() },[])

  async function load(){
    setLoading(true)
    const [{data:a},{data:b}]=await Promise.all([
      supabase.from('Fior Package').select('*'),
      supabase.from('2026 Fior Daily order').select('*')
    ])
    setFlor(a||[])
    setOrders(b||[])
    setLoading(false)
  }

  async function saveOrder(){
    if(!form['\u7ebf\u4e0a\u5355\u53f7']){setMsg('Order No is required!');return}
    setSaving(true)
    const {error}=await supabase.from('2026 Fior Daily order').insert([form])
    if(error){setMsg('Error: '+error.message)}
    else{setMsg('Order saved successfully!');setShowForm(false);setForm(EMPTY_ORDER);load()}
    setSaving(false)
    setTimeout(()=>setMsg(''),3000)
  }

  const revenue=orders.reduce((s,o)=>s+(parseFloat(String(o['Total Price']).replace('RM','').trim())||0),0)
  const totalBoxes=orders.reduce((s,o)=>s+(Number(o['Fior boxes'])||0),0)

  const icons = {
    Dashboard: '▦',
    'Fior Package': '◈',
    Orders: '◎'
  }

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',background:'#0f0f13'}}>
      
      {/* Sidebar */}
      <div style={{width:220,background:'#16161d',borderRight:'1px solid #2a2a35',display:'flex',flexDirection:'column',padding:'0'}}>
        <div style={{padding:'24px 20px',borderBottom:'1px solid #2a2a35'}}>
          <div style={{fontWeight:700,fontSize:20,color:'#fff',letterSpacing:2}}>FIOR</div>
          <div style={{fontSize:11,color:'#555',marginTop:4,letterSpacing:1,textTransform:'uppercase'}}>Business Dashboard</div>
        </div>
        <div style={{padding:'12px 0',flex:1}}>
          {TABS.map(t=>(
            <div key={t} onClick={()=>setTab(t)} style={{
              padding:'12px 20px',cursor:'pointer',fontSize:13,
              color:tab===t?'#fff':'#666',
              background:tab===t?'#1e1e2e':'transparent',
              borderLeft:tab===t?'3px solid #7c6af7':'3px solid transparent',
              display:'flex',alignItems:'center',gap:10,
              transition:'all 0.15s'
            }}>
              <span style={{fontSize:16,opacity:tab===t?1:0.5}}>{icons[t]}</span>
              {t}
            </div>
          ))}
        </div>
        <div style={{padding:'16px 20px',borderTop:'1px solid #2a2a35'}}>
          <div style={{fontSize:11,color:'#444',letterSpacing:0.5}}>v1.0.0 · Live</div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        
        {/* Topbar */}
        <div style={{background:'#16161d',borderBottom:'1px solid #2a2a35',padding:'16px 28px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:600,fontSize:18,color:'#fff'}}>{tab}</div>
            <div style={{fontSize:11,color:'#555',marginTop:2}}>{new Date().toLocaleDateString('en-MY',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
          </div>
          {tab==='Orders'&&(
            <button onClick={()=>setShowForm(true)} style={{background:'#7c6af7',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:500,letterSpacing:0.3}}>
              + New Order
            </button>
          )}
        </div>

        {msg&&(
          <div style={{background:msg.includes('Error')?'rgba(162,45,45,0.15)':'rgba(59,109,17,0.15)',color:msg.includes('Error')?'#f87171':'#86efac',padding:'10px 28px',fontSize:13,borderBottom:'1px solid #2a2a35'}}>
            {msg}
          </div>
        )}

        <div style={{flex:1,overflow:'auto',padding:28}}>

          {/* Dashboard */}
          {tab==='Dashboard'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
                {[
                  ['Total Orders',orders.length,'#7c6af7'],
                  ['Revenue','RM '+revenue.toLocaleString(),'#22d3ee'],
                  ['Packages',flor.length,'#f59e0b'],
                  ['Boxes Sold',totalBoxes,'#34d399']
                ].map(([l,v,color])=>(
                  <div key={l} style={{background:'#16161d',borderRadius:12,padding:20,border:'1px solid #2a2a35',position:'relative',overflow:'hidden'}}>
                    <div style={{position:'absolute',top:-10,right:-10,width:60,height:60,borderRadius:'50%',background:color,opacity:0.08}}/>
                    <div style={{fontSize:11,color:'#555',marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>{l}</div>
                    <div style={{fontSize:26,fontWeight:700,color}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{fontWeight:600,fontSize:14,color:'#888',marginBottom:14,textTransform:'uppercase',letterSpacing:1}}>Recent Orders</div>
              {loading?<Loader/>:<OrdersTable data={orders.slice(0,10)}/>}
            </div>
          )}

          {tab==='Fior Package'&&(loading?<Loader/>:<FlorTable data={flor}/>)}
          {tab==='Orders'&&(loading?<Loader/>:<OrdersTable data={orders}/>)}

        </div>
      </div>

      {/* Modal */}
      {showForm&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:'#16161d',border:'1px solid #2a2a35',borderRadius:16,padding:28,width:500,maxHeight:'90vh',overflow:'auto'}}>
            <div style={{fontWeight:700,fontSize:18,color:'#fff',marginBottom:6}}>New Order</div>
            <div style={{fontSize:12,color:'#555',marginBottom:24}}>Fill in the order details below</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {[['Order No (线上单号)','\u7ebf\u4e0a\u5355\u53f7'],['Date','Date'],['Name','Name'],['Phone Number','Phone number'],['Package','Package'],['Total Price','Total Price'],['Fior Boxes','Fior boxes'],['Channel','Channel'],['New/Repeat','new/repeat Manual'],['Purchase Reason','Purchase reason']].map(([label,key])=>(
                <div key={key}>
                  <div style={{fontSize:11,color:'#666',marginBottom:6,letterSpacing:0.5}}>{label}</div>
                  <input value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}
                    style={{width:'100%',padding:'9px 12px',background:'#0f0f13',border:'1px solid #2a2a35',borderRadius:8,fontSize:13,outline:'none',color:'#fff',boxSizing:'border-box'}}/>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginTop:24}}>
              <button onClick={()=>{setShowForm(false);setForm(EMPTY_ORDER)}} style={{flex:1,padding:'10px',border:'1px solid #2a2a35',borderRadius:8,cursor:'pointer',background:'transparent',fontSize:13,color:'#888'}}>Cancel</button>
              <button onClick={saveOrder} disabled={saving} style={{flex:1,padding:'10px',border:'none',borderRadius:8,cursor:'pointer',background:'#7c6af7',color:'#fff',fontSize:13,fontWeight:500}}>{saving?'Saving...':'Save Order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Loader(){
  return <div style={{color:'#555',fontSize:13}}>Loading...</div>
}

function FlorTable({data}){
  if(!data.length) return <div style={{color:'#555'}}>No data</div>
  return(
    <div style={{background:'#16161d',borderRadius:12,border:'1px solid #2a2a35',overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['SKU','SKU Name','Price','Fior Boxes'].map(h=><th key={h} style={{textAlign:'left',padding:'12px 16px',fontSize:11,fontWeight:600,color:'#555',background:'#12121a',borderBottom:'1px solid #2a2a35',textTransform:'uppercase',letterSpacing:1}}>{h}</th>)}</tr></thead>
        <tbody>{data.map((r,i)=>(
          <tr key={i} style={{borderBottom:i<data.length-1?'1px solid #1e1e2a':'none'}}>
            <td style={{padding:'12px 16px',color:'#7c6af7',fontWeight:500}}>{r['SKU']}</td>
            <td style={{padding:'12px 16px',color:'#ccc'}}>{r['SKU Name']}</td>
            <td style={{padding:'12px 16px',color:'#22d3ee'}}>RM {r['Price']}</td>
            <td style={{padding:'12px 16px',color:'#ccc'}}>{r['Fior Boxes']}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function OrdersTable({data}){
  if(!data.length) return <div style={{color:'#555'}}>No orders</div>
  return(
    <div style={{background:'#16161d',borderRadius:12,border:'1px solid #2a2a35',overflow:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['Order No','Date','Name','Phone','Package','Total Price','Boxes','Channel','Type'].map(h=><th key={h} style={{textAlign:'left',padding:'12px 16px',fontSize:11,fontWeight:600,color:'#555',background:'#12121a',borderBottom:'1px solid #2a2a35',textTransform:'uppercase',letterSpacing:1,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
        <tbody>{data.map((r,i)=>(
          <tr key={i} style={{borderBottom:i<data.length-1?'1px solid #1e1e2a':'none'}}>
            <td style={{padding:'12px 16px',color:'#7c6af7',fontWeight:500,whiteSpace:'nowrap'}}>{r['\u7ebf\u4e0a\u5355\u53f7']}</td>
            <td style={{padding:'12px 16px',color:'#888',whiteSpace:'nowrap'}}>{r['Date']}</td>
            <td style={{padding:'12px 16px',color:'#ccc'}}>{r['Name']}</td>
            <td style={{padding:'12px 16px',color:'#888',whiteSpace:'nowrap'}}>{r['Phone number']}</td>
            <td style={{padding:'12px 16px',color:'#ccc'}}>{r['Package']}</td>
            <td style={{padding:'12px 16px',color:'#22d3ee',whiteSpace:'nowrap'}}>{r['Total Price']}</td>
            <td style={{padding:'12px 16px',color:'#ccc'}}>{r['Fior boxes']}</td>
            <td style={{padding:'12px 16px',color:'#ccc'}}>{r['Channel']}</td>
            <td style={{padding:'12px 16px'}}><span style={{background:r['new/repeat Manual']==='new'?'rgba(124,106,247,0.15)':'rgba(34,211,238,0.1)',color:r['new/repeat Manual']==='new'?'#7c6af7':'#22d3ee',padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:500}}>{r['new/repeat Manual']}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}
