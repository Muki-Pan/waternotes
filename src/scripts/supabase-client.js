import { createClient } from "@supabase/supabase-js";

let client;

export function getSupabase() {
  if (client) return client;

  const configElement = document.querySelector("#supabase-config");
  const config = configElement ? JSON.parse(configElement.textContent || "{}") : {};
  const key = config.publishableKey || config.anonKey;

  if (!config.url || !key) {
    console.warn("Supabase is not configured. Add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
    return null;
  }

  client = createClient(config.url, key);
  return client;
}

export function getSupabaseBucket() {
  const configElement = document.querySelector("#supabase-config");
  const config = configElement ? JSON.parse(configElement.textContent || "{}") : {};
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
