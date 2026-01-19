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
  CustomizationSettings,
} from "./types"

export const API_BASE = "http://localhost:3000/api"
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
      if (!response.ok) throw new Error("Failed to create run")
      return response.json()
    },

    rerunGate: async (id: string, gateNumber: number): Promise<{ message: string; runId: string }> => {
      const response = await fetch(`${API_BASE}/runs/${id}/rerun/${gateNumber}`, { method: "POST" })
      if (!response.ok) throw new Error("Failed to rerun gate")
      return response.json()
    },

    uploadFiles: async (id: string, formData: FormData): Promise<{ message: string; files: Array<{ type: string; path: string; size: number }>; runReset: boolean }> => {
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
    customization: {
      get: async (): Promise<CustomizationSettings> => {
        const response = await fetch(`${CONFIG_BASE}/customization`)
        if (!response.ok) throw new Error("Failed to fetch customization")
        return response.json()
      },
      update: async (data: Partial<CustomizationSettings>): Promise<CustomizationSettings> => {
        const response = await fetch(`${CONFIG_BASE}/customization`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
        if (!response.ok) throw new Error("Failed to update customization")
        return response.json()
      },
    },
  },

  validators: {
    list: async () => {
      const response = await fetch(`${API_BASE}/validators`)
      if (!response.ok) throw new Error("Failed to fetch validators")
      return response.json()
    },
    update: async (name: string, isActive: boolean) => {
      const response = await fetch(`${API_BASE}/validators/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      if (!response.ok) throw new Error("Failed to update validator")
      return response.json()
    },
  },

}
