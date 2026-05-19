
// components.jsx — atoms, icons, Clay 3D shapes, UI mockups

const { useState } = React;

const I = {
  inbox: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 13l3-8h12l3 8"/><path d="M3 13v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/><path d="M3 13h5l1.5 3h5L16 13h5"/>
    </svg>
  ),
  users: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="8" r="3.2"/><path d="M2.5 19c.7-3.4 3.4-5.2 6.5-5.2s5.8 1.8 6.5 5.2"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.4c2.6 0 4.6 1.5 5.2 4.1"/>
    </svg>
  ),
  check: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 12.5l2.6 2.6L16 9.5"/>
    </svg>
  ),
  doc: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M14 3.5V8h4"/><path d="M9 12h6M9 15.5h4"/>
    </svg>
  ),
  receipt: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>
    </svg>
  ),
  spark: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>
    </svg>
  ),
  chart: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12" y="9" width="3" height="9" rx="1"/><rect x="17" y="6" width="3" height="12" rx="1"/>
    </svg>
  ),
  plug: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 3v4M15 3v4"/><rect x="6" y="7" width="12" height="6" rx="2"/><path d="M12 13v3a3 3 0 0 0 3 3h0"/>
    </svg>
  ),
  whats: (p={}) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...p}><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 22l5.4-1.3A9.5 9.5 0 1 0 12 2.5zm5.5 13.5c-.2.6-1.3 1.2-1.8 1.2-.5 0-1.1.2-3.6-1-2.6-1.2-4.3-3.8-4.4-3.9-.1-.2-1-1.4-1-2.7s.7-1.9.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.7.8 1.8.1.2.1.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.4-.5.5-.2.2-.4.4-.2.7.2.4.9 1.4 1.9 2.2 1.3 1.1 2.3 1.4 2.6 1.6.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.7.8 2 1 .3.1.5.2.6.3.1.1.1.5-.1 1z"/></svg>
  ),
  arrow: (p={}) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  ),
  plus: (p={}) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>
  ),
  minus: (p={}) => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M5 12h14"/></svg>
  ),
};

function Btn({variant='primary', size, children, style={}, ...rest}){
  const cls = `btn btn-${variant}${size==='lg'?' btn-lg':''}`;
  return <button className={cls} style={style} {...rest}>{children}</button>;
}
function Eyebrow({children, color}){
  return <div className="eyebrow" style={color?{color}:undefined}>{children}</div>;
}
function Chip({children, tone='neutral', style={}}){
  const map={neutral:'chip',indigo:'chip chip-indigo',mint:'chip chip-mint'};
  return <span className={map[tone]||'chip'} style={style}>{children}</span>;
}

function Logo(){
  return (
    <a className="logo" href="#">
      <span className="logo-mark"/>
      PymesHub
    </a>
  );
}

// Clay soft-3D shapes
function Clay({shape='ball', size=80, color='#A5B0FF', style={}, children, className=''}){
  const cls = `clay ${shape==='cube'?'cube':shape==='pill'?'pill':shape==='bubble'?'bubble':shape==='tab'?'tab':shape==='diamond'?'diamond':''} ${className}`;
  return (
    <div className={cls} style={{width:size,height:size,'--clay-c':color,...style}}>
      {children}
    </div>
  );
}

function ClayDocStack({size=110, color='#FFE8DA', style={}}){
  return (
    <div style={{position:'relative',width:size*1.2,height:size,...style}}>
      <div style={{position:'absolute',inset:'14% 12% 22% 4%',borderRadius:18,
        background:`linear-gradient(140deg, ${color}, color-mix(in oklab, ${color}, black 14%))`,
        boxShadow:'inset 0 4px 8px rgba(255,255,255,.5),inset 0 -8px 16px rgba(0,0,0,.18),0 14px 28px -10px rgba(0,0,0,.25)',
        transform:'rotate(-7deg)'}}/>
      <div style={{position:'absolute',inset:'6% 2% 8% 16%',borderRadius:18,
        background:`linear-gradient(140deg, color-mix(in oklab, ${color}, white 18%), ${color})`,
        boxShadow:'inset 0 4px 8px rgba(255,255,255,.6),inset 0 -8px 16px rgba(0,0,0,.18),0 18px 32px -10px rgba(0,0,0,.3)',
        transform:'rotate(6deg)'}}/>
    </div>
  );
}

function ClayAINode({size=120, style={}}){
  return (
    <div style={{position:'relative',width:size,height:size,...style}}>
      <Clay shape="ball" size={size} color="#6366F1"/>
      <div style={{position:'absolute',top:'12%',right:'-8%'}}><Clay shape="diamond" size={size*0.32} color="#FFF0BE"/></div>
      <div style={{position:'absolute',bottom:'-6%',left:'-2%'}}><Clay shape="ball" size={size*0.28} color="#FFDFE9"/></div>
    </div>
  );
}

function ClayBubble({size=120, color='#22C55E', text, style={}}){
  return (
    <div style={{position:'relative',width:size*1.1,height:size,...style}}>
      <div className="clay bubble" style={{width:'100%',height:'85%','--clay-c':color,position:'absolute',left:0,top:0}}>
        {text && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:size*0.18}}>{text}</div>}
      </div>
    </div>
  );
}

// Hero 3D scene
function HeroScene(){
  return (
    <div style={{position:'relative',width:'100%',aspectRatio:'1 / 1',maxWidth:560,margin:'0 auto'}}>
      <div style={{position:'absolute',inset:'8% 8% 4% 8%',borderRadius:'50%',
        background:'radial-gradient(circle, rgba(165,176,255,.55), rgba(165,176,255,0) 65%)',filter:'blur(8px)'}}/>
      <div style={{position:'absolute',left:'18%',top:'18%',width:'64%',aspectRatio:'1/1'}}>
        <Clay shape="ball" size="100%" color="#6366F1" style={{width:'100%',height:'100%'}}/>
      </div>
      <div style={{position:'absolute',right:'4%',top:'10%'}}>
        <Clay shape="ball" size={92} color="#7BD8A0"/>
      </div>
      <div style={{position:'absolute',left:'-2%',top:'8%'}}>
        <ClayBubble size={130} color="#25D366" text="" />
      </div>
      <div style={{position:'absolute',right:'-2%',bottom:'12%'}}>
        <Clay shape="cube" size={110} color="#C9B7FF"/>
      </div>
      <div style={{position:'absolute',left:'4%',bottom:'4%'}}>
        <Clay shape="pill" size={120} color="#FFB99A" style={{height:80}}/>
      </div>
      <div style={{position:'absolute',left:'48%',bottom:'-2%'}}>
        <Clay shape="diamond" size={64} color="#FFE08A"/>
      </div>
      <div className="glass" style={{position:'absolute',right:'2%',top:'34%',width:200,padding:14,transform:'rotate(4deg)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className="avatar" style={{background:'linear-gradient(135deg,#FF8A5B,#FF4D8D)'}}>MR</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <div style={{fontWeight:700,fontSize:13}}>María Rojas</div>
            <div style={{fontSize:11,color:'#6F6F7A'}}>Ferretería Volcán · CR</div>
          </div>
        </div>
        <div style={{display:'flex',gap:6,marginTop:10}}>
          <span style={{fontSize:11,padding:'4px 8px',borderRadius:999,background:'#EEF0FF',color:'#3730A3',fontWeight:600}}>Lead caliente</span>
          <span style={{fontSize:11,padding:'4px 8px',borderRadius:999,background:'#DCF3E0',color:'#1F5A3A',fontWeight:600}}>$ 2.4k</span>
        </div>
      </div>
      <div style={{position:'absolute',left:'-4%',top:'48%'}}>
        <Clay shape="ball" size={28} color="#FFFFFF"/>
      </div>
    </div>
  );
}

// Inbox mockup
function InboxMockup({compact=false}){
  const rows = [
    {avatar:'MR', name:'María Rojas',  msg:'¿Tienen disponible el modelo XR?', tag:'WhatsApp', tagBg:'#DCF3E0', tagInk:'#1F5A3A', time:'2m'},
    {avatar:'JG', name:'Juan García',  msg:'Adjunto la factura del pedido…',   tag:'Email',    tagBg:'#DBEBFF', tagInk:'#1F3C73', time:'14m', active:true},
    {avatar:'AL', name:'Andrea López', msg:'Confirmo entrega para mañana 9 am', tag:'WhatsApp', tagBg:'#DCF3E0', tagInk:'#1F5A3A', time:'1h'},
    {avatar:'PC', name:'Pablo Castro', msg:'Necesito una cotización para…',     tag:'WhatsApp', tagBg:'#DCF3E0', tagInk:'#1F5A3A', time:'3h'},
  ];
  const shown = compact ? rows.slice(0,3) : rows;
  return (
    <div className="win" style={{width:'100%'}}>
      <div className="win-bar">
        <span className="win-dot r"/><span className="win-dot y"/><span className="win-dot g"/>
        <div style={{marginLeft:12,fontSize:12,color:'#6F6F7A',fontWeight:600}}>Bandeja unificada — Hoy</div>
      </div>
      <div style={{padding:'10px 8px'}}>
        {shown.map((r,i)=>(
          <div key={i} className="row-line" style={r.active?{background:'rgba(79,70,229,0.08)'}:{}}>
            <div className="avatar" style={{width:32,height:32,fontSize:12,background:`hsl(${(i*70)%360} 70% 60%)`}}>{r.avatar}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontWeight:700,fontSize:13,color:'#0B0B0F'}}>{r.name}</div>
                <div style={{fontSize:11,color:'#9A9AA4'}}>{r.time}</div>
              </div>
              <div style={{fontSize:12.5,color:'#6F6F7A',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.msg}</div>
            </div>
            <span style={{fontSize:10.5,padding:'3px 7px',borderRadius:999,background:r.tagBg,color:r.tagInk,fontWeight:700}}>{r.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CRMMockup(){
  const cols=[
    {t:'Nuevos',n:8,c:'#EEF0FF',i:'#3730A3'},
    {t:'En seguimiento',n:14,c:'#FFF0BE',i:'#705A12'},
    {t:'Por cerrar',n:5,c:'#DCF3E0',i:'#1F5A3A'},
  ];
  return (
    <div className="win" style={{padding:14,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
      {cols.map((c,i)=>(
        <div key={i} style={{background:c.c,borderRadius:12,padding:10}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontWeight:700,fontSize:11,color:c.i}}>{c.t}</span>
            <span style={{fontSize:10,color:c.i,opacity:.7}}>{c.n}</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <div style={{background:'#fff',borderRadius:8,padding:'8px 9px'}}>
              <div className="bar" style={{width:'70%'}}/>
              <div className="bar tiny" style={{marginTop:5,height:6}}/>
            </div>
            <div style={{background:'#fff',borderRadius:8,padding:'8px 9px'}}>
              <div className="bar" style={{width:'55%'}}/>
              <div className="bar tiny" style={{marginTop:5,height:6}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartMockup({dark=false}){
  const bars=[40,62,55,80,72,90,68,84];
  return (
    <div className={dark?'glass-dark':'glass'} style={{padding:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <div>
          <div style={{fontSize:11,opacity:.6,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase'}}>Conversaciones · 7 días</div>
          <div style={{fontFamily:'Bricolage Grotesque',fontSize:30,fontWeight:700,letterSpacing:'-.02em',marginTop:2}}>1,284 <span style={{fontSize:14,color:'#22A06B'}}>↑ 18%</span></div>
        </div>
        <span className="chip" style={{background:'rgba(99,102,241,.15)',color:'#3730A3'}}>Tiempo de resp. 6m</span>
      </div>
      <div style={{display:'flex',alignItems:'flex-end',gap:9,height:70}}>
        {bars.map((h,i)=>(
          <div key={i} style={{flex:1,height:`${h}%`,borderRadius:6,
            background:`linear-gradient(180deg, ${i===5?'#6366F1':'rgba(99,102,241,0.35)'} 0%, ${i===5?'#4F46E5':'rgba(99,102,241,0.18)'} 100%)`}}/>
        ))}
      </div>
    </div>
  );
}

function AutomationMockup(){
  const Node=({label, color='#fff', dark})=> (
    <div style={{padding:'9px 12px',borderRadius:12,fontSize:12.5,fontWeight:600,
      background:color,color:dark?'#fff':'#0B0B0F',
      boxShadow:'0 8px 18px -8px rgba(0,0,0,.25),inset 0 0 0 1px rgba(11,11,15,.06)'}}>{label}</div>
  );
  const Edge=()=> <div style={{height:18,width:2,background:'rgba(11,11,15,.18)',margin:'0 auto',borderRadius:1}}/>;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'stretch',gap:0,maxWidth:240,margin:'0 auto'}}>
      <Node label="📩  Nuevo mensaje en WhatsApp"/>
      <Edge/>
      <Node label="✨  Clasificar con IA" color="#4F46E5" dark/>
      <Edge/>
      <Node label="👤  Asignar a vendedor"/>
      <Edge/>
      <Node label="📅  Crear seguimiento" color="#DCF3E0"/>
    </div>
  );
}

function InvoiceMockup(){
  return (
    <div className="win" style={{padding:18,maxWidth:300}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#6F6F7A',letterSpacing:'.08em',textTransform:'uppercase'}}>Factura #0481</div>
        <span style={{fontSize:11,padding:'3px 8px',borderRadius:999,background:'#DCF3E0',color:'#1F5A3A',fontWeight:700}}>Pagada</span>
      </div>
      <div style={{fontFamily:'Bricolage Grotesque',fontWeight:700,fontSize:30,letterSpacing:'-.02em',margin:'10px 0 14px'}}>₡ 248 500</div>
      <div className="hr"/>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontSize:12.5,color:'#6F6F7A'}}>
        <span>Hacienda — e-factura</span><span style={{color:'#1F5A3A',fontWeight:700}}>✓ Validada</span>
      </div>
    </div>
  );
}

Object.assign(window, {
  I, Btn, Eyebrow, Chip, Logo,
  Clay, ClayDocStack, ClayAINode, ClayBubble,
  HeroScene, InboxMockup, CRMMockup, ChartMockup, AutomationMockup, InvoiceMockup,
});
