Write a test file for the following micro-plan.

<micro_plan>

<task_prompt>
{{TASK_PROMPT}}
</task_prompt>

<manifest>
{{MANIFEST_JSON}}
</manifest>

<contract>
{{CONTRACT_JSON}}
</contract>

</micro_plan>

<project>
<project_path>{{PROJECT_PATH}}</project_path>
<test_file_path>{{TEST_FILE_PATH}}</test_file_path>
<test_file_name>{{TEST_FILE_NAME}}</test_file_name>
</project>

<instructions>
1. Read existing files if needed to understand types, conventions, and test framework.
2. Write a test file that covers ALL contract clauses.
3. Tag every it() block with // @clause matching the contract clause IDs.
4. Include at least one happy-path test and one sad-path test.
5. Import from files listed in the manifest with action=CREATE (they do not exist yet — this ensures TDD red phase).
6. Run the <self_check> checklist from your system prompt before saving.
7. Save the test file using save_artifact with filename {{TEST_FILE_NAME}}.
</instructions>

Begin by reading existing test files to understand the project's test conventions.
