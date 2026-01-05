import { createClient } from "@supabase/supabase-js";

// ⚠️ IMPORTANT: Replace this key with YOUR CORRECT Supabase anon key
// Get it from: https://app.supabase.co/project/zpecwgqgsjwjrfrfrzzq/settings/api
// Under "anon public" section - copy the FULL key

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lrrgtrhnkziwmpufnset.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_ANON_KEY (and optionally VITE_SUPABASE_URL) in your .env file."
  );
}

console.log("🔗 Supabase URL:", SUPABASE_URL);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions
export const signUpWithEmail = async (email: string, password: string) => {
  return supabase.auth.signUp({ email, password });
};

export const signInWithEmail = async (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
  return supabase.auth.signOut();
};

export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

export const getAccessToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

export const onAuthStateChange = (callback: (user: any) => void) => {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
};
