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

// ============================================================
// Workflows — /api/mobile/workflows (run & monitor, read-only builder)
// ============================================================

export type WorkflowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED"
export type WorkflowMode = "STANDARD" | "CHATFLOW"
export type WorkflowCategory = "TASK" | "CHATFLOW" | "AUTOMATION"
export type RunStatus = "PENDING" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED"

/** A node in the workflow graph (we only read a few fields for display). */
export interface WorkflowNode {
  id: string
  type?: string
  /** React Flow canvas coordinates (top-left), used by the diagram view. */
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

export interface WorkflowEdge {
  id?: string
  source: string
  target: string
  sourceHandle?: string | null
}

/** A declared input/output variable of a workflow. */
export interface WorkflowVariable {
  name: string
  type?: string
  description?: string
  required?: boolean
}

export interface Workflow {
  id: string
  name: string
  description: string | null
  status: WorkflowStatus
  mode: WorkflowMode
  category: WorkflowCategory
  tags: string[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  trigger: { type?: string } | null
  variables: { inputs?: WorkflowVariable[]; outputs?: WorkflowVariable[] } | null
  createdAt: string
  updatedAt: string
  _count?: { runs: number }
}

/** One step's trace entry within a run (StepLogEntry on the backend). */
export interface WorkflowStep {
  stepId: string
  nodeId: string
  nodeType: string
  label: string
  status: string
  input?: unknown
  output?: unknown
  error?: string
  durationMs?: number
  startedAt?: string
  completedAt?: string
  tokenUsage?: { total?: number; prompt?: number; completion?: number } | null
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: RunStatus
  input: unknown
  output?: unknown
  error?: string | null
  steps: WorkflowStep[]
  startedAt: string
  completedAt?: string | null
}

/** List workflows visible to the user — GET /api/mobile/workflows. */
export async function getWorkflows(token: string): Promise<Workflow[]> {
  const res = await authFetch("/api/mobile/workflows", token)
  return res.json()
}

/** A single workflow — GET /api/mobile/workflows/:id. */
export async function getWorkflow(token: string, id: string): Promise<Workflow> {
  const res = await authFetch(`/api/mobile/workflows/${id}`, token)
  return res.json()
}

/**
 * Run a workflow — POST /api/mobile/workflows/:id/execute. Returns the created
 * run (status RUNNING); poll {@link getWorkflowRun} for progress.
 */
export async function runWorkflow(
  token: string,
  id: string,
  input: Record<string, unknown>,
): Promise<WorkflowRun> {
  const res = await authFetch(`/api/mobile/workflows/${id}/execute`, token, {
    method: "POST",
    body: JSON.stringify({ input }),
  })
  return res.json()
}

/** Run history (last 50) — GET /api/mobile/workflows/:id/runs. */
export async function getWorkflowRuns(token: string, id: string): Promise<WorkflowRun[]> {
  const res = await authFetch(`/api/mobile/workflows/${id}/runs`, token)
  return res.json()
}

/** One run with its full step trace — GET /api/mobile/workflows/:id/runs/:runId. */
export async function getWorkflowRun(
  token: string,
  id: string,
  runId: string,
): Promise<WorkflowRun> {
  const res = await authFetch(`/api/mobile/workflows/${id}/runs/${runId}`, token)
  return res.json()
}

/** Change a workflow's status (deploy/pause/archive) — PUT /api/mobile/workflows/:id. */
export async function setWorkflowStatus(
  token: string,
  id: string,
  status: WorkflowStatus,
): Promise<Workflow> {
  const res = await authFetch(`/api/mobile/workflows/${id}`, token, {
    method: "PUT",
    body: JSON.stringify({ status }),
  })
  return res.json()
}

/** Delete a workflow — DELETE /api/mobile/workflows/:id. */
export async function deleteWorkflow(token: string, id: string): Promise<void> {
  await authFetch(`/api/mobile/workflows/${id}`, token, { method: "DELETE" })
}

// ============================================================
// Media Studio — /api/mobile/media (image + audio generation)
// ============================================================

export type MediaModality = "IMAGE" | "AUDIO" | "VIDEO"
export type MediaJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"

export interface MediaAsset {
  id: string
  jobId: string
  modality: MediaModality
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationMs: number | null
  isFavorite: boolean
  createdAt: string
  /** Present on the gallery list (asset joined with its job). */
  job?: { prompt?: string; modelId?: string } | null
}

export interface MediaJob {
  id: string
  modality: MediaModality
  modelId: string
  prompt: string
  status: MediaJobStatus
  errorMessage: string | null
  assets: MediaAsset[]
  createdAt: string
}

export interface MediaModel {
  id: string
  name: string
  provider: string
  isFree: boolean
  outputModalities: string[]
  inputModalities: string[]
}

export interface GenerateMediaInput {
  modality: MediaModality
  modelId: string
  prompt: string
  parameters?: Record<string, unknown>
  referenceAssetIds?: string[]
}

/** Models that can output the given modality — GET /api/mobile/media/models. */
export async function getMediaModels(
  token: string,
  modality: MediaModality,
): Promise<MediaModel[]> {
  const res = await authFetch(`/api/mobile/media/models?modality=${modality}`, token)
  return res.json()
}

/**
 * Generate media (image/audio) — POST /api/mobile/media/jobs. Synchronous: the
 * response contains the finished job with its assets.
 */
export async function generateMedia(
  token: string,
  input: GenerateMediaInput,
): Promise<MediaJob> {
  const res = await authFetch("/api/mobile/media/jobs", token, {
    method: "POST",
    body: JSON.stringify({
      parameters: {},
      referenceAssetIds: [],
      ...input,
    }),
  })
  return res.json()
}

/** The org's media library — GET /api/mobile/media/assets. */
export async function getMediaAssets(
  token: string,
  opts?: { modality?: MediaModality; favorite?: boolean; q?: string; limit?: number },
): Promise<{ items: MediaAsset[]; nextCursor?: string | null }> {
  const params = new URLSearchParams()
  if (opts?.modality) params.set("modality", opts.modality)
  if (opts?.favorite) params.set("favorite", "true")
  if (opts?.q) params.set("q", opts.q)
  if (opts?.limit) params.set("limit", String(opts.limit))
  const qs = params.toString()
  const res = await authFetch(`/api/mobile/media/assets${qs ? `?${qs}` : ""}`, token)
  return res.json()
}

/** A single asset — GET /api/mobile/media/assets/:id. */
export async function getMediaAsset(token: string, id: string): Promise<MediaAsset> {
  const res = await authFetch(`/api/mobile/media/assets/${id}`, token)
  return res.json()
}

/** Toggle favorite — PATCH /api/mobile/media/assets/:id. */
export async function favoriteMediaAsset(
  token: string,
  id: string,
  isFavorite: boolean,
): Promise<MediaAsset> {
  const res = await authFetch(`/api/mobile/media/assets/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify({ isFavorite }),
  })
  return res.json()
}

/** Delete an asset — DELETE /api/mobile/media/assets/:id. */
export async function deleteMediaAsset(token: string, id: string): Promise<void> {
  await authFetch(`/api/mobile/media/assets/${id}`, token, { method: "DELETE" })
}

/**
 * Upload an image to use as a reference — POST /api/mobile/media/uploads.
 * Returns the created asset id (pass it in `referenceAssetIds`).
 */
export async function uploadMediaReference(
  token: string,
  file: { uri: string; name: string; type: string },
): Promise<{ assetId: string }> {
  const form = new FormData()
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as never)
  const res = await fetch(`${API_URL}/api/mobile/media/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ""))
  return res.json()
}

/**
 * Build an <Image>/<Video> source URI for an asset's bytes (served via the proxy
 * so the phone never needs to reach the internal S3 host). The token goes in the
 * query string because RN's <Image>/<Video> can't reliably send auth headers on
 * Android. Add download=true to force an attachment disposition.
 */
export function mediaFileSource(
  token: string,
  assetId: string,
  download = false,
): { uri: string } {
  const params = new URLSearchParams({ token })
  if (download) params.set("download", "1")
  return { uri: `${API_URL}/api/mobile/media/assets/${assetId}/file?${params.toString()}` }
}

// ============================================================
// Files / Knowledge Base — /api/mobile/knowledge
// ============================================================

export interface KnowledgeGroup {
  id: string
  name: string
  description: string | null
  color: string | null
  documentCount?: number
}

export interface KnowledgeDocumentGroupRef {
  id: string
  name: string
  color?: string | null
}

/** A document as returned by the list endpoint (lightweight, no content). */
export interface KnowledgeDocumentListItem {
  id: string
  title: string
  categories: string[]
  subcategory?: string | null
  fileType: string | null
  fileSize: number | null
  hasS3File?: boolean
  chunkCount: number
  groups: KnowledgeDocumentGroupRef[]
}

export interface KnowledgeChunk {
  content: string
  chunkIndex?: number
}

/** Full document detail: extracted content + chunks. */
export interface KnowledgeDocumentDetail {
  id: string
  title: string
  content: string
  categories: string[]
  subcategory?: string | null
  fileType: string | null
  fileSize: number | null
  mimeType: string | null
  s3Key: string | null
  fileUrl?: string | null
  chunks: KnowledgeChunk[]
  groups: KnowledgeDocumentGroupRef[]
}

export interface KnowledgeCategory {
  id: string
  name: string
  label: string
  color: string | null
  isSystem: boolean
}

/** List knowledge bases (groups) — GET /api/mobile/knowledge/groups. */
export async function getKnowledgeGroups(
  token: string,
): Promise<{ groups: KnowledgeGroup[]; totalDocumentCount: number }> {
  const res = await authFetch("/api/mobile/knowledge/groups", token)
  return res.json()
}

/** Create a knowledge base — POST /api/mobile/knowledge/groups. */
export async function createKnowledgeGroup(
  token: string,
  input: { name: string; description?: string; color?: string },
): Promise<KnowledgeGroup> {
  const res = await authFetch("/api/mobile/knowledge/groups", token, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Update a knowledge base — PUT /api/mobile/knowledge/groups/:id. */
export async function updateKnowledgeGroup(
  token: string,
  id: string,
  input: { name?: string; description?: string; color?: string },
): Promise<KnowledgeGroup> {
  const res = await authFetch(`/api/mobile/knowledge/groups/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Delete a knowledge base (documents kept) — DELETE /api/mobile/knowledge/groups/:id. */
export async function deleteKnowledgeGroup(token: string, id: string): Promise<void> {
  await authFetch(`/api/mobile/knowledge/groups/${id}`, token, { method: "DELETE" })
}

/** List documents (optionally within a group) — GET /api/mobile/knowledge/documents. */
export async function getKnowledgeDocuments(
  token: string,
  groupId?: string,
): Promise<{ documents: KnowledgeDocumentListItem[] }> {
  const qs = groupId ? `?groupId=${encodeURIComponent(groupId)}` : ""
  const res = await authFetch(`/api/mobile/knowledge/documents${qs}`, token)
  return res.json()
}

/** Document detail with content + chunks — GET /api/mobile/knowledge/documents/:id. */
export async function getKnowledgeDocument(
  token: string,
  id: string,
): Promise<KnowledgeDocumentDetail> {
  const res = await authFetch(`/api/mobile/knowledge/documents/${id}`, token)
  return res.json()
}

/** Update document metadata — PUT /api/mobile/knowledge/documents/:id. */
export async function updateKnowledgeDocument(
  token: string,
  id: string,
  input: { title?: string; categories?: string[]; subcategory?: string | null; groupIds?: string[] },
): Promise<KnowledgeDocumentListItem> {
  const res = await authFetch(`/api/mobile/knowledge/documents/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Delete a document — DELETE /api/mobile/knowledge/documents/:id (?hard=true to purge). */
export async function deleteKnowledgeDocument(
  token: string,
  id: string,
  hard = false,
): Promise<void> {
  const qs = hard ? "?hard=true" : ""
  await authFetch(`/api/mobile/knowledge/documents/${id}${qs}`, token, { method: "DELETE" })
}

/**
 * Upload a document file — POST /api/mobile/knowledge/documents (multipart).
 * Ingestion (extract + OCR + chunk + embed) is synchronous and can take a while,
 * so callers should show a "processing" state and use a long timeout.
 */
export async function uploadKnowledgeDocument(
  token: string,
  file: { uri: string; name: string; type: string },
  opts?: { title?: string; categories?: string[]; subcategory?: string; groupIds?: string[]; enhanced?: boolean },
): Promise<{ id: string; title: string; chunkCount?: number }> {
  const form = new FormData()
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as never)
  if (opts?.title) form.append("title", opts.title)
  if (opts?.categories?.length) form.append("categories", JSON.stringify(opts.categories))
  if (opts?.subcategory) form.append("subcategory", opts.subcategory)
  if (opts?.groupIds?.length) form.append("groupIds", JSON.stringify(opts.groupIds))
  if (opts?.enhanced === false) form.append("enhanced", "false")

  const res = await fetch(`${API_URL}/api/mobile/knowledge/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ""))
  return res.json()
}

/** List category tags — GET /api/mobile/knowledge/categories. */
export async function getKnowledgeCategories(
  token: string,
): Promise<{ categories: KnowledgeCategory[] }> {
  const res = await authFetch("/api/mobile/knowledge/categories", token)
  return res.json()
}

/** Create a category tag — POST /api/mobile/knowledge/categories. */
export async function createKnowledgeCategory(
  token: string,
  input: { label: string; color?: string },
): Promise<KnowledgeCategory> {
  const res = await authFetch("/api/mobile/knowledge/categories", token, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return res.json()
}

/** Build an <Image> source URI for a document's original file (image docs). */
export function knowledgeFileSource(token: string, id: string): { uri: string } {
  return { uri: `${API_URL}/api/mobile/knowledge/documents/${id}/file?token=${encodeURIComponent(token)}` }
}

/** An entity extracted from a document (knowledge graph node). */
export interface KnowledgeEntity {
  id: string
  name: string
  type: string
  confidence: number
}

/** A relation between two entities (edge; `in`/`out` are entity ids). */
export interface KnowledgeRelation {
  id: string
  in: string
  out: string
  relation_type: string
  confidence: number
}

export interface DocumentIntelligence {
  entities: KnowledgeEntity[]
  relations: KnowledgeRelation[]
  stats: {
    totalEntities: number
    totalRelations: number
    entityTypes: number
    relationTypes: number
  }
}

/** Entities + relations for a document — GET .../documents/:id/intelligence. */
export async function getDocumentIntelligence(
  token: string,
  id: string,
): Promise<DocumentIntelligence> {
  const res = await authFetch(`/api/mobile/knowledge/documents/${id}/intelligence`, token)
  return res.json()
}
