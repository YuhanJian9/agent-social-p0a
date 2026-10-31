export type ApiResult = {
  status: number;
  json: Record<string, unknown> | null;
  text: string;
  location: string | null;
};

export class Session {
  readonly cookies = new Map<string, string>();

  constructor(private readonly base: string) {}

  setCookie(name: string, value: string) {
    this.cookies.set(name, value);
  }

  private cookieHeader() {
    return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  async request(path: string, init: RequestInit = {}): Promise<ApiResult> {
    const headers = new Headers(init.headers);
    const cookie = this.cookieHeader();
    if (cookie) headers.set("cookie", cookie);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const response = await fetch(this.base + path, {
      ...init,
      headers,
      redirect: "manual",
    });
    const setCookies =
      typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    for (const line of setCookies) {
      const part = line.split(";")[0] ?? "";
      const eq = part.indexOf("=");
      if (eq > 0) this.cookies.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
    }
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json, text, location: response.headers.get("location") };
  }

  async page(path: string) {
    let current = path;
    for (let hop = 0; hop < 4; hop += 1) {
      const result = await this.request(current);
      if (result.status >= 300 && result.status < 400 && result.location) {
        current = result.location.startsWith("http")
          ? new URL(result.location).pathname
          : result.location;
        continue;
      }
      return result;
    }
    throw new Error(`too many redirects for ${path}`);
  }
}

export async function authed(
  base: string,
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<ApiResult> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(base + path, { ...init, headers });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text, location: null };
}
