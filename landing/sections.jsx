
// sections.jsx — all landing page sections

const { useState: useStateS } = React;

function Nav(){
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Logo/>
        <div style={{display:'flex',gap:24,marginLeft:18}}>
          {['Producto','Soluciones','Integraciones','Precios','Recursos'].map(l=>(
            <a key={l} href="#" className="link">{l}</a>
          ))}
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:10,alignItems:'center'}}>
          <a href="#" className="link">Iniciar sesión</a>
          <Btn variant="primary">Solicitar demo</Btn>
        </div>
      </div>
    </nav>
  );
}

function SocialProof(){
  const brands=['Volcán','Cafetería Sol','Avilés Auto','Mar y Sol','Tecno Plus','Ferretería Real','Pura Vida','La Bodega'];
  return (
    <section className="section-tight" style={{padding:'48px 80px',maxWidth:1440,margin:'0 auto'}}>
      <div style={{textAlign:'center'}}>
        <div className="kicker" style={{color:'#6F6F7A'}}>Usado por negocios que crecen en Latinoamérica</div>
        <div style={{display:'flex',justifyContent:'center',gap:40,flexWrap:'wrap',marginTop:22,opacity:0.7}}>
          {brands.map(b=>(
            <span key={b} style={{fontFamily:'Bricolage Grotesque',fontWeight:700,fontSize:22,color:'#2F2F38',letterSpacing:'-.02em',opacity:.7}}>{b}</span>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:0,marginTop:48,borderTop:'1px solid #E4E4E8',borderBottom:'1px solid #E4E4E8'}}>
        {[
          ['12,400+','conversaciones centralizadas al día'],
          ['38%','más rápido el tiempo de respuesta'],
          ['+22 países','en Latinoamérica'],
          ['4.9 ★','satisfacción del equipo de soporte'],
        ].map(([n,l],i)=>(
          <div key={i} style={{padding:'34px 28px',borderLeft:i?'1px solid #E4E4E8':'none'}}>
            <div className="display" style={{fontSize:44,letterSpacing:'-.03em',color:'var(--indigo)'}}>{n}</div>
            <div style={{marginTop:6,color:'#6F6F7A',fontSize:14.5,maxWidth:'28ch'}}>{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks(){
  const steps=[
    {n:'01', t:'Conecta tus canales', d:'WhatsApp, email y formularios listos en minutos. Sin código, sin fricción.',
      color:'#DCF3E0', ink:'#1F5A3A', el:<ClayBubble size={150} color="#25D366"/>},
    {n:'02', t:'Organiza tu negocio', d:'Contactos, oportunidades, tareas y documentos en un solo espacio.',
      color:'#FFE8DA', ink:'#7B3A1E', el:<Clay shape="cube" size={140} color="#FF8A5B"/>},
    {n:'03', t:'Automatiza con IA',   d:'Resúmenes, clasificación y respuestas sugeridas en cada conversación.',
      color:'#E6E3FF', ink:'#332A77', el:<ClayAINode size={150}/>},
  ];
  return (
    <section className="section">
      <div style={{display:'flex',alignItems:'end',justifyContent:'space-between',gap:32,marginBottom:42}}>
        <div style={{maxWidth:'58ch'}}>
          <Eyebrow>Cómo funciona</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14}}>De caos a control,<br/><span className="serifit" style={{color:'var(--indigo)'}}>en tres pasos.</span></h2>
        </div>
        <p className="lead" style={{maxWidth:'40ch'}}>Una narrativa simple para una plataforma con mucha profundidad por debajo.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:18}}>
        {steps.map(s=>(
          <div key={s.n} className="tile" style={{background:s.color,color:s.ink,minHeight:380,padding:32,justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div className="display" style={{fontSize:54,letterSpacing:'-.03em',opacity:.45}}>{s.n}</div>
            </div>
            <div style={{display:'flex',justifyContent:'center',padding:'8px 0',minHeight:160}}>
              {s.el}
            </div>
            <div>
              <div className="tile-title" style={{fontSize:30}}>{s.t}</div>
              <div className="tile-desc" style={{marginTop:8,opacity:.78}}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureBento(){
  return (
    <section className="section">
      <div style={{display:'flex',alignItems:'end',justifyContent:'space-between',gap:32,marginBottom:42}}>
        <div style={{maxWidth:'62ch'}}>
          <Eyebrow>Una plataforma. Todo el negocio.</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14}}>Ocho módulos diseñados para<br/><span className="serifit" style={{color:'var(--indigo)'}}>trabajar como uno solo.</span></h2>
        </div>
        <p className="lead" style={{maxWidth:'42ch'}}>Cada módulo aporta capacidad y resultado. Empieza por la bandeja unificada o conecta todo a la vez.</p>
      </div>
      <BentoGrid variant="hero" illustrations="on"/>
    </section>
  );
}

function Benefits(){
  const list=[
    ['Nunca pierdas un lead', 'Cada conversación queda registrada, asignada y con seguimiento.'],
    ['Responde más rápido',   'La IA prepara respuestas y resúmenes en segundos.'],
    ['Centraliza la operación','Ventas, soporte, cobros y documentos en un solo lugar.'],
    ['Automatiza lo repetitivo','Flujos sencillos para liberar a tu equipo del trabajo manual.'],
    ['Escala con eficiencia', 'Crece sin tener que sumar más herramientas dispersas.'],
    ['Equipo más alineado',   'Visibilidad clara de quién, qué y cuándo en tu negocio.'],
  ];
  return (
    <section className="section-bg-dark">
      <div className="section">
        <div style={{maxWidth:'52ch'}}>
          <Eyebrow color="#A5B0FF">Resultados de negocio</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14,color:'#fff'}}>
            No vendemos software.<br/>
            <span className="serifit" style={{color:'#A5B0FF'}}>Vendemos tiempo, foco y crecimiento.</span>
          </h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:28,marginTop:54}}>
          {list.map(([t,d],i)=>(
            <div key={i} style={{display:'flex',flexDirection:'column',gap:10,paddingRight:16}}>
              <div style={{display:'flex',alignItems:'center',gap:10,fontFamily:'Bricolage Grotesque',fontSize:22,fontWeight:700,color:'#fff',letterSpacing:'-.015em'}}>
                <span style={{display:'inline-flex',width:32,height:32,borderRadius:10,background:'rgba(165,176,255,.12)',color:'#A5B0FF',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,boxShadow:'inset 0 0 0 1px rgba(165,176,255,.2)'}}>↗</span>
                {t}
              </div>
              <div style={{color:'rgba(255,255,255,.65)',fontSize:15.5,lineHeight:1.5}}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Integrations(){
  const groups=[
    {t:'Conversaciones',items:['WhatsApp Business','Email (IMAP/SMTP)','Instagram DM','SMS','Webchat']},
    {t:'Productividad',  items:['Google Calendar','Microsoft 365','Slack','Notion','Drive']},
    {t:'Cobros & ERP',   items:['Stripe','Hacienda CR','SAT México','QuickBooks','Xero']},
    {t:'Desarrollador',  items:['API REST','Webhooks','Zapier','Make','SDK JS / Python']},
  ];
  return (
    <section className="section">
      <div style={{display:'flex',alignItems:'end',justifyContent:'space-between',gap:32,marginBottom:48}}>
        <div style={{maxWidth:'60ch'}}>
          <Eyebrow>Integraciones</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14}}>Conecta con todo lo que ya<br/><span className="serifit" style={{color:'var(--indigo)'}}>usa tu empresa.</span></h2>
        </div>
        <p className="lead" style={{maxWidth:'40ch'}}>Más de 60 integraciones nativas y una API abierta para cualquier flujo a medida.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:18}}>
        {groups.map(g=>(
          <div key={g.t} className="tile paper" style={{minHeight:0,padding:24}}>
            <div className="kicker" style={{color:'var(--indigo)'}}>{g.t}</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:14}}>
              {g.items.map(it=>(
                <div key={it} style={{display:'flex',alignItems:'center',gap:10,fontSize:14.5,fontWeight:500,color:'#2F2F38'}}>
                  <span style={{width:6,height:6,borderRadius:99,background:'var(--indigo)'}}/>
                  {it}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials(){
  const items=[
    {
      q:'Pasamos de cinco herramientas a una. El equipo dejó de perder mensajes en WhatsApp y nuestras ventas crecieron 27% en el primer trimestre.',
      n:'Lucía Madrigal', r:'Gerente Comercial · Ferretería Volcán', c:'#FF8A5B', loc:'San José, CR'
    },
    {
      q:'La IA nos resume hilos largos en segundos y nos sugiere la respuesta. Es como tener un asistente más, pero sin las complicaciones.',
      n:'Carlos Rivera', r:'Fundador · Tecno Plus', c:'#6366F1', loc:'CDMX, MX'
    },
    {
      q:'La facturación electrónica conectada con Hacienda nos ahorra una mañana entera todos los lunes. Increíble lo simple que es.',
      n:'Andrea Quirós', r:'CFO · Cafetería Sol', c:'#22A06B', loc:'Medellín, CO'
    },
  ];
  return (
    <section className="section-bg-warm">
      <div className="section">
        <div style={{maxWidth:'60ch',marginBottom:48}}>
          <Eyebrow>Lo que dicen nuestros clientes</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14}}>Empresas que ya<br/><span className="serifit" style={{color:'var(--indigo)'}}>operan con PymesHub.</span></h2>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:18}}>
          {items.map((it,i)=>(
            <div key={i} className="tile paper" style={{minHeight:340,padding:32,justifyContent:'space-between'}}>
              <div style={{fontSize:21,lineHeight:1.4,letterSpacing:'-.005em',color:'#1A1A22',fontWeight:500}}>
                &ldquo;{it.q}&rdquo;
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,marginTop:24}}>
                <div className="avatar" style={{background:`linear-gradient(135deg, ${it.c}, color-mix(in oklab, ${it.c}, black 22%))`}}>
                  {it.n.split(' ').map(p=>p[0]).join('').slice(0,2)}
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{it.n}</div>
                  <div style={{fontSize:12.5,color:'#6F6F7A'}}>{it.r}</div>
                </div>
                <span style={{marginLeft:'auto',fontSize:11,color:'#6F6F7A',fontWeight:600,letterSpacing:'.04em',textTransform:'uppercase'}}>{it.loc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing(){
  const plans=[
    {n:'Starter',  p:'$29',   d:'Para equipos que están comenzando.',
      f:['1 número de WhatsApp','Bandeja unificada','CRM básico','3 usuarios incluidos','Soporte por email'], cta:'Empezar gratis', highlight:false},
    {n:'Growth',   p:'$79',   d:'Para negocios en crecimiento.',
      f:['3 números de WhatsApp','Automatizaciones con IA','Documentos & OCR','10 usuarios incluidos','Soporte prioritario'], cta:'Iniciar 14 días', highlight:true},
    {n:'Business', p:'$159',  d:'Para operaciones consolidadas.',
      f:['Múltiples sucursales','Facturación electrónica','Analítica avanzada','25 usuarios incluidos','Onboarding asistido'], cta:'Hablar con ventas', highlight:false},
    {n:'Business+', p:'A medida', d:'Para empresas con necesidades específicas.',
      f:['SLA dedicado','SSO + auditoría','Usuarios ilimitados','Integraciones a medida','Customer Success'], cta:'Contactar', highlight:false},
  ];
  return (
    <section className="section">
      <div style={{display:'flex',alignItems:'end',justifyContent:'space-between',gap:32,marginBottom:48}}>
        <div style={{maxWidth:'60ch'}}>
          <Eyebrow>Precios</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14}}>Planes claros para<br/><span className="serifit" style={{color:'var(--indigo)'}}>cualquier tamaño de equipo.</span></h2>
        </div>
        <div style={{display:'flex',gap:8,padding:6,borderRadius:999,background:'#F1F1F4',alignItems:'center'}}>
          <span style={{padding:'8px 16px',borderRadius:999,background:'#fff',fontWeight:600,fontSize:13,boxShadow:'0 1px 2px rgba(0,0,0,.06)'}}>Mensual</span>
          <span style={{padding:'8px 16px',fontWeight:600,fontSize:13,color:'#6F6F7A'}}>Anual <span style={{color:'#22A06B'}}>−20%</span></span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:18}}>
        {plans.map(p=>(
          <div key={p.n} className={`tile ${p.highlight?'indigo':'paper'}`} style={{minHeight:520,padding:28,justifyContent:'flex-start',gap:16}}>
            {p.highlight && (
              <span style={{alignSelf:'flex-start',display:'inline-flex',padding:'3px 10px',borderRadius:999,background:'rgba(255,255,255,.22)',color:'#fff',fontSize:11,fontWeight:800,letterSpacing:'.06em'}}>RECOMENDADO</span>
            )}
            <div style={{fontFamily:'Bricolage Grotesque',fontSize:28,fontWeight:700,letterSpacing:'-.02em',color:p.highlight?'#fff':'#0B0B0F'}}>{p.n}</div>
            <div style={{color:p.highlight?'rgba(255,255,255,.75)':'#6F6F7A',fontSize:14,minHeight:42}}>{p.d}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:6}}>
              <div className="display" style={{fontSize:54,letterSpacing:'-.03em',color:p.highlight?'#fff':'#0B0B0F'}}>{p.p}</div>
              {p.p.startsWith('$') && <span style={{color:p.highlight?'rgba(255,255,255,.6)':'#6F6F7A',fontSize:14}}>/mes</span>}
            </div>
            <button className={p.highlight?'btn btn-soft':'btn btn-primary'} style={{justifyContent:'center',width:'100%'}}>
              {p.cta}
            </button>
            <div style={{height:1,background:p.highlight?'rgba(255,255,255,.18)':'#E4E4E8',margin:'8px 0'}}/>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {p.f.map(item=>(
                <div key={item} style={{display:'flex',alignItems:'flex-start',gap:10,fontSize:14,color:p.highlight?'rgba(255,255,255,.9)':'#2F2F38'}}>
                  <span style={{flex:'0 0 18px',width:18,height:18,borderRadius:99,background:p.highlight?'rgba(255,255,255,.18)':'#EEF0FF',color:p.highlight?'#fff':'var(--indigo)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,marginTop:1}}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ(){
  const items=[
    ['¿Cuánto toma poner PymesHub en marcha?', 'La mayoría de equipos están operando en menos de un día. Para configuraciones avanzadas, nuestro equipo de Customer Success acompaña el proceso.'],
    ['¿Qué pasa con mis datos al migrar?', 'Migramos contactos, conversaciones y documentos sin pérdida de información. La migración es asistida en todos los planes.'],
    ['¿Necesito un número de WhatsApp Business?', 'Recomendamos uno, pero también puedes usar tu número existente. Nuestro equipo te ayuda a configurarlo con Meta.'],
    ['¿Cómo se cobra el plan?', 'Mensual o anual, con descuento del 20% al pagar por año. Aceptamos tarjeta y transferencia local en varios países.'],
    ['¿Ofrecen soporte en español?', 'Sí, soporte 100% en español, con horarios laborales LATAM y opciones prioritarias 24/7 en Business+.'],
    ['¿Mis datos están seguros?', 'Cifrado en tránsito y en reposo, copias de seguridad redundantes, control de acceso por rol y auditoría.'],
  ];
  const [open,setOpen]=useStateS(0);
  return (
    <section className="section">
      <div style={{display:'grid',gridTemplateColumns:'0.85fr 1.15fr',gap:60,alignItems:'start'}}>
        <div>
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14}}>Todo lo que<br/><span className="serifit" style={{color:'var(--indigo)'}}>necesitas saber.</span></h2>
          <p className="lead" style={{marginTop:18,maxWidth:'40ch'}}>¿Tienes una pregunta diferente? Nuestro equipo responde en menos de 4 horas hábiles.</p>
          <Btn variant="ghost" style={{marginTop:18}}>Contactar a un humano <I.arrow/></Btn>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {items.map(([q,a],i)=>(
            <div key={i} className="tile paper" style={{minHeight:0,padding:'22px 26px',cursor:'pointer'}} onClick={()=>setOpen(open===i?-1:i)}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:24}}>
                <div style={{fontWeight:600,fontSize:17,color:'#0B0B0F'}}>{q}</div>
                <span style={{width:32,height:32,borderRadius:99,background:open===i?'var(--indigo)':'#F1F1F4',color:open===i?'#fff':'#0B0B0F',display:'inline-flex',alignItems:'center',justifyContent:'center',flex:'0 0 32px',transition:'all .2s'}}>
                  {open===i ? <I.minus/> : <I.plus/>}
                </span>
              </div>
              {open===i && <div style={{marginTop:14,color:'#6F6F7A',fontSize:15.5,lineHeight:1.55,maxWidth:'62ch'}}>{a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA(){
  return (
    <section className="section">
      <div style={{position:'relative',borderRadius:'var(--r-2xl)',padding:'90px 80px',
        background:'linear-gradient(135deg, #4338CA 0%, #6366F1 60%, #8B85FF 100%)',color:'#fff',overflow:'hidden'}}>
        <div style={{position:'absolute',right:-40,top:-40,opacity:.9}}>
          <Clay shape="ball" size={260} color="#FFD07A"/>
        </div>
        <div style={{position:'absolute',right:160,bottom:-60,opacity:.85}}>
          <Clay shape="cube" size={160} color="#A5B0FF"/>
        </div>
        <div style={{position:'absolute',left:60,bottom:-30,opacity:.8}}>
          <Clay shape="bubble" size={140} color="#22C55E"/>
        </div>
        <div style={{position:'relative',maxWidth:'52ch'}}>
          <Eyebrow color="rgba(255,255,255,.85)">Comienza hoy</Eyebrow>
          <h2 className="display" style={{fontSize:76,letterSpacing:'-.03em',color:'#fff',marginTop:18}}>
            Dirige tu negocio<br/>desde una sola<br/>
            <span className="serifit" style={{color:'#FFE08A'}}>plataforma poderosa.</span>
          </h2>
          <p className="lead" style={{color:'rgba(255,255,255,.78)',marginTop:22,maxWidth:'52ch'}}>
            14 días gratis. Sin tarjeta de crédito. Migración asistida incluida.
          </p>
          <div style={{display:'flex',gap:12,marginTop:30}}>
            <Btn variant="soft" size="lg" style={{background:'#fff',color:'var(--indigo)'}}>Solicitar demo</Btn>
            <Btn variant="ghost" size="lg" style={{background:'rgba(255,255,255,.14)',color:'#fff'}}>Hablar con ventas</Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer(){
  const cols={
    Producto:['Bandeja unificada','CRM','Tareas','Documentos','Facturación','Automatizaciones','Analítica'],
    Soluciones:['Pequeños equipos','Retail','Servicios','Agencias','E-commerce'],
    Empresa:['Sobre PymesHub','Clientes','Carreras','Prensa','Contacto'],
    Recursos:['Blog','Casos de éxito','Centro de ayuda','Comunidad','Cambios'],
  };
  return (
    <footer style={{background:'var(--paper-warm)',padding:'80px 80px 40px',borderTop:'1px solid var(--ink-200)'}}>
      <div style={{maxWidth:1440,margin:'0 auto'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.4fr repeat(4, 1fr)',gap:32}}>
          <div>
            <Logo/>
            <p style={{marginTop:18,color:'#6F6F7A',fontSize:14.5,lineHeight:1.5,maxWidth:'32ch'}}>El sistema operativo para empresas en Latinoamérica. Construido en Costa Rica.</p>
            <div style={{display:'flex',gap:10,marginTop:18}}>
              {['X','Li','Ig','Yt'].map(s=>(
                <span key={s} style={{width:34,height:34,borderRadius:10,background:'#fff',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#0B0B0F',boxShadow:'inset 0 0 0 1px #E4E4E8'}}>{s}</span>
              ))}
            </div>
          </div>
          {Object.entries(cols).map(([t,items])=>(
            <div key={t}>
              <div className="kicker" style={{color:'#0B0B0F'}}>{t}</div>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
                {items.map(i=> <a key={i} href="#" style={{fontSize:14,color:'#2F2F38',textDecoration:'none'}}>{i}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:48,paddingTop:24,borderTop:'1px solid var(--ink-200)',color:'#6F6F7A',fontSize:13}}>
          <div>© 2025 PymesHub Inc. · Hecho en Costa Rica.</div>
          <div style={{display:'flex',gap:18}}>
            {['Privacidad','Términos','Estado','Seguridad'].map(l=>(
              <a key={l} href="#" style={{color:'#6F6F7A',textDecoration:'none'}}>{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, SocialProof, HowItWorks, FeatureBento, Benefits, Integrations, Testimonials, Pricing, FAQ, FinalCTA, Footer });
