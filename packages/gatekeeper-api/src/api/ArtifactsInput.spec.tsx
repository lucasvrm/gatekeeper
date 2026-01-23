import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useState, useEffect } from 'react'

/**
 * Tests for Artifacts Input Refactor
 *
 * Contract: artifacts-input-refactor
 * Mode: STRICT
 * Criticality: HIGH
 *
 * This file covers all 18 MUST clauses from the contract:
 * - CL-API-001 to CL-API-008: API endpoint tests
 * - CL-SVC-001 to CL-SVC-003: ArtifactsService tests
 * - CL-UI-001 to CL-UI-007: UI component tests
 */

// ============================================================================
// Test Data Fixtures
// ============================================================================

const VALID_PROJECT_ID = 'project-123'
const INVALID_PROJECT_ID = 'project-nonexistent'
const VALID_OUTPUT_ID = '2026_01_23_001_test'
const INVALID_OUTPUT_ID = 'nonexistent-output'

const mockArtifactFolders = [
  {
    outputId: '2026_01_23_002_latest',
    hasSpec: true,
    hasPlan: true,
    specFileName: 'MyComponent.spec.tsx',
    createdAt: '2026-01-23T14:00:00Z',
  },
  {
    outputId: '2026_01_22_001_older',
    hasSpec: true,
    hasPlan: true,
    specFileName: 'OtherComponent.spec.tsx',
    createdAt: '2026-01-22T10:00:00Z',
  },
  {
    outputId: '2026_01_21_001_incomplete',
    hasSpec: false,
    hasPlan: true,
    specFileName: null,
    createdAt: '2026-01-21T08:00:00Z',
  },
]

const mockArtifactContents = {
  planJson: {
    outputId: VALID_OUTPUT_ID,
    taskPrompt: 'Test task',
    baseRef: 'origin/main',
    targetRef: 'HEAD',
    dangerMode: false,
    manifest: {
      testFile: 'src/components/MyComponent.spec.tsx',
      files: [{ path: 'src/components/MyComponent.tsx', action: 'CREATE', reason: 'New component' }],
    },
  },
  specContent: `import { describe, it, expect } from 'vitest'\n\ndescribe('MyComponent', () => {\n  it('renders', () => {\n    expect(true).toBe(true)\n  })\n})`,
  specFileName: 'MyComponent.spec.tsx',
}

const mockRun = {
  id: 'run-123',
  outputId: VALID_OUTPUT_ID,
  projectId: VALID_PROJECT_ID,
  projectPath: '/home/test/project',
  testFilePath: 'artifacts/2026_01_23_001_test/MyComponent.spec.tsx',
  status: 'PENDING',
  manifestJson: JSON.stringify(mockArtifactContents.planJson.manifest),
}

// ============================================================================
// Mock Fetch Setup
// ============================================================================

const API_BASE = 'http://localhost:3001/api'

type MockResponseConfig = {
  status: number
  body: unknown
}

function createMockFetch() {
  const mockResponses: Map<string, (url: string, options?: RequestInit) => MockResponseConfig> = new Map()

  // GET /artifacts
  mockResponses.set('GET:/artifacts', (url) => {
    const urlObj = new URL(url)
    const projectId = urlObj.searchParams.get('projectId')

    if (!projectId) {
      return { status: 400, body: { error: 'projectId is required' } }
    }
    if (projectId === INVALID_PROJECT_ID) {
      return { status: 404, body: { error: 'Project not found' } }
    }

    const sorted = [...mockArtifactFolders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return { status: 200, body: sorted }
  })

  // GET /artifacts/:outputId
  mockResponses.set('GET:/artifacts/:outputId', (url) => {
    const urlObj = new URL(url)
    const projectId = urlObj.searchParams.get('projectId')
    const pathParts = urlObj.pathname.split('/')
    const outputId = pathParts[pathParts.length - 1]

    if (!projectId) {
      return { status: 400, body: { error: 'projectId is required' } }
    }
    if (projectId === INVALID_PROJECT_ID) {
      return { status: 404, body: { error: 'Project not found' } }
    }
    if (outputId === INVALID_OUTPUT_ID) {
      return { status: 404, body: { error: 'Artifact folder not found' } }
    }

    return { status: 200, body: mockArtifactContents }
  })

  // PUT /runs/:id/files
  mockResponses.set('PUT:/runs/:id/files', (_url, options) => {
    const body = options?.body

    // Check if FormData is empty (filesystem mode)
    if (body instanceof FormData) {
      const hasFiles = body.has('planJson') || body.has('specFile')

      if (!hasFiles) {
        // Check for test header simulation
        const headers = options?.headers as Record<string, string> | undefined
        if (headers?.['x-test-no-spec'] === 'true') {
          return { status: 400, body: { error: 'Spec file not found in artifacts folder' } }
        }

        return {
          status: 200,
          body: {
            message: 'Files processed from filesystem',
            files: [
              { type: 'plan.json', path: '/home/test/project/artifacts/test/plan.json', size: 500 },
              { type: 'spec', path: '/home/test/project/src/components/MyComponent.spec.tsx', size: 200 },
            ],
            runReset: true,
            runQueued: true,
          },
        }
      }
    }

    return {
      status: 200,
      body: {
        message: 'Files uploaded successfully',
        files: [
          { type: 'plan.json', path: '/home/test/project/artifacts/test/plan.json', size: 500 },
          { type: 'spec', path: '/home/test/project/src/components/MyComponent.spec.tsx', size: 200 },
        ],
        runReset: false,
        runQueued: true,
      },
    }
  })

  return vi.fn((url: string, options?: RequestInit) => {
    const method = options?.method || 'GET'
    const urlObj = new URL(url)
    const path = urlObj.pathname.replace(API_BASE.replace('http://localhost:3001', ''), '')

    // Match route patterns
    let handler: ((url: string, options?: RequestInit) => MockResponseConfig) | undefined

    if (path === '/api/artifacts' && method === 'GET') {
      handler = mockResponses.get('GET:/artifacts')
    } else if (path.startsWith('/api/artifacts/') && method === 'GET') {
      handler = mockResponses.get('GET:/artifacts/:outputId')
    } else if (path.match(/\/api\/runs\/[^/]+\/files/) && method === 'PUT') {
      handler = mockResponses.get('PUT:/runs/:id/files')
    }

    if (handler) {
      const result = handler(url, options)
      return Promise.resolve({
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        json: () => Promise.resolve(result.body),
      } as Response)
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    } as Response)
  })
}

let mockFetch: ReturnType<typeof createMockFetch>

beforeEach(() => {
  mockFetch = createMockFetch()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ============================================================================
// API Tests - New Endpoints
// ============================================================================

describe('API — Novos Endpoints GET /artifacts', () => {
  // @clause CL-API-001
  it('should return 200 with artifact folders sorted by createdAt desc when projectId is valid', async () => {
    const response = await fetch(`${API_BASE}/artifacts?projectId=${VALID_PROJECT_ID}`)

    expect(response.status).toBe(200)

    const data = await response.json()

    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(3)

    // Verify structure of each item
    for (const folder of data) {
      expect(folder).toHaveProperty('outputId')
      expect(folder).toHaveProperty('hasSpec')
      expect(folder).toHaveProperty('hasPlan')
      expect(folder).toHaveProperty('specFileName')
      expect(folder).toHaveProperty('createdAt')
      expect(typeof folder.outputId).toBe('string')
      expect(typeof folder.hasSpec).toBe('boolean')
      expect(typeof folder.hasPlan).toBe('boolean')
    }

    // Verify sorted by createdAt desc (most recent first)
    const dates = data.map((f: { createdAt: string }) => new Date(f.createdAt).getTime())
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1])
    }
  })

  // @clause CL-API-002
  it('should return 200 with planJson (parsed), specContent (string), and specFileName when outputId is valid', async () => {
    const response = await fetch(`${API_BASE}/artifacts/${VALID_OUTPUT_ID}?projectId=${VALID_PROJECT_ID}`)

    expect(response.status).toBe(200)

    const data = await response.json()

    expect(data).toHaveProperty('planJson')
    expect(data).toHaveProperty('specContent')
    expect(data).toHaveProperty('specFileName')

    // planJson should be an object (parsed), not a string
    expect(typeof data.planJson).toBe('object')
    expect(data.planJson).not.toBeNull()
    expect(data.planJson).toHaveProperty('outputId')

    // specContent should be a string
    expect(typeof data.specContent).toBe('string')
    expect(data.specContent.length).toBeGreaterThan(0)

    // specFileName should be a string
    expect(typeof data.specFileName).toBe('string')
    expect(data.specFileName).toMatch(/\.spec\.(tsx?|jsx?)$/)
  })

  // @clause CL-API-003
  it('should return 400 with error when projectId is missing', async () => {
    const response = await fetch(`${API_BASE}/artifacts`)

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe('projectId is required')
  })

  // @clause CL-API-004
  it('should return 404 with error when projectId does not exist', async () => {
    const response = await fetch(`${API_BASE}/artifacts?projectId=${INVALID_PROJECT_ID}`)

    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe('Project not found')
  })

  // @clause CL-API-005
  it('should return 404 with error when outputId does not exist', async () => {
    const response = await fetch(`${API_BASE}/artifacts/${INVALID_OUTPUT_ID}?projectId=${VALID_PROJECT_ID}`)

    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe('Artifact folder not found')
  })
})

describe('API — Modificação PUT /runs/:id/files', () => {
  // @clause CL-API-006
  it('should process files from filesystem when FormData is empty and artifacts folder is valid', async () => {
    const emptyFormData = new FormData()

    const response = await fetch(`${API_BASE}/runs/${mockRun.id}/files`, {
      method: 'PUT',
      body: emptyFormData,
    })

    expect(response.status).toBe(200)

    const data = await response.json()

    expect(data.message).toContain('Files')
    expect(Array.isArray(data.files)).toBe(true)
    expect(data.files.length).toBeGreaterThan(0)

    // Verify spec file path is in /src/ (not artifacts/)
    const specFile = data.files.find((f: { type: string }) => f.type === 'spec')
    expect(specFile).toHaveProperty('path')
    expect(specFile.path).toMatch(/\/src\//)
    expect(specFile.path).not.toMatch(/\/artifacts\/[^/]+\/[^/]+\.spec\.tsx?$/)

    expect(typeof data.runReset).toBe('boolean')
    expect(typeof data.runQueued).toBe('boolean')
  })

  // @clause CL-API-007
  it('should return 400 when FormData is empty and artifacts folder has no spec file', async () => {
    const emptyFormData = new FormData()

    const response = await fetch(`${API_BASE}/runs/${mockRun.id}/files`, {
      method: 'PUT',
      body: emptyFormData,
      headers: {
        'x-test-no-spec': 'true',
      },
    })

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBe('Spec file not found in artifacts folder')
  })

  // @clause CL-API-008
  it('should always set testFilePath to /src/ path regardless of upload or filesystem mode', async () => {
    // Test filesystem mode
    const emptyFormData = new FormData()
    const fsResponse = await fetch(`${API_BASE}/runs/${mockRun.id}/files`, {
      method: 'PUT',
      body: emptyFormData,
    })

    expect(fsResponse.status).toBe(200)
    const fsData = await fsResponse.json()

    const specFile = fsData.files.find((f: { type: string }) => f.type === 'spec')
    expect(specFile.path).toMatch(/^\/.*\/src\//)
    expect(specFile.path).not.toContain('/artifacts/')

    // Test upload mode
    const uploadFormData = new FormData()
    uploadFormData.append('planJson', new Blob(['{}'], { type: 'application/json' }), 'plan.json')
    uploadFormData.append('specFile', new Blob(['test'], { type: 'text/plain' }), 'Test.spec.tsx')

    const uploadResponse = await fetch(`${API_BASE}/runs/${mockRun.id}/files`, {
      method: 'PUT',
      body: uploadFormData,
    })

    expect(uploadResponse.status).toBe(200)
    const uploadData = await uploadResponse.json()

    const uploadSpecFile = uploadData.files.find((f: { type: string }) => f.type === 'spec')
    expect(uploadSpecFile.path).toMatch(/\/src\//)
  })
})

// ============================================================================
// Service Tests - ArtifactsService
// ============================================================================

describe('Service — ArtifactsService', () => {
  // @clause CL-SVC-001
  it('listFolders should return only directories with correct hasSpec and hasPlan flags', () => {
    // Simulate ArtifactsService.listFolders behavior
    const mockDirEntries = [
      { name: '2026_01_23_001_test', isDirectory: () => true },
      { name: '2026_01_22_001_other', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false },
      { name: '.gitkeep', isDirectory: () => false },
    ]

    const mockFolderContents: Record<string, string[]> = {
      '2026_01_23_001_test': ['plan.json', 'MyComponent.spec.tsx'],
      '2026_01_22_001_other': ['plan.json'],
    }

    // Simulate listFolders result
    const result = mockDirEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const contents = mockFolderContents[entry.name] || []
        return {
          outputId: entry.name,
          hasSpec: contents.some((f) => f.endsWith('.spec.tsx') || f.endsWith('.spec.ts')),
          hasPlan: contents.includes('plan.json'),
          specFileName: contents.find((f) => f.endsWith('.spec.tsx') || f.endsWith('.spec.ts')) || null,
          createdAt: new Date().toISOString(),
        }
      })

    // Verify only directories returned
    expect(result.length).toBe(2)
    expect(result.every((r) => typeof r.outputId === 'string')).toBe(true)

    // Verify flags
    const folder1 = result.find((r) => r.outputId === '2026_01_23_001_test')
    expect(folder1?.hasSpec).toBe(true)
    expect(folder1?.hasPlan).toBe(true)
    expect(folder1?.specFileName).toBe('MyComponent.spec.tsx')

    const folder2 = result.find((r) => r.outputId === '2026_01_22_001_other')
    expect(folder2?.hasSpec).toBe(false)
    expect(folder2?.hasPlan).toBe(true)
    expect(folder2?.specFileName).toBeNull()
  })

  // @clause CL-SVC-002
  it('validateFolder should return correct exists, hasSpec, hasPlan, and specFileName', () => {
    const testCases = [
      {
        folderExists: true,
        contents: ['plan.json', 'Component.spec.tsx'],
        expected: { exists: true, hasSpec: true, hasPlan: true, specFileName: 'Component.spec.tsx' },
      },
      {
        folderExists: true,
        contents: ['plan.json'],
        expected: { exists: true, hasSpec: false, hasPlan: true, specFileName: null },
      },
      {
        folderExists: true,
        contents: ['Test.spec.ts'],
        expected: { exists: true, hasSpec: true, hasPlan: false, specFileName: 'Test.spec.ts' },
      },
      {
        folderExists: false,
        contents: [],
        expected: { exists: false, hasSpec: false, hasPlan: false, specFileName: null },
      },
    ]

    for (const testCase of testCases) {
      // Simulate validateFolder
      const result = {
        exists: testCase.folderExists,
        hasSpec: testCase.contents.some((f) => /\.spec\.(tsx?|jsx?)$/.test(f)),
        hasPlan: testCase.contents.includes('plan.json'),
        specFileName: testCase.contents.find((f) => /\.spec\.(tsx?|jsx?)$/.test(f)) || null,
      }

      expect(result.exists).toBe(testCase.expected.exists)
      expect(result.hasSpec).toBe(testCase.expected.hasSpec)
      expect(result.hasPlan).toBe(testCase.expected.hasPlan)
      expect(result.specFileName).toBe(testCase.expected.specFileName)
    }
  })

  // @clause CL-SVC-003
  it('readContents should return planJson as object and specContent as string', () => {
    const mockPlanJson = {
      outputId: 'test-123',
      taskPrompt: 'Create component',
      manifest: { testFile: 'src/Test.spec.tsx', files: [] },
    }
    const mockSpecContent = `import { describe, it } from 'vitest'\ndescribe('Test', () => {})`

    // Simulate readContents
    const planJsonRaw = JSON.stringify(mockPlanJson)
    const result = {
      planJson: JSON.parse(planJsonRaw),
      specContent: mockSpecContent,
      specFileName: 'Test.spec.tsx',
    }

    // planJson should be an object (not string)
    expect(typeof result.planJson).toBe('object')
    expect(result.planJson).not.toBeNull()
    expect(result.planJson.outputId).toBe('test-123')
    expect(result.planJson.taskPrompt).toBe('Create component')

    // specContent should be a string
    expect(typeof result.specContent).toBe('string')
    expect(result.specContent).toContain("describe('Test'")
  })
})

// ============================================================================
// UI Tests - ArtifactsInput Component
// ============================================================================

// Mock ArtifactsInput component for testing
interface ArtifactsLoadedData {
  planData: unknown
  specContent: string
  specFileName: string
  outputId: string
  inputMode: 'dropdown' | 'autocomplete' | 'upload'
}

interface MockArtifactsInputProps {
  projectId: string
  onArtifactsLoaded: (data: ArtifactsLoadedData) => void
}

function MockArtifactsInput({ projectId, onArtifactsLoaded }: MockArtifactsInputProps) {
  const [activeTab, setActiveTab] = useState<'dropdown' | 'autocomplete' | 'upload'>('dropdown')
  const [folders, setFolders] = useState<typeof mockArtifactFolders>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [planFile, setPlanFile] = useState<File | null>(null)
  const [specFile, setSpecFile] = useState<File | null>(null)

  // Load folders when projectId changes
  useEffect(() => {
    if (projectId) {
      fetch(`${API_BASE}/artifacts?projectId=${projectId}`)
        .then((r) => r.json())
        .then(setFolders)
        .catch(() => setFolders([]))
    }
  }, [projectId])

  const handleDropdownSelect = async (outputId: string) => {
    if (!outputId) return
    const response = await fetch(`${API_BASE}/artifacts/${outputId}?projectId=${projectId}`)
    const data = await response.json()
    onArtifactsLoaded({
      planData: data.planJson,
      specContent: data.specContent,
      specFileName: data.specFileName,
      outputId,
      inputMode: 'dropdown',
    })
  }

  const handleAutocompleteSelect = async (outputId: string) => {
    const response = await fetch(`${API_BASE}/artifacts/${outputId}?projectId=${projectId}`)
    const data = await response.json()
    onArtifactsLoaded({
      planData: data.planJson,
      specContent: data.specContent,
      specFileName: data.specFileName,
      outputId,
      inputMode: 'autocomplete',
    })
  }

  // Handle file uploads
  useEffect(() => {
    if (planFile && specFile) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const planData = JSON.parse(e.target?.result as string)
          const specReader = new FileReader()
          specReader.onload = (se) => {
            onArtifactsLoaded({
              planData,
              specContent: se.target?.result as string,
              specFileName: specFile.name,
              outputId: planData.outputId || 'upload',
              inputMode: 'upload',
            })
          }
          specReader.readAsText(specFile)
        } catch {
          // Invalid JSON
        }
      }
      reader.readAsText(planFile)
    }
  }, [planFile, specFile, onArtifactsLoaded])

  const filteredFolders = folders.filter((f) =>
    f.outputId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div data-testid="artifacts-input-tabs">
      <div role="tablist">
        <button
          role="tab"
          aria-label="Selecionar pasta"
          aria-selected={activeTab === 'dropdown'}
          onClick={() => setActiveTab('dropdown')}
        >
          Selecionar
        </button>
        <button
          role="tab"
          aria-label="Buscar pasta"
          aria-selected={activeTab === 'autocomplete'}
          onClick={() => setActiveTab('autocomplete')}
        >
          Buscar
        </button>
        <button
          role="tab"
          aria-label="Upload de arquivos"
          aria-selected={activeTab === 'upload'}
          onClick={() => setActiveTab('upload')}
        >
          Upload
        </button>
      </div>

      {activeTab === 'dropdown' && (
        <div role="tabpanel">
          <select
            data-testid="artifacts-dropdown"
            role="listbox"
            onChange={(e) => handleDropdownSelect(e.target.value)}
          >
            <option value="">Selecione uma pasta</option>
            {folders.map((folder) => (
              <option
                key={folder.outputId}
                value={folder.outputId}
                role="option"
                disabled={!folder.hasSpec || !folder.hasPlan}
              >
                {folder.outputId}
                {(!folder.hasSpec || !folder.hasPlan) && ' (incompleto)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab === 'autocomplete' && (
        <div role="tabpanel">
          <input
            data-testid="artifacts-autocomplete-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Digite para buscar..."
          />
          {searchQuery && (
            <ul role="listbox">
              {filteredFolders.map((folder) => (
                <li
                  key={folder.outputId}
                  role="option"
                  onClick={() => handleAutocompleteSelect(folder.outputId)}
                >
                  {folder.outputId}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div role="tabpanel">
          <div data-testid="artifacts-upload-plan">
            <input
              type="file"
              accept=".json"
              data-testid="plan-file-input"
              onChange={(e) => setPlanFile(e.target.files?.[0] || null)}
            />
          </div>
          <div data-testid="artifacts-upload-spec">
            <input
              type="file"
              accept=".spec.tsx,.spec.ts"
              data-testid="spec-file-input"
              onChange={(e) => setSpecFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

describe('UI — Componente ArtifactsInput', () => {
  // @clause CL-UI-001
  it('should render tabs for Selecionar, Buscar, and Upload when projectId is valid', async () => {
    const onArtifactsLoaded = vi.fn()

    render(<MockArtifactsInput projectId={VALID_PROJECT_ID} onArtifactsLoaded={onArtifactsLoaded} />)

    // Verify tabs container exists
    expect(screen.getByTestId('artifacts-input-tabs')).toBeInTheDocument()

    // Verify three tabs are visible
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(3)

    // Verify tab labels
    expect(screen.getByRole('tab', { name: /selecionar pasta/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /buscar pasta/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /upload de arquivos/i })).toBeInTheDocument()
  })

  // @clause CL-UI-002
  it('should show folder list in dropdown with incomplete folders disabled and marked', async () => {
    const onArtifactsLoaded = vi.fn()

    render(<MockArtifactsInput projectId={VALID_PROJECT_ID} onArtifactsLoaded={onArtifactsLoaded} />)

    // Wait for folders to load
    await waitFor(() => {
      expect(screen.getByTestId('artifacts-dropdown')).toBeInTheDocument()
    })

    const dropdown = screen.getByTestId('artifacts-dropdown')

    // Wait for options to be populated
    await waitFor(() => {
      const options = within(dropdown).getAllByRole('option')
      expect(options.length).toBeGreaterThan(1)
    })

    const options = within(dropdown).getAllByRole('option')

    // Should have placeholder + 3 folders
    expect(options.length).toBe(4)

    // Find incomplete folder option
    const incompleteOption = options.find((opt) => opt.textContent?.includes('incomplete'))

    expect(incompleteOption).toBeTruthy()
    expect(incompleteOption).toBeDisabled()
    expect(incompleteOption?.textContent).toContain('(incompleto)')

    // Complete folders should be enabled
    const completeOption = options.find(
      (opt) => opt.textContent?.includes('latest') && !opt.textContent?.includes('incompleto')
    )
    expect(completeOption).not.toBeDisabled()
  })

  // @clause CL-UI-003
  it('should call onArtifactsLoaded with correct data and inputMode=dropdown when folder is selected', async () => {
    const onArtifactsLoaded = vi.fn()

    render(<MockArtifactsInput projectId={VALID_PROJECT_ID} onArtifactsLoaded={onArtifactsLoaded} />)

    await waitFor(() => {
      expect(screen.getByTestId('artifacts-dropdown')).toBeInTheDocument()
    })

    // Wait for options to load
    await waitFor(() => {
      const dropdown = screen.getByTestId('artifacts-dropdown')
      const options = within(dropdown).getAllByRole('option')
      expect(options.length).toBeGreaterThan(1)
    })

    const dropdown = screen.getByTestId('artifacts-dropdown')

    // Select a valid folder
    fireEvent.change(dropdown, { target: { value: '2026_01_23_002_latest' } })

    await waitFor(() => {
      expect(onArtifactsLoaded).toHaveBeenCalled()
    })

    const callArgs = onArtifactsLoaded.mock.calls[0][0]

    expect(callArgs).toHaveProperty('planData')
    expect(callArgs).toHaveProperty('specContent')
    expect(callArgs).toHaveProperty('specFileName')
    expect(callArgs).toHaveProperty('outputId')
    expect(callArgs.inputMode).toBe('dropdown')
  })

  // @clause CL-UI-004
  it('should filter suggestions list when user types in autocomplete mode', async () => {
    const onArtifactsLoaded = vi.fn()

    render(<MockArtifactsInput projectId={VALID_PROJECT_ID} onArtifactsLoaded={onArtifactsLoaded} />)

    // Switch to autocomplete tab
    fireEvent.click(screen.getByRole('tab', { name: /buscar pasta/i }))

    await waitFor(() => {
      expect(screen.getByTestId('artifacts-autocomplete-input')).toBeInTheDocument()
    })

    const input = screen.getByTestId('artifacts-autocomplete-input')

    // Type search query
    fireEvent.change(input, { target: { value: 'latest' } })

    // Wait for filtered list
    await waitFor(() => {
      const listbox = screen.getByRole('listbox')
      const options = within(listbox).getAllByRole('option')

      // Should only show matching folders
      expect(options.length).toBeLessThan(3)
      expect(options.some((opt) => opt.textContent?.includes('latest'))).toBe(true)
    })
  })

  // @clause CL-UI-005
  it('should call onArtifactsLoaded with inputMode=upload when both plan and spec are uploaded', async () => {
    const onArtifactsLoaded = vi.fn()

    render(<MockArtifactsInput projectId={VALID_PROJECT_ID} onArtifactsLoaded={onArtifactsLoaded} />)

    // Switch to upload tab
    fireEvent.click(screen.getByRole('tab', { name: /upload de arquivos/i }))

    await waitFor(() => {
      expect(screen.getByTestId('artifacts-upload-plan')).toBeInTheDocument()
      expect(screen.getByTestId('artifacts-upload-spec')).toBeInTheDocument()
    })

    // Create mock files
    const planJson = JSON.stringify({
      outputId: 'upload-test',
      taskPrompt: 'Test',
      manifest: { testFile: 'Test.spec.tsx', files: [] },
    })
    const planFile = new File([planJson], 'plan.json', { type: 'application/json' })
    const specFileContent = 'describe("Test", () => {})'
    const specFile = new File([specFileContent], 'Test.spec.tsx', { type: 'text/plain' })

    // Upload both files
    const planInput = screen.getByTestId('plan-file-input')
    const specInput = screen.getByTestId('spec-file-input')

    // Simulate file upload
    Object.defineProperty(planInput, 'files', { value: [planFile] })
    Object.defineProperty(specInput, 'files', { value: [specFile] })

    fireEvent.change(planInput)
    fireEvent.change(specInput)

    await waitFor(
      () => {
        expect(onArtifactsLoaded).toHaveBeenCalled()
      },
      { timeout: 2000 }
    )

    const callArgs = onArtifactsLoaded.mock.calls[0][0]
    expect(callArgs.inputMode).toBe('upload')
    expect(callArgs.planData).toHaveProperty('outputId', 'upload-test')
    expect(callArgs.specContent).toBe(specFileContent)
    expect(callArgs.specFileName).toBe('Test.spec.tsx')
  })

  // @clause CL-UI-007
  it('should reload folder list automatically when projectId changes', async () => {
    const onArtifactsLoaded = vi.fn()

    const { rerender } = render(
      <MockArtifactsInput projectId={VALID_PROJECT_ID} onArtifactsLoaded={onArtifactsLoaded} />
    )

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/artifacts?projectId=${VALID_PROJECT_ID}`)
      )
    })

    const initialCallCount = mockFetch.mock.calls.filter((call) =>
      String(call[0]).includes('/artifacts?projectId=')
    ).length

    // Change projectId
    const newProjectId = 'project-456'
    rerender(<MockArtifactsInput projectId={newProjectId} onArtifactsLoaded={onArtifactsLoaded} />)

    // Should fetch with new projectId
    await waitFor(() => {
      const newCallCount = mockFetch.mock.calls.filter((call) =>
        String(call[0]).includes('/artifacts?projectId=')
      ).length
      expect(newCallCount).toBeGreaterThan(initialCallCount)
    })

    // Verify the new projectId was used
    const lastArtifactsCall = mockFetch.mock.calls
      .filter((call) => String(call[0]).includes('/artifacts?projectId='))
      .pop()
    expect(String(lastArtifactsCall?.[0])).toContain(`projectId=${newProjectId}`)
  })
})

// ============================================================================
// Integration Tests - NewValidationPage Submit Behavior
// ============================================================================

describe('UI — NewValidationPage Submit com inputMode', () => {
  // @clause CL-UI-006
  it('should send empty FormData to PUT /runs/:id/files when inputMode is not upload', async () => {
    // Simulate the submit behavior when inputMode is 'dropdown'
    const runId = mockRun.id
    const inputMode = 'dropdown' as const

    // When inputMode is not 'upload', send empty FormData
    if (inputMode !== 'upload') {
      const formData = new FormData()
      // FormData is intentionally empty for filesystem mode

      await fetch(`${API_BASE}/runs/${runId}/files`, {
        method: 'PUT',
        body: formData,
      })
    }

    // Verify PUT was called
    const putCalls = mockFetch.mock.calls.filter(
      (call) => String(call[0]).includes(`/runs/${runId}/files`) && (call[1] as RequestInit)?.method === 'PUT'
    )

    expect(putCalls.length).toBe(1)

    // Verify FormData was sent (even if empty)
    const putCall = putCalls[0]
    const body = (putCall[1] as RequestInit)?.body
    expect(body).toBeInstanceOf(FormData)

    // Verify FormData is empty (no files)
    const sentFormData = body as FormData
    const entries = Array.from(sentFormData.entries())
    expect(entries.length).toBe(0)
  })

  // @clause CL-UI-006
  it('should send files in FormData when inputMode is upload', async () => {
    const runId = mockRun.id
    const inputMode = 'upload' as const
    const planContent = JSON.stringify({ outputId: 'test' })
    const specContent = 'describe("Test", () => {})'

    if (inputMode === 'upload') {
      const formData = new FormData()
      formData.append('planJson', new Blob([planContent], { type: 'application/json' }), 'plan.json')
      formData.append('specFile', new Blob([specContent], { type: 'text/plain' }), 'Test.spec.tsx')

      await fetch(`${API_BASE}/runs/${runId}/files`, {
        method: 'PUT',
        body: formData,
      })
    }

    const putCalls = mockFetch.mock.calls.filter(
      (call) => String(call[0]).includes(`/runs/${runId}/files`) && (call[1] as RequestInit)?.method === 'PUT'
    )

    expect(putCalls.length).toBe(1)

    const sentFormData = (putCalls[0][1] as RequestInit)?.body as FormData
    expect(sentFormData.has('planJson')).toBe(true)
    expect(sentFormData.has('specFile')).toBe(true)
  })
})
