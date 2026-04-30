import { D3 } from '../tokens';
import { D3StatusBar, D3NavBar, D3Avatar, D3Dot } from '../components/atoms';

export function D3Conversation() {
  const msgs = [
    { text: '¿Cuándo estará listo mi pedido #4821?', time: '9:12', mine: false },
    { text: 'Hola María, con gusto reviso ahora mismo.', time: '9:14', mine: true },
    { text: '¿Tienen estimado de entrega? Lo necesito para el jueves.', time: '9:15', mine: false },
    { text: 'Tu pedido está en tránsito, estimamos entrega el miércoles antes del mediodía.', time: '9:18', mine: true },
    { text: '¡Perfecto! Muchas gracias.', time: '9:19', mine: false },
  ];

  return (
    <div style={{ background: D3.surface, height: '100%', fontFamily: D3.fontSans, display: 'flex', flexDirection: 'column' }}>
      <D3StatusBar />
      <div style={{ padding: '6px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${D3.border}` }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D3.textTertiary} strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        <D3Avatar name="María Fernández" size={36} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: D3.textPrimary, letterSpacing: -0.3 }}>María Fernández</div>
          <div style={{ fontSize: 11, color: D3.success, fontWeight: 500, display: 'flex', gap: 5, alignItems: 'center' }}>
            <D3Dot color={D3.success} size={6} /> WhatsApp · hace 2 min
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={D3.textTertiary} strokeWidth="1.7" strokeLinecap="round"><path d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
        </div>
      </div>

      <div style={{ margin: '10px 16px 0', padding: '10px 14px', background: D3.accentSoft, borderRadius: D3.radiusSm, border: `1px solid ${D3.accentMid}`, display: 'flex', gap: 10, alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D3.accent} strokeWidth="2.5" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <div style={{ flex: 1, fontSize: 12, color: D3.accent, lineHeight: 1.4 }}>
          <strong>IA:</strong> Compartir número de guía puede incrementar satisfacción del cliente.
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: D3.accent, flexShrink: 0 }}>Usar</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: D3.bg }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.mine ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '76%', padding: '10px 14px', borderRadius: m.mine ? '14px 14px 3px 14px' : '14px 14px 14px 3px', background: m.mine ? D3.accent : D3.surface, boxShadow: D3.shadow }}>
              <div style={{ fontSize: 13, color: m.mine ? '#fff' : D3.textPrimary, lineHeight: 1.55 }}>{m.text}</div>
              <div style={{ fontSize: 10, color: m.mine ? 'rgba(255,255,255,0.5)' : D3.textTertiary, marginTop: 4, textAlign: m.mine ? 'right' : 'left' }}>{m.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 16px', borderTop: `1px solid ${D3.border}`, background: D3.surface, display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, background: D3.bg, borderRadius: 24, border: `1px solid ${D3.borderMid}`, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: D3.textTertiary }}>Mensaje...</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D3.textTertiary} strokeWidth="1.7" strokeLinecap="round"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: D3.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,82,204,0.28)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </div>
      </div>
      <D3NavBar />
    </div>
  );
}
