
// v2-app.jsx — PymesHub V2 landing page entry point
// Admin toggle: append ?admin to the URL to reveal the admin control panel.
// Config is fetched from the API (GET /api/workspaces/current/landing-config)
// and merged with TWEAK_DEFAULTS_V2. Append ?preview=1 to bypass the
// disabled-landing gate (used by the admin editor iframe).

const TWEAK_DEFAULTS_V2 = {
  hero: "illustration",
  pricing: "cards",
  testimonials: "cards",
  accent: "#4F46E5",
  background: "white",
};

// Global context so all sections can read config without prop drilling
const LandingConfigContext = React.createContext({});

function useLandingConfig() {
  return React.useContext(LandingConfigContext);
}

// Expose for sections.jsx / v2-extras.jsx
window.useLandingConfig = useLandingConfig;

// ── Admin Banner ──────────────────────────────────────────────────────────────
function AdminBanner({ enabled, onToggle, onClose }) {
  return (
    <div className="admin-banner">
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <span className="admin-banner-pill">
          <span style={{width:7,height:7,borderRadius:'50%',background:enabled?'#22C55E':'#DC2626',display:'inline-block'}}/>
          Admin
        </span>
        <span style={{color:'rgba(255,255,255,.7)'}}>
          Landing page V2 está actualmente{' '}
          <strong style={{color:'#fff'}}>{enabled ? 'activa' : 'desactivada'}</strong>
          {' '}para todos los visitantes.
        </span>
      </div>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <button className={`admin-toggle${enabled ? '' : ' off'}`} onClick={onToggle}>
          {enabled ? '⏸ Desactivar landing' : '▶ Activar landing'}
        </button>
        <a href="/admin/landing" target="_blank" style={{padding:'7px 14px',borderRadius:7,background:'rgba(255,255,255,.15)',color:'#fff',textDecoration:'none',fontSize:13,fontWeight:500}}>
          ✏️ Abrir editor
        </a>
        <button className="admin-close" title="Cerrar panel admin" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

// ── Maintenance page ──────────────────────────────────────────────────────────
function LandingDisabled() {
  return (
    <div style={{
      minHeight:'100vh', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:24,
      background:'#FAFAF9', fontFamily:"'Plus Jakarta Sans',sans-serif",
    }}>
      <div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#6366F1,#3730A3)',boxShadow:'0 8px 20px -6px rgba(99,102,241,.5)'}}/>
      <div style={{textAlign:'center',maxWidth:'38ch'}}>
        <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:40,fontWeight:700,letterSpacing:'-.025em',color:'#0B0B0F',lineHeight:1}}>PymesHub</div>
        <div style={{marginTop:14,fontSize:18,color:'#6F6F7A',lineHeight:1.5}}>Esta página no está disponible en este momento. Vuelve pronto.</div>
      </div>
      <a href="mailto:hola@pymeshub.com" style={{padding:'12px 22px',borderRadius:999,background:'#0B0B0F',color:'#fff',textDecoration:'none',fontWeight:600,fontSize:14}}>
        Contáctanos
      </a>
    </div>
  );
}

// ── Fetch landing config from API ─────────────────────────────────────────────
async function fetchLandingConfig() {
  try {
    const token = (() => { try { return localStorage.getItem('pymes_token'); } catch { return null; } })();
    if (!token) return null;
    const res = await fetch('/api/workspaces/current/landing-config', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Main app ──────────────────────────────────────────────────────────────────
function V2App() {
  const params = new URLSearchParams(window.location.search);
  const isAdminMode = params.has('admin');
  const isPreviewMode = params.has('preview');

  const [remoteConfig, setRemoteConfig] = React.useState(null);
  const [configLoaded, setConfigLoaded] = React.useState(false);

  React.useEffect(() => {
    fetchLandingConfig().then(cfg => {
      setRemoteConfig(cfg);
      setConfigLoaded(true);
    });
  }, []);

  // Merge remote tweaks with defaults
  const remoteTweaks = remoteConfig?.tweaks ?? {};
  const tweaks = { ...TWEAK_DEFAULTS_V2, ...remoteTweaks };

  // Use TweaksPanel only as a local override layer (design review)
  const [localTweaks, setLocalTweak] = useTweaks(tweaks);
  const t = localTweaks;

  // Landing enabled: prefer remote config, fall back to localStorage
  const remoteEnabled = remoteConfig?.enabled;
  const [landingEnabled, setLandingEnabled] = React.useState(() => {
    try {
      const stored = localStorage.getItem('pymeshub_landing_enabled');
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  });
  const effectiveEnabled = remoteEnabled !== undefined ? remoteEnabled : landingEnabled;

  const [adminBannerVisible, setAdminBannerVisible] = React.useState(isAdminMode);

  const toggleLanding = () => {
    const next = !effectiveEnabled;
    setLandingEnabled(next);
    try { localStorage.setItem('pymeshub_landing_enabled', String(next)); } catch {}
  };

  const accent = t.accent;
  const wrapStyle = {
    background: t.background === 'warm' ? 'var(--paper-warm)' : '#fff',
    minHeight: '100vh',
  };

  // Show maintenance page unless admin or preview mode
  if (!effectiveEnabled && !isAdminMode && !isPreviewMode) {
    return <LandingDisabled />;
  }

  // Build full config object for context
  const fullConfig = {
    ...(remoteConfig ?? {}),
    tweaks: t,
  };

  return (
    <LandingConfigContext.Provider value={fullConfig}>
      <div style={wrapStyle}>
        <style>{`
          :root { --indigo: ${accent}; }
          .btn-indigo, .tile.indigo { background: ${accent} !important }
          .eyebrow { color: ${accent} }
          .logo-mark {
            background:
              radial-gradient(circle at 30% 25%, rgba(255,255,255,.6), rgba(255,255,255,0) 50%),
              linear-gradient(135deg, color-mix(in oklab, ${accent}, white 16%), color-mix(in oklab, ${accent}, black 28%));
          }
        `}</style>

        <Nav/>
        <HeroV2 variant={t.hero} accent={accent}/>
        <SocialProof/>
        <HowItWorks/>
        <FeatureBento/>
        <Benefits/>
        <Integrations/>
        {t.testimonials === 'hero' ? <TestimonialHero accent={accent}/> : <Testimonials/>}
        {t.pricing === 'table'     ? <PricingTable accent={accent}/>    : <Pricing/>}
        <FAQ/>
        <FinalCTA/>
        <Footer/>

        <TweaksPanel title="V2 · Tweaks">
          <TweakSection label="Hero"/>
          <TweakRadio label="Layout" value={t.hero}
            options={[{value:'illustration',label:'3D'},{value:'product',label:'UI'},{value:'minimal',label:'Tipo'}]}
            onChange={(v) => setLocalTweak('hero', v)}/>
          <TweakSection label="Testimoniales"/>
          <TweakRadio label="Formato" value={t.testimonials}
            options={[{value:'cards',label:'Tarjetas'},{value:'hero',label:'Destacado'}]}
            onChange={(v) => setLocalTweak('testimonials', v)}/>
          <TweakSection label="Precios"/>
          <TweakRadio label="Formato" value={t.pricing}
            options={[{value:'cards',label:'Tarjetas'},{value:'table',label:'Tabla'}]}
            onChange={(v) => setLocalTweak('pricing', v)}/>
          <TweakSection label="Marca"/>
          <TweakRadio label="Acento" value={t.accent}
            options={[{value:'#4F46E5',label:'Indigo'},{value:'#0F8A6B',label:'Verde'},{value:'#DA5630',label:'Coral'}]}
            onChange={(v) => setLocalTweak('accent', v)}/>
          <TweakRadio label="Fondo" value={t.background}
            options={[{value:'white',label:'Blanco'},{value:'warm',label:'Cálido'}]}
            onChange={(v) => setLocalTweak('background', v)}/>
        </TweaksPanel>

        {adminBannerVisible && (
          <AdminBanner
            enabled={effectiveEnabled}
            onToggle={toggleLanding}
            onClose={() => setAdminBannerVisible(false)}
          />
        )}
      </div>
    </LandingConfigContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<V2App/>);
