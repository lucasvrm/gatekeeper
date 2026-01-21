/**
 * Migration Tool: Backfill projectId for existing ValidationRuns
 *
 * This script analyzes existing runs without projectId and helps migrate them
 * to the new multi-workspace architecture by:
 * 1. Grouping runs by projectPath
 * 2. Suggesting workspace/project creation
 * 3. Backfilling projectId on existing runs
 *
 * Usage:
 *   npm run migrate-runs -- analyze                    # Analyze existing runs
 *   npm run migrate-runs -- create-defaults            # Create default workspace/project
 *   npm run migrate-runs -- backfill <projectId>       # Backfill all runs to a project
 *   npm run migrate-runs -- backfill-by-path           # Interactive backfill by projectPath
 */

import { prisma } from '../src/db/client.js'
import readline from 'readline'

interface RunGroup {
  projectPath: string
  count: number
  runs: Array<{
    id: string
    outputId: string
    createdAt: Date
  }>
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function analyzeRuns(): Promise<RunGroup[]> {
  console.log('\n=== Analyzing Runs Without Project ===\n')

  const runs = await prisma.validationRun.findMany({
    where: {
      projectId: null,
    },
    select: {
      id: true,
      outputId: true,
      projectPath: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  console.log(`Found ${runs.length} runs without projectId`)

  // Group by projectPath
  const groups = new Map<string, RunGroup>()
  for (const run of runs) {
    const path = run.projectPath || 'unknown'
    if (!groups.has(path)) {
      groups.set(path, {
        projectPath: path,
        count: 0,
        runs: [],
      })
    }
    const group = groups.get(path)!
    group.count++
    group.runs.push({
      id: run.id,
      outputId: run.outputId,
      createdAt: run.createdAt,
    })
  }

  const groupsArray = Array.from(groups.values()).sort((a, b) => b.count - a.count)

  console.log('\nGrouped by projectPath:')
  console.log('------------------------')
  for (const group of groupsArray) {
    console.log(`\n${group.projectPath}`)
    console.log(`  ${group.count} run(s)`)
    console.log(`  Latest: ${group.runs[0]?.outputId || 'N/A'}`)
  }

  return groupsArray
}

async function createDefaults() {
  console.log('\n=== Creating Default Workspace and Project ===\n')

  // Check if default workspace exists
  let workspace = await prisma.workspace.findUnique({
    where: { name: 'Default' },
  })

  if (!workspace) {
    const rootPath = await question('Enter root path for default workspace: ')
    const artifactsDir = await question('Enter artifacts directory [artifacts]: ') || 'artifacts'

    workspace = await prisma.workspace.create({
      data: {
        name: 'Default',
        description: 'Default workspace for migrated runs',
        rootPath: rootPath.trim(),
        artifactsDir: artifactsDir.trim(),
      },
    })

    console.log(`✓ Created workspace: ${workspace.name} (${workspace.id})`)
  } else {
    console.log(`✓ Workspace "Default" already exists (${workspace.id})`)
  }

  // Check if default project exists
  let project = await prisma.project.findUnique({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'default',
      },
    },
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'default',
        description: 'Default project for migrated runs',
        baseRef: 'origin/main',
        targetRef: 'HEAD',
      },
    })

    console.log(`✓ Created project: ${project.name} (${project.id})`)
  } else {
    console.log(`✓ Project "default" already exists (${project.id})`)
  }

  console.log('\nDefault workspace and project ready for migration.')
  console.log(`Project ID: ${project.id}`)

  return project.id
}

async function backfillAllRuns(projectId: string) {
  console.log(`\n=== Backfilling All Runs to Project ${projectId} ===\n`)

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!project) {
    console.error(`Error: Project ${projectId} not found`)
    process.exit(1)
  }

  console.log(`Target: ${project.workspace.name} / ${project.name}`)

  const runs = await prisma.validationRun.findMany({
    where: {
      projectId: null,
    },
    select: {
      id: true,
    },
  })

  console.log(`Found ${runs.length} runs to migrate`)

  const confirm = await question(`\nProceed with migration? (y/n): `)
  const confirmLower = confirm.toLowerCase().trim()
  if (confirmLower !== 'y' && confirmLower !== 'yes') {
    console.log('Migration cancelled')
    return
  }

  let migrated = 0
  for (const run of runs) {
    await prisma.validationRun.update({
      where: { id: run.id },
      data: { projectId },
    })
    migrated++
    if (migrated % 10 === 0) {
      console.log(`  Migrated ${migrated}/${runs.length}...`)
    }
  }

  console.log(`\n✓ Successfully migrated ${migrated} runs to project ${projectId}`)
}

async function backfillByPath() {
  console.log('\n=== Interactive Migration by ProjectPath ===\n')

  const groups = await analyzeRuns()

  if (groups.length === 0) {
    console.log('No runs to migrate')
    return
  }

  // List available projects
  const projects = await prisma.project.findMany({
    include: {
      workspace: {
        select: {
          name: true,
        },
      },
    },
  })

  console.log('\n\nAvailable Projects:')
  console.log('-------------------')
  for (let i = 0; i < projects.length; i++) {
    console.log(`${i + 1}. ${projects[i].workspace.name} / ${projects[i].name} (${projects[i].id})`)
  }

  console.log('\n\nFor each projectPath group, select a target project:')

  for (const group of groups) {
    console.log(`\n\nProjectPath: ${group.projectPath}`)
    console.log(`Runs: ${group.count}`)

    const choice = await question('Select project number (or "skip" to skip): ')
    if (choice.toLowerCase() === 'skip') {
      console.log('Skipped')
      continue
    }

    const projectIndex = parseInt(choice) - 1
    if (projectIndex < 0 || projectIndex >= projects.length) {
      console.log('Invalid project number, skipping...')
      continue
    }

    const targetProject = projects[projectIndex]
    console.log(`Migrating ${group.count} runs to ${targetProject.workspace.name} / ${targetProject.name}...`)

    let migrated = 0
    for (const run of group.runs) {
      await prisma.validationRun.update({
        where: { id: run.id },
        data: { projectId: targetProject.id },
      })
      migrated++
    }

    console.log(`✓ Migrated ${migrated} runs`)
  }

  console.log('\n\n✓ Migration complete')
}

async function main() {
  const command = process.argv[2]
  const arg = process.argv[3]

  try {
    switch (command) {
      case 'analyze':
        await analyzeRuns()
        break

      case 'create-defaults':
        await createDefaults()
        break

      case 'backfill':
        if (!arg) {
          console.error('Error: projectId required for backfill command')
          console.log('Usage: npm run migrate-runs -- backfill <projectId>')
          process.exit(1)
        }
        await backfillAllRuns(arg)
        break

      case 'backfill-by-path':
        await backfillByPath()
        break

      default:
        console.log('Migration Tool: Backfill projectId for existing ValidationRuns')
        console.log('')
        console.log('Usage:')
        console.log('  npm run migrate-runs -- analyze                # Analyze existing runs')
        console.log('  npm run migrate-runs -- create-defaults        # Create default workspace/project')
        console.log('  npm run migrate-runs -- backfill <projectId>   # Backfill all runs to a project')
        console.log('  npm run migrate-runs -- backfill-by-path       # Interactive backfill by projectPath')
        process.exit(1)
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

main()
