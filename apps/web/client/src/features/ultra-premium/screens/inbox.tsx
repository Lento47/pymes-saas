import { D3 } from '../tokens';
import { D3StatusBar, D3NavBar, D3Avatar, D3BottomNav } from '../components/atoms';

export function D3Inbox() {
  const convos = [
    { name: 'María Fernández', preview: '¿Cuándo estará listo mi pedido?', time: '9:28', ch: 'WA', unread: 3, c: D3.success },
    { name: 'Distribuidora Mora', preview: 'Adjunto la factura solicitada.', time: '8:55', ch: 'Email', unread: 1, c: D3.accent },
    { name: 'Luis González', preview: 'Gracias, ya recibí la confirmación.', time: 'Ayer', ch: 'TG', unread: 0, c: '#7C3AED' },
    { name: 'Ferretería Vega', preview: '¿Tienen tornillo 3/8 zincado?', time: 'Ayer', ch: 'WA', unread: 2, c: D3.success },
    { name: 'Ana Rodríguez', preview: 'Formulario de cotización enviado.', time: 'Mar', ch: 'Form', unread: 0, c: D3.warning },
    { name: 'Constructora del Sur', preview: 'Propuesta revisada — reunión jueves.', time: 'Mar', ch: 'Email', unread: 0, c: D3.accent },
  ];

  return (
    <div style={{ background: D3.bg, minHeight: '100%', fontFamily: D3.fontSans, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <D3StatusBar />
      <div style={{ padding: '12px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: D3.textPrimary, letterSpacing: -0.6 }}>Inbox</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D3.textSecondary} strokeWidth="1.7" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={D3.textSecondary} strokeWidth="1.7" strokeLinecap="round"><path d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25"/></svg>
        </div>
      </div>

      <div style={{ display: 'flex', padding: '12px 22px 0', gap: 0, borderBottom: `1px solid ${D3.border}` }}>
        {['Todo', 'Sin leer', 'WhatsApp', 'Email'].map((t, i) => (
          <div key={i} style={{ padding: '8px 14px', fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? D3.accent : D3.textTertiary, borderBottom: i === 0 ? `1.5px solid ${D3.accent}` : '1.5px solid transparent', marginBottom: -1 }}>{t}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', background: D3.surface }}>
        {convos.map((c, i) => (
          <div key={i} style={{ padding: '14px 22px', display: 'flex', gap: 13, alignItems: 'center', borderBottom: `1px solid ${D3.border}` }}>
            <div style={{ position: 'relative' }}>
              <D3Avatar name={c.name} size={44} mono={!c.unread} />
              <div style={{ position: 'absolute', bottom: -1, right: -1, width: 18, height: 14, borderRadius: 5, background: c.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>{c.ch}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ fontSize: 14, fontWeight: c.unread ? 700 : 500, color: D3.textPrimary }}>{c.name}</div>
                <div style={{ fontSize: 11, color: D3.textTertiary }}>{c.time}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: D3.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.preview}</div>
                {c.unread > 0 && (
                  <div style={{ width: 18, height: 18, borderRadius: 9, background: D3.accent, fontSize: 10, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 }}>{c.unread}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 105, right: 22 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: D3.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,82,204,0.3)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
      </div>

      <D3BottomNav active={1} />
      <D3NavBar />
    </div>
  );
}
