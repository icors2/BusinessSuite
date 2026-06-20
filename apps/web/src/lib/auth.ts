const TOKEN_KEY = 'anc_access_token';

export interface AuthSession {
  accessToken: string;
  email: string;
  roles: string[];
}

function decodeJwtPayload(token: string): { email?: string; roles?: string[] } {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    return JSON.parse(atob(payload));
  } catch {
    return {};
  }
}

export function getSession(): AuthSession | null {
  const accessToken = localStorage.getItem(TOKEN_KEY);
  if (!accessToken) return null;
  const payload = decodeJwtPayload(accessToken);
  return {
    accessToken,
    email: payload.email ?? '',
    roles: payload.roles ?? [],
  };
}

export function setSession(accessToken: string): AuthSession {
  localStorage.setItem(TOKEN_KEY, accessToken);
  const payload = decodeJwtPayload(accessToken);
  return {
    accessToken,
    email: payload.email ?? '',
    roles: payload.roles ?? [],
  };
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(
  email: string,
  password: string,
): Promise<AuthSession> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Login failed');
  }

  const data = await res.json();
  return setSession(data.accessToken);
}
