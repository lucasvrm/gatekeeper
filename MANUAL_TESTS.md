# Manual Tests - Multi-Workspace Architecture

## Prerequisites
- Backend server running: `cd packages/gatekeeper-api && npm start`
- Server should be at: http://localhost:3000

---

## 1. Health Check
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","timestamp":"..."}`

---

## 2. Workspace Endpoints

### List Workspaces
```bash
curl http://localhost:3000/api/workspaces
```
Expected: Should show default "Gatekeeper" workspace

### Get Specific Workspace
```bash
# Replace {workspaceId} with actual ID from list above
curl http://localhost:3000/api/workspaces/{workspaceId}
```

### Create New Workspace
```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workspace",
    "description": "Workspace for testing",
    "rootPath": "C:/Coding/test-project",
    "artifactsDir": "test-artifacts"
  }'
```
Expected: Returns created workspace with ID

### Update Workspace
```bash
# Replace {workspaceId} with actual ID
curl -X PUT http://localhost:3000/api/workspaces/{workspaceId} \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description",
    "artifactsDir": "new-artifacts"
  }'
```

### Delete Workspace
```bash
# Replace {workspaceId} with actual ID
curl -X DELETE http://localhost:3000/api/workspaces/{workspaceId}
```
Expected: 204 No Content

---

## 3. Project Endpoints

### List All Projects
```bash
curl http://localhost:3000/api/projects
```
Expected: Should show default "gatekeeper" project

### List Projects by Workspace
```bash
# Replace {workspaceId} with actual ID
curl "http://localhost:3000/api/projects?workspaceId={workspaceId}"
```

### Get Specific Project
```bash
# Replace {projectId} with actual ID
curl http://localhost:3000/api/projects/{projectId}
```

### Create New Project
```bash
# Replace {workspaceId} with actual workspace ID
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "{workspaceId}",
    "name": "test-project",
    "description": "Project for testing",
    "baseRef": "origin/main",
    "targetRef": "HEAD",
    "backendWorkspace": "packages/api"
  }'
```
Expected: Returns created project with ID

### Update Project
```bash
# Replace {projectId} with actual ID
curl -X PUT http://localhost:3000/api/projects/{projectId} \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated project description",
    "baseRef": "origin/develop"
  }'
```

### Delete Project
```bash
# Replace {projectId} with actual ID
curl -X DELETE http://localhost:3000/api/projects/{projectId}
```
Expected: 204 No Content

---

## 4. Workspace Config Endpoints

### Get Workspace Configs
```bash
# Replace {workspaceId} with actual ID
curl http://localhost:3000/api/workspaces/{workspaceId}/configs
```
Expected: Empty array initially (configs are optional)

### Create/Update Workspace Config
```bash
# Replace {workspaceId} with actual ID
curl -X PUT http://localhost:3000/api/workspaces/{workspaceId}/configs/MAX_TOKEN_BUDGET \
  -H "Content-Type: application/json" \
  -d '{
    "value": "150000",
    "type": "NUMBER",
    "category": "GATE0",
    "description": "Custom token budget for this workspace"
  }'
```
Expected: Returns created/updated config

### Delete Workspace Config
```bash
# Replace {workspaceId} with actual ID
curl -X DELETE http://localhost:3000/api/workspaces/{workspaceId}/configs/MAX_TOKEN_BUDGET
```
Expected: 204 No Content

---

## 5. ValidationRun with projectId (NEW!)

### Create Run WITHOUT projectId (Backward Compatibility)
```bash
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "outputId": "test_old_way",
    "taskPrompt": "Testing backward compatibility without projectId",
    "manifest": {
      "testFile": "test.spec.tsx",
      "files": [
        {"path": "src/test.tsx", "action": "CREATE"}
      ]
    },
    "baseRef": "origin/main",
    "targetRef": "HEAD",
    "runType": "CONTRACT"
  }'
```
Expected: Creates run using global configs (old behavior)

### Create Run WITH projectId (New Way)
```bash
# Replace {projectId} with actual project ID
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{projectId}",
    "outputId": "test_new_way",
    "taskPrompt": "Testing new project-based configuration",
    "manifest": {
      "testFile": "test.spec.tsx",
      "files": [
        {"path": "src/test.tsx", "action": "CREATE"}
      ]
    },
    "runType": "CONTRACT"
  }'
```
Expected: Creates run using project/workspace configs (baseRef, targetRef inherited from project)

### Get Run to Verify projectId
```bash
# Replace {runId} with actual run ID from above
curl http://localhost:3000/api/runs/{runId}/results
```
Expected: Run should have `projectId` field populated (or null for old way)

---

## 6. Edge Cases to Test

### Try to create project with duplicate name in same workspace
```bash
# Should FAIL with 400 error
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "{workspaceId}",
    "name": "gatekeeper",
    "description": "Duplicate name"
  }'
```
Expected: 400 Bad Request - "Project with this name already exists in this workspace"

### Try to create run with invalid projectId
```bash
# Should FAIL with 400 error
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "invalid-id",
    "outputId": "test_invalid",
    "taskPrompt": "Testing invalid projectId",
    "manifest": {
      "testFile": "test.spec.tsx",
      "files": [{"path": "src/test.tsx", "action": "CREATE"}]
    }
  }'
```
Expected: 400 Bad Request - "Project not found"

### Try to create run with inactive project
```bash
# First deactivate a project:
curl -X PUT http://localhost:3000/api/projects/{projectId} \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# Then try to create run with it:
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "{projectId}",
    "outputId": "test_inactive",
    "taskPrompt": "Testing inactive project",
    "manifest": {
      "testFile": "test.spec.tsx",
      "files": [{"path": "src/test.tsx", "action": "CREATE"}]
    }
  }'
```
Expected: 400 Bad Request - "Project is not active"

---

## 7. Database Verification

### Check database directly
```bash
cd packages/gatekeeper-api
npx prisma studio
```
Then verify in Prisma Studio:
- Workspace table has entries
- Project table has entries with correct workspaceId FK
- ValidationRun table has projectId FK (nullable)
- WorkspaceConfig table (if you created any configs)

---

## Test Checklist

- [ ] Server starts without errors
- [ ] Can list workspaces (shows default "Gatekeeper")
- [ ] Can list projects (shows default "gatekeeper")
- [ ] Can create new workspace
- [ ] Can create new project in workspace
- [ ] Can create run WITHOUT projectId (backward compatibility works)
- [ ] Can create run WITH projectId (inherits baseRef/targetRef from project)
- [ ] Workspace/project unique constraints work (duplicate names fail)
- [ ] Invalid projectId is rejected
- [ ] Inactive project is rejected for new runs
- [ ] Can create workspace configs
- [ ] Can update and delete workspaces/projects

---

## Notes

- **Backward Compatibility**: Runs created without `projectId` still work using global ValidationConfig
- **Project Inheritance**: When `projectId` is provided, run inherits `baseRef`, `targetRef`, `backendWorkspace` from Project, and `rootPath`, `artifactsDir` from Workspace
- **Global Configs**: Still used as fallback when projectId is not provided
- **Test Path Conventions**: Global conventions use `workspaceId = "__global__"` and still work for all runs
