import type { GateDefinition } from '../types/index.js'

import { TokenBudgetFitValidator } from '../domain/validators/gate0/TokenBudgetFit.js'
import { TaskScopeSizeValidator } from '../domain/validators/gate0/TaskScopeSize.js'
import { TaskClarityCheckValidator } from '../domain/validators/gate0/TaskClarityCheck.js'
import { SensitiveFilesLockValidator } from '../domain/validators/gate0/SensitiveFilesLock.js'
import { DangerModeExplicitValidator } from '../domain/validators/gate0/DangerModeExplicit.js'

import { TestSyntaxValidValidator } from '../domain/validators/gate1/TestSyntaxValid.js'
import { TestHasAssertionsValidator } from '../domain/validators/gate1/TestHasAssertions.js'
import { TestCoversHappyAndSadPathValidator } from '../domain/validators/gate1/TestCoversHappyAndSadPath.js'
import { TestFailsBeforeImplementationValidator } from '../domain/validators/gate1/TestFailsBeforeImplementation.js'
import { NoDecorativeTestsValidator } from '../domain/validators/gate1/NoDecorativeTests.js'
import { ManifestFileLockValidator } from '../domain/validators/gate1/ManifestFileLock.js'
import { NoImplicitFilesValidator } from '../domain/validators/gate1/NoImplicitFiles.js'
import { ImportRealityCheckValidator } from '../domain/validators/gate1/ImportRealityCheck.js'
import { TestIntentAlignmentValidator } from '../domain/validators/gate1/TestIntentAlignment.js'

import { DiffScopeEnforcementValidator } from '../domain/validators/gate2/DiffScopeEnforcement.js'
import { TestReadOnlyEnforcementValidator } from '../domain/validators/gate2/TestReadOnlyEnforcement.js'
import { TaskTestPassesValidator } from '../domain/validators/gate2/TaskTestPasses.js'
import { StrictCompilationValidator } from '../domain/validators/gate2/StrictCompilation.js'
import { StyleConsistencyLintValidator } from '../domain/validators/gate2/StyleConsistencyLint.js'

import { FullRegressionPassValidator } from '../domain/validators/gate3/FullRegressionPass.js'
import { ProductionBuildPassValidator } from '../domain/validators/gate3/ProductionBuildPass.js'

export const GATES_CONFIG: GateDefinition[] = [
  {
    number: 0,
    name: 'SANITIZATION',
    emoji: '🧹',
    description: 'Validação de entrada e escopo',
    validators: [
      TokenBudgetFitValidator,
      TaskScopeSizeValidator,
      TaskClarityCheckValidator,
      SensitiveFilesLockValidator,
      DangerModeExplicitValidator,
    ],
  },
  {
    number: 1,
    name: 'CONTRACT',
    emoji: '📜',
    description: 'Validação de contrato e testes',
    validators: [
      TestSyntaxValidValidator,
      TestHasAssertionsValidator,
      TestCoversHappyAndSadPathValidator,
      TestFailsBeforeImplementationValidator,
      NoDecorativeTestsValidator,
      ManifestFileLockValidator,
      NoImplicitFilesValidator,
      ImportRealityCheckValidator,
      TestIntentAlignmentValidator,
    ],
  },
  {
    number: 2,
    name: 'EXECUTION',
    emoji: '⚙️',
    description: 'Validação de execução e compilação',
    validators: [
      DiffScopeEnforcementValidator,
      TestReadOnlyEnforcementValidator,
      TaskTestPassesValidator,
      StrictCompilationValidator,
      StyleConsistencyLintValidator,
    ],
  },
  {
    number: 3,
    name: 'INTEGRITY',
    emoji: '🏗️',
    description: 'Validação de integridade final',
    validators: [
      FullRegressionPassValidator,
      ProductionBuildPassValidator,
    ],
  },
]
