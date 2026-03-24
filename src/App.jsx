import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://alzrtdyayhqspdaaxdla.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenJ0ZHlheWhxc3BkYWF4ZGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTAyNzcsImV4cCI6MjA4OTcyNjI3N30.qET8aoQDdbibSYGs1djSwA4p9P_I3rVRuHwGKcVJAO8')

const TABS = ['Dashboard','Fior Package','Orders']

export default function App() {
  const [tab,setTab]=useState('Dashboard')
  const [flor,setFlor]=useState([])
  const [orders,setOrders]=useState([])
  const [loading,setLoading]=useState(true)

  useEffect(()=>{
    async function load(){
      const [{data:a},{data:b}]=await Promise.all([
        supabase.from('Fior Package').select('*'),
        supabase.from('2026 Fior Daily order').select('*')
      ])
      setFlor(a||[])
      setOrders(b||[])
      setLoading(false)
    }
    load()
  },[])

  const revenue=orders.reduce((s,o)=>s+(parseFloat(String(o['Total Price']).replace('RM','').trim())||0),0)

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'system-ui,sans-serif',background:'#f5f5f3'}}>
      <div style={{width:200,background:'#fff',borderRight:'1px solid #e5e5e5',display:'flex',flexDirection:'column',padding:'20px 0'}}>
        <div style={{padding:'0 20px 20px',borderBottom:'1px solid #e5e5e5',marginBottom:8}}>
          <div style={{fontWeight:600,fontSize:16}}>BizTrack</div>
          <div style={{fontSize:11,color:'#888',marginTop:2}}>Business Manager</div>
        </div>
        {TABS.map(t=>(
          <div key={t} onClick={()=>setTab(t)} style={{padding:'10px 20px',cursor:'pointer',fontSize:14,color:tab===t?'#111':'#666',background:tab===t?'#f5f5f3':'transparent',fontWeight:tab===t?600:400,borderRight:tab===t?'2px solid #378ADD':'2px solid transparent'}}>{t}</div>
        ))}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:'#fff',borderBottom:'1px solid #e5e5e5',padding:'14px 24px'}}>
          <span style={{fontWeight:600,fontSize:16}}>{tab}</span>
        </div>
        <div style={{flex:1,overflow:'auto',padding:24}}>
          {tab==='Dashboard'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
                {[['Total Orders',orders.length],['Revenue','RM '+revenue.toLocaleString()],['Packages',flor.length],['Boxes Sold',orders.reduce((s,o)=>s+(Number(o['Fior boxes'])||0),0)]].map(([l,v])=>(
                  <div key={l} style={{background:'#f5f5f3',borderRadius:10,padding:16}}>
                    <div style={{fontSize:11,color:'#888',marginBottom:6,textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontSize:24,fontWeight:600}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{fontWeight:500,marginBottom:12}}>Recent Orders</div>
              {loading?<div>Loading...</div>:<OrdersTable data={orders.slice(0,10)}/>}
            </div>
          )}
          {tab==='Fior Package'&&(loading?<div>Loading...</div>:<FlorTable data={flor}/>)}
          {tab==='Orders'&&(loading?<div>Loading...</div>:<OrdersTable data={orders}/>)}
        </div>
      </div>
    </div>
  )
}

function FlorTable({data}){
  if(!data.length) return <div style={{color:'#888'}}>No data</div>
  return(
    <div style={{background:'#fff',borderRadius:10,border:'1px solid #e5e5e5',overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['SKU','SKU Name','Price','Fior Boxes'].map(h=><th key={h} style={{textAlign:'left',padding:'10px 14px',fontSize:11,fontWeight:600,color:'#888',background:'#fafafa',borderBottom:'1px solid #e5e5e5',textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
        <tbody>{data.map((r,i)=><tr key={i} style={{borderBottom:i<data.length-1?'1px solid #f0f0f0':'none'}}><td style={{padding:'10px 14px'}}>{r['SKU']}</td><td style={{padding:'10px 14px'}}>{r['SKU Name']}</td><td style={{padding:'10px 14px'}}>RM {r['Price']}</td><td style={{padding:'10px 14px'}}>{r['Fior Boxes']}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function OrdersTable({data}){
  if(!data.length) return <div style={{color:'#888'}}>No orders</div>
  return(
    <div style={{background:'#fff',borderRadius:10,border:'1px solid #e5e5e5',overflow:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['Order No','Date','Name','Phone','Package','Total Price','Boxes','Channel','Type'].map(h=><th key={h} style={{textAlign:'left',padding:'10px 14px',fontSize:11,fontWeight:600,color:'#888',background:'#fafafa',borderBottom:'1px solid #e5e5e5',textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
        <tbody>{data.map((r,i)=><tr key={i} style={{borderBottom:i<data.length-1?'1px solid #f0f0f0':'none'}}><td style={{padding:'10px 14px',whiteSpace:'nowrap'}}>{r['\u7ebf\u4e0a\u5355\u53f7']}</td><td style={{padding:'10px 14px',whiteSpace:'nowrap'}}>{r['Date']}</td><td style={{padding:'10px 14px'}}>{r['Name']}</td><td style={{padding:'10px 14px',whiteSpace:'nowrap'}}>{r['Phone number']}</td><td style={{padding:'10px 14px'}}>{r['Package']}</td><td style={{padding:'10px 14px',whiteSpace:'nowrap'}}>{r['Total Price']}</td><td style={{padding:'10px 14px'}}>{r['Fior boxes']}</td><td style={{padding:'10px 14px'}}>{r['Channel']}</td><td style={{padding:'10px 14px'}}>{r['new/repeat Manual']}</td></tr>)}</tbody>
      </table>
    </div>
  )
}
