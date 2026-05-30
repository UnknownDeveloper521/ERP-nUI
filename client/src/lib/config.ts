const DEFAULT_API_BASE_URL = "http://localhost:8000";

const normalizeBaseUrl = (value?: string | null) =>
  value?.trim().replace(/\/+$/, "") ?? "";

const buildTimeApiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_BACKEND_URL
);

export const API_BASE_URL = buildTimeApiBaseUrl || DEFAULT_API_BASE_URL;

export const API_BASE = `${API_BASE_URL}/api`;
