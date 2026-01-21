# Test script for Multi-Workspace Architecture API
# Usage: .\test-workspace-api.ps1

$BaseUrl = "http://localhost:3000/api"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Multi-Workspace Architecture API Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: List Workspaces
Write-Host "[TEST 1] Listing workspaces..." -ForegroundColor Yellow
$workspaces = Invoke-RestMethod -Uri "$BaseUrl/workspaces" -Method Get
$workspaces.data | ConvertTo-Json -Depth 5
$workspaceId = $workspaces.data[0].id
Write-Host "✓ Workspace ID: $workspaceId" -ForegroundColor Green
Write-Host ""

# Test 2: List Projects
Write-Host "[TEST 2] Listing projects..." -ForegroundColor Yellow
$projects = Invoke-RestMethod -Uri "$BaseUrl/projects" -Method Get
$projects.data | ConvertTo-Json -Depth 5
$projectId = $projects.data[0].id
Write-Host "✓ Project ID: $projectId" -ForegroundColor Green
Write-Host ""

# Test 3: Get Specific Workspace
Write-Host "[TEST 3] Getting workspace details..." -ForegroundColor Yellow
$workspace = Invoke-RestMethod -Uri "$BaseUrl/workspaces/$workspaceId" -Method Get
$workspace | ConvertTo-Json -Depth 5
Write-Host ""

# Test 4: Get Specific Project
Write-Host "[TEST 4] Getting project details..." -ForegroundColor Yellow
$project = Invoke-RestMethod -Uri "$BaseUrl/projects/$projectId" -Method Get
$project | ConvertTo-Json -Depth 5
Write-Host ""

# Test 5: Create New Workspace
Write-Host "[TEST 5] Creating new workspace..." -ForegroundColor Yellow
$newWorkspaceBody = @{
    name = "Test Workspace"
    description = "Created by PowerShell test script"
    rootPath = "C:/Coding/test"
    artifactsDir = "artifacts"
} | ConvertTo-Json

$newWorkspace = Invoke-RestMethod -Uri "$BaseUrl/workspaces" -Method Post -Body $newWorkspaceBody -ContentType "application/json"
$newWorkspace | ConvertTo-Json -Depth 5
$newWorkspaceId = $newWorkspace.id
Write-Host "✓ New Workspace ID: $newWorkspaceId" -ForegroundColor Green
Write-Host ""

# Test 6: Create New Project
Write-Host "[TEST 6] Creating new project in new workspace..." -ForegroundColor Yellow
$newProjectBody = @{
    workspaceId = $newWorkspaceId
    name = "test-project"
    description = "Created by PowerShell test script"
    baseRef = "origin/main"
    targetRef = "HEAD"
} | ConvertTo-Json

$newProject = Invoke-RestMethod -Uri "$BaseUrl/projects" -Method Post -Body $newProjectBody -ContentType "application/json"
$newProject | ConvertTo-Json -Depth 5
$newProjectId = $newProject.id
Write-Host "✓ New Project ID: $newProjectId" -ForegroundColor Green
Write-Host ""

# Test 7: Create Workspace Config
Write-Host "[TEST 7] Creating workspace config..." -ForegroundColor Yellow
$configBody = @{
    value = "150000"
    type = "NUMBER"
    category = "GATE0"
    description = "Custom budget for test workspace"
} | ConvertTo-Json

$config = Invoke-RestMethod -Uri "$BaseUrl/workspaces/$newWorkspaceId/configs/MAX_TOKEN_BUDGET" -Method Put -Body $configBody -ContentType "application/json"
$config | ConvertTo-Json -Depth 5
Write-Host ""

# Test 8: Get Workspace Configs
Write-Host "[TEST 8] Getting workspace configs..." -ForegroundColor Yellow
$configs = Invoke-RestMethod -Uri "$BaseUrl/workspaces/$newWorkspaceId/configs" -Method Get
$configs | ConvertTo-Json -Depth 5
Write-Host ""

# Test 9: Create Run WITHOUT projectId (old way)
Write-Host "[TEST 9] Creating run WITHOUT projectId (backward compatibility)..." -ForegroundColor Yellow
$runOldBody = @{
    outputId = "test_old_way"
    taskPrompt = "Testing backward compatibility without projectId in PowerShell script"
    manifest = @{
        testFile = "test.spec.tsx"
        files = @(
            @{
                path = "src/test.tsx"
                action = "CREATE"
            }
        )
    }
    baseRef = "origin/main"
    targetRef = "HEAD"
    runType = "CONTRACT"
} | ConvertTo-Json -Depth 5

$runOld = Invoke-RestMethod -Uri "$BaseUrl/runs" -Method Post -Body $runOldBody -ContentType "application/json"
$runOld | ConvertTo-Json -Depth 5
$runOldId = $runOld.runId
Write-Host "✓ Run ID (old way): $runOldId" -ForegroundColor Green
Write-Host ""

# Test 10: Create Run WITH projectId (new way)
Write-Host "[TEST 10] Creating run WITH projectId (new way)..." -ForegroundColor Yellow
$runNewBody = @{
    projectId = $newProjectId
    outputId = "test_new_way"
    taskPrompt = "Testing project-based configuration in PowerShell script"
    manifest = @{
        testFile = "test.spec.tsx"
        files = @(
            @{
                path = "src/test.tsx"
                action = "CREATE"
            }
        )
    }
    runType = "CONTRACT"
} | ConvertTo-Json -Depth 5

$runNew = Invoke-RestMethod -Uri "$BaseUrl/runs" -Method Post -Body $runNewBody -ContentType "application/json"
$runNew | ConvertTo-Json -Depth 5
$runNewId = $runNew.runId
Write-Host "✓ Run ID (new way): $runNewId" -ForegroundColor Green
Write-Host ""

# Test 11: Verify Run with projectId
Write-Host "[TEST 11] Verifying run has projectId..." -ForegroundColor Yellow
$runDetails = Invoke-RestMethod -Uri "$BaseUrl/runs/$runNewId/results" -Method Get
$runDetails | Select-Object id, projectId, outputId, baseRef, targetRef | ConvertTo-Json -Depth 5
Write-Host ""

# Test 12: Try duplicate project name (should fail)
Write-Host "[TEST 12] Testing duplicate project name (should fail)..." -ForegroundColor Yellow
try {
    $duplicateBody = @{
        workspaceId = $newWorkspaceId
        name = "test-project"
        description = "This should fail"
    } | ConvertTo-Json

    $duplicate = Invoke-RestMethod -Uri "$BaseUrl/projects" -Method Post -Body $duplicateBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "✗ Duplicate name was NOT rejected!" -ForegroundColor Red
    $duplicate | ConvertTo-Json -Depth 5
} catch {
    Write-Host "✓ Duplicate name rejected as expected" -ForegroundColor Green
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    $errorResponse | ConvertTo-Json -Depth 5
}
Write-Host ""

# Test 13: Update Project
Write-Host "[TEST 13] Updating project..." -ForegroundColor Yellow
$updateBody = @{
    description = "Updated by PowerShell test script"
    baseRef = "origin/develop"
} | ConvertTo-Json

$updated = Invoke-RestMethod -Uri "$BaseUrl/projects/$newProjectId" -Method Put -Body $updateBody -ContentType "application/json"
$updated | ConvertTo-Json -Depth 5
Write-Host ""

# Test 14: Deactivate Project
Write-Host "[TEST 14] Deactivating project..." -ForegroundColor Yellow
$deactivateBody = @{
    isActive = $false
} | ConvertTo-Json

$deactivated = Invoke-RestMethod -Uri "$BaseUrl/projects/$newProjectId" -Method Put -Body $deactivateBody -ContentType "application/json"
$deactivated | ConvertTo-Json -Depth 5
Write-Host ""

# Test 15: Try to create run with inactive project (should fail)
Write-Host "[TEST 15] Testing inactive project (should fail)..." -ForegroundColor Yellow
try {
    $inactiveBody = @{
        projectId = $newProjectId
        outputId = "test_inactive"
        taskPrompt = "This should fail - project is inactive"
        manifest = @{
            testFile = "test.spec.tsx"
            files = @(
                @{
                    path = "src/test.tsx"
                    action = "CREATE"
                }
            )
        }
    } | ConvertTo-Json -Depth 5

    $inactive = Invoke-RestMethod -Uri "$BaseUrl/runs" -Method Post -Body $inactiveBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "✗ Inactive project was NOT rejected!" -ForegroundColor Red
    $inactive | ConvertTo-Json -Depth 5
} catch {
    Write-Host "✓ Inactive project rejected as expected" -ForegroundColor Green
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    $errorResponse | ConvertTo-Json -Depth 5
}
Write-Host ""

# Test 16: Cleanup - Delete workspace config
Write-Host "[TEST 16] Deleting workspace config..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$BaseUrl/workspaces/$newWorkspaceId/configs/MAX_TOKEN_BUDGET" -Method Delete | Out-Null
Write-Host "✓ Config deleted" -ForegroundColor Green
Write-Host ""

# Test 17: Cleanup - Delete project
Write-Host "[TEST 17] Deleting test project..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$BaseUrl/projects/$newProjectId" -Method Delete | Out-Null
Write-Host "✓ Project deleted" -ForegroundColor Green
Write-Host ""

# Test 18: Cleanup - Delete workspace
Write-Host "[TEST 18] Deleting test workspace..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$BaseUrl/workspaces/$newWorkspaceId" -Method Delete | Out-Null
Write-Host "✓ Workspace deleted" -ForegroundColor Green
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "All tests completed!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "- Created workspace ID: $newWorkspaceId"
Write-Host "- Created project ID: $newProjectId"
Write-Host "- Created run (old way) ID: $runOldId"
Write-Host "- Created run (new way) ID: $runNewId"
Write-Host "- All resources cleaned up"
