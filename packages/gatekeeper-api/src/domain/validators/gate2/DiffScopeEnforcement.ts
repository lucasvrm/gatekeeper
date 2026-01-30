import type { ValidatorDefinition, ValidationContext, ValidatorOutput, ValidatorContextFinding, ValidatorContextAnalyzedGroup } from '../../../types/index.js'

interface IncompleteFile {
  path: string
  subtype: string
  hint: string
}

export const DiffScopeEnforcementValidator: ValidatorDefinition = {
  code: 'DIFF_SCOPE_ENFORCEMENT',
  name: 'Diff Scope Enforcement',
  description: 'Verifica se diff está contido no manifesto e se manifest foi implementado',
  gate: 2,
  order: 1,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-DSE-001: No manifest provided
    if (!ctx.manifest) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'No manifest provided',
        context: {
          inputs: [{ label: 'Manifest', value: 'none' }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Manifest not provided' }],
          reasoning: 'Diff scope cannot be validated without a manifest.',
        },
        metrics: {
          implementationRate: '0%',
          scopeCreepCount: 0,
          incompleteCount: 0,
          overallHealth: 'POOR',
        },
      }
    }

    // CL-DSE-002: Empty manifest files
    if (!ctx.manifest.files || ctx.manifest.files.length === 0) {
      return {
        passed: false,
        status: 'FAILED',
        message: 'Manifest has no files declared',
        context: {
          inputs: [{ label: 'Manifest', value: ctx.manifest }],
          analyzed: [],
          findings: [{ type: 'fail', message: 'Manifest has no files declared' }],
          reasoning: 'Cannot validate scope without declared files.',
        },
        metrics: {
          implementationRate: '0%',
          scopeCreepCount: 0,
          incompleteCount: 0,
          overallHealth: 'POOR',
        },
      }
    }

    const useWorkingTree = ctx.config.get('DIFF_SCOPE_INCLUDE_WORKING_TREE') === 'true'
    const diffFiles = useWorkingTree
      ? await ctx.services.git.getDiffFilesWithWorkingTree(ctx.baseRef)
      : await ctx.services.git.getDiffFiles(ctx.baseRef, ctx.targetRef)
    const manifestPaths = new Set(ctx.manifest.files.map((f) => f.path))
    const testFile = ctx.manifest.testFile

    // CL-DSE-012, CL-DSE-041: Get ignored patterns from config
    const ignoredPatternsStr = ctx.config.get('DIFF_SCOPE_IGNORED_PATTERNS') || 'package-lock.json,yarn.lock,pnpm-lock.yaml'
    const ignoredPatterns = ignoredPatternsStr.split(',').map(p => p.trim())

    // CL-DSE-030, CL-DSE-031: Config for test-only diff
    const allowTestOnlyDiff = ctx.config.get('DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF') !== 'false'

    // CL-DSE-040: Config for incomplete fail mode
    const incompleteFailMode = ctx.config.get('DIFF_SCOPE_INCOMPLETE_FAIL_MODE') || 'HARD'

    // Filter diff files (remove ignored patterns)
    const filteredDiffFiles = diffFiles.filter(f => !ignoredPatterns.some(pattern => f.includes(pattern)))

    // CL-DSE-030/031: Test-only diff handling
    if (filteredDiffFiles.length === 1 && filteredDiffFiles[0] === testFile) {
      if (allowTestOnlyDiff) {
        return {
          passed: true,
          status: 'PASSED',
          message: 'Only test file modified',
          context: {
            inputs: [
              { label: 'Manifest', value: ctx.manifest },
              { label: 'BaseRef', value: ctx.baseRef },
              { label: 'TargetRef', value: ctx.targetRef },
            ],
            analyzed: [
              { label: 'Expected Files (from manifest)', items: ctx.manifest.files.map(f => `${f.action}: ${f.path}`) },
              { label: 'Actual Files (from diff)', items: filteredDiffFiles },
              { label: 'Missing Implementation', items: [] },
              { label: 'Undeclared Changes (scope creep)', items: [] },
              { label: 'Successfully Implemented', items: [] },
            ],
            findings: [{ type: 'pass', message: 'Only test file modified' }],
            reasoning: 'Only test file modified, allowed by configuration.',
          },
          metrics: {
            implementationRate: '0%',
            scopeCreepCount: 0,
            incompleteCount: 0,
            overallHealth: 'GOOD',
          },
        }
      } else {
        return {
          passed: false,
          status: 'FAILED',
          message: 'Only test file modified but DIFF_SCOPE_ALLOW_TEST_ONLY_DIFF is false',
          context: {
            inputs: [{ label: 'Manifest', value: ctx.manifest }],
            analyzed: [
              { label: 'Expected Files (from manifest)', items: ctx.manifest.files.map(f => `${f.action}: ${f.path}`) },
              { label: 'Actual Files (from diff)', items: filteredDiffFiles },
              { label: 'Missing Implementation', items: [] },
              { label: 'Undeclared Changes (scope creep)', items: [] },
              { label: 'Successfully Implemented', items: [] },
            ],
            findings: [{ type: 'fail', message: 'Test-only diff not allowed' }],
            reasoning: 'Test-only diff is disabled by configuration.',
          },
          metrics: {
            implementationRate: '0%',
            scopeCreepCount: 0,
            incompleteCount: 0,
            overallHealth: 'POOR',
          },
        }
      }
    }

    // CL-DSE-010, CL-DSE-011: Scope creep detection (diff → manifest)
    const scopeCreepFiles: string[] = []
    for (const diffFile of filteredDiffFiles) {
      // CL-DSE-011: testFile is not scope creep
      if (diffFile === testFile) continue
      // CL-DSE-010: Not in manifest = scope creep
      if (!manifestPaths.has(diffFile)) {
        scopeCreepFiles.push(diffFile)
      }
    }

    // CL-DSE-020 to CL-DSE-024: Incomplete implementation detection (manifest → diff)
    const diffFileSet = new Set(filteredDiffFiles)
    const incompleteFiles: IncompleteFile[] = []
    const implementedFiles: string[] = []

    for (const manifestFile of ctx.manifest.files) {
      const { path, action } = manifestFile
      const inDiff = diffFileSet.has(path)

      // Check file existence based on action
      let existsInBase = true
      let existsInTarget = true

      try {
        await ctx.services.git.readFile(path, ctx.baseRef)
      } catch {
        existsInBase = false
      }

      try {
        await ctx.services.git.readFile(path, ctx.targetRef)
      } catch {
        existsInTarget = false
      }

      let existsInWorkingTree = true
      if (useWorkingTree) {
        try {
          await ctx.services.git.readFile(path)
        } catch {
          existsInWorkingTree = false
        }
      }

      switch (action) {
        case 'CREATE':
          // CL-DSE-021: CREATE but file existed
          if (existsInBase) {
            incompleteFiles.push({
              path,
              subtype: 'CREATE_BUT_FILE_EXISTED',
              hint: 'File already exists. Change action to MODIFY OR delete first.',
            })
          }
          // CL-DSE-020: CREATE not created
          else if (!inDiff) {
            incompleteFiles.push({
              path,
              subtype: 'CREATE_NOT_CREATED',
              hint: 'Create the file OR remove from manifest.',
            })
          }
          // CL-DSE-051: CREATE fulfilled
          else {
            implementedFiles.push(path)
          }
          break

        case 'MODIFY':
          // CL-DSE-023: MODIFY but file not existed
          if (!existsInBase) {
            incompleteFiles.push({
              path,
              subtype: 'MODIFY_BUT_FILE_NOT_EXISTED',
              hint: 'File does not exist. Change action to CREATE.',
            })
          }
          // CL-DSE-022: MODIFY not modified
          else if (!inDiff) {
            incompleteFiles.push({
              path,
              subtype: 'MODIFY_NOT_MODIFIED',
              hint: 'Modify the file OR remove from manifest.',
            })
          }
          // CL-DSE-052: MODIFY fulfilled
          else {
            implementedFiles.push(path)
          }
          break

        case 'DELETE':
          // CL-DSE-024: DELETE not deleted
          if (useWorkingTree ? existsInWorkingTree : existsInTarget) {
            incompleteFiles.push({
              path,
              subtype: 'DELETE_NOT_DELETED',
              hint: 'Delete the file OR remove from manifest.',
            })
          }
          // CL-DSE-053: DELETE fulfilled
          else {
            implementedFiles.push(path)
          }
          break
      }
    }

    // CL-DSE-060: Metrics calculation
    const expectedCount = ctx.manifest.files.length
    const implementedCount = implementedFiles.length
    const implementationRate = expectedCount > 0
      ? `${Math.round((implementedCount / expectedCount) * 100)}%`
      : '100%'

    // CL-DSE-061: overallHealth calculation
    const rate = expectedCount > 0 ? (implementedCount / expectedCount) * 100 : 100
    let overallHealth: string
    if (rate === 100 && scopeCreepFiles.length === 0) {
      overallHealth = 'PERFECT'
    } else if (rate >= 80 && scopeCreepFiles.length === 0) {
      overallHealth = 'GOOD'
    } else if (rate >= 50) {
      overallHealth = 'PARTIAL'
    } else {
      overallHealth = 'POOR'
    }

    // CL-DSE-071: Build findings with hints
    const findings: ValidatorContextFinding[] = []

    for (const file of scopeCreepFiles) {
      findings.push({
        type: 'fail',
        message: `${file} not declared in manifest. Add to manifest OR revert changes.`,
        location: file,
      })
    }

    for (const { path, subtype, hint } of incompleteFiles) {
      findings.push({
        type: 'fail',
        message: `${path}: ${subtype}. ${hint}`,
        location: path,
      })
    }

    // CL-DSE-070: Context analyzed sections (5 required)
    const analyzed: ValidatorContextAnalyzedGroup[] = [
      { label: 'Expected Files (from manifest)', items: ctx.manifest.files.map(f => `${f.action}: ${f.path}`) },
      { label: 'Actual Files (from diff)', items: filteredDiffFiles },
      { label: 'Missing Implementation', items: incompleteFiles.map(f => `${f.path} (${f.subtype})`) },
      { label: 'Undeclared Changes (scope creep)', items: scopeCreepFiles },
      { label: 'Successfully Implemented', items: implementedFiles },
    ]

    const hasScopeCreep = scopeCreepFiles.length > 0
    const hasIncomplete = incompleteFiles.length > 0

    // CL-DSE-040: WARNING mode for incomplete (no scope creep)
    if (!hasScopeCreep && hasIncomplete && incompleteFailMode === 'WARNING') {
      return {
        passed: false,
        status: 'WARNING',
        message: `${incompleteFiles.length} manifest file(s) not implemented (warning mode)`,
        context: {
          inputs: [
            { label: 'Manifest', value: ctx.manifest },
            { label: 'BaseRef', value: ctx.baseRef },
            { label: 'TargetRef', value: ctx.targetRef },
          ],
          analyzed,
          findings,
          reasoning: `Implementation incomplete but scope creep is zero. Returning WARNING per config.`,
        },
        details: {
          scopeCreepCount: 0,
          incompleteCount: incompleteFiles.length,
          violations: scopeCreepFiles,
          incompleteFiles: incompleteFiles.map(f => f.path),
        },
        metrics: {
          implementationRate,
          scopeCreepCount: 0,
          incompleteCount: incompleteFiles.length,
          overallHealth,
        },
      }
    }

    // CL-DSE-010, CL-DSE-020-024: FAILED cases
    if (hasScopeCreep || hasIncomplete) {
      const messages: string[] = []
      if (hasScopeCreep) messages.push(`${scopeCreepFiles.length} file(s) modified outside manifest scope`)
      if (hasIncomplete) messages.push(`${incompleteFiles.length} manifest file(s) not implemented`)

      return {
        passed: false,
        status: 'FAILED',
        message: messages.join('; '),
        context: {
          inputs: [
            { label: 'Manifest', value: ctx.manifest },
            { label: 'BaseRef', value: ctx.baseRef },
            { label: 'TargetRef', value: ctx.targetRef },
          ],
          analyzed,
          findings,
          reasoning: `Scope validation failed. ${messages.join('. ')}.`,
        },
        details: {
          scopeCreepCount: scopeCreepFiles.length,
          incompleteCount: incompleteFiles.length,
          violations: scopeCreepFiles,
          incompleteFiles: incompleteFiles.map(f => f.path),
        },
        metrics: {
          implementationRate,
          scopeCreepCount: scopeCreepFiles.length,
          incompleteCount: incompleteFiles.length,
          overallHealth,
        },
      }
    }

    // CL-DSE-050, CL-DSE-080: All passed
    return {
      passed: true,
      status: 'PASSED',
      message: 'All diff files are declared in manifest and all manifest files implemented',
      context: {
        inputs: [
          { label: 'Manifest', value: ctx.manifest },
          { label: 'BaseRef', value: ctx.baseRef },
          { label: 'TargetRef', value: ctx.targetRef },
        ],
        analyzed,
        findings: [{ type: 'pass', message: 'All validations passed' }],
        reasoning: 'Every file in the diff is listed in the manifest and all actions fulfilled.',
      },
      metrics: {
        implementationRate,
        scopeCreepCount: 0,
        incompleteCount: 0,
        overallHealth,
      },
    }
  },
}
