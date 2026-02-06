Decompose the following task into atomic micro-plans.

<task_description>
{{TASK_DESCRIPTION}}
</task_description>

<project>
<project_path>{{PROJECT_PATH}}</project_path>
<project_id>{{PROJECT_ID}}</project_id>
</project>

<config>
<max_files_per_plan>{{MAX_FILES_PER_PLAN}}</max_files_per_plan>
<max_explorers>{{MAX_EXPLORERS}}</max_explorers>
<max_retries>{{MAX_RETRIES}}</max_retries>
<parallelism>{{PARALLELISM}}</parallelism>
</config>

<instructions>
1. Spawn Explorer sub-agents to understand the codebase structure, types, tests, and dependencies.
2. Wait for all explorer reports.
3. Decompose the task into micro-plans (≤ {{MAX_FILES_PER_PLAN}} files each).
4. Define contracts with testable clauses for each micro-plan.
5. Verify your decomposition against the <validation_checklist> in your system prompt.
6. Save the output as planner-output.json using save_artifact.
</instructions>

Begin by spawning explorers to gather context.
