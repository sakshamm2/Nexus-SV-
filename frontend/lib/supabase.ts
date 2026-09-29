import { createClient } from "@supabase/supabase-js";

// Keeps the login session in the browser and refreshes it automatically.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);