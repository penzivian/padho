import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { requiredEnv } from "@/lib/env";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server components cannot set cookies; server actions can.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Server components cannot set cookies; server actions can.
          }
        }
      }
    }
  );
}
