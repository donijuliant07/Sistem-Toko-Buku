import type { Book, BookInput, BookPage, BookUpdate, CurrentUser, SpoilerLevel, AIReviewResponse } from "./types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type RequestOptions = RequestInit & { accessToken?: string };

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { accessToken, headers, ...requestInit } = init ?? {};
  const response = await fetch(`${apiUrl}${path}`, {
    ...requestInit,
    headers: {
      Accept: "application/json",
      ...(requestInit.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") detail = body.detail;
      if (Array.isArray(body.detail)) detail = body.detail.map((item) => item.msg).filter(Boolean).join(", ") || detail;
    } catch {
      // Keep status fallback when backend returns an empty response.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getBooks(page = 1, query = "", pageSize = 12): Promise<BookPage> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (query.trim()) params.set("q", query.trim());
  return request<BookPage>(`/books?${params.toString()}`);
}

export function getBook(id: string): Promise<Book> {
  return request<Book>(`/books/${encodeURIComponent(id)}`);
}

export function getCurrentUser(accessToken: string): Promise<CurrentUser> {
  return request<CurrentUser>("/me", { accessToken });
}

export function checkAdmin(accessToken: string): Promise<{ status: string }> {
  return request<{ status: string }>("/admin/check", { accessToken });
}

export function createBook(data: BookInput, accessToken: string): Promise<Book> {
  return request<Book>("/books", { method: "POST", body: JSON.stringify(data), accessToken });
}

export function updateBook(id: string, data: BookUpdate, accessToken: string): Promise<Book> {
  return request<Book>(`/books/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data), accessToken });
}

export function deleteBook(id: string, accessToken: string): Promise<void> {
  return request<void>(`/books/${encodeURIComponent(id)}`, { method: "DELETE", accessToken });
}

export function getAIReview(
  bookId: string,
  spoilerLevel: SpoilerLevel,
  accessToken?: string
): Promise<AIReviewResponse> {
  return request<AIReviewResponse>(`/books/${encodeURIComponent(bookId)}/ai-review`, {
    method: "POST",
    body: JSON.stringify({ spoiler_level: spoilerLevel }),
    accessToken,
  });
}
