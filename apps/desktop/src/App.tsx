export default function App() {
  return (
    <main className="shell-preview">
      <div className="shell-card">
        <p className="shell-kicker">Pymeshub Desktop</p>
        <h1>Shell remoto listo para Tauri</h1>
        <p>
          Este frontend local solo existe para el empaquetado. La app de escritorio carga una
          URL configurada en build con fallback a
          <strong> http://127.0.0.1:5000 </strong>
          dentro de WebView2.
        </p>
      </div>
    </main>
  );
}
