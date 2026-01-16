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
} from "./types"

export const API_BASE = "http://localhost:3000/api"

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
}
