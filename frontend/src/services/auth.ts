/**
 * Cliente REST de autenticación/perfil y almacenamiento local del access token.
 */

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const ACCESS_KEY = "signlang_access_token";
const REFRESH_KEY = "signlang_refresh_token";

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

const saveTokens = (tokens: AuthTokens) => {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
};

const FIELD_LABELS: Record<string, string> = {
  email: "Correo electrónico",
  password: "Contraseña",
  username: "Usuario",
  login: "Usuario o correo",
  display_name: "Nombre",
};

type ValidationItem = {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
  ctx?: { min_length?: number; max_length?: number };
};

/** Convierte la respuesta de error de FastAPI en un mensaje legible en español. */
export async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  const detail = body?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item: ValidationItem) => {
        const field = String(item.loc?.[item.loc.length - 1] ?? "");
        const label = FIELD_LABELS[field] ?? field;
        if (field === "email") return "El correo electrónico no es válido";
        if (item.type === "string_too_short" && item.ctx?.min_length)
          return `${label}: mínimo ${item.ctx.min_length} caracteres`;
        if (item.type === "string_too_long" && item.ctx?.max_length)
          return `${label}: máximo ${item.ctx.max_length} caracteres`;
        if (item.type === "missing") return `${label}: es obligatorio`;
        return label ? `${label}: ${item.msg ?? "valor no válido"}` : item.msg ?? fallback;
      })
      .join(". ");
  }

  return response.status >= 500 ? `${fallback} (error del servidor)` : fallback;
}

export const getAccessToken = () => localStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);

export async function registerAccount(payload: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiError(response, "No se pudo crear la cuenta"));
  const tokens: AuthTokens = await response.json();
  saveTokens(tokens);
  return tokens;
}

export async function loginAccount(login: string, password: string) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
  if (!response.ok) throw new Error(await readApiError(response, "Usuario o contraseña incorrectos"));
  const tokens: AuthTokens = await response.json();
  saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    clearAuth();
    return null;
  }
  const tokens: AuthTokens = await response.json();
  saveTokens(tokens);
  return tokens.access_token;
}

export async function logoutAccount() {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => undefined);
  }
  clearAuth();
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  let accessToken = getAccessToken();
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status !== 401) return response;

  accessToken = await refreshAccessToken();
  if (!accessToken) return response;

  headers.set("Authorization", `Bearer ${accessToken}`);
  response = await fetch(`${API_URL}${path}`, { ...init, headers });
  return response;
}
export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await authenticatedFetch("/api/auth/me");

  if (!response.ok) {
    throw new Error("No se pudo obtener el usuario");
  }

  return response.json();
}
export type UserProfile = {
  user_id: number;
  display_name: string | null;
  locale: string;
  learning_enabled: boolean;
  implicit_learning_enabled: boolean;
};

export async function getUserProfile(): Promise<UserProfile> {
  const response = await authenticatedFetch(
    "/api/users/me/profile"
  );

  if (!response.ok) {
    throw new Error("No se pudo obtener el perfil");
  }

  return response.json();
}

export async function updateUserProfile(
  profile: Partial<{
    display_name: string | null;
    locale: string;
    learning_enabled: boolean;
    implicit_learning_enabled: boolean;
  }>
): Promise<UserProfile> {
  const response = await authenticatedFetch(
    "/api/users/me/profile",
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profile),
    }
  );

  if (!response.ok) {
    throw new Error("No se pudo actualizar el perfil");
  }

  return response.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: "GET",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
