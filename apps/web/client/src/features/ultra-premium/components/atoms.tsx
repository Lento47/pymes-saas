import { D3 } from '../tokens';

export function D3StatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? 'rgba(255,255,255,0.9)' : D3.textPrimary;
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', position: 'relative' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: c, fontFamily: D3.fontSans, letterSpacing: -0.2 }}>9:41</span>
      <div style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: 10, background: dark ? '#2a2a2a' : '#E0E0DC' }} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect x="0" y="4" width="3" height="8" rx="1" fill={c} opacity="0.4"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill={c} opacity="0.6"/><rect x="9" y="1" width="3" height="11" rx="1" fill={c} opacity="0.8"/><rect x="13.5" y="0" width="2.5" height="12" rx="1" fill={c}/></svg>
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="0.5" y="0.5" width="20" height="11" rx="2.5" stroke={c} strokeWidth="1" opacity="0.5"/><rect x="2" y="2" width="14" height="8" rx="1.5" fill={c}/><path d="M22 4C22.8 4 23.5 4.7 23.5 6C23.5 7.3 22.8 8 22 8V4Z" fill={c} opacity="0.5"/></svg>
      </div>
    </div>
  );
}

export function D3NavBar({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 130, height: 5, borderRadius: 3, background: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)' }} />
    </div>
  );
}

export function D3Dot({ color = D3.accent, size = 8 }: { color?: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: size / 2, background: color, flexShrink: 0 }} />;
}

export function D3Avatar({ name, size = 36, mono = false }: { name: string; size?: number; mono?: boolean }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: mono ? D3.surfaceSubtle : D3.accentSoft,
      border: `1px solid ${mono ? D3.border : D3.accentMid}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 700, letterSpacing: -0.3,
      color: mono ? D3.textSecondary : D3.accent, fontFamily: D3.fontSans, flexShrink: 0,
    }}>{initials}</div>
  );
}

export function D3Tag({ label, color = D3.accent }: { label: string; color?: string }) {
  return (
    <div style={{
      padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
      background: color === D3.accent ? D3.accentSoft : color + '12',
      color, fontFamily: D3.fontSans, letterSpacing: 0.1,
      border: `1px solid ${color === D3.accent ? D3.accentMid : color + '25'}`,
      display: 'inline-block',
    }}>{label}</div>
  );
}

export function D3BottomNav({ active = 0 }: { active?: number }) {
  const items = [
    { path: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25', label: 'Inicio' },
    { path: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z', label: 'Inbox', badge: true },
    { path: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', label: 'Clientes' },
    { path: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z', label: 'Pipeline' },
    { path: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z', label: 'Config.' },
  ];

  return (
    <div style={{ height: 58, background: D3.surface, borderTop: `1px solid ${D3.border}`, display: 'flex', alignItems: 'stretch' }}>
      {items.map((item, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' }}>
          {item.badge && (
            <div style={{ position: 'absolute', top: 7, left: '50%', marginLeft: 4, width: 7, height: 7, borderRadius: 4, background: D3.accent }} />
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={i === active ? D3.accent : D3.textTertiary}
            strokeWidth={i === active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d={item.path} />
          </svg>
          <span style={{ fontSize: 10, fontWeight: i === active ? 600 : 400, color: i === active ? D3.accent : D3.textTertiary, fontFamily: D3.fontSans, letterSpacing: 0.1 }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
