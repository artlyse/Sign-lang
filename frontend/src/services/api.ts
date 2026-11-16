/**
 * Helper JSON sobre authenticatedFetch con mensajes de error del backend.
 */
import { authenticatedFetch, readApiError } from "./auth";

export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const response = await authenticatedFetch(path, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Error ${response.status}`));
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}
