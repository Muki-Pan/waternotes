import { createClient } from "@supabase/supabase-js";

let client;
let publicClient;

function readConfig() {
  const configElement = document.querySelector("#supabase-config");
  return configElement ? JSON.parse(configElement.textContent || "{}") : {};
}

export function getSupabase() {
  if (client) return client;

  const config = readConfig();
  const key = config.publishableKey || config.anonKey;

  if (!config.url || !key) {
    console.warn("Supabase is not configured. Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
    return null;
  }

  client = createClient(config.url, key);
  return client;
}

export function getPublicSupabase() {
  if (publicClient) return publicClient;
  const config = readConfig();
  const key = config.publishableKey || config.anonKey;
  if (!config.url || !key) return null;
  publicClient = createClient(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return publicClient;
}

export function getSupabaseBucket() {
  const config = readConfig();
  return config.bucket || "field-notes";
}

if (typeof window !== "undefined") {
  window.fieldNotesSignIn = async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    window.dispatchEvent(new CustomEvent("field-notes-auth-change", { detail: { session: data.session } }));
    return data.session;
  };

  window.fieldNotesSignOut = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.dispatchEvent(new CustomEvent("field-notes-auth-change", { detail: { session: null } }));
  };
}
