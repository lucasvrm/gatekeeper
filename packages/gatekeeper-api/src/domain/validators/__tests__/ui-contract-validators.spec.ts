import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * UI Contract Validators — Contract Spec
 * =======================================
 *
 * Contract: ui-contract-validators v1.0
 * Mode: STRICT
 * Criticality: HIGH
 *
 * Objetivo: Testar dois novos validadores no Gate 2 do Gatekeeper:
 *   1. UIComponentRegistry — verifica se componentes JSX existem no registry
 *   2. UIPropsCompliance — verifica se props estão corretas (enum, required)
 *
 * Inclui também tipos em gates.types.ts, carregamento de contratos no Orchestrator,
 * e registro no gates.config.ts.
 *
 * REGRA: Se estes testes falharem, a LLM executora errou na implementação.
 */

// ─── IMPORTS REAIS DOS VALIDADORES (devem existir após implementação) ────────

import { UIComponentRegistryValidator } from '../gate2/UIComponentRegistry.js'
import { UIPropsComplianceValidator } from '../gate2/UIPropsCompliance.js'
import type {
  ValidationContext,
  ValidatorOutput,
  ValidatorDefinition,
  ManifestInput,
  GitService,
  LogService,
} from '../../../types/index.js'
import { GATES_CONFIG } from '../../../config/gates.config.js'

// ─── CAMINHOS DE REFERÊNCIA ──────────────────────────────────────────────────

const TYPES_FILE = path.resolve(__dirname, '..', '..', '..', 'types', 'gates.types.ts')
const GATES_CONFIG_FILE = path.resolve(__dirname, '..', '..', '..', 'config', 'gates.config.ts')
const ORCHESTRATOR_FILE = path.resolve(__dirname, '..', '..', '..', 'services', 'ValidationOrchestrator.ts')
const UI_REGISTRY_VALIDATOR_FILE = path.resolve(__dirname, '..', 'gate2', 'UIComponentRegistry.ts')
const UI_PROPS_VALIDATOR_FILE = path.resolve(__dirname, '..', 'gate2', 'UIPropsCompliance.ts')

// ─── MINI REGISTRY PARA TESTES ──────────────────────────────────────────────

const BUTTON_CONTRACT = {
  name: 'Button',
  category: 'primitive',
  description: 'Botão de ação',
  source: 'shadcn-ui',
  props: {
    variant: {
      type: 'enum',
      required: false,
      description: 'Variante visual',
      default: 'default',
      enumValues: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      type: 'enum',
      required: false,
      description: 'Tamanho',
      default: 'default',
      enumValues: ['default', 'sm', 'lg', 'icon'],
    },
    disabled: { type: 'boolean', required: false, description: 'Desabilitado', default: false },
    asChild: { type: 'boolean', required: false, description: 'Render as child' },
    type: {
      type: 'enum',
      required: false,
      description: 'Tipo HTML',
      default: 'button',
      enumValues: ['button', 'submit', 'reset'],
    },
    className: { type: 'string', required: false, description: 'Classes CSS' },
  },
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

const CARD_CONTRACT = {
  name: 'Card',
  category: 'layout',
  description: 'Container card',
  source: 'shadcn-ui',
  props: {
    className: { type: 'string', required: false, description: 'CSS classes' },
  },
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

const DIALOG_CONTRACT = {
  name: 'Dialog',
  category: 'feedback',
  description: 'Modal dialog',
  source: 'shadcn-ui',
  props: {
    open: { type: 'boolean', required: false, description: 'Estado' },
    onOpenChange: { type: 'function', required: false, description: 'Callback' },
  },
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

const ALERT_DIALOG_CONTRACT = {
  name: 'AlertDialog',
  category: 'feedback',
  description: 'Alert dialog',
  source: 'shadcn-ui',
  props: {},
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

const ACCORDION_CONTRACT = {
  name: 'Accordion',
  category: 'disclosure',
  description: 'Accordion collapsible',
  source: 'shadcn-ui',
  props: {
    type: {
      type: 'enum',
      required: true,
      description: 'Tipo de seleção',
      enumValues: ['single', 'multiple'],
    },
    collapsible: { type: 'boolean', required: false, description: 'Permite colapsar', default: false },
    className: { type: 'string', required: false, description: 'CSS classes' },
  },
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

const DATA_TABLE_CONTRACT = {
  name: 'DataTable',
  category: 'data-display',
  description: 'Data table',
  source: 'shadcn-ui',
  props: {
    columns: { type: 'array', required: true, description: 'Colunas' },
    data: { type: 'array', required: true, description: 'Dados' },
    sorting: { type: 'boolean', required: false, description: 'Sorting', default: true },
  },
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

const TABLE_CONTRACT = {
  name: 'Table',
  category: 'data-display',
  description: 'Simple table',
  source: 'shadcn-ui',
  props: {
    className: { type: 'string', required: false, description: 'CSS classes' },
  },
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

const SELECT_CONTRACT = {
  name: 'Select',
  category: 'input',
  description: 'Select dropdown',
  source: 'shadcn-ui',
  props: {
    value: { type: 'string', required: false, description: 'Valor' },
    onValueChange: { type: 'function', required: false, description: 'Callback' },
  },
  slots: [],
  variants: [],
  examples: [],
  tags: [],
}

function buildMiniRegistry() {
  return {
    $orqui: { version: '1.0.0' },
    components: {
      Button: BUTTON_CONTRACT,
      Card: CARD_CONTRACT,
      Dialog: DIALOG_CONTRACT,
      AlertDialog: ALERT_DIALOG_CONTRACT,
      Accordion: ACCORDION_CONTRACT,
      DataTable: DATA_TABLE_CONTRACT,
      Table: TABLE_CONTRACT,
      Select: SELECT_CONTRACT,
    },
  }
}

// ─── MOCK FACTORY ────────────────────────────────────────────────────────────

function createMockLogService(): LogService {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function createMockGitService(fileContents: Record<string, string> = {}): GitService {
  return {
    diff: vi.fn().mockResolvedValue(''),
    readFile: vi.fn().mockImplementation(async (filePath: string) => {
      if (fileContents[filePath] !== undefined) return fileContents[filePath]
      throw new Error(`File not found: ${filePath}`)
    }),
    checkout: vi.fn().mockResolvedValue(undefined),
    stash: vi.fn().mockResolvedValue(undefined),
    stashPop: vi.fn().mockResolvedValue(undefined),
    createWorktree: vi.fn().mockResolvedValue(undefined),
    removeWorktree: vi.fn().mockResolvedValue(undefined),
    getDiffFiles: vi.fn().mockResolvedValue([]),
    getDiffFilesWithWorkingTree: vi.fn().mockResolvedValue([]),
    getCurrentRef: vi.fn().mockResolvedValue('HEAD'),
  }
}

interface BuildCtxOpts {
  uiContracts?: unknown
  manifest?: ManifestInput | null
  fileContents?: Record<string, string>
  configEntries?: Record<string, string>
}

function buildCtx(opts: BuildCtxOpts = {}): ValidationContext {
  const configMap = new Map<string, string>()
  if (opts.configEntries) {
    for (const [k, v] of Object.entries(opts.configEntries)) {
      configMap.set(k, v)
    }
  }

  return {
    runId: 'test-run-001',
    projectPath: '/fake/project',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    taskPrompt: 'test task',
    manifest: opts.manifest !== undefined ? opts.manifest : null,
    contract: null,
    testFilePath: null,
    dangerMode: false,
    services: {
      git: createMockGitService(opts.fileContents ?? {}),
      ast: { parseFile: vi.fn(), getImports: vi.fn(), getTestBlocksWithComments: vi.fn() },
      testRunner: { runSingleTest: vi.fn(), runAllTests: vi.fn() },
      compiler: { compile: vi.fn() },
      lint: { lint: vi.fn() },
      build: { build: vi.fn() },
      tokenCounter: { count: vi.fn().mockReturnValue(0) },
      log: createMockLogService(),
    },
    config: configMap,
    sensitivePatterns: [],
    ambiguousTerms: [],
    bypassedValidators: new Set(),
    uiContracts: opts.uiContracts as never,
  } as ValidationContext
}

function makeManifest(files: Array<{ path: string; action: 'CREATE' | 'MODIFY' | 'DELETE' }>): ManifestInput {
  return {
    testFile: 'src/__tests__/test.spec.ts',
    files: files.map((f) => ({ path: f.path, action: f.action, reason: 'test' })),
  }
}

function readFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 1: TIPOS E CONTEXTO (CL-CTX-001, CL-CTX-002)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-CTX-001 — ValidationContext inclui campo uiContracts', () => {
  let typesContent: string

  beforeEach(() => {
    typesContent = readFileContent(TYPES_FILE)
  })

  // @clause CL-CTX-001
  it('succeeds when ValidationContext has uiContracts field typed as UIContracts or null', () => {
    expect(typesContent).toMatch(/uiContracts\s*:\s*UIContracts\s*\|\s*null/)
  })

  // @clause CL-CTX-001
  it('succeeds when UIContracts type is defined and exported', () => {
    expect(typesContent).toMatch(/export\s+(interface|type)\s+UIContracts/)
  })

  // @clause CL-CTX-001
  it('succeeds when UIContracts contains registry, layout, and lock fields', () => {
    const uiContractsBlock = typesContent.match(
      /(?:export\s+)?(?:interface|type)\s+UIContracts\s*(?:=\s*)?{([^}]+)}/s,
    )
    expect(uiContractsBlock).not.toBeNull()
    const body = uiContractsBlock![1]
    expect(body).toMatch(/registry\s*:\s*UIRegistryContract\s*\|\s*null/)
    expect(body).toMatch(/layout\s*:\s*LayoutContract\s*\|\s*null/)
    expect(body).toMatch(/lock\s*:\s*OrquiLock\s*\|\s*null/)
  })

  // @clause CL-CTX-001
  it('succeeds when UIRegistryContract type is defined and exported with components field', () => {
    expect(typesContent).toMatch(/export\s+(interface|type)\s+UIRegistryContract/)
    expect(typesContent).toMatch(/components\s*:\s*Record<string,\s*UIRegistryComponent>/)
  })

  // @clause CL-CTX-001
  it('succeeds when UIRegistryComponent type has required fields', () => {
    expect(typesContent).toMatch(/export\s+(interface|type)\s+UIRegistryComponent/)
    const compBlock = typesContent.match(
      /(?:export\s+)?(?:interface|type)\s+UIRegistryComponent\s*(?:=\s*)?{([^}]+)}/s,
    )
    expect(compBlock).not.toBeNull()
    const body = compBlock![1]
    expect(body).toContain('name')
    expect(body).toContain('category')
    expect(body).toContain('props')
  })

  // @clause CL-CTX-001
  it('succeeds when UIComponentProp type is defined with type, required, description fields', () => {
    expect(typesContent).toMatch(/export\s+(interface|type)\s+UIComponentProp/)
    const propBlock = typesContent.match(
      /(?:export\s+)?(?:interface|type)\s+UIComponentProp\s*(?:=\s*)?{([^}]+)}/s,
    )
    expect(propBlock).not.toBeNull()
    const body = propBlock![1]
    expect(body).toContain('type')
    expect(body).toContain('required')
    expect(body).toContain('description')
  })

  // @clause CL-CTX-001
  it('succeeds when LayoutContract and OrquiLock types are exported', () => {
    expect(typesContent).toMatch(/export\s+(interface|type)\s+LayoutContract/)
    expect(typesContent).toMatch(/export\s+(interface|type)\s+OrquiLock/)
  })
})

describe('CL-CTX-002 — ValidatorCode inclui novos códigos UI', () => {
  let typesContent: string

  beforeEach(() => {
    typesContent = readFileContent(TYPES_FILE)
  })

  // @clause CL-CTX-002
  it('succeeds when ValidatorCode union includes UI_COMPONENT_REGISTRY', () => {
    expect(typesContent).toMatch(/['"]UI_COMPONENT_REGISTRY['"]/)
  })

  // @clause CL-CTX-002
  it('succeeds when ValidatorCode union includes UI_PROPS_COMPLIANCE', () => {
    expect(typesContent).toMatch(/['"]UI_PROPS_COMPLIANCE['"]/)
  })

  // @clause CL-CTX-002
  it('succeeds when both codes are part of the ValidatorCode type block', () => {
    const validatorCodeBlock = typesContent.match(
      /type\s+ValidatorCode\s*=\s*([\s\S]*?)(?:\n\n|\nexport)/,
    )
    expect(validatorCodeBlock).not.toBeNull()
    const body = validatorCodeBlock![1]
    expect(body).toContain('UI_COMPONENT_REGISTRY')
    expect(body).toContain('UI_PROPS_COMPLIANCE')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 2: ORCHESTRATOR — CARREGAMENTO DE CONTRATOS UI (CL-CTX-003 a CL-CTX-006)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-CTX-003 — Orchestrator carrega contratos UI quando orqui.lock.json existe', () => {
  let orchContent: string

  beforeEach(() => {
    orchContent = readFileContent(ORCHESTRATOR_FILE)
  })

  // @clause CL-CTX-003
  it('succeeds when buildContext reads orqui.lock.json', () => {
    expect(orchContent).toContain('orqui.lock.json')
  })

  // @clause CL-CTX-003
  it('succeeds when buildContext reads ui-registry-contract.json', () => {
    expect(orchContent).toContain('ui-registry-contract.json')
  })

  // @clause CL-CTX-003
  it('succeeds when buildContext includes uiContracts in the returned context', () => {
    // The context object returned by buildContext must include uiContracts
    const returnBlock = orchContent.match(/return\s*{[\s\S]*?uiContracts[\s\S]*?}/s)
    expect(returnBlock).not.toBeNull()
  })
})

describe('CL-CTX-004 — uiContracts é null quando orqui.lock.json não existe', () => {
  let orchContent: string

  beforeEach(() => {
    orchContent = readFileContent(ORCHESTRATOR_FILE)
  })

  // @clause CL-CTX-004
  it('succeeds when Orchestrator checks for orqui.lock.json existence', () => {
    expect(orchContent).toMatch(/existsSync.*orqui\.lock\.json|orqui\.lock\.json.*existsSync/)
  })

  // @clause CL-CTX-004
  it('succeeds when uiContracts defaults to null in the context', () => {
    expect(orchContent).toMatch(/uiContracts.*=.*null|uiContracts:\s*null/)
  })

  // @clause CL-CTX-004
  it('succeeds when buildContext has conditional loading for uiContracts', () => {
    // Must have an if/conditional around reading contracts
    const hasConditional = orchContent.includes('orqui.lock.json') &&
      (orchContent.includes('existsSync') || orchContent.includes('readFileSync'))
    expect(hasConditional).toBe(true)
  })
})

describe('CL-CTX-005 — Falha no parse não interrompe pipeline', () => {
  let orchContent: string

  beforeEach(() => {
    orchContent = readFileContent(ORCHESTRATOR_FILE)
  })

  // @clause CL-CTX-005
  it('succeeds when Orchestrator has try-catch around UI contract parsing', () => {
    // There should be error handling around JSON.parse of UI contracts
    const hasTryCatch = orchContent.includes('try') &&
      (orchContent.includes('ui-registry-contract') || orchContent.includes('uiContracts'))
    expect(hasTryCatch).toBe(true)
  })

  // @clause CL-CTX-005
  it('succeeds when Orchestrator logs warning on contract parse failure', () => {
    // Should use warn/console.warn when parse fails
    expect(orchContent).toMatch(/warn.*(?:UI|ui|contract|parse)/i)
  })

  // @clause CL-CTX-005
  it('fails when Orchestrator throws on invalid JSON instead of handling gracefully', () => {
    // There should NOT be unhandled throws for UI contract parsing
    // The try-catch should set the field to null, not re-throw
    const uiSections = orchContent.split('orqui.lock.json')
    expect(uiSections.length).toBeGreaterThanOrEqual(2)
    // After the lock reference, there should be a catch block that doesn't re-throw
    const afterLock = uiSections[1]
    expect(afterLock).toMatch(/catch/)
  })
})

describe('CL-CTX-006 — UI_CONTRACTS_DIR configurável', () => {
  let orchContent: string

  beforeEach(() => {
    orchContent = readFileContent(ORCHESTRATOR_FILE)
  })

  // @clause CL-CTX-006
  it('succeeds when Orchestrator reads UI_CONTRACTS_DIR from config', () => {
    expect(orchContent).toContain('UI_CONTRACTS_DIR')
  })

  // @clause CL-CTX-006
  it('succeeds when UI_CONTRACTS_DIR overrides the default contracts path', () => {
    // Should use config value or fallback to project path
    const configRef = orchContent.match(/config.*get.*UI_CONTRACTS_DIR|UI_CONTRACTS_DIR.*config/s)
    expect(configRef).not.toBeNull()
  })

  // @clause CL-CTX-006
  it('succeeds when Orchestrator uses projectPath as fallback when UI_CONTRACTS_DIR is not set', () => {
    // There should be a fallback path using projectPath or run.projectPath
    expect(orchContent).toMatch(/projectPath|run\.projectPath/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 3: UIComponentRegistry VALIDATOR (CL-REG-001 a CL-REG-012)
// ═══════════════════════════════════════════════════════════════════════════════

describe('UIComponentRegistryValidator', () => {
  describe('CL-REG-001 — SKIPPED quando uiContracts é null', () => {
    // @clause CL-REG-001
    it('succeeds when uiContracts is null and returns SKIPPED', async () => {
      const ctx = buildCtx({ uiContracts: null })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
      expect(result.passed).toBe(true)
    })

    // @clause CL-REG-001
    it('succeeds when uiContracts.registry is null and returns SKIPPED', async () => {
      const ctx = buildCtx({ uiContracts: { registry: null, layout: null, lock: null } })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
      expect(result.passed).toBe(true)
    })

    // @clause CL-REG-001
    it('succeeds when SKIPPED message contains informative text about missing contract', async () => {
      const ctx = buildCtx({ uiContracts: null })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.message).toContain('No UI registry contract')
    })
  })

  describe('CL-REG-002 — SKIPPED quando manifest é null', () => {
    // @clause CL-REG-002
    it('succeeds when manifest is null and returns SKIPPED', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: null,
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
    })

    // @clause CL-REG-002
    it('succeeds when manifest has empty files array and returns SKIPPED', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: { testFile: 'test.spec.ts', files: [] },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
    })

    // @clause CL-REG-002
    it('succeeds when SKIPPED result has passed true', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: null,
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })
  })

  describe('CL-REG-003 — PASSED quando todos os componentes são válidos', () => {
    const VALID_TSX = `
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
export function Dashboard() {
  return <Card><Button variant="ghost">Click</Button></Card>
}
`
    // @clause CL-REG-003
    it('succeeds when all JSX components exist in registry', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Dashboard.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Dashboard.tsx': VALID_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
      expect(result.passed).toBe(true)
    })

    // @clause CL-REG-003
    it('succeeds when metrics show zero unknownComponents', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Dashboard.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Dashboard.tsx': VALID_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.metrics?.unknownComponents).toBe(0)
    })

    // @clause CL-REG-003
    it('succeeds when metrics show totalComponentsFound greater than zero', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Dashboard.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Dashboard.tsx': VALID_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(Number(result.metrics?.totalComponentsFound)).toBeGreaterThan(0)
    })
  })

  describe('CL-REG-004 — FAILED com sugestão para componente desconhecido', () => {
    const INVALID_TSX = `
export function Page() {
  return <SuperTable data={[]} />
}
`
    // @clause CL-REG-004
    it('fails when unknown component is used and result is FAILED', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Page.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Page.tsx': INVALID_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.passed).toBe(false)
    })

    // @clause CL-REG-004
    it('fails when evidence contains the unknown component name', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Page.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Page.tsx': INVALID_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.evidence).toContain('SuperTable')
    })

    // @clause CL-REG-004
    it('fails when evidence contains the file path', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Page.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Page.tsx': INVALID_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.evidence).toContain('src/Page.tsx')
    })
  })

  describe('CL-REG-005 — HTML nativas ignoradas', () => {
    const HTML_ONLY_TSX = `
export function Layout() {
  return (
    <div className="wrapper">
      <span>text</span>
      <input type="text" />
      <button onClick={() => {}}>click</button>
      <section><article><p>content</p></article></section>
    </div>
  )
}
`
    // @clause CL-REG-005
    it('succeeds when only HTML native elements are used', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Layout.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Layout.tsx': HTML_ONLY_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-REG-005
    it('succeeds when HTML elements are not counted as unknown components', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Layout.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Layout.tsx': HTML_ONLY_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.metrics?.unknownComponents).toBe(0)
    })

    // @clause CL-REG-005
    it('succeeds when mixing HTML elements with valid registry components', async () => {
      const mixedTsx = `
export function Mix() {
  return <div><Button>OK</Button><span>text</span></div>
}
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Mix.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Mix.tsx': mixedTsx },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
      expect(result.metrics?.unknownComponents).toBe(0)
    })
  })

  describe('CL-REG-006 — Prefixos ignorados (Lucide, Icon)', () => {
    const ICON_TSX = `
import { LucideHome } from 'lucide-react'
export function Nav() {
  return <div><LucideHome /><IconSettings /></div>
}
`
    // @clause CL-REG-006
    it('succeeds when LucideHome is not flagged as unknown', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Nav.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Nav.tsx': ICON_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-REG-006
    it('succeeds when IconSettings is not flagged as unknown', async () => {
      const iconOnly = `export function X() { return <IconSettings /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': iconOnly },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.metrics?.unknownComponents).toBe(0)
    })

    // @clause CL-REG-006
    it('fails when a non-prefixed unknown component is used alongside ignored prefixed ones', async () => {
      const mixed = `export function Y() { return <div><LucideCheck /><FancyWidget /></div> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Y.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Y.tsx': mixed },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.evidence).toContain('FancyWidget')
      expect(result.evidence).not.toContain('LucideCheck')
    })
  })

  describe('CL-REG-007 — Componentes extras via config', () => {
    // @clause CL-REG-007
    it('succeeds when component is in UI_ALLOWED_EXTRA_COMPONENTS config', async () => {
      const tsx = `export function X() { return <CustomChart data={[]} /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_ALLOWED_EXTRA_COMPONENTS: 'CustomChart,SpecialWidget' },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-REG-007
    it('succeeds when SpecialWidget is accepted via extras config', async () => {
      const tsx = `export function X() { return <SpecialWidget /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_ALLOWED_EXTRA_COMPONENTS: 'CustomChart,SpecialWidget' },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.metrics?.unknownComponents).toBe(0)
    })

    // @clause CL-REG-007
    it('fails when component is NOT in extras config', async () => {
      const tsx = `export function X() { return <RandomComponent /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_ALLOWED_EXTRA_COMPONENTS: 'CustomChart,SpecialWidget' },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
    })
  })

  describe('CL-REG-008 — Apenas TSX/JSX não-teste são analisados', () => {
    // @clause CL-REG-008
    it('succeeds when .ts file is ignored (not analyzed)', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([
          { path: 'src/utils.ts', action: 'CREATE' },
          { path: 'src/Valid.tsx', action: 'CREATE' },
        ]),
        fileContents: {
          'src/utils.ts': 'export const x = 1',
          'src/Valid.tsx': `export function V() { return <Button>OK</Button> }`,
        },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-REG-008
    it('succeeds when .spec.tsx file is ignored', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([
          { path: 'src/Thing.spec.tsx', action: 'CREATE' },
          { path: 'src/Valid.tsx', action: 'CREATE' },
        ]),
        fileContents: {
          'src/Thing.spec.tsx': `it('test', () => { render(<FakeComponent />) })`,
          'src/Valid.tsx': `export function V() { return <Card>hi</Card> }`,
        },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-REG-008
    it('succeeds when DELETE action files are ignored', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([
          { path: 'src/Old.tsx', action: 'DELETE' },
          { path: 'src/Valid.tsx', action: 'CREATE' },
        ]),
        fileContents: {
          'src/Valid.tsx': `export function V() { return <Button>OK</Button> }`,
        },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })
  })

  describe('CL-REG-009 — Mix de válidos e inválidos reporta apenas inválidos', () => {
    const MIX_TSX = `
export function Dashboard() {
  return (
    <div>
      <Button variant="ghost">Click</Button>
      <FancyModal open={true}>Content</FancyModal>
    </div>
  )
}
`
    // @clause CL-REG-009
    it('fails when mix of valid and invalid components used', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Dashboard.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Dashboard.tsx': MIX_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
    })

    // @clause CL-REG-009
    it('fails when evidence contains FancyModal', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Dashboard.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Dashboard.tsx': MIX_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.evidence).toContain('FancyModal')
    })

    // @clause CL-REG-009
    it('fails when evidence does NOT contain Button (valid component)', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Dashboard.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Dashboard.tsx': MIX_TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.evidence).not.toContain('Button')
    })
  })

  describe('CL-REG-010 — Sugestão inteligente por substring', () => {
    // @clause CL-REG-010
    it('succeeds when unknown "Modal" suggests Dialog or AlertDialog', async () => {
      const tsx = `export function X() { return <Modal open /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.evidence).toMatch(/Dialog|AlertDialog/)
    })

    // @clause CL-REG-010
    it('succeeds when unknown "Selector" suggests Select', async () => {
      const tsx = `export function X() { return <Selector value="a" /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.evidence).toMatch(/Select/)
    })

    // @clause CL-REG-010
    it('succeeds when unknown "DataGrid" suggests DataTable or Table', async () => {
      const tsx = `export function X() { return <DataGrid rows={[]} /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.evidence).toMatch(/DataTable|Table/)
    })
  })

  describe('CL-REG-011 — Componente definido no mesmo arquivo não é reportado', () => {
    // @clause CL-REG-011
    it('succeeds when function component declared in same file is used', async () => {
      const tsx = `
function LocalCard({ children }: { children: React.ReactNode }) {
  return <div className="card">{children}</div>
}
export function Page() { return <LocalCard><Button>OK</Button></LocalCard> }
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Page.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Page.tsx': tsx },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-REG-011
    it('succeeds when const arrow component declared in same file is used', async () => {
      const tsx = `
const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>
export function Page() { return <Wrapper><Card>hi</Card></Wrapper> }
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Page.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Page.tsx': tsx },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-REG-011
    it('fails when unknown component is NOT declared locally', async () => {
      const tsx = `export function Page() { return <ExternalUnknown /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/Page.tsx', action: 'CREATE' }]),
        fileContents: { 'src/Page.tsx': tsx },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
    })
  })

  describe('CL-REG-012 — Metrics e context populados', () => {
    const TSX = `export function X() { return <Button>OK</Button> }`

    // @clause CL-REG-012
    it('succeeds when result.metrics contains all required numeric fields', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.metrics).toHaveProperty('totalComponentsFound')
      expect(result.metrics).toHaveProperty('validComponents')
      expect(result.metrics).toHaveProperty('unknownComponents')
      expect(result.metrics).toHaveProperty('filesAnalyzed')
    })

    // @clause CL-REG-012
    it('succeeds when result.context contains inputs array', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(result.context).toBeDefined()
      expect(Array.isArray(result.context!.inputs)).toBe(true)
      expect(result.context!.inputs.length).toBeGreaterThan(0)
    })

    // @clause CL-REG-012
    it('succeeds when result.context contains analyzed and findings arrays', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': TSX },
      })
      const result = await UIComponentRegistryValidator.execute(ctx)
      expect(Array.isArray(result.context!.analyzed)).toBe(true)
      expect(Array.isArray(result.context!.findings)).toBe(true)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 4: UIPropsCompliance VALIDATOR (CL-PRP-001 a CL-PRP-015)
// ═══════════════════════════════════════════════════════════════════════════════

describe('UIPropsComplianceValidator', () => {
  describe('CL-PRP-001 — SKIPPED quando uiContracts é null', () => {
    // @clause CL-PRP-001
    it('succeeds when uiContracts is null and returns SKIPPED', async () => {
      const ctx = buildCtx({ uiContracts: null })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
      expect(result.passed).toBe(true)
    })

    // @clause CL-PRP-001
    it('succeeds when uiContracts.registry is null and returns SKIPPED', async () => {
      const ctx = buildCtx({ uiContracts: { registry: null, layout: null, lock: null } })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
    })

    // @clause CL-PRP-001
    it('succeeds when SKIPPED result has passed true', async () => {
      const ctx = buildCtx({ uiContracts: null })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })
  })

  describe('CL-PRP-002 — SKIPPED quando manifest é null', () => {
    // @clause CL-PRP-002
    it('succeeds when manifest is null and returns SKIPPED', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: null,
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
    })

    // @clause CL-PRP-002
    it('succeeds when manifest has empty files and returns SKIPPED', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: { testFile: 'test.spec.ts', files: [] },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('SKIPPED')
    })

    // @clause CL-PRP-002
    it('succeeds when SKIPPED result from null manifest has passed true', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: null,
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })
  })

  describe('CL-PRP-003 — PASSED quando todas as props são válidas', () => {
    const VALID_TSX = `export function X() { return <Button variant="ghost" size="sm">OK</Button> }`

    // @clause CL-PRP-003
    it('succeeds when all enum props have valid values', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': VALID_TSX },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
      expect(result.passed).toBe(true)
    })

    // @clause CL-PRP-003
    it('succeeds when Accordion with required type prop is present', async () => {
      const tsx = `export function X() { return <Accordion type="single" collapsible>items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-PRP-003
    it('succeeds when DataTable has both required columns and data props', async () => {
      const tsx = `export function X() { return <DataTable columns={cols} data={rows} /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })
  })

  describe('CL-PRP-004 — FAILED para valor de enum inválido', () => {
    // @clause CL-PRP-004
    it('fails when Button variant has invalid value "primary"', async () => {
      const tsx = `export function X() { return <Button variant="primary">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.passed).toBe(false)
    })

    // @clause CL-PRP-004
    it('fails when evidence contains the invalid prop name and value', async () => {
      const tsx = `export function X() { return <Button variant="primary">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.evidence).toContain('variant')
      expect(result.evidence).toContain('primary')
    })

    // @clause CL-PRP-004
    it('fails when evidence lists valid enum values', async () => {
      const tsx = `export function X() { return <Button variant="primary">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.evidence).toContain('default')
      expect(result.evidence).toContain('destructive')
      expect(result.evidence).toContain('ghost')
    })
  })

  describe('CL-PRP-005 — FAILED para prop obrigatória ausente', () => {
    // @clause CL-PRP-005
    it('fails when Accordion is missing required "type" prop', async () => {
      const tsx = `export function X() { return <Accordion collapsible>items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.passed).toBe(false)
    })

    // @clause CL-PRP-005
    it('fails when evidence contains the missing required prop name', async () => {
      const tsx = `export function X() { return <Accordion collapsible>items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.evidence).toContain('type')
    })

    // @clause CL-PRP-005
    it('fails when DataTable is missing required "columns" prop', async () => {
      const tsx = `export function X() { return <DataTable data={[]} /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
      expect(result.evidence).toContain('columns')
    })
  })

  describe('CL-PRP-006 — Prop obrigatória com default não é cobrada', () => {
    // @clause CL-PRP-006
    it('succeeds when Button used without variant (has default)', async () => {
      const tsx = `export function X() { return <Button>OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-PRP-006
    it('succeeds when Button used without size (has default)', async () => {
      const tsx = `export function X() { return <Button variant="ghost">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-PRP-006
    it('succeeds when Accordion collapsible is omitted (has default false)', async () => {
      const tsx = `export function X() { return <Accordion type="single">items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })
  })

  describe('CL-PRP-007 — Expressões dinâmicas aceitas silenciosamente', () => {
    // @clause CL-PRP-007
    it('succeeds when variant uses dynamic expression variable', async () => {
      const tsx = `export function X({ v }: { v: string }) { return <Button variant={v}>OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-PRP-007
    it('succeeds when size uses ternary expression', async () => {
      const tsx = `export function X() { return <Button size={isBig ? 'lg' : 'sm'}>OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('PASSED')
    })

    // @clause CL-PRP-007
    it('succeeds when type prop uses function call expression', async () => {
      const tsx = `export function X() { return <Accordion type={getType()}>items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      // Dynamic expressions should not trigger missing required prop error either
      expect(result.passed).toBe(true)
    })
  })

  describe('CL-PRP-008 — Spread operator gera WARNING', () => {
    // @clause CL-PRP-008
    it('succeeds when spread operator triggers WARNING status', async () => {
      const tsx = `export function X(props: any) { return <Button {...props}>OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('WARNING')
    })

    // @clause CL-PRP-008
    it('succeeds when spread detection is mentioned in evidence or findings', async () => {
      const tsx = `export function X(props: any) { return <Button {...props}>OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      const allText = [result.evidence ?? '', result.message ?? ''].join(' ')
      expect(allText).toMatch(/spread/i)
    })

    // @clause CL-PRP-008
    it('succeeds when spread skips required props check (no FAIL for missing props)', async () => {
      // Accordion has required `type` prop, but spread should skip check
      const tsx = `export function X(props: any) { return <Accordion {...props}>items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      // Should NOT be FAILED — should be WARNING
      expect(result.status).not.toBe('FAILED')
    })
  })

  describe('CL-PRP-009 — Componente fora do registry é pulado', () => {
    // @clause CL-PRP-009
    it('succeeds when unknown component props are not validated', async () => {
      const tsx = `export function X() { return <UnknownThing variant="whatever" required>hi</UnknownThing> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      // Props of unknown components should not cause FAILED
      expect(result.status).not.toBe('FAILED')
    })

    // @clause CL-PRP-009
    it('succeeds when mixing unknown and known components validates only known', async () => {
      const tsx = `
export function X() {
  return <div><UnknownThing bad="value" /><Button variant="ghost">OK</Button></div>
}
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })

    // @clause CL-PRP-009
    it('fails when known component has invalid prop even if unknown component is present', async () => {
      const tsx = `
export function X() {
  return <div><UnknownThing /><Button variant="primary">Bad</Button></div>
}
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
    })
  })

  describe('CL-PRP-010 — Múltiplas instâncias, apenas inválida reportada', () => {
    // @clause CL-PRP-010
    it('fails when one of two Button instances has invalid variant', async () => {
      const tsx = `
export function X() {
  return (
    <div>
      <Button variant="ghost">Good</Button>
      <Button variant="primary">Bad</Button>
    </div>
  )
}
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
    })

    // @clause CL-PRP-010
    it('fails when evidence mentions the invalid value but not the valid one', async () => {
      const tsx = `
export function X() {
  return (
    <div>
      <Button variant="ghost">Good</Button>
      <Button variant="massive">Bad</Button>
    </div>
  )
}
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.evidence).toContain('massive')
    })

    // @clause CL-PRP-010
    it('fails when metrics.enumViolations matches the count of invalid instances', async () => {
      const tsx = `
export function X() {
  return (
    <div>
      <Button variant="ghost">Good</Button>
      <Button variant="primary">Bad</Button>
    </div>
  )
}
`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(Number(result.metrics?.enumViolations)).toBeGreaterThanOrEqual(1)
    })
  })

  describe('CL-PRP-011 — Modo estrito desabilitado: props desconhecidas aceitas', () => {
    // @clause CL-PRP-011
    it('succeeds when unknown prop is silently accepted in default mode', async () => {
      const tsx = `export function X() { return <Button customProp="val">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })

    // @clause CL-PRP-011
    it('succeeds when UI_STRICT_PROPS is explicitly false and unknown prop passes', async () => {
      const tsx = `export function X() { return <Button unknownProp="val">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_STRICT_PROPS: 'false' },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })

    // @clause CL-PRP-011
    it('succeeds when unknownPropsWarnings is 0 in default mode', async () => {
      const tsx = `export function X() { return <Button weirdProp>OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(Number(result.metrics?.unknownPropsWarnings ?? 0)).toBe(0)
    })
  })

  describe('CL-PRP-012 — Modo estrito habilitado: props desconhecidas geram warning', () => {
    // @clause CL-PRP-012
    it('succeeds when WARNING is emitted for unknown prop in strict mode', async () => {
      const tsx = `export function X() { return <Button customProp="val">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_STRICT_PROPS: 'true' },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(Number(result.metrics?.unknownPropsWarnings)).toBeGreaterThanOrEqual(1)
    })

    // @clause CL-PRP-012
    it('succeeds when result status is WARNING for unknown props in strict mode (no other errors)', async () => {
      const tsx = `export function X() { return <Button customProp="val">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_STRICT_PROPS: 'true' },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('WARNING')
    })

    // @clause CL-PRP-012
    it('fails when strict mode and invalid enum are both present', async () => {
      const tsx = `export function X() { return <Button variant="bad" customProp="val">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_STRICT_PROPS: 'true' },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('FAILED')
    })
  })

  describe('CL-PRP-013 — Props HTML genéricas aceitas em modo estrito', () => {
    // @clause CL-PRP-013
    it('succeeds when className and onClick are accepted in strict mode', async () => {
      const tsx = `export function X() { return <Button className="btn" onClick={fn}>OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_STRICT_PROPS: 'true' },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })

    // @clause CL-PRP-013
    it('succeeds when data-testid and aria-label are accepted in strict mode', async () => {
      const tsx = `export function X() { return <Button data-testid="btn" aria-label="submit">OK</Button> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_STRICT_PROPS: 'true' },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.passed).toBe(true)
    })

    // @clause CL-PRP-013
    it('succeeds when style, id, key, ref, onChange, onSubmit, onBlur, onFocus are accepted', async () => {
      const tsx = `export function X() {
  return <Button style={{}} id="b" key="k" ref={ref} onChange={fn} onSubmit={fn} onBlur={fn} onFocus={fn}>OK</Button>
}`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
        configEntries: { UI_STRICT_PROPS: 'true' },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(Number(result.metrics?.unknownPropsWarnings ?? 0)).toBe(0)
    })
  })

  describe('CL-PRP-014 — Spread + prop obrigatória gera WARNING', () => {
    // @clause CL-PRP-014
    it('succeeds when Accordion with spread gets WARNING instead of FAIL', async () => {
      const tsx = `export function X(props: any) { return <Accordion {...props}>items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).toBe('WARNING')
    })

    // @clause CL-PRP-014
    it('succeeds when DataTable with spread does not FAIL for missing columns/data', async () => {
      const tsx = `export function X(props: any) { return <DataTable {...props} /> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.status).not.toBe('FAILED')
    })

    // @clause CL-PRP-014
    it('succeeds when spread warning mentions required props context', async () => {
      const tsx = `export function X(props: any) { return <Accordion {...props}>items</Accordion> }`
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': tsx },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      const allText = [result.evidence ?? '', result.message ?? ''].join(' ')
      expect(allText).toMatch(/spread|required/i)
    })
  })

  describe('CL-PRP-015 — Metrics e context populados', () => {
    const TSX = `export function X() { return <Button variant="ghost">OK</Button> }`

    // @clause CL-PRP-015
    it('succeeds when result.metrics has all required numeric fields', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': TSX },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.metrics).toHaveProperty('totalInstances')
      expect(result.metrics).toHaveProperty('totalPropsChecked')
      expect(result.metrics).toHaveProperty('enumViolations')
      expect(result.metrics).toHaveProperty('missingRequiredProps')
      expect(result.metrics).toHaveProperty('unknownPropsWarnings')
    })

    // @clause CL-PRP-015
    it('succeeds when result.context has inputs, analyzed, and findings', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': TSX },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(result.context).toBeDefined()
      expect(Array.isArray(result.context!.inputs)).toBe(true)
      expect(Array.isArray(result.context!.analyzed)).toBe(true)
      expect(Array.isArray(result.context!.findings)).toBe(true)
    })

    // @clause CL-PRP-015
    it('succeeds when metrics values are numbers', async () => {
      const ctx = buildCtx({
        uiContracts: { registry: buildMiniRegistry(), layout: null, lock: null },
        manifest: makeManifest([{ path: 'src/X.tsx', action: 'CREATE' }]),
        fileContents: { 'src/X.tsx': TSX },
      })
      const result = await UIPropsComplianceValidator.execute(ctx)
      expect(typeof result.metrics?.totalInstances).toBe('number')
      expect(typeof result.metrics?.enumViolations).toBe('number')
      expect(typeof result.metrics?.missingRequiredProps).toBe('number')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 5: CONFIGURAÇÃO E REGISTRO (CL-CFG-001 a CL-CFG-003)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CL-CFG-001 — Validators registrados no gates.config.ts', () => {
  // @clause CL-CFG-001
  it('succeeds when Gate 2 config includes UIComponentRegistryValidator', () => {
    const gate2 = GATES_CONFIG.find((g) => g.number === 2)
    expect(gate2).toBeDefined()
    const codes = gate2!.validators.map((v) => v.code)
    expect(codes).toContain('UI_COMPONENT_REGISTRY')
  })

  // @clause CL-CFG-001
  it('succeeds when Gate 2 config includes UIPropsComplianceValidator', () => {
    const gate2 = GATES_CONFIG.find((g) => g.number === 2)
    expect(gate2).toBeDefined()
    const codes = gate2!.validators.map((v) => v.code)
    expect(codes).toContain('UI_PROPS_COMPLIANCE')
  })

  // @clause CL-CFG-001
  it('succeeds when UI validators are after TestReadOnlyEnforcement and before TaskTestPasses', () => {
    const gate2 = GATES_CONFIG.find((g) => g.number === 2)
    expect(gate2).toBeDefined()
    const codes = gate2!.validators.map((v) => v.code)
    const troe = codes.indexOf('TEST_READ_ONLY_ENFORCEMENT')
    const uiReg = codes.indexOf('UI_COMPONENT_REGISTRY')
    const uiProps = codes.indexOf('UI_PROPS_COMPLIANCE')
    const ttp = codes.indexOf('TASK_TEST_PASSES')

    expect(troe).toBeLessThan(uiReg)
    expect(uiReg).toBeLessThan(uiProps)
    expect(uiProps).toBeLessThan(ttp)
  })

  // @clause CL-CFG-001
  it('succeeds when gates.config.ts file imports both new validators', () => {
    const configContent = readFileContent(GATES_CONFIG_FILE)
    expect(configContent).toContain('UIComponentRegistryValidator')
    expect(configContent).toContain('UIPropsComplianceValidator')
  })
})

describe('CL-CFG-002 — Identidade do UIComponentRegistry', () => {
  // @clause CL-CFG-002
  it('succeeds when UIComponentRegistryValidator has code UI_COMPONENT_REGISTRY', () => {
    expect(UIComponentRegistryValidator.code).toBe('UI_COMPONENT_REGISTRY')
  })

  // @clause CL-CFG-002
  it('succeeds when UIComponentRegistryValidator has gate 2 and order 3', () => {
    expect(UIComponentRegistryValidator.gate).toBe(2)
    expect(UIComponentRegistryValidator.order).toBe(3)
  })

  // @clause CL-CFG-002
  it('succeeds when UIComponentRegistryValidator has isHardBlock true', () => {
    expect(UIComponentRegistryValidator.isHardBlock).toBe(true)
  })
})

describe('CL-CFG-003 — Identidade do UIPropsCompliance', () => {
  // @clause CL-CFG-003
  it('succeeds when UIPropsComplianceValidator has code UI_PROPS_COMPLIANCE', () => {
    expect(UIPropsComplianceValidator.code).toBe('UI_PROPS_COMPLIANCE')
  })

  // @clause CL-CFG-003
  it('succeeds when UIPropsComplianceValidator has gate 2 and order 4', () => {
    expect(UIPropsComplianceValidator.gate).toBe(2)
    expect(UIPropsComplianceValidator.order).toBe(4)
  })

  // @clause CL-CFG-003
  it('succeeds when UIPropsComplianceValidator has isHardBlock true', () => {
    expect(UIPropsComplianceValidator.isHardBlock).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 6: VALIDAÇÃO ESTRUTURAL DOS ARQUIVOS DE VALIDATOR (existência)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Structural — Validator files exist and export correctly', () => {
  // @clause CL-CFG-002
  it('succeeds when UIComponentRegistry.ts file exists', () => {
    expect(fs.existsSync(UI_REGISTRY_VALIDATOR_FILE)).toBe(true)
  })

  // @clause CL-CFG-003
  it('succeeds when UIPropsCompliance.ts file exists', () => {
    expect(fs.existsSync(UI_PROPS_VALIDATOR_FILE)).toBe(true)
  })

  // @clause CL-CFG-002
  it('succeeds when UIComponentRegistry.ts exports UIComponentRegistryValidator', () => {
    const content = readFileContent(UI_REGISTRY_VALIDATOR_FILE)
    expect(content).toMatch(/export\s+(const|function)\s+UIComponentRegistryValidator/)
  })

  // @clause CL-CFG-003
  it('succeeds when UIPropsCompliance.ts exports UIPropsComplianceValidator', () => {
    const content = readFileContent(UI_PROPS_VALIDATOR_FILE)
    expect(content).toMatch(/export\s+(const|function)\s+UIPropsComplianceValidator/)
  })
})
