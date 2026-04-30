import { D3 } from '../tokens';
import { D3StatusBar, D3NavBar, D3Avatar, D3Dot, D3Tag, D3BottomNav } from '../components/atoms';

export function D3ContactProfile() {
  return (
    <div style={{ background: D3.bg, minHeight: '100%', fontFamily: D3.fontSans }}>
      <D3StatusBar />
      <div style={{ padding: '8px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D3.textTertiary} strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        <span style={{ fontSize: 15, fontWeight: 600, color: D3.textPrimary }}>Contacto</span>
      </div>

      <div style={{ padding: '12px 22px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <D3Avatar name="María Fernández" size={62} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: D3.textPrimary, letterSpacing: -0.5, marginBottom: 4 }}>María Fernández</div>
          <div style={{ fontSize: 13, color: D3.textSecondary, marginBottom: 8 }}>Constructora del Sur S.A.</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <D3Tag label="Activa" color={D3.success} />
            <D3Tag label="Alta prioridad" color={D3.danger} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 22px 14px' }}>
        {['WhatsApp', 'Email', 'Llamar'].map((a, i) => (
          <div key={i} style={{ flex: 1, background: D3.surface, borderRadius: D3.radius, padding: '11px', textAlign: 'center', boxShadow: D3.shadow, fontSize: 12, fontWeight: 600, color: D3.textSecondary }}>{a}</div>
        ))}
      </div>

      <div style={{ margin: '0 22px 10px', background: D3.surface, borderRadius: D3.radius, overflow: 'hidden', boxShadow: D3.shadow }}>
        {[['Teléfono', '+506 8845 2231'], ['Email', 'mfernandez@constrsur.cr'], ['Empresa', 'Constructora del Sur'], ['Segmento', 'B2B · Construcción']].map(([k, v], i, arr) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${D3.border}` : 'none' }}>
            <span style={{ fontSize: 12, color: D3.textTertiary, fontWeight: 500 }}>{k}</span>
            <span style={{ fontSize: 12, color: D3.textPrimary, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ margin: '0 22px', background: D3.surface, borderRadius: D3.radius, padding: '16px', boxShadow: D3.shadow }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: D3.textSecondary, marginBottom: 14 }}>Historial</div>
        {[
          { t: 'Conversación WhatsApp — pedido #4821', time: 'Hoy 9:28', c: D3.success },
          { t: 'Propuesta enviada — ₡14.8M', time: 'Ayer', c: D3.warning },
          { t: 'Nota: necesita entrega el jueves', time: 'Mar 28', c: D3.accent },
          { t: 'Email: Catálogo Q2 enviado', time: 'Mar 25', c: '#7C3AED' },
        ].map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 14 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              <D3Dot color={ev.c} size={8} />
              {i < 3 && <div style={{ width: 1, flex: 1, background: D3.border, marginTop: 4 }} />}
            </div>
            <div style={{ flex: 1, paddingBottom: i < 3 ? 8 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: D3.textPrimary, lineHeight: 1.4, marginBottom: 2 }}>{ev.t}</div>
              <div style={{ fontSize: 11, color: D3.textTertiary }}>{ev.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 20 }} />
      <D3BottomNav active={2} />
      <D3NavBar />
    </div>
  );
}
