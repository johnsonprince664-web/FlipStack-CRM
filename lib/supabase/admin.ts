import { createClient } from "@supabase/supabase-js";

export function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error("Missing Supabase admin environment variables");
  }

  return createClient(url, service, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function getUserFromRequest(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.replace("Bearer ", "");

  if (!token) {
    return { user: null, error: "Missing bearer token" };
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: error?.message || "Unauthorized" };
  }

  return { user: data.user, error: null };
}
