const API_URL = "http://localhost:8000";
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
  if (!response.ok) throw new Error((await response.json()).detail ?? "Error de registro");
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
  if (!response.ok) throw new Error((await response.json()).detail ?? "Error de acceso");
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
