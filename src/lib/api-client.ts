"use client";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function send<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      data.error ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiPost = <T = unknown>(url: string, body: unknown) =>
  send<T>("POST", url, body);
export const apiPut = <T = unknown>(url: string, body: unknown) =>
  send<T>("PUT", url, body);
export const apiPatch = <T = unknown>(url: string, body: unknown) =>
  send<T>("PATCH", url, body);
export const apiDelete = <T = unknown>(url: string) =>
  send<T>("DELETE", url);
