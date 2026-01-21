# Testing Guide - Multi-Workspace Architecture

## Quick Start

### 1. Start the Backend Server

```bash
cd packages/gatekeeper-api
npm start
```

Server should start at: http://localhost:3000

### 2. Run Automated Test Script

**Option A: Using bash (Git Bash on Windows or Linux/Mac)**
```bash
bash test-workspace-api.sh
```

This script will automatically:
- ✅ List existing workspaces and projects
- ✅ Create new workspace and project
- ✅ Test workspace configs
- ✅ Create runs with and without projectId
- ✅ Test validation (duplicates, inactive projects)
- ✅ Cleanup all test data

**Option B: Manual testing with curl**

See `MANUAL_TESTS.md` for detailed curl commands and test cases.

**Option C: Using Postman or Insomnia**

Import the following base URL and test endpoints manually:
- Base URL: `http://localhost:3000/api`
- See `MANUAL_TESTS.md` for endpoint documentation

### 3. Inspect Database (Optional)

```bash
cd packages/gatekeeper-api
npx prisma studio
```

This opens a visual database browser where you can:
- See Workspace and Project tables
- Verify FK relationships
- Check ValidationRun.projectId
- Inspect WorkspaceConfig entries

---

## What to Test

### Core Functionality
1. **Workspace CRUD** - Create, read, update, delete workspaces
2. **Project CRUD** - Create, read, update, delete projects
3. **Workspace Configs** - Custom configs per workspace
4. **Project-based Runs** - Create runs with projectId
5. **Backward Compatibility** - Create runs without projectId (old way still works)

### Validation & Edge Cases
6. **Unique Constraints** - Duplicate workspace/project names should fail
7. **FK Validation** - Invalid projectId should be rejected
8. **Active Status** - Inactive projects should reject new runs
9. **Config Inheritance** - Runs with projectId should inherit baseRef/targetRef from project

### Expected Results
- ✅ All CRUD operations work
- ✅ Runs can be created both with and without projectId
- ✅ Workspace configs override global defaults
- ✅ Validation prevents invalid data
- ✅ No existing functionality is broken

---

## Test Checklist

After running tests, verify:

- [ ] Server starts without errors
- [ ] Default workspace "Gatekeeper" exists
- [ ] Default project "gatekeeper" exists
- [ ] Can create new workspace
- [ ] Can create new project in workspace
- [ ] Can create workspace configs
- [ ] Can create run WITHOUT projectId (backward compatibility)
- [ ] Can create run WITH projectId (new behavior)
- [ ] Run with projectId inherits project settings
- [ ] Duplicate names are rejected
- [ ] Invalid projectId is rejected
- [ ] Inactive project is rejected for new runs
- [ ] Can update and delete workspaces/projects
- [ ] Database FK relationships are correct

---

## Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID <PID> /F

# Or use different port in .env
PORT=3001
```

### Database issues
```bash
# Reset database
cd packages/gatekeeper-api
rm -f prisma/dev.db
npx prisma migrate dev
npx prisma db seed
```

### Test script fails
```bash
# Make sure jq is installed (for JSON parsing)
# Windows: choco install jq
# Mac: brew install jq
# Linux: sudo apt-get install jq

# Or run manual tests from MANUAL_TESTS.md instead
```

---

## Files Created for Testing

- `MANUAL_TESTS.md` - Detailed curl commands and test cases
- `test-workspace-api.sh` - Automated test script
- `README_TESTING.md` - This file

---

## Next Steps

After manual testing is complete and you're satisfied:
1. Report any issues found
2. Proceed with **Phase 3** - Frontend UI
3. Then **Phase 4** - Migration Tool
4. Finally - Automated Tests
