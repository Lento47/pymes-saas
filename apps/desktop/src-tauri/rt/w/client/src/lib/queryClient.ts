import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { reportClientError } from "@/lib/error-reporting";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status >= 500) {
      void reportClientError({
        source: "FRONTEND",
        category: "QUERY_RESPONSE",
        severity: "ERROR",
        title: `Query ${res.status}`,
        message: text,
        status_code: res.status,
        url: res.url,
      });
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (error: any) {
    void reportClientError({
      source: "FRONTEND",
      category: "QUERY_NETWORK",
      severity: "ERROR",
      title: "Query network failure",
      message: error?.message ?? `Falló la llamada ${method} ${url}`,
      stack: error?.stack,
      method,
      url: `${API_BASE}${url}`,
    });
    throw error;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${queryKey.join("/")}`);
    } catch (error: any) {
      void reportClientError({
        source: "FRONTEND",
        category: "QUERY_NETWORK",
        severity: "ERROR",
        title: "Query fetch failure",
        message: error?.message ?? "Falló una consulta de datos.",
        stack: error?.stack,
        url: `${API_BASE}${queryKey.join("/")}`,
      });
      throw error;
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
