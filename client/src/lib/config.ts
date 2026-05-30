type RuntimeConfig = {
  API_BASE_URL?: string;
};

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8000";

const normalizeBaseUrl = (value?: string | null) =>
  value?.trim().replace(/\/+$/, "") ?? "";

const runtimeApiBaseUrl = normalizeBaseUrl(
  typeof window !== "undefined" ? window.__APP_RUNTIME_CONFIG__?.API_BASE_URL : undefined
);

const buildTimeApiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_BACKEND_URL
);

export const API_BASE_URL =
  runtimeApiBaseUrl || buildTimeApiBaseUrl || DEFAULT_API_BASE_URL;

export const API_BASE = `${API_BASE_URL}/api`;
