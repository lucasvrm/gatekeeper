import PQueue from 'p-queue'
import { prisma } from '../db/client.js'
import { GATES_CONFIG, CONTRACT_GATE_NUMBERS, EXECUTION_GATE_NUMBERS } from '../config/gates.config.js'
import type { ValidationContext, GateDefinition, ManifestInput } from '../types/index.js'
import { GitService } from './GitService.js'
import { ASTService } from './ASTService.js'
import { TestRunnerService } from './TestRunnerService.js'
import { CompilerService } from './CompilerService.js'
import { LintService } from './LintService.js'
import { BuildService } from './BuildService.js'
import { TokenCounterService } from './TokenCounterService.js'
import { LogService } from './LogService.js'
import type { ContractV1 } from '../types/contract.types.js'
import {
  createContractLogMetadata,
  isContractPayloadTooLarge,
} from '../utils/contract.utils.js'
import { ValidationRunRepository } from '../repositories/ValidationRunRepository.js'
import { GateResultRepository } from '../repositories/GateResultRepository.js'
import { ValidatorResultRepository } from '../repositories/ValidatorResultRepository.js'
import { RunEventService } from './RunEventService.js'
import type { ValidationRun } from '@prisma/client'
type ValidationRunWithContract = ValidationRun & { contractJson?: string | null }

export class ValidationOrchestrator {
  private queue: PQueue
  private runRepository: ValidationRunRepository
  private gateRepository: GateResultRepository
  private validatorRepository: ValidatorResultRepository

  constructor() {
    this.queue = new PQueue({ concurrency: 1 })
    this.runRepository = new ValidationRunRepository()
    this.gateRepository = new GateResultRepository()
    this.validatorRepository = new ValidatorResultRepository()
  }

  async executeRun(runId: string): Promise<void> {
    console.log('>>> executeRun CALLED with runId:', runId)
    const run = await this.runRepository.findById(runId)
    if (!run) {
      throw new Error(`Run ${runId} not found`)
    }

    await this.runRepository.update(runId, {
      status: 'RUNNING',
      startedAt: new Date(),
    })
    RunEventService.emitRunStatus(runId, 'RUNNING')

    const ctx = await this.buildContext(run)

    const allowedGates = run.runType === 'EXECUTION'
      ? EXECUTION_GATE_NUMBERS
      : CONTRACT_GATE_NUMBERS
    const gatesToRun = GATES_CONFIG.filter(g => allowedGates.includes(g.number))

    for (const gate of gatesToRun) {
      await this.runRepository.update(runId, {
        currentGate: gate.number,
      })

      const gateResult = await this.executeGate(runId, gate, ctx)

      if (!gateResult.passed) {
        await this.runRepository.update(runId, {
          status: 'FAILED',
          passed: false,
          failedAt: gate.number,
          failedValidatorCode: gateResult.failedValidatorCode || null,
          completedAt: new Date(),
        })
        RunEventService.emitRunStatus(runId, 'FAILED', {
          failedAt: gate.number,
          failedValidatorCode: gateResult.failedValidatorCode || null,
        })
        return
      }
    }

    await this.runRepository.update(runId, {
      status: 'PASSED',
      passed: true,
      completedAt: new Date(),
    })
    RunEventService.emitRunStatus(runId, 'PASSED')
  }

  private async executeGate(
    runId: string,
    gate: GateDefinition,
    ctx: ValidationContext
  ): Promise<{ passed: boolean; failedValidatorCode: string | null }> {
    const gateResult = await this.gateRepository.create({
      run: { connect: { id: runId } },
      gateNumber: gate.number,
      gateName: gate.name,
      status: 'RUNNING',
      startedAt: new Date(),
      totalValidators: gate.validators.length,
    })

    let passedCount = 0
    let failedCount = 0
    let warningCount = 0
    let skippedCount = 0
    let gatePassed = true
    let failedValidatorCode: string | null = null

    for (const validator of gate.validators) {
      const startTime = Date.now()
      
      try {
        const isActive = ctx.config.get(validator.code)
        if (isActive === 'false') {
          const duration = Date.now() - startTime
          await this.validatorRepository.create({
            run: { connect: { id: runId } },
            gateNumber: gate.number,
            validatorCode: validator.code,
            validatorName: validator.name,
            validatorOrder: validator.order,
            status: 'SKIPPED',
            passed: true,
            isHardBlock: validator.isHardBlock,
            message: 'Validator disabled',
            startedAt: new Date(startTime),
            completedAt: new Date(),
            durationMs: duration,
          })
          RunEventService.emitValidatorComplete(runId, gate.number, validator.code, 'SKIPPED', true)
          skippedCount++
          continue
        }

        const result = await validator.execute(ctx)
        const duration = Date.now() - startTime

        await this.validatorRepository.create({
          run: { connect: { id: runId } },
          gateNumber: gate.number,
          validatorCode: validator.code,
          validatorName: validator.name,
          validatorOrder: validator.order,
          status: result.status,
          passed: result.passed,
          isHardBlock: validator.isHardBlock,
          message: result.message,
          details: result.details ? JSON.stringify(result.details) : null,
          evidence: result.evidence || null,
          metrics: result.metrics ? JSON.stringify(result.metrics) : null,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          durationMs: duration,
        })
        RunEventService.emitValidatorComplete(runId, gate.number, validator.code, result.status, result.passed)

        switch (result.status) {
          case 'PASSED':
            passedCount++
            break
          case 'FAILED':
            failedCount++
            if (validator.isHardBlock) {
              gatePassed = false
              if (!failedValidatorCode) {
                failedValidatorCode = validator.code
              }
            }
            break
          case 'WARNING':
            warningCount++
            break
          case 'SKIPPED':
            skippedCount++
            break
        }

        if (!gatePassed && validator.isHardBlock) {
          break
        }
      } catch (error) {
        const duration = Date.now() - startTime
        
        await this.validatorRepository.create({
          run: { connect: { id: runId } },
          gateNumber: gate.number,
          validatorCode: validator.code,
          validatorName: validator.name,
          validatorOrder: validator.order,
          status: 'FAILED',
          passed: false,
          isHardBlock: validator.isHardBlock,
          message: `Validator execution error: ${error instanceof Error ? error.message : String(error)}`,
          durationMs: duration,
        })
        RunEventService.emitValidatorComplete(runId, gate.number, validator.code, 'FAILED', false)

        failedCount++
        if (validator.isHardBlock) {
          gatePassed = false
          if (!failedValidatorCode) {
            failedValidatorCode = validator.code
          }
          break
        }
      }
    }

    const completedAt = new Date()
    const durationMs = completedAt.getTime() - (gateResult.startedAt?.getTime() || 0)

    await this.gateRepository.update(gateResult.id, {
      status: gatePassed ? 'PASSED' : 'FAILED',
      passed: gatePassed,
      passedCount,
      failedCount,
      warningCount,
      skippedCount,
      completedAt,
      durationMs,
    })
    RunEventService.emitGateComplete(runId, gate.number, gatePassed, gate.name)

    return { passed: gatePassed, failedValidatorCode }
  }

  private async buildContext(run: ValidationRunWithContract): Promise<ValidationContext> {
    const config = await prisma.validationConfig.findMany()
    const configMap = new Map<string, string>()
    
    for (const item of config) {
      const value = item.value
      
      if (item.type === 'NUMBER') {
        const parsed = parseFloat(item.value)
        if (isNaN(parsed)) {
          console.warn(`Invalid number config for ${item.key}: ${item.value}, using as string`)
        }
      } else if (item.type === 'BOOLEAN') {
        if (item.value !== 'true' && item.value !== 'false') {
          console.warn(`Invalid boolean config for ${item.key}: ${item.value}, using as string`)
        }
      }
      
      configMap.set(item.key, value)
    }

    const sensitivePatterns = (
      await prisma.sensitiveFileRule.findMany({
        where: { isActive: true },
      })
    ).map((rule) => rule.pattern)

    const ambiguousTerms = (
      await prisma.ambiguousTerm.findMany({
        where: { isActive: true },
      })
    ).map((term) => term.term)

    let manifest: ManifestInput | null = null
    if (run.manifestJson) {
      try {
        manifest = JSON.parse(run.manifestJson)
      } catch (error) {
        console.error('Failed to parse manifest JSON:', error)
      }
    }

    let contract: ContractV1 | null = null
    let contractParseError: string | null = null
    if (run.contractJson) {
      if (isContractPayloadTooLarge(run.contractJson)) {
        contractParseError = 'Contract payload exceeds maximum allowed size'
      } else {
        try {
          contract = JSON.parse(run.contractJson) as ContractV1
        } catch (error) {
          contractParseError = error instanceof Error ? error.message : String(error)
        }
      }
    }

    const gitService = new GitService(run.projectPath)
    const astService = new ASTService()
    const testRunnerService = new TestRunnerService(run.projectPath)
    const compilerService = new CompilerService(run.projectPath)
    const lintService = new LintService(run.projectPath)
    const buildService = new BuildService(run.projectPath)
    const tokenCounterService = new TokenCounterService()
    const logService = new LogService(run.id, contract ? createContractLogMetadata(contract) : undefined)

    return {
      runId: run.id,
      projectPath: run.projectPath,
      baseRef: run.baseRef,
      targetRef: run.targetRef,
      taskPrompt: run.taskPrompt,
      manifest,
      testFilePath: run.testFilePath,
      dangerMode: run.dangerMode,
      services: {
        git: gitService,
        ast: astService,
        testRunner: testRunnerService,
        compiler: compilerService,
        lint: lintService,
        build: buildService,
        tokenCounter: tokenCounterService,
        log: logService,
      },
      config: configMap,
      sensitivePatterns,
      ambiguousTerms,
      contract: contract ?? undefined,
      contractJson: run.contractJson ?? undefined,
      contractParseError: contractParseError ?? undefined,
    }
  }

  addToQueue(runId: string): Promise<void> {
    return this.queue.add(() => this.executeRun(runId))
  }
}
