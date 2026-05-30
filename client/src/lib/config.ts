const normalizeBaseUrl = (value?: string | null) =>
  value?.trim().replace(/\/+$/, "") ?? "";

const buildTimeApiBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_BACKEND_URL
);

/** True when an external backend API URL is configured. UI preview runs without one. */
export const HAS_BACKEND_API = Boolean(buildTimeApiBaseUrl);

export const API_BASE_URL = buildTimeApiBaseUrl;

export const API_BASE = buildTimeApiBaseUrl ? `${buildTimeApiBaseUrl}/api` : "";
