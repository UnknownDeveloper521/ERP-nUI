import { createClient } from "@supabase/supabase-js";

// Correct Supabase project: lrrgtrhnkziwmpufnset
const SUPABASE_URL = "https://lrrgtrhnkziwmpufnset.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxycmd0cmhua3ppd21wdWZuc2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwODYzMjcsImV4cCI6MjA4MjY2MjMyN30.R6bf2h8y0Pi7MjD79OOdM5byGG1lLKK9n7epp0nB0_w";

console.log("🔗 Supabase URL:", SUPABASE_URL);
console.log("🔑 Supabase Key loaded:", SUPABASE_ANON_KEY ? "Yes" : "No");
console.log("🔄 Build v2");

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
