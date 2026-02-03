import type {
  Run,
  RunWithResults,
  PaginatedResponse,
  RunStatus,
  Gate,
  Validator,
  ConfigItem,
  CreateRunRequest,
  CreateRunResponse,
  Workspace,
  Project,
  WorkspaceConfig,
  ArtifactFolder,
  ArtifactContents,
  GitStatusResponse,
  GitCommitResponse,
  GitPushResponse,
  GitFetchStatusResponse,
  GitDiffResponse,
  MCPSessionConfig,
  MCPStatus,
  PromptInstruction,
  Snippet,
  ContextPack,
  SessionPreset,
  SessionHistory,
  SessionProfile,
  TaskType,
  GitStrategy,
} from "./types"

export const API_BASE = "http://localhost:3001/api"
const CONFIG_BASE = `${API_BASE}/config`

export const api = {
  runs: {
    list: async (page = 1, limit = 20, status?: RunStatus): Promise<PaginatedResponse<Run>> => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (status) params.append("status", status)
      const response = await fetch(`${API_BASE}/runs?${params}`)
      if (!response.ok) throw new Error("Failed to fetch runs")
      return response.json()
    },

    get: async (id: string): Promise<Run> => {
      const response = await fetch(`${API_BASE}/runs/${id}`)
      if (!response.ok) throw new Error("Failed to fetch run")
      return response.json()
    },

    getWithResults: async (id: string): Promise<RunWithResults> => {
      const response = await fetch(`${API_BASE}/runs/${id}/results`)
      if (!response.ok) throw new Error("Failed to fetch run results")
      return response.json()
    },

    abort: async (id: string): Promise<Run> => {
      const response = await fetch(`${API_BASE}/runs/${id}/abort`, { method: "POST" })
      if (!response.ok) throw new Error("Failed to abort run")
      return response.json()
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/runs/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete run")
    },

    create: async (data: CreateRunRequest): Promise<CreateRunResponse> => {
      const response = await fetch(`${API_BASE}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || body?.error || `Failed to create run (${response.status})`)
      }
      return response.json()
    },

    rerunGate: async (id: string, gateNumber: number): Promise<{ message: string; runId: string }> => {
      const response = await fetch(`${API_BASE}/runs/${id}/rerun/${gateNumber}`, { method: "POST" })
      if (!response.ok) throw new Error("Failed to rerun gate")
      return response.json()
    },

    bypassValidator: async (id: string, validatorCode: string): Promise<{ message: string; runId: string }> => {
      const response = await fetch(`${API_BASE}/runs/${id}/validators/${validatorCode}/bypass`, { method: "POST" })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.message || error?.error || `Failed to bypass validator (${response.status})`)
      }
      return response.json()
    },

    uploadFiles: async (
      id: string,
      formData: FormData
    ): Promise<{ message: string; files: Array<{ type: string; path: string; size: number }>; runReset: boolean; runQueued: boolean }> => {
      const response = await fetch(`${API_BASE}/runs/${id}/files`, {
        method: "PUT",
        body: formData,
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload files")
      }
      return response.json()
    },
  },

  gates: {
    list: async (): Promise<Gate[]> => {
      const response = await fetch(`${API_BASE}/gates`)
      if (!response.ok) throw new Error("Failed to fetch gates")
      return response.json()
    },

    getValidators: async (gateNumber: number): Promise<Validator[]> => {
      const response = await fetch(`${API_BASE}/gates/${gateNumber}/validators`)
      if (!response.ok) throw new Error("Failed to fetch validators")
      return response.json()
    },
  },

  config: {
    list: async (): Promise<ConfigItem[]> => {
      const response = await fetch(`${API_BASE}/config`)
      if (!response.ok) throw new Error("Failed to fetch config")
      return response.json()
    },

    update: async (key: string, value: string | number | boolean): Promise<void> => {
      const response = await fetch(`${API_BASE}/config/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      })
      if (!response.ok) throw new Error("Failed to update config")
    },
  },

  configTables: {
    sensitiveFileRules: {
      list: async () => {
        const response = await fetch(`${CONFIG_BASE}/sensitive-file-rules`)
        if (!response.ok) throw new Error("Failed to fetch sensitive file rules")
        return response.json()
      },
      create: async (data: {
        pattern: string
        category: string
        severity: string
        description?: string
        isActive?: boolean
      }) => {
        const response = await fetch(`${CONFIG_BASE}/sensitive-file-rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to create sensitive file rule")
        return response.json()
      },
      update: async (id: string, data: Partial<{
        pattern: string
        category: string
        severity: string
        description: string | null
        isActive: boolean
      }>) => {
        const response = await fetch(`${CONFIG_BASE}/sensitive-file-rules/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to update sensitive file rule")
        return response.json()
      },
      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${CONFIG_BASE}/sensitive-file-rules/${id}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to delete sensitive file rule")
      },
    },
    ambiguousTerms: {
      list: async () => {
        const response = await fetch(`${CONFIG_BASE}/ambiguous-terms`)
        if (!response.ok) throw new Error("Failed to fetch ambiguous terms")
        return response.json()
      },
      create: async (data: {
        term: string
        category: string
        suggestion?: string
        isActive?: boolean
      }) => {
        const response = await fetch(`${CONFIG_BASE}/ambiguous-terms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to create ambiguous term")
        return response.json()
      },
      update: async (id: string, data: Partial<{
        term: string
        category: string
        suggestion: string | null
        isActive: boolean
      }>) => {
        const response = await fetch(`${CONFIG_BASE}/ambiguous-terms/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to update ambiguous term")
        return response.json()
      },
      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${CONFIG_BASE}/ambiguous-terms/${id}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to delete ambiguous term")
      },
    },
    validationConfigs: {
      list: async () => {
        const response = await fetch(`${CONFIG_BASE}/validation-configs`)
        if (!response.ok) throw new Error("Failed to fetch validation configs")
        return response.json()
      },
      create: async (data: {
        key: string
        value: string
        type: string
        category: string
        description?: string
      }) => {
        const response = await fetch(`${CONFIG_BASE}/validation-configs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to create validation config")
        return response.json()
      },
      update: async (id: string, data: Partial<{
        key: string
        value: string
        type: string
        category: string
        description: string | null
      }>) => {
        const response = await fetch(`${CONFIG_BASE}/validation-configs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to update validation config")
        return response.json()
      },
      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${CONFIG_BASE}/validation-configs/${id}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to delete validation config")
      },
    },
    testPaths: {
      list: async () => {
        const response = await fetch(`${CONFIG_BASE}/test-paths`)
        if (!response.ok) throw new Error("Failed to fetch test path conventions")
        return response.json()
      },
      create: async (data: {
        testType: string
        pathPattern: string
        description?: string
        isActive?: boolean
      }) => {
        const response = await fetch(`${CONFIG_BASE}/test-paths`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to create test path convention")
        return response.json()
      },
      update: async (testType: string, data: Partial<{
        pathPattern: string
        description: string | null
        isActive: boolean
      }>) => {
        const response = await fetch(`${CONFIG_BASE}/test-paths/${testType}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to update test path convention")
        return response.json()
      },
      delete: async (testType: string): Promise<void> => {
        const response = await fetch(`${CONFIG_BASE}/test-paths/${testType}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to delete test path convention")
      },
    },
  },

  artifacts: {
    list: async (projectId: string): Promise<ArtifactFolder[]> => {
      const response = await fetch(`${API_BASE}/artifacts?projectId=${encodeURIComponent(projectId)}`)
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "Failed to fetch artifacts")
      }
      return response.json()
    },
    getContents: async (projectId: string, outputId: string): Promise<ArtifactContents> => {
      const response = await fetch(
        `${API_BASE}/artifacts/${encodeURIComponent(outputId)}?projectId=${encodeURIComponent(projectId)}`
      )
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error || "Failed to fetch artifact contents")
      }
      return response.json()
    },
  },

  validators: {
    list: async (): Promise<ConfigItem[]> => {
      const response = await fetch(`${API_BASE}/validators`)
      if (!response.ok) throw new Error("Failed to fetch validators")
      return response.json()
    },
    update: async (name: string, data: { isActive?: boolean; failMode?: "HARD" | "WARNING" | null }) => {
      const response = await fetch(`${API_BASE}/validators/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to update validator")
      return response.json()
    },
    bulkUpdate: async (payload: { keys: string[]; updates: { isActive?: boolean; failMode?: "HARD" | "WARNING" | null } }) => {
      const response = await fetch(`${API_BASE}/validators/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error?.message || "Failed to bulk update validators")
      }
      return response.json()
    },
  },

  workspaces: {
    list: async (page = 1, limit = 20, includeInactive = false): Promise<PaginatedResponse<Workspace>> => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (includeInactive) params.append("includeInactive", "true")
      const response = await fetch(`${API_BASE}/workspaces?${params}`)
      if (!response.ok) throw new Error("Failed to fetch workspaces")
      return response.json()
    },

    get: async (id: string): Promise<Workspace> => {
      const response = await fetch(`${API_BASE}/workspaces/${id}`)
      if (!response.ok) throw new Error("Failed to fetch workspace")
      return response.json()
    },

    create: async (data: {
      name: string
      description?: string
      rootPath: string
      artifactsDir?: string
    }): Promise<Workspace> => {
      const response = await fetch(`${API_BASE}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create workspace")
      }
      return response.json()
    },

    update: async (id: string, data: Partial<{
      name: string
      description: string
      rootPath: string
      artifactsDir: string
      isActive: boolean
    }>): Promise<Workspace> => {
      const response = await fetch(`${API_BASE}/workspaces/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update workspace")
      }
      return response.json()
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/workspaces/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete workspace")
    },

    getConfigs: async (id: string): Promise<WorkspaceConfig[]> => {
      const response = await fetch(`${API_BASE}/workspaces/${id}/configs`)
      if (!response.ok) throw new Error("Failed to fetch workspace configs")
      return response.json()
    },

    updateConfig: async (workspaceId: string, key: string, data: {
      value: string
      type?: string
      category?: string
      description?: string
    }): Promise<WorkspaceConfig> => {
      const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/configs/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to update workspace config")
      return response.json()
    },

    deleteConfig: async (workspaceId: string, key: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/configs/${key}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete workspace config")
    },
  },

  projects: {
    list: async (page = 1, limit = 20, workspaceId?: string, includeInactive = false): Promise<PaginatedResponse<Project>> => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (workspaceId) params.append("workspaceId", workspaceId)
      if (includeInactive) params.append("includeInactive", "true")
      const response = await fetch(`${API_BASE}/projects?${params}`)
      if (!response.ok) throw new Error("Failed to fetch projects")
      return response.json()
    },

    get: async (id: string): Promise<Project> => {
      const response = await fetch(`${API_BASE}/projects/${id}`)
      if (!response.ok) throw new Error("Failed to fetch project")
      return response.json()
    },

    create: async (data: {
      workspaceId: string
      name: string
      description?: string
      baseRef?: string
      targetRef?: string
      backendWorkspace?: string
    }): Promise<Project> => {
      const response = await fetch(`${API_BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create project")
      }
      return response.json()
    },

    update: async (id: string, data: Partial<{
      name: string
      description: string
      baseRef: string
      targetRef: string
      backendWorkspace: string
      isActive: boolean
    }>): Promise<Project> => {
      const response = await fetch(`${API_BASE}/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update project")
      }
      return response.json()
    },

    delete: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete project")
    },
  },

  git: {
    status: async (projectId?: string, projectPath?: string): Promise<GitStatusResponse> => {
      const response = await fetch(`${API_BASE}/git/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectPath }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error?.message || "Failed to check git status")
      }
      return response.json()
    },

    add: async (projectId?: string, projectPath?: string): Promise<{ success: boolean }> => {
      const response = await fetch(`${API_BASE}/git/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectPath }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error?.message || "Failed to stage changes")
      }
      return response.json()
    },

    commit: async (
      projectId: string | undefined,
      message: string,
      runId?: string,
      projectPath?: string
    ): Promise<GitCommitResponse> => {
      const response = await fetch(`${API_BASE}/git/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectPath, message, runId }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        const errorData = { message: error?.error?.message || "Failed to commit", code: error?.error?.code }
        throw errorData
      }
      return response.json()
    },

    diff: async (
      projectId: string | undefined,
      filePath: string,
      baseRef: string,
      targetRef: string,
      projectPath?: string
    ): Promise<GitDiffResponse> => {
      const params = new URLSearchParams({ file: filePath, baseRef, targetRef })
      if (projectId) params.append("projectId", projectId)
      if (projectPath) params.append("projectPath", projectPath)
      const response = await fetch(`${API_BASE}/git/diff?${params}`)
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error?.message || "Failed to fetch diff")
      }
      return response.json()
    },

    push: async (projectId?: string, projectPath?: string): Promise<GitPushResponse> => {
      const response = await fetch(`${API_BASE}/git/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectPath }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        const errorData = { message: error?.error?.message || "Failed to push", code: error?.error?.code }
        throw errorData
      }
      return response.json()
    },

    pull: async (projectId?: string, projectPath?: string): Promise<{ success: boolean }> => {
      const response = await fetch(`${API_BASE}/git/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectPath }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error?.message || "Failed to pull")
      }
      return response.json()
    },

    fetchStatus: async (projectId?: string, projectPath?: string): Promise<GitFetchStatusResponse> => {
      const response = await fetch(`${API_BASE}/git/fetch-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectPath }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error?.message || "Failed to fetch and check status")
      }
      return response.json()
    },

    branch: async (): Promise<{ branch: string; isProtected: boolean }> => {
      const response = await fetch(`${API_BASE}/git/branch`)
      if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(error?.error?.message || "Failed to get branch info")
      }
      return response.json()
    },
  },

  mcp: {
    session: {
      get: async (): Promise<{ config: MCPSessionConfig }> => {
        const response = await fetch(`${API_BASE}/mcp/session`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to fetch session config")
        }
        return response.json()
      },

      update: async (data: { config: MCPSessionConfig }): Promise<{ success: boolean }> => {
        const response = await fetch(`${API_BASE}/mcp/session`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to update session config")
        }
        return response.json()
      },
    },

    status: {
      get: async (): Promise<MCPStatus> => {
        const response = await fetch(`${API_BASE}/mcp/status`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to fetch MCP status")
        }
        return response.json()
      },
    },

    snippets: {
      list: async (): Promise<Snippet[]> => {
        const response = await fetch(`${API_BASE}/mcp/snippets`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to fetch snippets")
        }
        const result = await response.json()
        return result.data
      },

      create: async (data: { name: string; category: string; content: string; tags?: string[] }): Promise<Snippet> => {
        const response = await fetch(`${API_BASE}/mcp/snippets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to create snippet")
        }
        return response.json()
      },

      update: async (id: string, data: { name?: string; category?: string; content?: string; tags?: string[] }): Promise<Snippet> => {
        const response = await fetch(`${API_BASE}/mcp/snippets/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to update snippet")
        }
        return response.json()
      },

      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/mcp/snippets/${id}`, { method: "DELETE" })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to delete snippet")
        }
      },
    },

    contextPacks: {
      list: async (): Promise<ContextPack[]> => {
        const response = await fetch(`${API_BASE}/mcp/context-packs`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to fetch context packs")
        }
        const result = await response.json()
        return result.data
      },

      create: async (data: { name: string; description?: string; files: string[] }): Promise<ContextPack> => {
        const response = await fetch(`${API_BASE}/mcp/context-packs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to create context pack")
        }
        return response.json()
      },

      update: async (id: string, data: { name?: string; description?: string; files?: string[] }): Promise<ContextPack> => {
        const response = await fetch(`${API_BASE}/mcp/context-packs/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to update context pack")
        }
        return response.json()
      },

      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/mcp/context-packs/${id}`, { method: "DELETE" })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to delete context pack")
        }
      },
    },

    presets: {
      list: async (): Promise<SessionPreset[]> => {
        const response = await fetch(`${API_BASE}/mcp/presets`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to fetch presets")
        }
        const result = await response.json()
        return result.data
      },

      create: async (data: { name: string; config: MCPSessionConfig }): Promise<SessionPreset> => {
        const response = await fetch(`${API_BASE}/mcp/presets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to create preset")
        }
        return response.json()
      },

      update: async (id: string, data: { name?: string; config?: MCPSessionConfig }): Promise<SessionPreset> => {
        const response = await fetch(`${API_BASE}/mcp/presets/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to update preset")
        }
        return response.json()
      },

      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/mcp/presets/${id}`, { method: "DELETE" })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to delete preset")
        }
      },
    },

    prompts: {
      list: async (): Promise<PromptInstruction[]> => {
        const response = await fetch(`${API_BASE}/mcp/prompts`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to fetch prompts")
        }
        const result = await response.json()
        return result.data
      },

      create: async (data: { name: string; content: string; isActive?: boolean }): Promise<PromptInstruction> => {
        const response = await fetch(`${API_BASE}/mcp/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to create prompt")
        }
        return response.json()
      },

      update: async (id: string, data: { name?: string; content?: string; isActive?: boolean }): Promise<PromptInstruction> => {
        const response = await fetch(`${API_BASE}/mcp/prompts/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to update prompt")
        }
        return response.json()
      },

      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/mcp/prompts/${id}`, { method: "DELETE" })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to delete prompt")
        }
      },
    },

    history: {
      list: async (): Promise<SessionHistory[]> => {
        const response = await fetch(`${API_BASE}/mcp/history`)
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to fetch history")
        }
        const result = await response.json()
        return result.data
      },

      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/mcp/history/${id}`, { method: "DELETE" })
        if (!response.ok) {
          const error = await response.json().catch(() => null)
          throw new Error(error?.error || "Failed to delete history entry")
        }
      },
    },

    profiles: {
      list: async (): Promise<SessionProfile[]> => {
        const response = await fetch(`${API_BASE}/mcp/profiles`)
        if (!response.ok) throw new Error("Failed to fetch profiles")
        const json = await response.json()
        return json.data
      },

      get: async (id: string): Promise<SessionProfile> => {
        const response = await fetch(`${API_BASE}/mcp/profiles/${id}`)
        if (!response.ok) throw new Error("Failed to fetch profile")
        return response.json()
      },

      create: async (data: {
        name: string
        taskType?: TaskType
        gitStrategy?: GitStrategy
        branch?: string
        docsDir?: string
        promptIds?: string[]
      }): Promise<SessionProfile> => {
        const response = await fetch(`${API_BASE}/mcp/profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => null)
          throw new Error(err?.error || "Failed to create profile")
        }
        return response.json()
      },

      update: async (
        id: string,
        data: Partial<{
          name: string
          taskType: TaskType
          gitStrategy: GitStrategy
          branch: string | null
          docsDir: string | null
        }>
      ): Promise<SessionProfile> => {
        const response = await fetch(`${API_BASE}/mcp/profiles/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => null)
          throw new Error(err?.error || "Failed to update profile")
        }
        return response.json()
      },

      delete: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE}/mcp/profiles/${id}`, {
          method: "DELETE",
        })
        if (!response.ok) throw new Error("Failed to delete profile")
      },

      setPrompts: async (id: string, promptIds: string[]): Promise<SessionProfile> => {
        const response = await fetch(`${API_BASE}/mcp/profiles/${id}/prompts`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptIds }),
        })
        if (!response.ok) throw new Error("Failed to update profile prompts")
        return response.json()
      },
    },
  },

}
