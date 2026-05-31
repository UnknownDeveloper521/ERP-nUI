import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./lib/store";

// Radix popovers inside scrollable dialogs can emit benign ResizeObserver loop errors
// that the dev overlay treats as fatal — suppress them in development only.
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
}

console.log("[App] main.tsx mount start");
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);

