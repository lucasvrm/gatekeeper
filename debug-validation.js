// Script de Debug para Validação Travada
// Execute: node debug-validation.js

import { PrismaClient } from './packages/gatekeeper-api/node_modules/@prisma/client/index.js'

const prisma = new PrismaClient()

async function debug() {
  console.log('\n🔍 DEBUG: Verificando validações travadas...\n')

  // 1. Buscar runs PENDING
  const pendingRuns = await prisma.validationRun.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      project: {
        include: { workspace: true }
      }
    }
  })

  console.log(`📊 Runs PENDING encontradas: ${pendingRuns.length}\n`)

  for (const run of pendingRuns) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📝 Run ID: ${run.id}`)
    console.log(`📅 Criado em: ${run.createdAt}`)
    console.log(`🏷️  Output ID: ${run.outputId}`)
    console.log(`🎯 Run Type: ${run.runType}`)
    console.log(`📂 Project Path: ${run.projectPath}`)
    console.log(`🧪 Test File Path: ${run.testFilePath || 'NULL'}`)
    console.log(`📋 Manifest JSON: ${run.manifestJson ? 'Presente' : 'NULL'}`)
    console.log(`📜 Contract JSON: ${run.contractJson ? 'Presente' : 'NULL'}`)

    if (run.project) {
      console.log(`\n🔧 Project Config:`)
      console.log(`   - Name: ${run.project.name}`)
      console.log(`   - Active: ${run.project.isActive}`)
      console.log(`   - Backend Workspace: ${run.project.backendWorkspace || 'N/A'}`)
      console.log(`   - Workspace Root: ${run.project.workspace.rootPath}`)
      console.log(`   - Artifacts Dir: ${run.project.workspace.artifactsDir}`)
    }

    // Verificar se há gates para esta run
    const gates = await prisma.gateResult.findMany({
      where: { runId: run.id },
      orderBy: { gateNumber: 'asc' }
    })

    console.log(`\n🚪 Gates executados: ${gates.length}`)
    if (gates.length > 0) {
      for (const gate of gates) {
        console.log(`   Gate ${gate.gateNumber}: ${gate.status} (${gate.gateName})`)
      }
    }

    // Verificar validadores
    const validators = await prisma.validatorResult.findMany({
      where: { runId: run.id },
      orderBy: { gateNumber: 'asc' }
    })

    console.log(`\n✅ Validadores executados: ${validators.length}`)
    if (validators.length > 0) {
      const last = validators[validators.length - 1]
      console.log(`   Último: ${last.validatorName} (${last.status})`)
    }
  }

  // 2. Buscar runs RUNNING (possível trava)
  const runningRuns = await prisma.validationRun.findMany({
    where: { status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
    take: 5
  })

  if (runningRuns.length > 0) {
    console.log(`\n\n⚠️  RUNS RUNNING (possivelmente travadas): ${runningRuns.length}\n`)

    for (const run of runningRuns) {
      const elapsed = run.startedAt
        ? Math.floor((Date.now() - run.startedAt.getTime()) / 1000)
        : 0

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`🔄 Run ID: ${run.id}`)
      console.log(`⏱️  Running por: ${elapsed}s`)
      console.log(`🚪 Current Gate: ${run.currentGate || 'NULL'}`)
      console.log(`📂 Project Path: ${run.projectPath}`)

      // Verificar último validador executado
      const lastValidator = await prisma.validatorResult.findFirst({
        where: { runId: run.id },
        orderBy: { startedAt: 'desc' }
      })

      if (lastValidator) {
        const validatorElapsed = lastValidator.startedAt
          ? Math.floor((Date.now() - lastValidator.startedAt.getTime()) / 1000)
          : 0

        console.log(`\n🔍 Último validador:`)
        console.log(`   - Nome: ${lastValidator.validatorName}`)
        console.log(`   - Status: ${lastValidator.status}`)
        console.log(`   - Gate: ${lastValidator.gateNumber}`)

        if (lastValidator.status === 'RUNNING') {
          console.log(`   ⚠️  TRAVADO por ${validatorElapsed}s!`)
        }
      }
    }
  }

  // 3. Estatísticas gerais
  const stats = await prisma.validationRun.groupBy({
    by: ['status'],
    _count: { status: true }
  })

  console.log(`\n\n📊 ESTATÍSTICAS GERAIS:\n`)
  for (const stat of stats) {
    console.log(`   ${stat.status}: ${stat._count.status}`)
  }

  await prisma.$disconnect()
}

debug().catch(console.error)
