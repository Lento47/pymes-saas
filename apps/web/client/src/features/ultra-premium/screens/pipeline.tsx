import { D3 } from '../tokens';
import { D3StatusBar, D3NavBar, D3Tag, D3BottomNav } from '../components/atoms';

export function D3Pipeline() {
  const deals = [
    { name: 'Constructora del Sur', value: '₡14.8M', stage: 'Propuesta', days: 3, prob: 65, c: D3.warning },
    { name: 'Distribuidora Mora', value: '₡28.5M', stage: 'Negociación', days: 7, prob: 80, c: D3.success },
    { name: 'Ferretería Vega', value: '₡9.2M', stage: 'Contactado', days: 1, prob: 35, c: D3.accent },
    { name: 'Servicios ABC', value: '₡6.8M', stage: 'Prospecto', days: 14, prob: 20, c: D3.textTertiary },
  ];

  return (
    <div style={{ background: D3.bg, minHeight: '100%', fontFamily: D3.fontSans }}>
      <D3StatusBar />
      <div style={{ padding: '12px 22px 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: D3.textPrimary, letterSpacing: -0.6 }}>Pipeline</div>
      </div>

      <div style={{ margin: '0 22px 14px', background: D3.accent, borderRadius: D3.radiusLg, padding: '20px 22px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5, marginBottom: 4 }}>VALOR TOTAL</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#fff', letterSpacing: -1.5, marginBottom: 2 }}>₡254.9M</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>28 oportunidades · 5 etapas</div>
        <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden' }}>
          {[{v:12,c:'rgba(255,255,255,0.2)'},{v:8,c:'rgba(255,255,255,0.35)'},{v:5,c:'rgba(255,255,255,0.55)'},{v:3,c:'rgba(255,255,255,0.75)'},{v:7,c:'rgba(255,255,255,1)'}].map((s, i) => (
            <div key={i} style={{ flex: s.v, background: s.c }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 22px 12px', overflowX: 'auto' }}>
        {['Todos', 'Prospecto', 'Contactado', 'Propuesta', 'Negociación', 'Cerrado'].map((s, i) => (
          <div key={i} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, background: i === 0 ? D3.textPrimary : D3.surface, fontSize: 12, fontWeight: 600, color: i === 0 ? '#fff' : D3.textSecondary, boxShadow: i === 0 ? 'none' : D3.shadow }}>{s}</div>
        ))}
      </div>

      <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {deals.map((d, i) => (
          <div key={i} style={{ background: D3.surface, borderRadius: D3.radius, padding: '15px 16px', boxShadow: D3.shadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: D3.textPrimary, marginBottom: 3, letterSpacing: -0.2 }}>{d.name}</div>
                <D3Tag label={d.stage} color={d.c} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: D3.textPrimary, letterSpacing: -0.5 }}>{d.value}</div>
                <div style={{ fontSize: 11, color: D3.textTertiary, marginTop: 4 }}>hace {d.days}d</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, height: 3, background: D3.border, borderRadius: 2 }}>
                <div style={{ width: `${d.prob}%`, height: '100%', background: d.c, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: d.c, width: 30, textAlign: 'right' }}>{d.prob}%</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 16 }} />
      <D3BottomNav active={2} />
      <D3NavBar />
    </div>
  );
}
