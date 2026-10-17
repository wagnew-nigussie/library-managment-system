const API_BASE = "http://localhost:5000/api";

const TOKEN_KEY = "library_management_token";
const USER_KEY = "library_management_user";

export function getAuthToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const user = window.sessionStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function saveAuthSession(token, user) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(USER_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let result = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { message: text };
  }

  if (!response.ok) {
    const error = new Error(
      result.message || `Request failed: ${response.status}`
    );
    error.status = response.status;
    error.data = result;
    throw error;
  }

  return result;
}

export function getList(result, key) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.[key])) return result[key];
  if (Array.isArray(result?.data?.[key])) return result.data[key];
  return [];
}
