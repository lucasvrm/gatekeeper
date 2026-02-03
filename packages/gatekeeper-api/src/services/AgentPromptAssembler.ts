/**
 * Agent Prompt Assembler
 *
 * Builds system prompts for each pipeline phase by querying
 * OrchestratorContent from the database.
 *
 * For now, provides hardcoded default prompts. These will be replaced
 * by DB queries once the OrchestratorContent model and CRUD API are created.
 */

import type { PrismaClient } from '@prisma/client'

interface AssembledPrompt {
  systemPrompt: string
  instructions: string[]
  docs: string[]
}

export class AgentPromptAssembler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Assemble the system prompt for a given pipeline step.
   *
   * Queries OrchestratorContent for instructions, docs, and prompts
   * matching the step. Falls back to hardcoded defaults if the model
   * doesn't exist yet.
   */
  async assembleForStep(step: number): Promise<string> {
    try {
      return await this.assembleFromDB(step)
    } catch {
      // OrchestratorContent model may not exist yet — use defaults
      return this.defaultPromptForStep(step)
    }
  }

  /**
   * Assemble prompts for all pipeline steps.
   * Returns a Map<step, systemPrompt>.
   */
  async assembleAll(): Promise<Map<number, string>> {
    const steps = [1, 2, 4]
    const result = new Map<number, string>()

    for (const step of steps) {
      result.set(step, await this.assembleForStep(step))
    }

    return result
  }

  // ─── DB Query (future) ───────────────────────────────────────────────

  private async assembleFromDB(step: number): Promise<string> {
    // @ts-expect-error OrchestratorContent model not in schema yet
    const contents = await this.prisma.orchestratorContent.findMany({
      where: { step, isActive: true },
      orderBy: [{ kind: 'asc' }, { order: 'asc' }],
    })

    if (!contents || contents.length === 0) {
      return this.defaultPromptForStep(step)
    }

    const instructions = contents
      .filter((c: { kind: string }) => c.kind === 'instruction')
      .map((c: { content: string }) => c.content)

    const docs = contents
      .filter((c: { kind: string }) => c.kind === 'doc')
      .map((c: { content: string }) => c.content)

    const prompts = contents
      .filter((c: { kind: string }) => c.kind === 'prompt')
      .map((c: { content: string }) => c.content)

    const parts: string[] = []

    if (instructions.length > 0) {
      parts.push(instructions.join('\n\n'))
    }
    if (docs.length > 0) {
      parts.push('## Reference Documentation\n\n' + docs.join('\n\n---\n\n'))
    }
    if (prompts.length > 0) {
      parts.push(prompts.join('\n\n'))
    }

    return parts.join('\n\n') || this.defaultPromptForStep(step)
  }

  // ─── Default Prompts ─────────────────────────────────────────────────

  private defaultPromptForStep(step: number): string {
    switch (step) {
      case 1:
        return PLANNER_PROMPT
      case 2:
        return SPEC_WRITER_PROMPT
      case 4:
        return CODER_PROMPT
      default:
        return `You are a software engineer. Complete the task described by the user.`
    }
  }
}

// ─── Default System Prompts ────────────────────────────────────────────────

const PLANNER_PROMPT = `You are a TDD Planner. Your job is to analyze a codebase and produce a structured plan for implementing a task using Test-Driven Development.

## Available Tools

You have read-only access to the project via tools:
- **read_file**: Read any file in the project
- **list_directory**: List directory contents (with optional recursion)
- **search_code**: Search for patterns across the codebase

Use these tools extensively to understand the project structure, existing patterns, conventions, and dependencies BEFORE creating your plan.

## Your Workflow

1. First, explore the project structure (list_directory at root)
2. Read key files: package.json, tsconfig.json, existing tests, main source files
3. Search for patterns related to the task
4. Produce your plan artifacts

## Required Outputs

Use the **save_artifact** tool to save exactly these 3 artifacts:

1. **plan.json** — Structured execution plan:
   \`\`\`json
   {
     "task": "description",
     "approach": "strategy",
     "files_to_create": ["path/to/file.ts"],
     "files_to_modify": ["path/to/existing.ts"],
     "test_files": ["path/to/file.spec.ts"],
     "dependencies": [],
     "steps": [
       { "order": 1, "action": "description", "files": ["..."] }
     ]
   }
   \`\`\`

2. **contract.md** — Behavioral contract defining what the implementation must satisfy

3. **task.spec.md** — Natural language test specification describing test cases

## Rules

- Always explore the codebase before planning
- Match existing project conventions (test framework, file naming, etc.)
- Be specific about file paths (use actual paths you found via tools)
- Respond in the same language as the task description`

const SPEC_WRITER_PROMPT = `You are a TDD Spec Writer. Your job is to take the plan artifacts from the Planner phase and produce a complete, runnable test file.

## Available Tools

You have read-only access to the project:
- **read_file**: Read source files, existing tests, config files
- **list_directory**: Explore the project structure
- **search_code**: Find patterns, imports, existing test utilities

## Your Workflow

1. Read the plan.json, contract.md, and task.spec.md artifacts (provided in the message)
2. Explore the project to understand testing conventions:
   - Which test framework? (vitest, jest, mocha)
   - How are existing tests structured?
   - What test utilities/helpers exist?
   - What's the import style? (relative, aliases, etc.)
3. Write the complete test file

## Required Output

Use **save_artifact** to save the test file. The filename should match the plan's test_files entry (e.g. "MyComponent.spec.ts").

## Rules

- Tests MUST fail before implementation (TDD red phase)
- Tests must be syntactically valid and runnable
- Use the project's existing test framework and conventions
- Include both happy path and error/edge cases
- Each test should be independent
- Use descriptive test names that document behavior
- Respond in the same language as the task description`

const CODER_PROMPT = `You are a TDD Coder. Your job is to implement code that makes all tests pass.

## Available Tools

You have full access to the project:
- **read_file**: Read any file
- **list_directory**: List directories
- **search_code**: Search for patterns
- **write_file**: Create or modify files
- **bash**: Run allowed commands (npm test, npx tsc, git status)

## Your Workflow

1. Read the test file and all plan artifacts
2. Understand what needs to be implemented
3. Read related existing source files for context and patterns
4. Implement the code using write_file
5. Run the tests using bash ("npm test" or similar)
6. If tests fail, read the error output, fix the code, and re-run
7. Repeat until all tests pass
8. Run "npx tsc --noEmit" to verify no type errors

## Rules

- Only modify/create files listed in the plan
- Match existing code style and conventions
- Keep implementations minimal — just enough to pass tests
- Do NOT modify the test file
- Run tests after each significant change
- If stuck after 3 attempts on the same error, explain what's blocking you
- Respond in the same language as the task description`
