/**
 * Smoke Test — Agent Runner Bridge (full pipeline)
 *
 * Usage:
 *   1. Add ANTHROPIC_API_KEY to .env
 *   2. Start the server: npm run dev
 *   3. Run: npx tsx scripts/smoke-test-agent.ts [mode] [args...]
 *
 * Modes:
 *   plan     [task]         — POST /bridge/plan → step 1
 *   spec     <outputId>     — POST /bridge/spec → step 2
 *   execute  <outputId>     — POST /bridge/execute → step 4
 *   fix      <outputId>     — POST /bridge/fix → step 3
 *   pipeline [task]         — Run plan → spec → execute sequentially
 *   phase                   — POST /run/phase → in-memory only (original)
 *   check    <outputId>     — GET /bridge/artifacts → list saved artifacts
 *   read     <outputId> <f> — GET artifact content
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3001'
const MODE = process.argv[2] || 'plan'
const ARG1 = process.argv[3]
const ARG2 = process.argv[4]

const DEFAULT_TASK =
  'Analyze the project structure. List the main directories and describe what each one contains. Then save a plan.json artifact with your findings.'

// ─── Colors ──────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
}

function log(icon: string, color: string, label: string, detail?: string) {
  const time = new Date().toLocaleTimeString()
  const msg = detail
    ? `${c.dim}${time}${c.reset}  ${icon}  ${color}${label}${c.reset}  ${detail}`
    : `${c.dim}${time}${c.reset}  ${icon}  ${color}${label}${c.reset}`
  console.log(msg)
}

// ─── Check Status ──────────────────────────────────────────────────────

async function checkStatus(): Promise<boolean> {
  log('🔍', c.cyan, 'Checking server status...')
  try {
    const res = await fetch(`${BASE_URL}/api/agent/status`)
    const data = (await res.json()) as Record<string, unknown>
    const providers = data.providers as Record<string, unknown>
    log('📡', c.green, 'Server running', `${BASE_URL}`)
    log('🔑', c.yellow, 'Providers', JSON.stringify(providers))
    if (!providers.anthropic && !providers.openai && !providers.mistral) {
      log('❌', c.red, 'No API keys configured!')
      return false
    }
    return true
  } catch {
    log('❌', c.red, 'Server not running', `Start with: npm run dev`)
    return false
  }
}

// ─── Plan Mode: POST /bridge/plan ──────────────────────────────────

async function runPlan(task?: string): Promise<string | null> {
  log('🚀', c.magenta, 'Bridge Plan — Step 1 with artifact persistence')

  const body = {
    taskDescription: task || DEFAULT_TASK,
    projectPath: process.cwd(),
  }

  log('📁', c.dim, 'Project path', body.projectPath)
  log('📝', c.dim, 'Task', body.taskDescription.slice(0, 100) + (body.taskDescription.length > 100 ? '...' : ''))

  const res = await fetch(`${BASE_URL}/api/agent/bridge/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    log('❌', c.red, `HTTP ${res.status}`, await res.text())
    return null
  }

  const data = (await res.json()) as Record<string, unknown>
  const runId = data.runId as string
  const eventsUrl = data.eventsUrl as string

  log('✅', c.green, 'Run started', `runId: ${runId}`)

  const outputId = await listenSSE(eventsUrl)
  return outputId || null
}

// ─── Spec Mode: POST /bridge/spec ─────────────────────────────────

async function runSpec(outputId: string): Promise<string | null> {
  log('🚀', c.magenta, 'Bridge Spec — Step 2 (generate test)')
  log('📂', c.dim, 'OutputId', outputId)

  const body = {
    outputId,
    projectPath: process.cwd(),
  }

  const res = await fetch(`${BASE_URL}/api/agent/bridge/spec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    log('❌', c.red, `HTTP ${res.status}`, await res.text())
    return null
  }

  const data = (await res.json()) as Record<string, unknown>
  const runId = data.runId as string
  const eventsUrl = data.eventsUrl as string

  log('✅', c.green, 'Run started', `runId: ${runId}`)

  await listenSSE(eventsUrl)
  return outputId
}

// ─── Execute Mode: POST /bridge/execute ────────────────────────────

async function runExecute(outputId: string): Promise<string | null> {
  log('🚀', c.magenta, 'Bridge Execute — Step 4 (implement code)')
  log('📂', c.dim, 'OutputId', outputId)

  const body = {
    outputId,
    projectPath: process.cwd(),
  }

  const res = await fetch(`${BASE_URL}/api/agent/bridge/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    log('❌', c.red, `HTTP ${res.status}`, await res.text())
    return null
  }

  const data = (await res.json()) as Record<string, unknown>
  const runId = data.runId as string
  const eventsUrl = data.eventsUrl as string

  log('✅', c.green, 'Run started', `runId: ${runId}`)

  await listenSSE(eventsUrl)
  return outputId
}

// ─── Fix Mode: POST /bridge/fix ────────────────────────────────────

async function runFix(outputId: string): Promise<string | null> {
  log('🚀', c.magenta, 'Bridge Fix — Step 3 (correct artifacts)')
  log('📂', c.dim, 'OutputId', outputId)

  const body = {
    outputId,
    projectPath: process.cwd(),
    target: 'plan',
    failedValidators: ['example_validator'],
  }

  const res = await fetch(`${BASE_URL}/api/agent/bridge/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    log('❌', c.red, `HTTP ${res.status}`, await res.text())
    return null
  }

  const data = (await res.json()) as Record<string, unknown>
  const runId = data.runId as string
  const eventsUrl = data.eventsUrl as string

  log('✅', c.green, 'Run started', `runId: ${runId}`)

  await listenSSE(eventsUrl)
  return outputId
}

// ─── Pipeline Mode: plan → spec → execute ──────────────────────────

async function runPipeline(task?: string): Promise<void> {
  log('🔗', c.bold + c.magenta, 'FULL PIPELINE — plan → spec → execute')
  console.log(`${c.dim}${'═'.repeat(70)}${c.reset}\n`)

  // Step 1: Plan
  log('📋', c.bold + c.cyan, 'STEP 1 / 3: Generate Plan')
  const outputId = await runPlan(task)
  if (!outputId) {
    log('❌', c.red, 'Pipeline aborted — plan failed')
    return
  }

  console.log(`\n${c.dim}${'═'.repeat(70)}${c.reset}\n`)

  // Step 2: Spec
  log('🧪', c.bold + c.cyan, 'STEP 2 / 3: Generate Spec Test')
  const specResult = await runSpec(outputId)
  if (!specResult) {
    log('❌', c.red, 'Pipeline aborted — spec failed')
    return
  }

  console.log(`\n${c.dim}${'═'.repeat(70)}${c.reset}\n`)

  // Step 4: Execute
  log('⚡', c.bold + c.cyan, 'STEP 3 / 3: Execute Implementation')
  await runExecute(outputId)

  console.log(`\n${c.dim}${'═'.repeat(70)}${c.reset}`)
  log('🏆', c.bold + c.green, 'PIPELINE COMPLETE', `outputId: ${outputId}`)
  log('💡', c.dim, 'Check artifacts',
    `npx tsx scripts/smoke-test-agent.ts check ${outputId}`)
}

// ─── Phase Mode: POST /run/phase (original) ───────────────────────────

async function runPhase(): Promise<string | null> {
  log('🚀', c.magenta, 'Phase Mode — Direct agent (no persistence)')

  const body = {
    step: 1,
    taskDescription: ARG1 || DEFAULT_TASK,
    projectPath: process.cwd(),
  }

  const res = await fetch(`${BASE_URL}/api/agent/run/phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    log('❌', c.red, `HTTP ${res.status}`, await res.text())
    return null
  }

  const data = (await res.json()) as Record<string, unknown>
  const runId = data.runId as string
  const eventsUrl = data.eventsUrl as string
  const phase = data.phase as Record<string, string>

  log('✅', c.green, 'Run started', `runId: ${runId}`)
  log('🤖', c.cyan, 'Provider', `${phase.provider} / ${phase.model}`)

  await listenSSE(eventsUrl)
  return runId
}

// ─── Check Mode: List artifacts on disk ────────────────────────────────

async function checkArtifacts(outputId: string): Promise<void> {
  const projectPath = encodeURIComponent(process.cwd())
  const res = await fetch(
    `${BASE_URL}/api/agent/bridge/artifacts/${outputId}?projectPath=${projectPath}`,
  )

  if (!res.ok) {
    log('❌', c.red, `HTTP ${res.status}`, await res.text())
    return
  }

  const data = (await res.json()) as Record<string, unknown>
  log('📂', c.green, 'Artifacts found', (data.path as string))

  const artifacts = data.artifacts as Array<{ filename: string; size: number; modified: string }>
  for (const a of artifacts) {
    log('📄', c.cyan, a.filename, `${a.size} bytes  ${c.dim}${a.modified}${c.reset}`)
  }
}

// ─── Read Mode: Read single artifact ───────────────────────────────────

async function readArtifact(outputId: string, filename: string): Promise<void> {
  const projectPath = encodeURIComponent(process.cwd())
  const res = await fetch(
    `${BASE_URL}/api/agent/bridge/artifacts/${outputId}/${filename}?projectPath=${projectPath}`,
  )

  if (!res.ok) {
    log('❌', c.red, `HTTP ${res.status}`, await res.text())
    return
  }

  const data = (await res.json()) as Record<string, unknown>
  log('📄', c.green, `${outputId}/${filename}`, `${data.size} bytes`)
  console.log(`${c.dim}${'─'.repeat(70)}${c.reset}`)
  console.log(data.content)
  console.log(`${c.dim}${'─'.repeat(70)}${c.reset}`)
}

// ─── SSE Listener ──────────────────────────────────────────────────────

async function listenSSE(eventsUrl: string): Promise<string | undefined> {
  log('📡', c.blue, 'Connecting to SSE...')
  console.log(`${c.dim}${'─'.repeat(70)}${c.reset}`)

  const res = await fetch(`${BASE_URL}${eventsUrl}`)
  if (!res.ok || !res.body) {
    log('❌', c.red, 'SSE failed', `HTTP ${res.status}`)
    return undefined
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let outputId: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr) continue

      try {
        const event = JSON.parse(jsonStr) as Record<string, unknown>

        // Capture outputId from bridge events
        if (event.outputId) outputId = event.outputId as string

        handleEvent(event)

        if (
          event.type === 'agent:stream_end' ||
          event.type === 'agent:error' ||
          event.type === 'agent:phase_complete' ||
          event.type === 'agent:bridge_plan_done' ||
          event.type === 'agent:bridge_spec_done' ||
          event.type === 'agent:bridge_fix_done' ||
          event.type === 'agent:bridge_execute_done'
        ) {
          console.log(`${c.dim}${'─'.repeat(70)}${c.reset}`)

          if (outputId) {
            log('📂', c.bold + c.green, 'OutputId', outputId)
            log('💡', c.dim, 'Check artifacts',
              `npx tsx scripts/smoke-test-agent.ts check ${outputId}`)
          }

          return outputId
        }
      } catch {
        // skip
      }
    }
  }

  return outputId
}

function handleEvent(event: Record<string, unknown>) {
  switch (event.type) {
    case 'agent:start':
      log('▶️ ', c.green, 'STARTED', `${event.provider}/${event.model} (step ${event.step})`)
      break
    case 'agent:iteration': {
      const tokens = event.tokensUsed as Record<string, number>
      let detail = `tokens: ${tokens.inputTokens}in/${tokens.outputTokens}out`
      if (tokens.cacheReadTokens) {
        const pct = Math.round((tokens.cacheReadTokens / tokens.inputTokens) * 100)
        detail += `  ${c.green}cache: ${tokens.cacheReadTokens} read (${pct}%)${c.reset}`
      }
      if (tokens.cacheCreationTokens) {
        detail += `  ${c.yellow}wrote: ${tokens.cacheCreationTokens}${c.reset}`
      }
      log('🔄', c.dim, `Iteration ${event.iteration}`, detail)
      break
    }
    case 'agent:text': {
      const text = String(event.text || '').slice(0, 200)
      log('💬', c.cyan, 'TEXT', text + (String(event.text || '').length > 200 ? '...' : ''))
      break
    }
    case 'agent:tool_call':
      log('🔧', c.yellow, `TOOL → ${event.tool}`, JSON.stringify(event.input).slice(0, 120))
      break
    case 'agent:tool_result':
      log(event.isError ? '❌' : '✅', event.isError ? c.red : c.green,
        `TOOL ← ${event.tool}`, `${event.durationMs}ms`)
      break
    case 'agent:complete': {
      log('🏁', c.bold + c.green, 'AGENT COMPLETE')
      const result = event.result as Record<string, unknown>
      if (result) {
        log('📊', c.dim, 'Stats', `${result.iterations} iters, ${result.provider}/${result.model}`)
        const tokens = result.tokensUsed as Record<string, number>
        if (tokens) {
          let detail = `${tokens.inputTokens} in / ${tokens.outputTokens} out`
          if (tokens.cacheReadTokens) {
            const savings = Math.round(tokens.cacheReadTokens * 0.9 * 3 / 1_000_000 * 100) / 100
            detail += `  ${c.green}| cache saved ~$${savings}${c.reset}`
          }
          log('🪙', c.dim, 'Tokens', detail)
        }
      }
      break
    }
    case 'agent:bridge_start':
      log('🌉', c.magenta, 'BRIDGE START', `step ${event.step}, outputId: ${event.outputId}`)
      break
    case 'agent:bridge_plan_done':
      log('🌉', c.bold + c.green, 'BRIDGE PLAN DONE',
        `outputId: ${event.outputId}, artifacts: ${JSON.stringify(event.artifacts)}`)
      log('🪙', c.dim, 'Tokens', JSON.stringify(event.tokensUsed))
      break
    case 'agent:bridge_spec_done':
      log('🌉', c.bold + c.green, 'BRIDGE SPEC DONE',
        `outputId: ${event.outputId}, artifacts: ${JSON.stringify(event.artifacts)}`)
      log('🪙', c.dim, 'Tokens', JSON.stringify(event.tokensUsed))
      break
    case 'agent:bridge_fix_done':
      log('🌉', c.bold + c.green, 'BRIDGE FIX DONE',
        `outputId: ${event.outputId}, corrections: ${JSON.stringify(event.corrections)}`)
      break
    case 'agent:bridge_execute_done':
      log('🌉', c.bold + c.green, 'BRIDGE EXECUTE DONE',
        `outputId: ${event.outputId}, artifacts: ${JSON.stringify(event.artifacts)}`)
      log('🪙', c.dim, 'Tokens', JSON.stringify(event.tokensUsed))
      break
    case 'agent:bridge_complete':
      log('🌉', c.green, 'BRIDGE STEP COMPLETE',
        `step ${event.step}, artifacts: ${JSON.stringify(event.artifactNames)}`)
      break
    case 'agent:fallback':
      log('🔀', c.yellow, 'FALLBACK', `${event.from} → ${event.to}: ${event.reason}`)
      break
    case 'agent:error':
      log('💥', c.red, 'ERROR', String(event.error))
      break
    case 'agent:stream_end':
      break
    default:
      log('❓', c.dim, String(event.type), JSON.stringify(event).slice(0, 100))
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

function showUsage() {
  console.log(`
${c.bold}Usage:${c.reset} npx tsx scripts/smoke-test-agent.ts <mode> [args]

${c.bold}Modes:${c.reset}
  ${c.cyan}plan${c.reset}     [task]              Generate plan artifacts (step 1)
  ${c.cyan}spec${c.reset}     <outputId>          Generate test spec (step 2)
  ${c.cyan}execute${c.reset}  <outputId>          Implement code (step 4)
  ${c.cyan}fix${c.reset}      <outputId>          Fix artifacts after rejection (step 3)
  ${c.cyan}pipeline${c.reset} [task]              Run full plan → spec → execute
  ${c.cyan}phase${c.reset}    [task]              Direct agent (no disk persistence)
  ${c.cyan}check${c.reset}    <outputId>          List artifacts on disk
  ${c.cyan}read${c.reset}     <outputId> <file>   Read an artifact file

${c.bold}Examples:${c.reset}
  npx tsx scripts/smoke-test-agent.ts plan
  npx tsx scripts/smoke-test-agent.ts spec 2026_02_03_188_analyze-the-project
  npx tsx scripts/smoke-test-agent.ts check 2026_02_03_188_analyze-the-project
  npx tsx scripts/smoke-test-agent.ts read 2026_02_03_188_analyze-the-project plan.json
  npx tsx scripts/smoke-test-agent.ts pipeline "Create a health check endpoint"
`)
}

async function main() {
  console.log(`\n${c.bold}🧪 Agent Runner — Smoke Test${c.reset}  ${c.dim}(${MODE})${c.reset}`)
  console.log(`${c.dim}${'─'.repeat(70)}${c.reset}\n`)

  // Modes that don't need server status check
  if (MODE === 'check') {
    if (!ARG1) { log('❌', c.red, 'Missing outputId'); showUsage(); process.exit(1) }
    await checkArtifacts(ARG1)
    process.exit(0)
  }

  if (MODE === 'read') {
    if (!ARG1 || !ARG2) { log('❌', c.red, 'Missing outputId or filename'); showUsage(); process.exit(1) }
    await readArtifact(ARG1, ARG2)
    process.exit(0)
  }

  if (MODE === 'help' || MODE === '--help' || MODE === '-h') {
    showUsage()
    process.exit(0)
  }

  // Server-dependent modes
  const ok = await checkStatus()
  if (!ok) process.exit(1)
  console.log()

  switch (MODE) {
    case 'plan':
      await runPlan(ARG1)
      break
    case 'spec':
      if (!ARG1) { log('❌', c.red, 'Missing outputId', 'Usage: spec <outputId>'); process.exit(1) }
      await runSpec(ARG1)
      break
    case 'execute':
      if (!ARG1) { log('❌', c.red, 'Missing outputId', 'Usage: execute <outputId>'); process.exit(1) }
      await runExecute(ARG1)
      break
    case 'fix':
      if (!ARG1) { log('❌', c.red, 'Missing outputId', 'Usage: fix <outputId>'); process.exit(1) }
      await runFix(ARG1)
      break
    case 'pipeline':
      await runPipeline(ARG1)
      break
    case 'phase':
      await runPhase()
      break
    default:
      log('❌', c.red, 'Unknown mode', MODE)
      showUsage()
      process.exit(1)
  }

  console.log(`\n${c.bold}${c.green}✅ Smoke test complete!${c.reset}\n`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
