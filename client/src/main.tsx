import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./lib/store";

// Radix popovers / async handlers can emit non-Error rejections that the dev overlay treats as fatal.
if (import.meta.env.DEV) {
  window.addEventListener(
    "error",
    (event) => {
      const message = event.message ?? "";
      if (message.includes("ResizeObserver loop")) {
        event.stopImmediatePropagation();
      }
    },
    true,
  );
  window.addEventListener("unhandledrejection", (event) => {
    if (!(event.reason instanceof Error)) {
      console.warn("[dev] Suppressed non-Error promise rejection:", event.reason);
      event.preventDefault();
    }
  });
}

console.log("[App] main.tsx mount start");
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

