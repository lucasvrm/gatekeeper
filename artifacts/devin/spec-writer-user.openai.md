# User Prompt — Spec Writer Agent (OpenAI)

Write a test file for the following micro-plan.

## Micro-Plan

### Task Prompt

"""
{{TASK_PROMPT}}
"""

### Manifest

"""
{{MANIFEST_JSON}}
"""

### Contract

"""
{{CONTRACT_JSON}}
"""

## Project

"""
PROJECT_PATH: {{PROJECT_PATH}}
TEST_FILE_PATH: {{TEST_FILE_PATH}}
TEST_FILE_NAME: {{TEST_FILE_NAME}}
"""

---

## Instructions

1. Read existing files if needed to understand types, conventions, and test framework.
2. Write a test file that covers ALL contract clauses.
3. Tag every `it()` block with `// @clause <ID>` matching the contract clause IDs.
4. Include at least one happy-path test and one sad-path test.
5. Import from files listed in the manifest with action=CREATE (they do not exist yet — this ensures TDD red phase).
6. Run the self-check from your system prompt before saving.
7. Save the test file using `save_artifact` with filename `{{TEST_FILE_NAME}}`.

Begin by reading existing test files to understand the project's test conventions.
