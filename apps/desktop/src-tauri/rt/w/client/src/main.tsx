import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorReporting } from "@/lib/error-reporting";

if (!window.location.hash) {
  window.location.hash = "#/";
}

installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(<App />);
