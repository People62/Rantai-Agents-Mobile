/**
 * API client untuk backend RantAI Agents.
 *
 * Base URL dibaca dari .env (key API_URL) via react-native-config. Tidak ada
 * URL yang di-hardcode, sehingga transisi dev -> produksi cukup mengganti .env
 * lalu build ulang aplikasi.
 */

import Config from "react-native-config"

const API_URL = Config.API_URL ?? "http://192.168.18.93:3000"

export function getApiUrl(): string {
  return API_URL
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`)
    this.name = "ApiError"
  }
}

/** Fetch dasar ke backend dengan header JSON + penanganan error seragam. */
export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => ""))
  }
  return res
}

/**
 * Cek apakah backend terjangkau dari HP. Mengembalikan true bila server
 * merespons (status apa pun < 500). Berguna untuk layar diagnostik koneksi.
 */
export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/`, { method: "GET" })
    return res.status < 500
  } catch {
    return false
  }
}

// ============================================================
// Auth mobile + riwayat chat (dashboard chat sessions)
// ============================================================

export interface MobileUser {
  id: string
  email: string
  name: string | null
  role: string
}

/** Login mobile — POST /api/mobile/login. Mengembalikan token JWT + user. */
export async function mobileLogin(
  email: string,
  password: string,
): Promise<{ token: string; user: MobileUser }> {
  const res = await apiFetch("/api/mobile/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  return res.json()
}

/** Fetch ber-otorisasi memakai Bearer token dari login. */
async function authFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  return apiFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
}

/** Ringkasan sesi chat (satu item di daftar riwayat). */
export interface ChatSessionSummary {
  id: string
  title: string
  assistantId: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage: string | null
}

/** Satu pesan dalam sebuah sesi. */
export interface ChatSessionMessage {
  id: string
  role: string
  content: string
  createdAt?: string
}

/** Detail sesi chat beserta pesan-pesannya. */
export interface ChatSessionDetail {
  id: string
  title: string
  assistantId: string
  createdAt: string
  messages: ChatSessionMessage[]
}

/** Daftar riwayat chat milik user — GET /api/dashboard/chat/sessions. */
export async function getChatSessions(token: string): Promise<ChatSessionSummary[]> {
  const res = await authFetch("/api/dashboard/chat/sessions", token)
  return res.json()
}

/** Detail + pesan satu sesi — GET /api/dashboard/chat/sessions/:id. */
export async function getChatSession(
  token: string,
  id: string,
): Promise<ChatSessionDetail> {
  const res = await authFetch(`/api/dashboard/chat/sessions/${id}`, token)
  return res.json()
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Panggil endpoint OpenAI-compatible di backend.
 * Autentikasi memakai Bearer API key (buat di dashboard: Agent API Keys).
 */
export async function chatCompletion(params: {
  apiKey: string
  model: string
  messages: ChatMessage[]
}): Promise<string> {
  const res = await apiFetch("/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
    }),
  })
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ""
}
