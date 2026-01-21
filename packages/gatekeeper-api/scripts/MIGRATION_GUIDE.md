# Migration Guide: Backfilling ProjectId for Existing Runs

This guide helps you migrate existing ValidationRuns to the new multi-workspace architecture.

## Overview

The multi-workspace architecture introduces the concept of Workspaces and Projects. Existing runs don't have a `projectId` assigned, which means they fall back to using global configurations.

This migration tool helps you:
1. Analyze existing runs without `projectId`
2. Create default workspace and project (if needed)
3. Backfill `projectId` on existing runs

## Prerequisites

- Make sure you've run the schema migrations: `npm run db:migrate`
- Make sure the database is seeded: `npm run db:seed`

## Migration Steps

### Step 1: Analyze Existing Runs

First, analyze your existing runs to see what needs to be migrated:

```bash
cd packages/gatekeeper-api
npm run migrate-runs -- analyze
```

This will show you:
- Total number of runs without `projectId`
- Runs grouped by `projectPath`
- Count and latest run for each group

**Example output:**
```
=== Analyzing Runs Without Project ===

Found 42 runs without projectId

Grouped by projectPath:
------------------------

C:\Projects\MyApp
  35 run(s)
  Latest: output_xyz123

C:\Projects\OtherApp
  7 run(s)
  Latest: output_abc456
```

### Step 2: Create Default Workspace and Project (Optional)

If you want to migrate all runs to a single default project:

```bash
npm run migrate-runs -- create-defaults
```

This will:
1. Create a workspace named "Default" (if it doesn't exist)
2. Create a project named "default" in that workspace
3. Prompt you for the root path and artifacts directory

**Example:**
```
=== Creating Default Workspace and Project ===

Enter root path for default workspace: C:\Projects
Enter artifacts directory [artifacts]: artifacts

✓ Created workspace: Default (clxyz123456)
✓ Created project: default (clxyz789012)

Default workspace and project ready for migration.
Project ID: clxyz789012
```

### Step 3: Backfill Runs

You have two options for backfilling:

#### Option A: Backfill All Runs to One Project

If you want to migrate all runs to the same project (e.g., the default project):

```bash
npm run migrate-runs -- backfill <projectId>
```

**Example:**
```bash
npm run migrate-runs -- backfill clxyz789012
```

This will:
1. Find all runs without `projectId`
2. Show you the target project
3. Ask for confirmation
4. Update all runs with the specified `projectId`

**Example output:**
```
=== Backfilling All Runs to Project clxyz789012 ===

Target: Default / default
Found 42 runs to migrate

Proceed with migration? (y/n): y

  Migrated 10/42...
  Migrated 20/42...
  Migrated 30/42...
  Migrated 40/42...

✓ Successfully migrated 42 runs to project clxyz789012
```

#### Option B: Interactive Backfill by ProjectPath

If you want to map different `projectPath` groups to different projects:

```bash
npm run migrate-runs -- backfill-by-path
```

This will:
1. Show you all available projects
2. For each `projectPath` group, ask which project to assign
3. Migrate runs accordingly

**Example:**
```
=== Interactive Migration by ProjectPath ===

Available Projects:
-------------------
1. Gatekeeper / gatekeeper (clxyz123456)
2. Default / default (clxyz789012)

For each projectPath group, select a target project:

ProjectPath: C:\Projects\MyApp
Runs: 35
Select project number (or "skip" to skip): 1
Migrating 35 runs to Gatekeeper / gatekeeper...
✓ Migrated 35 runs

ProjectPath: C:\Projects\OtherApp
Runs: 7
Select project number (or "skip" to skip): 2
Migrating 7 runs to Default / default...
✓ Migrated 7 runs

✓ Migration complete
```

## Verification

After migration, you can verify that runs have been assigned to projects:

1. Check in the database:
   ```bash
   npm run db:studio
   ```
   Navigate to `ValidationRun` and check the `projectId` column

2. Check in the UI:
   - Go to `/runs` in the frontend
   - You should now see the workspace/project names instead of just project paths

## Rollback

If you need to rollback the migration (remove `projectId` from runs):

```sql
-- In Prisma Studio or your database client:
UPDATE ValidationRun SET projectId = NULL WHERE projectId IS NOT NULL;
```

**Warning:** This will remove the project association from all runs.

## Best Practices

1. **Backup First**: Before running migration, backup your database
2. **Test in Dev**: Test the migration in a development environment first
3. **Analyze First**: Always run `analyze` before backfilling to understand what will be migrated
4. **Create Projects**: If using `backfill-by-path`, create the necessary projects first via the UI or seed script
5. **One-Time Operation**: This migration should only be run once after deploying the multi-workspace architecture

## Troubleshooting

### "Project not found" error
Make sure the project ID you're using exists. List projects with:
```bash
npm run db:studio
```
Navigate to `Project` table to see all available projects.

### "No runs to migrate"
If you see this message, it means all runs already have a `projectId` assigned. No action needed.

### Migration is slow
The migration processes runs sequentially for safety. For very large databases (>1000 runs), expect a few minutes of processing time.

## Questions?

Check the main project README or open an issue on GitHub.
