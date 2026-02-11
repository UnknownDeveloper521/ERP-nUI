import { createClient } from "@supabase/supabase-js";

// Use environment variables from .env file
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("🔗 Supabase URL:", SUPABASE_URL);
console.log("🔑 Supabase Key loaded:", SUPABASE_ANON_KEY ? "Yes" : "No");
console.log("🔄 Build v3 - Using env variables");

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
