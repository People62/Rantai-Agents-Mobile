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
