import { D3 } from '@/features/ultra-premium/tokens';
import { D3Dashboard } from '@/features/ultra-premium/screens/dashboard';
import { D3Inbox } from '@/features/ultra-premium/screens/inbox';
import { D3Conversation } from '@/features/ultra-premium/screens/conversation';
import { D3Pipeline } from '@/features/ultra-premium/screens/pipeline';
import { D3ContactProfile } from '@/features/ultra-premium/screens/contact-profile';

const FRAME_W = 380;
const FRAME_H = 820;

function PhoneFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: FRAME_W, height: FRAME_H, borderRadius: 44,
        padding: 10, background: '#0D0D0C',
        boxShadow: '0 30px 60px -20px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.4)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 34, overflow: 'hidden', background: D3.bg, position: 'relative' }}>
          {children}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: D3.textSecondary, fontFamily: D3.fontSans, letterSpacing: 0.2 }}>{title}</div>
    </div>
  );
}

export default function UltraPremiumShowcase() {
  return (
    <div style={{
      minHeight: '100vh', background: D3.bg, fontFamily: D3.fontSans,
      padding: '48px 32px 80px', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto 40px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: D3.accent, letterSpacing: 1.4, marginBottom: 8 }}>
          DIRECTION 03
        </div>
        <h1 style={{ fontSize: 44, fontWeight: 700, color: D3.textPrimary, letterSpacing: -1.6, lineHeight: 1.05, margin: 0, marginBottom: 14 }}>
          Ultra-Premium Platform
        </h1>
        <p style={{ fontSize: 16, color: D3.textSecondary, lineHeight: 1.55, maxWidth: 640, margin: 0 }}>
          Apple-level discipline. Highly minimal, elegant, spacious. Single cobalt accent
          on near-white surfaces — extreme restraint for an investor-grade product feel.
        </p>

        <div style={{ display: 'flex', gap: 24, marginTop: 32, flexWrap: 'wrap' }}>
          {[
            { k: 'Background', v: D3.bg },
            { k: 'Surface', v: D3.surface },
            { k: 'Text Primary', v: D3.textPrimary },
            { k: 'Accent', v: D3.accent },
            { k: 'Success', v: D3.success },
            { k: 'Danger', v: D3.danger },
          ].map((s) => (
            <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: s.v, border: `1px solid ${D3.border}` }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: D3.textPrimary, letterSpacing: -0.1 }}>{s.k}</div>
                <div style={{ fontSize: 10, color: D3.textTertiary, fontFamily: 'JetBrains Mono, monospace' }}>{s.v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${FRAME_W}px, ${FRAME_W}px))`,
        gap: 56, justifyContent: 'center',
      }}>
        <PhoneFrame title="01 · Dashboard"><D3Dashboard /></PhoneFrame>
        <PhoneFrame title="02 · Inbox"><D3Inbox /></PhoneFrame>
        <PhoneFrame title="03 · Conversación"><D3Conversation /></PhoneFrame>
        <PhoneFrame title="04 · Pipeline"><D3Pipeline /></PhoneFrame>
        <PhoneFrame title="05 · Contacto"><D3ContactProfile /></PhoneFrame>
      </div>
    </div>
  );
}
