/**
 * API client for the RantAI Agents backend.
 *
 * The base URL is read from .env (key API_URL) via react-native-config. No URL
 * is hardcoded, so moving from dev -> production is just a matter of changing
 * .env and rebuilding the app.
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

/** Base fetch to the backend with JSON headers + uniform error handling. */
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
 * Check whether the backend is reachable from the phone. Returns true if the
 * server responds (any status < 500). Useful for a connection diagnostics screen.
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
// Mobile auth + chat history (dashboard chat sessions)
// ============================================================

export interface MobileUser {
  id: string
  email: string
  name: string | null
  role: string
}

/** Mobile login — POST /api/mobile/login. Returns a JWT token + user. */
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

/** Authorized fetch using the Bearer token from login. */
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

/** Chat session summary (one item in the history list). */
export interface ChatSessionSummary {
  id: string
  title: string
  assistantId: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage: string | null
}

/** A single message within a session. */
export interface ChatSessionMessage {
  id: string
  role: string
  content: string
  createdAt?: string
  /** Id of the message being replied to (reply feature). */
  replyTo?: string | null
}

/** Artifact produced by Canvas (HTML, React, SVG, etc.). */
export interface ChatArtifact {
  id: string
  title: string
  content: string
  artifactType: string | null
  metadata?: Record<string, unknown> | null
}

/** Chat session detail along with its messages & artifacts. */
export interface ChatSessionDetail {
  id: string
  title: string
  assistantId: string
  createdAt: string
  messages: ChatSessionMessage[]
  artifacts?: ChatArtifact[]
}

/** The user's chat history list — GET /api/dashboard/chat/sessions. */
export async function getChatSessions(token: string): Promise<ChatSessionSummary[]> {
  const res = await authFetch("/api/dashboard/chat/sessions", token)
  return res.json()
}

/**
 * Create a new session/conversation — POST /api/dashboard/chat/sessions.
 * assistantId "general" = the default assistant ("Just Chat").
 */
export async function createChatSession(
  token: string,
  assistantId: string,
  title?: string,
): Promise<ChatSessionSummary> {
  const res = await authFetch("/api/dashboard/chat/sessions", token, {
    method: "POST",
    body: JSON.stringify({ assistantId, ...(title ? { title } : {}) }),
  })
  return res.json()
}

/** Rename a session — PATCH /api/dashboard/chat/sessions/:id. */
export async function renameChatSession(
  token: string,
  id: string,
  title: string,
): Promise<{ id: string; title: string }> {
  const res = await authFetch(`/api/dashboard/chat/sessions/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  })
  return res.json()
}

/** Delete a session — DELETE /api/dashboard/chat/sessions/:id. */
export async function deleteChatSession(token: string, id: string): Promise<void> {
  await authFetch(`/api/dashboard/chat/sessions/${id}`, token, { method: "DELETE" })
}

/** Detail + messages of a single session — GET /api/dashboard/chat/sessions/:id. */
export async function getChatSession(
  token: string,
  id: string,
): Promise<ChatSessionDetail> {
  const res = await authFetch(`/api/dashboard/chat/sessions/${id}`, token)
  return res.json()
}

/**
 * Save messages to a session — POST /api/dashboard/chat/sessions/:id/messages.
 * The backend only stores the messages (it does not generate an AI reply).
 * Returns the stored messages along with their real ids from the database.
 */
export async function sendChatMessages(
  token: string,
  sessionId: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ messages: ChatSessionMessage[] }> {
  const res = await authFetch(
    `/api/dashboard/chat/sessions/${sessionId}/messages`,
    token,
    { method: "POST", body: JSON.stringify({ messages }) },
  )
  return res.json()
}

/**
 * Send a message & get the AI reply (non-streaming) — POST /api/mobile/chat.
 * The backend stores the user message, generates an AI reply, saves it, then
 * returns the reply text.
 */
/** A skill that can be selected in the composer. */
export interface Skill {
  id: string
  displayName: string
  description: string
  icon: string | null
}

/** The user's skill list — GET /api/mobile/skills. */
export async function getSkills(token: string): Promise<Skill[]> {
  const res = await authFetch("/api/mobile/skills", token)
  return res.json()
}

/** Result of the backend processing an attachment. */
export interface UploadedAttachment {
  /** "inline" = text extracted successfully; "rag" = stored as a document. */
  type: "inline" | "rag"
  /** Extracted text (for type "inline"). */
  text?: string
  documentId?: string
  fileId?: string
}

/**
 * Upload an attachment — POST /api/chat/upload (multipart).
 * Note: deliberately does NOT use apiFetch because the Content-Type header must
 * be left empty so React Native can fill in its own multipart boundary.
 */
export async function uploadAttachment(
  token: string,
  sessionId: string,
  file: { uri: string; name: string; type: string },
): Promise<UploadedAttachment> {
  const form = new FormData()
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as never)
  form.append("sessionId", sessionId)

  const res = await fetch(`${API_URL}/api/chat/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => ""))
  }
  const data = await res.json()
  return data?.result ?? data
}

export interface ChatTools {
  /** Allow the AI to search the web before answering. */
  enableWebSearch?: boolean
  /** Allow the AI to run code in a sandbox (requires Piston active on the backend). */
  enableCodeInterpreter?: boolean
  /** Names of other built-in tools that are enabled (e.g. "calculator", "date_time"). */
  enabledToolNames?: string[]
  /** Ids of enabled skills; their prompts are injected by the backend into the system prompt. */
  enabledSkillIds?: string[]
  /**
   * Canvas mode: "auto" (AI decides) or one of the artifact types
   * (e.g. "text/html", "application/react"). Empty = Canvas off.
   */
  canvasMode?: string
  /** Attachment text injected as context. */
  fileContext?: string
}

export async function sendChatAndReply(
  token: string,
  sessionId: string,
  content: string,
  tools?: ChatTools,
  /** Id of the message being replied to — quoted into the prompt & stored as a relation. */
  replyTo?: string,
): Promise<{ reply: string }> {
  const res = await authFetch("/api/mobile/chat", token, {
    method: "POST",
    body: JSON.stringify({ sessionId, content, ...tools, replyTo }),
  })
  return res.json()
}

/**
 * Regenerate the last reply — POST /api/mobile/chat/regenerate.
 * The backend discards the last assistant reply and generates a new one;
 * the user message is not duplicated.
 */
export async function regenerateReply(
  token: string,
  sessionId: string,
  tools?: ChatTools,
): Promise<{ reply: string }> {
  const res = await authFetch("/api/mobile/chat/regenerate", token, {
    method: "POST",
    body: JSON.stringify({ sessionId, ...tools }),
  })
  return res.json()
}

/** Delete messages — DELETE /api/dashboard/chat/sessions/:id/messages. */
export async function deleteChatMessages(
  token: string,
  sessionId: string,
  messageIds: string[],
): Promise<void> {
  await authFetch(`/api/dashboard/chat/sessions/${sessionId}/messages`, token, {
    method: "DELETE",
    body: JSON.stringify({ messageIds }),
  })
}

// ============================================================
// Agent Builder (assistants) — /api/mobile/assistants
// ============================================================

/** An agent (assistant) as returned by the mobile API. */
export interface Agent {
  id: string
  name: string
  description: string | null
  emoji: string
  systemPrompt: string
  model: string
  isBuiltIn: boolean
  isSystemDefault: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  /** Number of tools bound to the agent (list endpoint only). */
  toolCount?: number
}

/** Fields accepted when creating or editing an agent (MVP subset). */
export interface AgentInput {
  name: string
  systemPrompt: string
  description?: string | null
  emoji?: string
  model?: string
}

/** A selectable model for the agent editor dropdown. */
export interface AgentModel {
  id: string
  name: string
  provider: string
  hasToolCalling: boolean
  isFree: boolean
}

/**
 * List agents visible to the user, plus the user's personal default agent id —
 * GET /api/mobile/assistants.
 */
export async function getAgents(
  token: string,
): Promise<{ assistants: Agent[]; defaultAssistantId: string | null }> {
  const res = await authFetch("/api/mobile/assistants", token)
  return res.json()
}

/** A single agent — GET /api/mobile/assistants/:id. */
export async function getAgent(token: string, id: string): Promise<Agent> {
  const res = await authFetch(`/api/mobile/assistants/${id}`, token)
  return res.json()
}

/** Create an agent — POST /api/mobile/assistants. */
export async function createAgent(token: string, input: AgentInput): Promise<Agent> {
  const res = await authFetch("/api/mobile/assistants", token, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Update an agent — PUT /api/mobile/assistants/:id. */
export async function updateAgent(
  token: string,
  id: string,
  input: Partial<AgentInput>,
): Promise<Agent> {
  const res = await authFetch(`/api/mobile/assistants/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Delete an agent — DELETE /api/mobile/assistants/:id. */
export async function deleteAgent(token: string, id: string): Promise<void> {
  await authFetch(`/api/mobile/assistants/${id}`, token, { method: "DELETE" })
}

/** Duplicate an agent — POST /api/mobile/assistants/:id/duplicate. */
export async function duplicateAgent(token: string, id: string): Promise<Agent> {
  const res = await authFetch(`/api/mobile/assistants/${id}/duplicate`, token, {
    method: "POST",
  })
  return res.json()
}

/** Set the user's default agent — POST /api/mobile/assistants/:id/default. */
export async function setDefaultAgent(token: string, id: string): Promise<void> {
  await authFetch(`/api/mobile/assistants/${id}/default`, token, { method: "POST" })
}

/** Models available for the agent editor — GET /api/mobile/models. */
export async function getModels(token: string): Promise<AgentModel[]> {
  const res = await authFetch("/api/mobile/models", token)
  return res.json()
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Call the OpenAI-compatible endpoint on the backend.
 * Authenticates with a Bearer API key (create one in the dashboard: Agent API Keys).
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
