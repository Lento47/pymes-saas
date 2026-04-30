import { D3 } from '../tokens';
import { D3StatusBar, D3NavBar, D3Avatar, D3Dot, D3BottomNav } from '../components/atoms';

export function D3Dashboard() {
  return (
    <div style={{ background: D3.bg, minHeight: '100%', fontFamily: D3.fontSans }}>
      <D3StatusBar />

      <div style={{ padding: '12px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: D3.textTertiary, fontWeight: 500, letterSpacing: 0.4, marginBottom: 3 }}>Miércoles · 30 de abril</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: D3.textPrimary, letterSpacing: -0.6, lineHeight: 1.1 }}>Buenos días, Carlos.</div>
        </div>
        <D3Avatar name="Carlos Mora" size={40} />
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '16px 22px 0' }}>
        {[
          { n: '247', l: 'Conversaciones', sub: '+12 hoy', c: D3.accent },
          { n: '18', l: 'Pendientes', sub: '3 urgentes', c: D3.danger },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: D3.surface, borderRadius: D3.radius, padding: '16px', boxShadow: D3.shadow }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.c, letterSpacing: -1.2, marginBottom: 4 }}>{s.n}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: D3.textPrimary, marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 11, color: D3.textTertiary }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ margin: '12px 22px 0', background: D3.surface, borderRadius: D3.radius, padding: '16px 18px', boxShadow: D3.shadow }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: D3.textSecondary, marginBottom: 14, letterSpacing: 0.2 }}>Canales activos</div>
        {[
          { name: 'WhatsApp', n: 142, pct: 58, c: D3.success },
          { name: 'Email', n: 63, pct: 26, c: D3.accent },
          { name: 'Telegram', n: 27, pct: 11, c: '#7C3AED' },
          { name: 'Formulario', n: 15, pct: 5, c: D3.warning },
        ].map((ch, i) => (
          <div key={i} style={{ marginBottom: i < 3 ? 12 : 0, display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 70, fontSize: 12, color: D3.textSecondary, fontWeight: 500 }}>{ch.name}</div>
            <div style={{ flex: 1, height: 3, background: D3.border, borderRadius: 2 }}>
              <div style={{ width: `${ch.pct}%`, height: '100%', background: ch.c, borderRadius: 2 }} />
            </div>
            <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: D3.textPrimary, textAlign: 'right' }}>{ch.n}</div>
          </div>
        ))}
      </div>

      <div style={{ margin: '12px 22px 0', background: D3.accentSoft, border: `1px solid ${D3.accentMid}`, borderRadius: D3.radius, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: D3.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: D3.accent, marginBottom: 4, letterSpacing: 0.1 }}>Asistente IA</div>
          <div style={{ fontSize: 13, color: D3.textPrimary, lineHeight: 1.5 }}>Ferretería Vega lleva 5 días sin respuesta. Recomendamos contactarlos hoy.</div>
          <div style={{ marginTop: 10, display: 'inline-block', padding: '7px 14px', background: D3.accent, borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#fff' }}>
            Contactar ahora
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 22px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: D3.textSecondary, letterSpacing: 0.2 }}>Pendientes de hoy</div>
          <div style={{ fontSize: 12, color: D3.accent, fontWeight: 600 }}>Ver 18</div>
        </div>
        <div style={{ background: D3.surface, borderRadius: D3.radius, overflow: 'hidden', boxShadow: D3.shadow }}>
          {[
            { t: 'Seguimiento — Constructora del Sur', due: 'Hoy', urgent: true },
            { t: 'Propuesta para Distribuidora Mora', due: 'Mañana', urgent: false },
            { t: 'Renovar suscripción — Ferretería Vega', due: '2 días', urgent: false },
          ].map((task, i) => (
            <div key={i} style={{ padding: '13px 16px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: i < 2 ? `1px solid ${D3.border}` : 'none' }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${task.urgent ? D3.danger : D3.border}`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: D3.textPrimary, marginBottom: 2 }}>{task.t}</div>
                <div style={{ fontSize: 11, color: task.urgent ? D3.danger : D3.textTertiary }}>{task.due}</div>
              </div>
              {task.urgent && <D3Dot color={D3.danger} size={6} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 16 }} />
      <D3BottomNav active={0} />
      <D3NavBar />
    </div>
  );
}
