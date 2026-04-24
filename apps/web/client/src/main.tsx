import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/error-reporting";
import { normalizeInitialLocation } from "@/hooks/use-workspace-location";

if (!window.location.hash) {
  window.location.hash = "#/";
}

normalizeInitialLocation();
installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);
