/**
 * @fileoverview Test: DELETE_DEPENDENCY_CHECK Validator
 * @contract delete-dependency-check v1.0
 * @mode STRICT
 *
 * Este teste verifica o validador DELETE_DEPENDENCY_CHECK que previne
 * operações DELETE que deixariam imports órfãos no projeto.
 */

import { DeleteDependencyCheckValidator } from '../../../src/domain/validators/gate0/DeleteDependencyCheck.ts'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

console.log('=== TESTE: DeleteDependencyCheckValidator ===\n')

// Helper para criar estrutura de teste temporária
function createTestProject(files) {
  const testDir = resolve(tmpdir(), `gatekeeper-test-${Date.now()}`)
  mkdirSync(testDir, { recursive: true })

  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = resolve(testDir, filePath)
    const dir = join(fullPath, '..')
    mkdirSync(dir, { recursive: true })
    writeFileSync(fullPath, content)
  }

  return testDir
}

function cleanupTestProject(testDir) {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true })
  }
}

async function runTests() {
  let passed = 0
  let failed = 0
  let testDir = null

  try {
    // ---------------------------------------------------------------------------
    // INVARIANTS (CL-DEL-011, CL-DEL-012)
    // ---------------------------------------------------------------------------

    console.log('📋 Validator Definition Tests\n')

    // @clause CL-DEL-011
    console.log('  Test: isHardBlock is always true')
    if (DeleteDependencyCheckValidator.isHardBlock === true) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED: isHardBlock should be true')
      failed++
    }

    // @clause CL-DEL-012
    console.log('  Test: gate is always 0')
    if (DeleteDependencyCheckValidator.gate === 0) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED: gate should be 0')
      failed++
    }

    console.log('  Test: code is DELETE_DEPENDENCY_CHECK')
    if (DeleteDependencyCheckValidator.code === 'DELETE_DEPENDENCY_CHECK') {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED: code should be DELETE_DEPENDENCY_CHECK')
      failed++
    }

    // ---------------------------------------------------------------------------
    // SKIP SCENARIOS (CL-DEL-001)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Skip Scenarios (CL-DEL-001)\n')

    // @clause CL-DEL-001
    console.log('  Test: manifest is null returns SKIPPED')
    let result = await DeleteDependencyCheckValidator.execute({
      manifest: null,
      projectPath: '.'
    })
    if (result.passed === true && result.status === 'SKIPPED' && result.message.includes('No manifest')) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-001
    console.log('  Test: manifest is undefined returns SKIPPED')
    result = await DeleteDependencyCheckValidator.execute({
      manifest: undefined,
      projectPath: '.'
    })
    if (result.passed === true && result.status === 'SKIPPED' && result.message.includes('No manifest')) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-001
    console.log('  Test: manifest has no files property returns SKIPPED')
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {},
      projectPath: '.'
    })
    if (result.passed === true && result.status === 'SKIPPED' && result.message.includes('No manifest')) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // PASS SCENARIOS - NO DELETE (CL-DEL-002)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Pass Scenarios - No DELETE Operations (CL-DEL-002)\n')

    // @clause CL-DEL-002
    console.log('  Test: manifest has only CREATE actions')
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/new-file.ts', action: 'CREATE' }
        ]
      },
      projectPath: '.'
    })
    if (result.passed === true && result.status === 'PASSED' && result.message.includes('No DELETE operations')) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-002
    console.log('  Test: manifest has only MODIFY actions')
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/existing.ts', action: 'MODIFY' },
          { path: 'src/another.ts', action: 'MODIFY' }
        ]
      },
      projectPath: '.'
    })
    if (result.passed === true && result.status === 'PASSED' && result.message.includes('No DELETE operations')) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-002
    console.log('  Test: manifest files array is empty')
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: []
      },
      projectPath: '.'
    })
    if (result.passed === true && result.status === 'PASSED' && result.message.includes('No DELETE operations')) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // PASS SCENARIOS - DELETE WITHOUT IMPORTERS (CL-DEL-003)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Pass Scenarios - DELETE Without Importers (CL-DEL-003)\n')

    // @clause CL-DEL-003
    console.log('  Test: deleted file has no importers in project')
    testDir = createTestProject({
      'src/main.ts': 'import { foo } from "./other"',
      'src/other.ts': 'export const foo = 1',
      'src/lib/unused-legacy.ts': 'export const old = 2'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/unused-legacy.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (result.passed === true && result.status === 'PASSED') {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // PASS SCENARIOS - IMPORTERS COVERED BY MODIFY (CL-DEL-004)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Pass Scenarios - Importers Covered by MODIFY (CL-DEL-004)\n')

    // @clause CL-DEL-004
    console.log('  Test: all importers are in manifest with MODIFY action')
    testDir = createTestProject({
      'src/lib/legacy.ts': 'export const old = 1',
      'src/service.ts': 'import { old } from "./lib/legacy"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/legacy.ts', action: 'DELETE' },
          { path: 'src/service.ts', action: 'MODIFY' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (result.passed === true && result.status === 'PASSED' && result.message.includes('covered in manifest')) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // PASS SCENARIOS - IMPORTER ALSO DELETED (CL-DEL-005)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Pass Scenarios - Importer Also Deleted (CL-DEL-005)\n')

    // @clause CL-DEL-005
    console.log('  Test: importer is also marked for DELETE')
    testDir = createTestProject({
      'src/lib/legacy.ts': 'export const old = 1',
      'src/service.ts': 'import { old } from "./lib/legacy"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/legacy.ts', action: 'DELETE' },
          { path: 'src/service.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (result.passed === true && result.status === 'PASSED') {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // FAIL SCENARIOS - UNCOVERED IMPORTERS (CL-DEL-006)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Fail Scenarios - Uncovered Importers (CL-DEL-006)\n')

    // @clause CL-DEL-006
    console.log('  Test: one importer is not in manifest')
    testDir = createTestProject({
      'src/lib/legacy.ts': 'export const old = 1',
      'src/service.ts': 'import { old } from "./lib/legacy"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/legacy.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (
      result.passed === false &&
      result.status === 'FAILED' &&
      result.message.includes('importing deleted files but not in manifest') &&
      Array.isArray(result.details?.orphanedImports) &&
      result.details.orphanedImports.length > 0 &&
      Array.isArray(result.details?.suggestions) &&
      result.details.suggestions.length > 0
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-006
    console.log('  Test: multiple importers are not in manifest')
    testDir = createTestProject({
      'src/lib/legacy.ts': 'export const old = 1',
      'src/service.ts': 'import { old } from "./lib/legacy"',
      'src/component.tsx': 'import { old } from "./lib/legacy"',
      'src/utils.ts': 'import { old } from "./lib/legacy"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/legacy.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (
      result.passed === false &&
      result.status === 'FAILED' &&
      result.details?.orphanedImports?.[0]?.importers?.length === 3 &&
      result.details?.suggestions?.length === 3
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // IMPORT DETECTION - RELATIVE PATHS (CL-DEL-007)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Import Detection - Relative Paths (CL-DEL-007)\n')

    // @clause CL-DEL-007
    console.log('  Test: detecting import with ./ relative path')
    testDir = createTestProject({
      'src/lib/deleted.ts': 'export const foo = 1',
      'src/lib/consumer.ts': 'import { foo } from "./deleted"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/deleted.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (
      result.passed === false &&
      result.status === 'FAILED' &&
      result.details?.orphanedImports?.[0]?.importers?.includes('src/lib/consumer.ts')
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-007
    console.log('  Test: detecting import with ../ relative path')
    testDir = createTestProject({
      'src/lib/deleted.ts': 'export const foo = 1',
      'src/features/consumer.ts': 'import { foo } from "../lib/deleted"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/deleted.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (
      result.passed === false &&
      result.status === 'FAILED' &&
      result.details?.orphanedImports?.[0]?.importers?.includes('src/features/consumer.ts')
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // IMPORT DETECTION - ALIAS @/ (CL-DEL-008)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Import Detection - Alias @/ (CL-DEL-008)\n')

    // @clause CL-DEL-008
    console.log('  Test: detecting import with @/ alias resolving to src/')
    testDir = createTestProject({
      'src/lib/deleted.ts': 'export const foo = 1',
      'src/features/consumer.ts': 'import { foo } from "@/lib/deleted"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/deleted.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (
      result.passed === false &&
      result.status === 'FAILED' &&
      result.details?.orphanedImports?.[0]?.importers?.includes('src/features/consumer.ts')
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-008
    console.log('  Test: @/ alias is resolved and importer is covered')
    testDir = createTestProject({
      'src/lib/deleted.ts': 'export const foo = 1',
      'src/features/consumer.ts': 'import { foo } from "@/lib/deleted"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/deleted.ts', action: 'DELETE' },
          { path: 'src/features/consumer.ts', action: 'MODIFY' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (result.passed === true && result.status === 'PASSED') {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // SUGGESTIONS FORMAT (CL-DEL-009)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Suggestions Format (CL-DEL-009)\n')

    // @clause CL-DEL-009
    console.log('  Test: suggestions have correct path and action MODIFY')
    testDir = createTestProject({
      'src/lib/legacy.ts': 'export const old = 1',
      'src/service.ts': 'import { old } from "./lib/legacy"',
      'src/component.tsx': 'import { old } from "./lib/legacy"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/legacy.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)

    let suggestionsValid = true
    if (Array.isArray(result.details?.suggestions)) {
      for (const suggestion of result.details.suggestions) {
        if (typeof suggestion.path !== 'string' || suggestion.path.length === 0 || suggestion.action !== 'MODIFY') {
          suggestionsValid = false
          break
        }
      }
    } else {
      suggestionsValid = false
    }

    if (result.passed === false && suggestionsValid) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // EVIDENCE FORMAT (CL-DEL-010)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Evidence Format (CL-DEL-010)\n')

    // @clause CL-DEL-010
    console.log('  Test: evidence contains DELETE:, Imported by, Suggested additions')
    testDir = createTestProject({
      'src/lib/legacy.ts': 'export const old = 1',
      'src/service.ts': 'import { old } from "./lib/legacy"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/legacy.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (
      result.passed === false &&
      result.evidence?.includes('DELETE:') &&
      result.evidence?.includes('Imported by') &&
      result.evidence?.includes('Suggested additions')
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // CONTEXT STRUCTURE (CL-DEL-013)
    // ---------------------------------------------------------------------------

    console.log('\n📋 Context Structure (CL-DEL-013)\n')

    // @clause CL-DEL-013
    console.log('  Test: SKIPPED output contains structured context')
    result = await DeleteDependencyCheckValidator.execute({
      manifest: null,
      projectPath: '.'
    })
    if (
      result.context &&
      Array.isArray(result.context.inputs) &&
      Array.isArray(result.context.analyzed) &&
      Array.isArray(result.context.findings) &&
      typeof result.context.reasoning === 'string'
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-013
    console.log('  Test: PASSED output contains structured context')
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/new.ts', action: 'CREATE' }
        ]
      },
      projectPath: '.'
    })
    if (
      result.context &&
      Array.isArray(result.context.inputs) &&
      Array.isArray(result.context.analyzed) &&
      Array.isArray(result.context.findings) &&
      typeof result.context.reasoning === 'string'
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // @clause CL-DEL-013
    console.log('  Test: FAILED output contains structured context with findings')
    testDir = createTestProject({
      'src/lib/legacy.ts': 'export const old = 1',
      'src/service.ts': 'import { old } from "./lib/legacy"'
    })
    result = await DeleteDependencyCheckValidator.execute({
      manifest: {
        files: [
          { path: 'src/lib/legacy.ts', action: 'DELETE' }
        ]
      },
      projectPath: testDir
    })
    cleanupTestProject(testDir)
    if (
      result.passed === false &&
      result.context &&
      Array.isArray(result.context.inputs) &&
      result.context.inputs.length > 0 &&
      Array.isArray(result.context.analyzed) &&
      result.context.analyzed.length > 0 &&
      Array.isArray(result.context.findings) &&
      result.context.findings.length > 0 &&
      typeof result.context.reasoning === 'string' &&
      result.context.reasoning.length > 0
    ) {
      console.log('    ✅ PASSED')
      passed++
    } else {
      console.log('    ❌ FAILED:', result)
      failed++
    }

    // ---------------------------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------------------------

    console.log('\n' + '='.repeat(50))
    console.log(`SUMMARY: ${passed} passed, ${failed} failed`)
    console.log('='.repeat(50))

    if (failed > 0) {
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
    if (testDir) cleanupTestProject(testDir)
    process.exit(1)
  }
}

runTests()
