
// v2-extras.jsx — alternate Hero variants, PricingTable, TestimonialHero

function HeroV2({variant='illustration', accent='#4F46E5'}){
  if (variant === 'product') {
    return (
      <section className="section" style={{paddingTop:80,paddingBottom:60}}>
        <div style={{maxWidth:'58ch',marginBottom:48}}>
          <Chip tone="indigo">
            <span className="dot" style={{background:accent}}/> Nuevo · PymesHub IA 2.0
          </Chip>
          <h1 className="display h-display" style={{marginTop:22}}>
            El sistema operativo<br/>
            <span className="serifit" style={{color:accent}}>de tu negocio.</span>
          </h1>
          <p className="lead" style={{maxWidth:'56ch',marginTop:22}}>
            Centraliza WhatsApp, email, CRM, tareas, documentos, facturación y
            automatizaciones con IA en una sola plataforma diseñada para empresas
            en Latinoamérica.
          </p>
          <div style={{display:'flex',gap:12,marginTop:30}}>
            <Btn variant="primary" size="lg">Solicitar demo <I.arrow/></Btn>
            <Btn variant="soft" size="lg">Ver cómo funciona</Btn>
          </div>
        </div>
        <div className="win" style={{maxWidth:1280,margin:'0 auto',padding:0,overflow:'hidden'}}>
          <div className="win-bar">
            <span className="win-dot r"/><span className="win-dot y"/><span className="win-dot g"/>
            <div style={{marginLeft:14,fontSize:12.5,color:'#6F6F7A',fontWeight:600}}>PymesHub · Bandeja unificada</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'220px 1fr 320px',background:'#fff',minHeight:440}}>
            <div style={{padding:'18px 14px',borderRight:'1px solid #ECECEF',background:'#FAFAFB',display:'flex',flexDirection:'column',gap:6}}>
              {[['Bandeja','24',true],['CRM','—'],['Tareas','7'],['Documentos','—'],['Facturación','3'],['Automatizaciones','—'],['Analítica','—']].map(([l,c,active])=>(
                <div key={l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:9,
                  background:active?'#fff':'transparent',boxShadow:active?'inset 0 0 0 1px #ECECEF,0 1px 2px rgba(0,0,0,.04)':'none'}}>
                  <span style={{fontWeight:active?700:500,fontSize:13.5,color:'#0B0B0F'}}>{l}</span>
                  {c!=='—' && <span style={{fontSize:11,padding:'1px 7px',borderRadius:99,background:active?accent:'#F1F1F4',color:active?'#fff':'#6F6F7A',fontWeight:700}}>{c}</span>}
                </div>
              ))}
            </div>
            <div style={{padding:'10px 0',borderRight:'1px solid #ECECEF'}}>
              <InboxMockup compact={false}/>
            </div>
            <div style={{padding:18,background:'#FAFAFB'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#6F6F7A',letterSpacing:'.08em',textTransform:'uppercase'}}>Juan García · WhatsApp</div>
              <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
                <div style={{alignSelf:'flex-start',maxWidth:'88%',padding:'9px 12px',borderRadius:'14px 14px 14px 4px',background:'#fff',fontSize:13,boxShadow:'inset 0 0 0 1px #ECECEF'}}>Necesito una cotización para 50 unidades.</div>
                <div style={{alignSelf:'flex-end',maxWidth:'88%',padding:'9px 12px',borderRadius:'14px 14px 4px 14px',background:'#DCF8C6',fontSize:13}}>Claro, le envío el PDF en 3 minutos.</div>
                <div style={{padding:'10px 12px',borderRadius:10,background:'#EEF0FF',color:'#3730A3',fontSize:12.5,fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                  <I.spark/> Sugerido: adjuntar cotización 0480 (similar)
                </div>
              </div>
              <div className="hr" style={{margin:'18px 0'}}/>
              <div style={{fontSize:11,fontWeight:700,color:'#6F6F7A',letterSpacing:'.08em',textTransform:'uppercase'}}>Resumen IA</div>
              <div style={{marginTop:8,fontSize:13,color:'#2F2F38',lineHeight:1.5}}>Cliente recurrente solicita cotización por volumen. Tres correos previos sobre productos similares. Probabilidad de cierre alta.</div>
            </div>
          </div>
        </div>
      </section>
    );
  }
  if (variant === 'minimal') {
    return (
      <section className="section" style={{paddingTop:140,paddingBottom:80,textAlign:'center'}}>
        <div style={{maxWidth:'22ch',margin:'0 auto'}}>
          <Chip tone="indigo" style={{margin:'0 auto'}}>
            <span className="dot" style={{background:accent}}/> Nuevo · PymesHub IA 2.0
          </Chip>
          <h1 className="display" style={{fontSize:120,letterSpacing:'-.035em',lineHeight:0.95,marginTop:30}}>
            El sistema<br/>operativo de tu<br/><span className="serifit" style={{color:accent}}>negocio.</span>
          </h1>
        </div>
        <p className="lead" style={{maxWidth:'46ch',margin:'30px auto 0'}}>
          Todo lo que tu PYME necesita: WhatsApp, email, CRM, tareas, documentos,
          facturación y automatizaciones con IA. En una sola plataforma.
        </p>
        <div style={{display:'flex',gap:12,marginTop:36,justifyContent:'center'}}>
          <Btn variant="primary" size="lg">Solicitar demo <I.arrow/></Btn>
          <Btn variant="soft" size="lg">Ver cómo funciona</Btn>
        </div>
        <div style={{marginTop:80,maxWidth:1180,margin:'80px auto 0',position:'relative'}}>
          <div className="win" style={{boxShadow:'0 60px 120px -40px rgba(15,15,40,.35),0 30px 60px -30px rgba(15,15,40,.25),inset 0 0 0 1px rgba(11,11,15,.06)'}}>
            <div className="win-bar">
              <span className="win-dot r"/><span className="win-dot y"/><span className="win-dot g"/>
              <div style={{marginLeft:14,fontSize:12.5,color:'#6F6F7A',fontWeight:600}}>PymesHub · pymeshub.app/inbox</div>
            </div>
            <div style={{padding:'24px 32px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,minHeight:380,textAlign:'left'}}>
              <InboxMockup/>
              <div><ChartMockup/><div style={{marginTop:14}}><CRMMockup/></div></div>
            </div>
          </div>
        </div>
      </section>
    );
  }
  // default · illustration
  return (
    <section className="section" style={{paddingTop:80,paddingBottom:60}}>
      <div style={{display:'grid',gridTemplateColumns:'1.05fr 1fr',gap:60,alignItems:'center'}}>
        <div style={{display:'flex',flexDirection:'column',gap:28}}>
          <Chip tone="indigo">
            <span className="dot" style={{background:accent}}/> Nuevo · PymesHub IA 2.0
          </Chip>
          <h1 className="display h-display">
            El sistema operativo<br/>
            <span className="serifit" style={{color:accent}}>de tu negocio.</span>
          </h1>
          <p className="lead" style={{maxWidth:'58ch'}}>
            Centraliza WhatsApp, email, CRM, tareas, documentos, facturación y
            automatizaciones con IA en una sola plataforma premium, diseñada
            para empresas en Latinoamérica.
          </p>
          <div style={{display:'flex',gap:12,marginTop:6}}>
            <Btn variant="primary" size="lg">Solicitar demo <I.arrow/></Btn>
            <Btn variant="soft" size="lg">Ver cómo funciona</Btn>
          </div>
          <div style={{display:'flex',gap:24,alignItems:'center',marginTop:8,color:'#6F6F7A',fontSize:14}}>
            {['14 días gratis','Sin tarjeta de crédito','Migración asistida'].map(t=>(
              <div key={t} style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:18,height:18,borderRadius:99,background:'#DCF3E0',color:'#1F5A3A',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800}}>✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{position:'relative'}}>
          <HeroScene/>
        </div>
      </div>
    </section>
  );
}

function PricingTable({accent='#4F46E5'}){
  const rows = [
    ['Bandeja unificada (WhatsApp + email)',  true, true, true, true],
    ['Números de WhatsApp incluidos',  '1', '3', '6', 'Ilimitado'],
    ['Usuarios incluidos',             '3', '10','25','Ilimitado'],
    ['CRM y contactos',                true,true,true,true],
    ['Tareas y seguimientos',          true,true,true,true],
    ['Automatizaciones con IA',        '—', true,true,true],
    ['Documentos & OCR',               '—', true,true,true],
    ['Facturación electrónica',        '—', '—', true,true],
    ['Analítica avanzada',             '—', '—', true,true],
    ['SSO + auditoría',                '—', '—', '—', true],
    ['Customer Success dedicado',      '—', '—', '—', true],
  ];
  const plans = [
    {n:'Starter',  p:'$29',  cta:'Empezar', highlight:false},
    {n:'Growth',   p:'$79',  cta:'Iniciar 14 días', highlight:true},
    {n:'Business', p:'$159', cta:'Hablar con ventas', highlight:false},
    {n:'Business+',p:'A medida', cta:'Contactar', highlight:false},
  ];
  const Cell = ({v, highlight}) => {
    if (v === true) return <span style={{display:'inline-flex',width:20,height:20,borderRadius:99,background:highlight?accent:'#EEF0FF',color:highlight?'#fff':accent,alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800}}>✓</span>;
    if (v === '—') return <span style={{color:'#C5C5CC',fontSize:14}}>—</span>;
    return <span style={{fontSize:14,fontWeight:600,color:'#0B0B0F'}}>{v}</span>;
  };
  return (
    <section className="section">
      <div style={{display:'flex',alignItems:'end',justifyContent:'space-between',gap:32,marginBottom:48}}>
        <div style={{maxWidth:'60ch'}}>
          <Eyebrow>Precios</Eyebrow>
          <h2 className="display h-1" style={{marginTop:14}}>Compara los planes,<br/><span className="serifit" style={{color:accent}}>elige sin sorpresas.</span></h2>
        </div>
      </div>
      <div className="tile paper" style={{minHeight:0,padding:0,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.4fr repeat(4, 1fr)'}}>
          <div style={{padding:'28px 28px 22px',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
            <div className="kicker">Comparar planes</div>
            <div style={{fontFamily:'Bricolage Grotesque',fontSize:24,fontWeight:700,letterSpacing:'-.02em',marginTop:8}}>Todo lo que necesitas.</div>
          </div>
          {plans.map(p=>(
            <div key={p.n} style={{padding:'28px 18px 20px',background:p.highlight?accent:'#FAFAFB',color:p.highlight?'#fff':'#0B0B0F',
              display:'flex',flexDirection:'column',gap:6,borderLeft:'1px solid #ECECEF'}}>
              {p.highlight && <span style={{alignSelf:'flex-start',padding:'2px 8px',borderRadius:999,background:'#fff',color:accent,fontSize:10.5,fontWeight:800,letterSpacing:'.06em'}}>RECOMENDADO</span>}
              <div style={{fontFamily:'Bricolage Grotesque',fontSize:22,fontWeight:700,letterSpacing:'-.02em'}}>{p.n}</div>
              <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                <span className="display" style={{fontSize:32,letterSpacing:'-.03em'}}>{p.p}</span>
                {p.p.startsWith('$') && <span style={{fontSize:12,opacity:.7}}>/mes</span>}
              </div>
              <button className={p.highlight?'btn btn-soft':'btn btn-primary'} style={{justifyContent:'center',width:'100%',marginTop:8}}>{p.cta}</button>
            </div>
          ))}
        </div>
        {rows.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1.4fr repeat(4, 1fr)',borderTop:'1px solid #ECECEF',background:i%2?'#fff':'#FAFAFB'}}>
            <div style={{padding:'14px 28px',fontSize:14.5,color:'#2F2F38',fontWeight:500}}>{r[0]}</div>
            {[1,2,3,4].map(c=>(
              <div key={c} style={{padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'center',borderLeft:'1px solid #ECECEF'}}>
                <Cell v={r[c]} highlight={c===2}/>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function TestimonialHero({accent='#4F46E5'}){
  return (
    <section className="section-bg-warm">
      <div className="section" style={{paddingTop:120,paddingBottom:120}}>
        <div style={{maxWidth:'24ch',marginBottom:32}}>
          <Eyebrow>Lo que dicen nuestros clientes</Eyebrow>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:60,alignItems:'center'}}>
          <div>
            <div className="display" style={{fontSize:54,letterSpacing:'-.022em',lineHeight:1.08,color:'#0B0B0F'}}>
              &ldquo;Pasamos de cinco herramientas a una.<br/>
              <span style={{color:accent}}>Las ventas crecieron 27%</span> en el primer trimestre y dejamos de perder mensajes en WhatsApp.&rdquo;
            </div>
            <div style={{display:'flex',alignItems:'center',gap:14,marginTop:32}}>
              <div className="avatar" style={{width:54,height:54,fontSize:18,background:'linear-gradient(135deg,#FF8A5B,#FF4D8D)'}}>LM</div>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>Lucía Madrigal</div>
                <div style={{fontSize:14,color:'#6F6F7A'}}>Gerente Comercial · Ferretería Volcán · San José, CR</div>
              </div>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {[
              ['27%','crecimiento en ventas Q1'],
              ['5 → 1','herramientas consolidadas'],
              ['0','mensajes perdidos al mes'],
            ].map(([n,l],i)=>(
              <div key={i} className="tile paper" style={{minHeight:0,padding:'22px 28px',flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:18}}>
                <div className="display" style={{fontSize:44,letterSpacing:'-.03em',color:accent}}>{n}</div>
                <div style={{fontSize:14,color:'#6F6F7A',textAlign:'right',maxWidth:'18ch'}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { HeroV2, PricingTable, TestimonialHero });
