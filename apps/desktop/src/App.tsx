import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

type RuntimeStage = "idle" | "starting" | "ready" | "error";

type RuntimePayload = {
  stage?: RuntimeStage;
  message?: string;
  config_path?: string;
  log_path?: string;
};

const initialState = {
  stage: "idle" as RuntimeStage,
  message: "Preparando el servidor local de Pymeshub Enterprise...",
  configPath: "",
  logPath: "",
};

export default function App() {
  const [status, setStatus] = useState(initialState);

  useEffect(() => {
    let disposed = false;

    const applyPayload = (payload: RuntimePayload, fallbackStage: RuntimeStage) => {
      if (disposed) {
        return;
      }

      setStatus({
        stage: payload.stage ?? fallbackStage,
        message: payload.message ?? initialState.message,
        configPath: payload.config_path ?? "",
        logPath: payload.log_path ?? "",
      });
    };

    const setupListeners = async () => {
      const unlistenStatus = await listen<RuntimePayload>(
        "desktop://enterprise-runtime-status",
        (event) => applyPayload(event.payload, "starting"),
      );
      const unlistenError = await listen<RuntimePayload>(
        "desktop://enterprise-runtime-error",
        (event) => applyPayload(event.payload, "error"),
      );

      return () => {
        unlistenStatus();
        unlistenError();
      };
    };

    let cleanup: (() => void) | undefined;
    void setupListeners().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <main className="shell-preview">
      <div className="shell-card">
        <p className="shell-kicker">Pymeshub Enterprise</p>
        <h1>Inicializando servidor local</h1>
        <p className="shell-message">{status.message}</p>

        <div className="shell-badge" data-stage={status.stage}>
          {labelForStage(status.stage)}
        </div>

        <div className="shell-details">
          <p>
            <span>Config</span>
            <strong>{status.configPath || "Se generara al primer arranque"}</strong>
          </p>
          <p>
            <span>Logs</span>
            <strong>{status.logPath || "Se generaran al primer arranque"}</strong>
          </p>
        </div>

        <p className="shell-note">
          Esta ventana permanece visible mientras se crean configuraciones, se aplican migraciones
          y se levantan el API y el frontend local.
        </p>
      </div>
    </main>
  );
}

function labelForStage(stage: RuntimeStage) {
  switch (stage) {
    case "ready":
      return "Servidor listo";
    case "error":
      return "Requiere revision";
    case "starting":
      return "Arrancando servicios";
    default:
      return "Preparando runtime";
  }
}
