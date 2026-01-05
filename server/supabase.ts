import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://lrrgtrhnkziwmpufnset.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing server Supabase configuration. Set SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) in your .env file."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getUserFromAccessToken(accessToken: string) {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) throw error;
  if (!data.user) throw new Error("Invalid access token");
  return data.user;
}
