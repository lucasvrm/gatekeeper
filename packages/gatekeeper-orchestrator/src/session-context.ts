/**
 * Gatekeeper Orchestrator — Session Context
 *
 * Fetches session configuration and prompt instructions from the Gatekeeper API.
 * Reuses the same logic as the MCP server's buildSessionContext(),
 * but without depending on the MCP SDK types.
 */

export interface SessionContext {
  gitStrategy: string
  customInstructions: string
}

/**
 * Fetch session context from the Gatekeeper API.
 * Returns git strategy + custom prompt instructions.
 * Fails gracefully if the API is offline.
 */
export async function fetchSessionContext(
  gatekeeperApiUrl: string,
  profileId?: string
): Promise<SessionContext> {
  let gitStrategy = ''
  let customInstructions = ''

  try {
    // Fetch session config
    const sessionRes = await fetch(`${gatekeeperApiUrl}/mcp/session`)
    if (!sessionRes.ok) throw new Error(`HTTP ${sessionRes.status}`)

    const session = await sessionRes.json()
    const config = session.config

    // Git strategy
    if (config?.gitStrategy === 'new-branch') {
      const branch = config.branch || 'feature/task'
      gitStrategy = `\n## Git Strategy\nCrie uma nova branch antes de implementar: ${branch}\n`
    } else if (config?.gitStrategy === 'existing-branch' && config.branch) {
      gitStrategy = `\n## Git Strategy\nUse a branch existente: ${config.branch}\n`
    } else {
      gitStrategy = `\n## Git Strategy\nCommit direto na branch atual.\n`
    }

    // Resolve prompt instructions
    const activeProfileId = profileId || config?.activeProfileId
    let activePrompts: Array<{ name: string; content: string; isActive: boolean }> = []

    if (activeProfileId) {
      try {
        const profileRes = await fetch(`${gatekeeperApiUrl}/mcp/profiles/${activeProfileId}`)
        if (profileRes.ok) {
          const profile = await profileRes.json()
          activePrompts = profile.prompts?.filter((p: { isActive: boolean }) => p.isActive) || []
        }
      } catch {
        // Profile not found — fallback below
      }
    }

    if (activePrompts.length === 0) {
      try {
        const promptsRes = await fetch(`${gatekeeperApiUrl}/mcp/prompts`)
        if (promptsRes.ok) {
          const promptsData = await promptsRes.json()
          activePrompts = (promptsData.data || []).filter((p: { isActive: boolean }) => p.isActive)
        }
      } catch {
        // Ignore
      }
    }

    if (activePrompts.length > 0) {
      customInstructions += `\n## Instruções Adicionais\n`
      for (const p of activePrompts) {
        customInstructions += `### ${p.name}\n${p.content}\n\n`
      }
    }
  } catch {
    customInstructions += '\n[Session config unavailable — API offline]\n'
  }

  return { gitStrategy, customInstructions }
}
