
// bento.jsx — four bento grid variants for PymesHub

const FEATS = {
  inbox: {
    title:'Bandeja unificada',
    desc:'WhatsApp, email y más canales en un solo espacio de trabajo.',
    outcome:'Nunca pierdas una conversación con un cliente.',
    eyebrow:'01 · Conversaciones',
    icon:<I.inbox/>, tone:'lav',
  },
  crm: {
    title:'CRM y contactos',
    desc:'Cada cliente, oportunidad e interacción organizada de un vistazo.',
    outcome:'Cierra más ventas con menos esfuerzo.',
    eyebrow:'02 · Relaciones',
    icon:<I.users/>, tone:'peach',
  },
  tasks: {
    title:'Tareas y seguimientos',
    desc:'Recordatorios y próximos pasos asignados automáticamente.',
    outcome:'Ningún lead queda olvidado.',
    eyebrow:'03 · Operación',
    icon:<I.check/>, tone:'mint',
  },
  docs: {
    title:'Documentos & OCR',
    desc:'Cotizaciones, recibos y contratos escaneados y clasificados.',
    outcome:'Reduce el papeleo manual al mínimo.',
    eyebrow:'04 · Información',
    icon:<I.doc/>, tone:'butter',
  },
  billing: {
    title:'Facturación electrónica',
    desc:'Integrada con Hacienda y los requisitos fiscales de cada país.',
    outcome:'Simplifica el trabajo administrativo y de cobro.',
    eyebrow:'05 · Cobros',
    icon:<I.receipt/>, tone:'blush',
  },
  ai: {
    title:'Automatizaciones e IA',
    desc:'Resúmenes, clasificación y respuestas sugeridas, listas para usar.',
    outcome:'Ahorra horas de trabajo repetitivo cada semana.',
    eyebrow:'06 · Inteligencia',
    icon:<I.spark/>, tone:'mocha',
  },
  analytics: {
    title:'Analítica e insights',
    desc:'Rendimiento, tiempo de respuesta y actividad de ventas en vivo.',
    outcome:'Toma decisiones con datos reales, no intuición.',
    eyebrow:'07 · Decisiones',
    icon:<I.chart/>, tone:'sky',
  },
  integrations: {
    title:'Integraciones',
    desc:'Conecta WhatsApp, Stripe, Calendar, QuickBooks y mucho más.',
    outcome:'Elimina los flujos de trabajo desconectados.',
    eyebrow:'08 · Ecosistema',
    icon:<I.plug/>, tone:'sand',
  },
};

function Tile({featKey, tone, size='md', illustrations='on', children, style={}}){
  const f = FEATS[featKey];
  const sizeCls = size==='hero' ? 'size-hero' : size==='xl' ? 'size-xl' : size==='tall' ? 'size-tall' : '';
  return (
    <div className={`tile ${tone||f.tone} ${sizeCls}`} style={style}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,fontSize:12,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',opacity:.62}}>
          {f.icon} <span>{f.eyebrow}</span>
        </div>
        <div className="tile-title">{f.title}</div>
        <div className="tile-desc">{f.desc}</div>
      </div>
      {children}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:18}}>
        <div style={{fontWeight:700,fontSize:14,lineHeight:1.3,opacity:.9}}>→ {f.outcome}</div>
      </div>
    </div>
  );
}

function AccentSlot({type, illustrations}){
  if(illustrations==='off') return null;
  const opacity = illustrations==='subtle' ? 0.45 : 1;
  const size = illustrations==='subtle' ? 70 : 110;
  const wrap = (el)=> (
    <div style={{position:'absolute',right:18,bottom:18,opacity,pointerEvents:'none'}}>{el}</div>
  );
  switch(type){
    case 'inbox':        return wrap(<ClayBubble size={size} color="#25D366"/>);
    case 'crm':          return wrap(<Clay shape="ball" size={size*0.9} color="#FF8A5B"/>);
    case 'tasks':        return wrap(
      <div style={{position:'relative'}}>
        <Clay shape="cube" size={size*0.85} color="#7BD8A0"/>
        <div style={{position:'absolute',right:-14,top:-14}}><Clay shape="ball" size={36} color="#fff"/></div>
      </div>
    );
    case 'docs':         return wrap(<ClayDocStack size={size} color="#FFD07A"/>);
    case 'billing':      return wrap(<Clay shape="tab" size={size*1.1} color="#FF93B1" style={{height:size*0.7}}/>);
    case 'ai':           return wrap(<ClayAINode size={size}/>);
    case 'analytics':    return wrap(<Clay shape="ball" size={size*0.9} color="#6FB3FF"/>);
    case 'integrations': return wrap(<Clay shape="pill" size={size} color="#C9B7FF" style={{height:size*0.55}}/>);
    default: return null;
  }
}

function ATile({featKey, tone, size, illustrations}){
  return (
    <Tile featKey={featKey} tone={tone} size={size} illustrations={illustrations}>
      <AccentSlot type={featKey} illustrations={illustrations}/>
    </Tile>
  );
}

// Variant 2 — Hero feature dominant (the one the user chose: "I liked V2")
function BentoHeroDominant({illustrations='on'}){
  return (
    <div className="bento" style={{gridTemplateColumns:'repeat(4, 1fr)',gridAutoRows:'minmax(280px, auto)'}}>
      <div style={{gridColumn:'1 / span 2',gridRow:'1 / span 2'}}>
        <Tile featKey="inbox" tone="lav" size="hero" illustrations={illustrations}>
          <div style={{margin:'18px 0 0'}}><InboxMockup/></div>
          {illustrations!=='off' && (
            <div style={{position:'absolute',right:-28,top:-28,opacity:0.95,pointerEvents:'none'}}>
              <Clay shape="ball" size={150} color="#6366F1"/>
            </div>
          )}
        </Tile>
      </div>
      <ATile featKey="crm"          illustrations={illustrations}/>
      <ATile featKey="tasks"        illustrations={illustrations}/>
      <ATile featKey="ai"           illustrations={illustrations}/>
      <ATile featKey="docs"         illustrations={illustrations}/>
      <div style={{gridColumn:'1 / span 2'}}>
        <ATile featKey="billing"    illustrations={illustrations}/>
      </div>
      <ATile featKey="analytics"    illustrations={illustrations}/>
      <ATile featKey="integrations" illustrations={illustrations}/>
    </div>
  );
}

function BentoGrid({variant='hero', illustrations}){
  return <BentoHeroDominant illustrations={illustrations ?? 'on'}/>;
}

Object.assign(window, { FEATS, Tile, ATile, AccentSlot, BentoGrid, BentoHeroDominant });
