import type { AppType } from "@kaoru/api";
import { hc } from "hono/client";
import { supabase } from "@/lib/supabase";

// Authenticated RPC client with Supabase JWT injection & 401 automatic refresh
export const api = hc<AppType>(import.meta.env.VITE_API_URL, {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    let {
      data: { session },
    } = await supabase.auth.getSession();

    const headers = new Headers(init?.headers);
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    let response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
      const { data: refreshData, error } = await supabase.auth.refreshSession();
      if (!error && refreshData.session) {
        headers.set(
          "Authorization",
          `Bearer ${refreshData.session.access_token}`,
        );
        response = await fetch(input, { ...init, headers });
      }
    }

    return response;
  },
});
