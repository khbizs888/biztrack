import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://alzrtdyayhqspdaaxdla.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsenJ0ZHlheWhxc3BkYWF4ZGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTAyNzcsImV4cCI6MjA4OTcyNjI3N30.qET8aoQDdbibSYGs1djSwA4p9P_I3rVRuHwGKcVJAO8')

const TABS = ['Dashboard','Fior Package','Orders']
const EMPTY = {'线上单号':'','Date':'','Name':'','Phone number':'','Package':'','Total Price':'','Fior boxes':'','Channel':'','new/repeat Manual':'','Purchase reason':''}

function BarChart({data,color='#7c6af7'}){
  if(!data.length) return null
  const max=Math.max(...data.map(d=>d.value),1)
  return(
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height:120,padding:'0 4px'}}>
      {data.map((d,i)=>(
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
          <div style={{fontSize:9,color:'#555'}}>{d.value>0?d.value:''}</div>
          <div style={{width:'100%',background:color,borderRadius:'4px 4px 0 0',height:Math.max((d.value/max)*90,d.value>0?4:0),opacity:0.85,transition:'height 0.3s'}}/>
          <div style={{fontSize:9,color:'#555',textAlign:'center',whiteSpace:'nowrap',overflow:'hidden',maxWidth:36}}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [tab,setTab]=useState('Dashboard')
  const [pkgs,setPkgs]=useState([])
  const [orders,setOrders]=useState([])
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [form,setForm]=useState(EMPTY)
  const [saving,setSaving]=useState(false)
  const [msg,setMsg]=useState('')
  const [chartView,setChartView]=useState('monthly')

  useEffect(()=>{ load() },[])

  async function load(){
    setLoading(true)
    const [{data:a},{data:b}]=await Promise.all([
      supabase.from('Fior Package').select('*'),
      supabase.from('2026 Fior Daily order').select('*')
    ])
    setPkgs(a||[])
    setOrders(b||[])
    setLoading(false)
  }

  function pickPackage(name){
    const p=pkgs.find(x=>x['SKU Name']===name)
    setForm({...form,'Package':name,'Total Price':p?String(p['Price']):'','Fior boxes':p?String(p['Fior Boxes']):''})
  }

  async function saveOrder(){
    if(!form['线上单号']){setMsg('Order No is required!');return}
    setSaving(true)
    const {error}=await supabase.from('2026 Fior Daily order').insert([form])
    if(error){setMsg('Error: '+error.message)}
    else{setMsg('Saved!');setShowForm(false);setForm(EMPTY);load()}
    setSaving(false)
    setTimeout(()=>setMsg(''),3000)
  }

  const revenue=orders.reduce((s,o)=>s+(parseFloat(String(o['Total Price']).replace('RM','').trim())||0),0)
  const boxes=orders.reduce((s,o)=>s+(Number(o['Fior boxes'])||0),0)

  function getMonthlyData(){
    const map={}
    orders.forEach(o=>{
      if(!o['Date']) return
      const parts=o['Date'].split('/')
      if(parts.length<2) return
      const key=parts[1]+'/'+parts[2]?.slice(-2)
      const val=parseFloat(String(o['Total Price']).replace('RM','').trim())||0
      map[key]=(map[key]||0)+val
    })
    return Object.entries(map).sort().map(([label,value])=>({label,value:Math.round(value)}))
  }

  function getWeeklyData(){
    const map={}
    orders.forEach(o=>{
      if(!o['Date']) return
      const parts=o['Date'].split('/')
      if(parts.length<3) return
      const d=new Date(parts[2],parts[1]-1,parts[0])
      const week='W'+Math.ceil(d.getDate()/7)+' '+d.toLocaleString('default',{month:'short'})
      const val=parseFloat(String(o['Total Price']).replace('RM','').trim())||0
      map[week]=(map[week]||0)+val
    })
    return Object.entries(map).slice(-8).map(([label,value])=>({label,value:Math.round(value)}))
  }

  function getChannelData(){
    const map={}
    orders.forEach(o=>{
      const ch=o['Channel']||'Unknown'
      const val=parseFloat(String(o['Total Price']).replace('RM','').trim())||0
      map[ch]=(map[ch]||0)+val
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value:Math.round(value)}))
  }

  function getPackageData(){
    const map={}
    orders.forEach(o=>{
      const pk=o['Package']||'Unknown'
      map[pk]=(map[pk]||0)+1
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}))
  }

  const chartData = chartView==='monthly'?getMonthlyData():chartView==='weekly'?getWeeklyData():chartView==='channel'?getChannelData():getPackageData()
  const newCount=orders.filter(o=>o['new/repeat Manual']?.toLowerCase()==='new').length
  const repeatCount=orders.filter(o=>o['new/repeat Manual']?.toLowerCase()==='repeat').length

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'-apple-system,sans-serif',background:'#0f0f13'}}>
      <div style={{width:220,background:'#16161d',borderRight:'1px solid #2a2a35',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'24px 20px',borderBottom:'1px solid #2a2a35'}}>
          <div style={{fontWeight:700,fontSize:22,color:'#fff',letterSpacing:3}}>FIOR</div>
          <div style={{fontSize:11,color:'#555',marginTop:4,letterSpacing:1}}>BUSINESS DASHBOARD</div>
        </div>
        <div style={{padding:'12px 0',flex:1}}>
          {TABS.map(t=>(
            <div key={t} onClick={()=>setTab(t)} style={{padding:'12px 20px',cursor:'pointer',fontSize:13,color:tab===t?'#fff':'#555',background:tab===t?'#1e1e2e':'transparent',borderLeft:tab===t?'3px solid #7c6af7':'3px solid transparent',display:'flex',alignItems:'center',gap:10}}>
              <span style={{opacity:tab===t?1:0.4}}>{t==='Dashboard'?'▦':t==='Fior Package'?'◈':'◎'}</span>{t}
            </div>
          ))}
        </div>
        <div style={{padding:'16px 20px',borderTop:'1px solid #2a2a35',fontSize:11,color:'#333'}}>v1.0 · Live</div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:'#16161d',borderBottom:'1px solid #2a2a35',padding:'16px 28px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:600,fontSize:18,color:'#fff'}}>{tab}</div>
            <div style={{fontSize:11,color:'#555',marginTop:2}}>{new Date().toLocaleDateString('en-MY',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
          </div>
          {tab==='Orders'&&<button onClick={()=>setShowForm(true)} style={{background:'#7c6af7',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:500}}>+ New Order</button>}
        </div>

        {msg&&<div style={{background:msg.includes('Error')?'rgba(162,45,45,0.15)':'rgba(59,109,17,0.15)',color:msg.includes('Error')?'#f87171':'#86efac',padding:'10px 28px',fontSize:13}}>{msg}</div>}

        <div style={{flex:1,overflow:'auto',padding:28}}>
          {tab==='Dashboard'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:28}}>
                {[['Total Orders',orders.length,'#7c6af7'],['Revenue','RM '+revenue.toLocaleString(),'#22d3ee'],['New Customers',newCount,'#f59e0b'],['Boxes Sold',boxes,'#34d399']].map(([l,v,color])=>(
                  <div key={l} style={{background:'#16161d',borderRadius:12,padding:20,border:'1px solid #2a2a35'}}>
                    <div style={{fontSize:11,color:'#555',marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>{l}</div>
                    <div style={{fontSize:26,fontWeight:700,color}}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,marginBottom:28}}>
                <div style={{background:'#16161d',borderRadius:12,padding:20,border:'1px solid #2a2a35'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <div style={{fontSize:13,fontWeight:600,color:'#fff'}}>Revenue Trend</div>
                    <div style={{display:'flex',gap:6}}>
                      {['weekly','monthly','channel','package'].map(v=>(
                        <button key={v} onClick={()=>setChartView(v)} style={{fontSize:10,padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',background:chartView===v?'#7c6af7':'#1e1e2e',color:chartView===v?'#fff':'#555',textTransform:'capitalize'}}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <BarChart data={chartData} color={chartView==='channel'?'#22d3ee':chartView==='package'?'#f59e0b':'#7c6af7'}/>
                </div>
                <div style={{background:'#16161d',borderRadius:12,padding:20,border:'1px solid #2a2a35'}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#fff',marginBottom:16}}>New vs Repeat</div>
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {[['New',newCount,'#7c6af7'],['Repeat',repeatCount,'#22d3ee'],['Other',orders.length-newCount-repeatCount,'#555']].map(([l,v,c])=>(
                      <div key={l}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:12,color:'#888'}}>{l}</span>
                          <span style={{fontSize:12,color:c,fontWeight:600}}>{v}</span>
                        </div>
                        <div style={{background:'#1e1e2e',borderRadius:4,height:6}}>
                          <div style={{background:c,borderRadius:4,height:6,width:orders.length?Math.round((v/orders.length)*100)+'%':'0%',transition:'width 0.5s'}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:20,paddingTop:16,borderTop:'1px solid #2a2a35'}}>
                    <div style={{fontSize:11,color:'#555',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Repeat Rate</div>
                    <div style={{fontSize:24,fontWeight:700,color:'#22d3ee'}}>{orders.length?Math.round((repeatCount/orders.length)*100):0}%</div>
                  </div>
                </div>
              </div>

              <div style={{fontWeight:600,fontSize:13,color:'#555',marginBottom:14,textTransform:'uppercase',letterSpacing:1}}>Recent Orders</div>
              {loading?<div style={{color:'#555'}}>Loading...</div>:<OTable data={orders.slice(0,10)}/>}
            </div>
          )}
          {tab==='Fior Package'&&(loading?<div style={{color:'#555'}}>Loading...</div>:<PTable data={pkgs}/>)}
          {tab==='Orders'&&(loading?<div style={{color:'#555'}}>Loading...</div>:<OTable data={orders}/>)}
        </div>
      </div>

      {showForm&&(
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:'#16161d',border:'1px solid #2a2a35',borderRadius:16,padding:28,width:520,maxHeight:'90vh',overflow:'auto'}}>
            <div style={{fontWeight:700,fontSize:18,color:'#fff',marginBottom:4}}>New Order</div>
            <div style={{fontSize:12,color:'#555',marginBottom:22}}>Fill in order details</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {[['Order No','线上单号'],['Date','Date'],['Name','Name'],['Phone','Phone number'],['Channel','Channel'],['New/Repeat','new/repeat Manual'],['Purchase Reason','Purchase reason']].map(([l,k])=>(
                <div key={k}>
                  <div style={{fontSize:11,color:'#666',marginBottom:5}}>{l}</div>
                  <input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} style={{width:'100%',padding:'9px 12px',background:'#0f0f13',border:'1px solid #2a2a35',borderRadius:8,fontSize:13,color:'#fff',outline:'none',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div style={{gridColumn:'1/-1'}}>
                <div style={{fontSize:11,color:'#666',marginBottom:5}}>Package</div>
                <select value={form['Package']||''} onChange={e=>pickPackage(e.target.value)} style={{width:'100%',padding:'9px 12px',background:'#0f0f13',border:'1px solid #2a2a35',borderRadius:8,fontSize:13,color:'#fff',outline:'none',boxSizing:'border-box'}}>
                  <option value=''>Select package...</option>
                  {pkgs.map(p=><option key={p['SKU Name']} value={p['SKU Name']}>{p['SKU Name']} — RM{p['Price']} ({p['Fior Boxes']} boxes)</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:11,color:'#22d3ee',marginBottom:5}}>Total Price (auto-filled)</div>
                <input value={form['Total Price']||''} onChange={e=>setForm({...form,'Total Price':e.target.value})} style={{width:'100%',padding:'9px 12px',background:'#111',border:'1px solid #22d3ee44',borderRadius:8,fontSize:13,color:'#22d3ee',outline:'none',boxSizing:'border-box'}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'#22d3ee',marginBottom:5}}>Fior Boxes (auto-filled)</div>
                <input value={form['Fior boxes']||''} onChange={e=>setForm({...form,'Fior boxes':e.target.value})} style={{width:'100%',padding:'9px 12px',background:'#111',border:'1px solid #22d3ee44',borderRadius:8,fontSize:13,color:'#22d3ee',outline:'none',boxSizing:'border-box'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:22}}>
              <button onClick={()=>{setShowForm(false);setForm(EMPTY)}} style={{flex:1,padding:'10px',border:'1px solid #2a2a35',borderRadius:8,cursor:'pointer',background:'transparent',fontSize:13,color:'#666'}}>Cancel</button>
              <button onClick={saveOrder} disabled={saving} style={{flex:1,padding:'10px',border:'none',borderRadius:8,cursor:'pointer',background:'#7c6af7',color:'#fff',fontSize:13,fontWeight:500}}>{saving?'Saving...':'Save Order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PTable({data}){
  if(!data.length) return <div style={{color:'#555'}}>No data</div>
  return(
    <div style={{background:'#16161d',borderRadius:12,border:'1px solid #2a2a35',overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['SKU','SKU Name','Price','Fior Boxes'].map(h=><th key={h} style={{textAlign:'left',padding:'12px 16px',fontSize:11,fontWeight:600,color:'#555',background:'#12121a',borderBottom:'1px solid #2a2a35',textTransform:'uppercase',letterSpacing:1}}>{h}</th>)}</tr></thead>
        <tbody>{data.map((r,i)=><tr key={i} style={{borderBottom:i<data.length-1?'1px solid #1e1e2a':'none'}}><td style={{padding:'12px 16px',color:'#7c6af7',fontWeight:500}}>{r['SKU']}</td><td style={{padding:'12px 16px',color:'#ccc'}}>{r['SKU Name']}</td><td style={{padding:'12px 16px',color:'#22d3ee'}}>RM {r['Price']}</td><td style={{padding:'12px 16px',color:'#ccc'}}>{r['Fior Boxes']}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function OTable({data}){
  if(!data.length) return <div style={{color:'#555'}}>No orders</div>
  return(
    <div style={{background:'#16161d',borderRadius:12,border:'1px solid #2a2a35',overflow:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr>{['Order No','Date','Name','Phone','Package','Total Price','Boxes','Channel','Type'].map(h=><th key={h} style={{textAlign:'left',padding:'12px 16px',fontSize:11,fontWeight:600,color:'#555',background:'#12121a',borderBottom:'1px solid #2a2a35',textTransform:'uppercase',letterSpacing:1,whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
        <tbody>{data.map((r,i)=><tr key={i} style={{borderBottom:i<data.length-1?'1px solid #1e1e2a':'none'}}><td style={{padding:'12px 16px',color:'#7c6af7',fontWeight:500,whiteSpace:'nowrap'}}>{r['线上单号']}</td><td style={{padding:'12px 16px',color:'#888',whiteSpace:'nowrap'}}>{r['Date']}</td><td style={{padding:'12px 16px',color:'#ccc'}}>{r['Name']}</td><td style={{padding:'12px 16px',color:'#888',whiteSpace:'nowrap'}}>{r['Phone number']}</td><td style={{padding:'12px 16px',color:'#ccc'}}>{r['Package']}</td><td style={{padding:'12px 16px',color:'#22d3ee',whiteSpace:'nowrap'}}>{r['Total Price']}</td><td style={{padding:'12px 16px',color:'#ccc'}}>{r['Fior boxes']}</td><td style={{padding:'12px 16px',color:'#ccc'}}>{r['Channel']}</td><td style={{padding:'12px 16px'}}><span style={{background:r['new/repeat Manual']?.toLowerCase()==='new'?'rgba(124,106,247,0.15)':'rgba(34,211,238,0.1)',color:r['new/repeat Manual']?.toLowerCase()==='new'?'#7c6af7':'#22d3ee',padding:'3px 10px',borderRadius:99,fontSize:11}}>{r['new/repeat Manual']}</span></td></tr>)}</tbody>
      </table>
    </div>
  )
}
