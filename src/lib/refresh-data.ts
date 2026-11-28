import { debugFetch } from "./browser-debug";

/** Read fresh, authorized data without navigating or replaying a mutation. */
export async function refreshData<T>(url: string): Promise<T> {
  const response = await debugFetch(url, { cache: "no-store" });
  const payload = await response.json() as { ok?: boolean; data?: T; message?: string };
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.message ?? "No se pudieron actualizar los datos.");
  }
  return payload.data;
}
