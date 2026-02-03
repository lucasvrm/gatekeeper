/**
 * HTTP Client for Gatekeeper API
 * Provides typed methods for all API endpoints
 */

import type {
  GatekeeperClientConfig,
  GatekeeperError,
  PaginatedResponse,
  Project,
  Run,
  RunWithResults,
  Validator,
  Gate,
  ArtifactFolder,
  ArtifactContents,
  CreateRunInput,
  CreateRunResponse,
  RunEvent,
  UploadFilesInput,
  UploadFilesResponse,
  ContinueRunResponse,
  SessionConfigResponse,
  ProfileResponse,
  PromptInstruction,
} from './types.js'

export class GatekeeperClient {
  private baseUrl: string

  constructor(config: GatekeeperClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`) as GatekeeperError
        error.status = response.status
        throw error
      }

      return response.json()
    } catch (error) {
      if (error instanceof TypeError) {
        const connError = new Error('ECONNREFUSED') as GatekeeperError
        connError.code = 'ECONNREFUSED'
        throw connError
      }
      throw error
    }
  }

  // Projects
  async listProjects(opts?: { page?: number; limit?: number }): Promise<PaginatedResponse<Project>> {
    const params = new URLSearchParams()
    if (opts?.page) params.set('page', String(opts.page))
    if (opts?.limit) params.set('limit', String(opts.limit))
    const query = params.toString() ? `?${params}` : ''
    return this.request<PaginatedResponse<Project>>(`/projects${query}`)
  }

  async getProject(id: string): Promise<Project> {
    return this.request<Project>(`/projects/${id}`)
  }

  // Runs
  async listRuns(opts?: { page?: number; limit?: number }): Promise<PaginatedResponse<Run>> {
    const params = new URLSearchParams()
    if (opts?.page) params.set('page', String(opts.page))
    if (opts?.limit) params.set('limit', String(opts.limit))
    const query = params.toString() ? `?${params}` : ''
    return this.request<PaginatedResponse<Run>>(`/runs${query}`)
  }

  async getRun(id: string): Promise<Run> {
    return this.request<Run>(`/runs/${id}`)
  }

  async getRunResults(id: string): Promise<RunWithResults> {
    return this.request<RunWithResults>(`/runs/${id}/results`)
  }

  async abortRun(id: string): Promise<Run> {
    return this.request<Run>(`/runs/${id}/abort`, { method: 'POST' })
  }

  async createRun(input: CreateRunInput): Promise<CreateRunResponse> {
    return this.request<CreateRunResponse>('/validation/runs', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  // Validators & Gates
  async listValidators(): Promise<Validator[]> {
    return this.request<Validator[]>('/validators')
  }

  async listGates(): Promise<Gate[]> {
    return this.request<Gate[]>('/validation/gates')
  }

  // Artifacts
  async listArtifacts(projectId?: string): Promise<ArtifactFolder[]> {
    const query = projectId ? `?projectId=${projectId}` : ''
    return this.request<ArtifactFolder[]>(`/artifacts${query}`)
  }

  async getArtifactContents(outputId: string): Promise<ArtifactContents> {
    return this.request<ArtifactContents>(`/artifacts/${outputId}`)
  }

  // Upload files to a run
  async uploadRunFiles(id: string, files: UploadFilesInput['files']): Promise<UploadFilesResponse> {
    return this.request<UploadFilesResponse>(`/runs/${id}/files`, {
      method: 'PUT',
      body: JSON.stringify({ files }),
    })
  }

  // Continue/rerun a failed gate
  async continueRun(id: string, gate: number = 0): Promise<ContinueRunResponse> {
    return this.request<ContinueRunResponse>(`/runs/${id}/rerun/${gate}`, {
      method: 'POST',
    })
  }

  // Session Config (singleton from API)
  async getSessionConfig(): Promise<SessionConfigResponse> {
    return this.request<SessionConfigResponse>('/mcp/session')
  }

  // Prompt Instructions from API
  async getPrompts(): Promise<PromptInstruction[]> {
    const result = await this.request<{ data: PromptInstruction[] }>('/mcp/prompts')
    return result.data
  }

  // Session Profile from API
  async getProfile(id: string): Promise<ProfileResponse> {
    return this.request<ProfileResponse>(`/mcp/profiles/${id}`)
  }

  // SSE Subscription
  subscribeToRun(id: string, callback: (event: RunEvent) => void): () => void {
    const url = `${this.baseUrl}/runs/${id}/events`
    const eventSource = new EventSource(url)
    let closed = false

    eventSource.onmessage = (event) => {
      if (closed) return
      try {
        const data = JSON.parse(event.data)
        callback({ ...data, runId: id })
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      if (!closed) {
        eventSource.close()
      }
    }

    return () => {
      closed = true
      eventSource.close()
    }
  }
}
