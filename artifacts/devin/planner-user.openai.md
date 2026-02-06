# User Prompt — Planner Agent (OpenAI)

Decompose the following task into atomic micro-plans.

## Task Description

"""
{{TASK_DESCRIPTION}}
"""

## Project

"""
PROJECT_PATH: {{PROJECT_PATH}}
PROJECT_ID: {{PROJECT_ID}}
"""

## Configuration

"""
MAX_FILES_PER_PLAN: {{MAX_FILES_PER_PLAN}}
MAX_EXPLORERS: {{MAX_EXPLORERS}}
MAX_RETRIES: {{MAX_RETRIES}}
PARALLELISM: {{PARALLELISM}}
"""

---

## Instructions

1. Spawn Explorer sub-agents to understand the codebase structure, types, tests, and dependencies.
2. Wait for all explorer reports.
3. Decompose the task into micro-plans (≤ {{MAX_FILES_PER_PLAN}} files each).
4. Define contracts with testable clauses for each micro-plan.
5. Verify your decomposition against the validation checklist in your system prompt.
6. Save the output as `planner-output.json` using `save_artifact`.

Begin by spawning explorers to gather context.
