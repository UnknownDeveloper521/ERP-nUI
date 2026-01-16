import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://lrrgtrhnkziwmpufnset.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const supabase = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export function getBearerTokenFromHeaders(headers: Record<string, any>) {
  const h = (headers?.authorization || headers?.Authorization || "") as string;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export function createAuthedSupabaseClient(accessToken: string) {
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing server Supabase configuration. Set SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) in your .env file."
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { persistSession: false },
  });
}

export async function getUserFromAccessToken(accessToken: string) {
  if (!supabase) {
    throw new Error(
      "Missing server Supabase configuration. Set SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) in your .env file."
    );
  }
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) throw error;
  if (!data.user) throw new Error("Invalid access token");
  return data.user;
}
