import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "@/components/layout/sidebar-mobile-logout.css";
import { installGlobalErrorReporting } from "@/lib/error-reporting";
import { normalizeInitialLocation } from "@/hooks/use-workspace-location";

if (window.location.pathname === "/" && !window.location.hash) {
  history.replaceState(null, "", "/");
}

normalizeInitialLocation();
installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);
