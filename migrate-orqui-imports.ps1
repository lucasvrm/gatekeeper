# ============================================================================
# migrate-orqui-imports.ps1
# Roda na raiz do monorepo (C:\Coding\gatekeeper)
# Atualiza todos os imports v1 → v2 nos arquivos do Gatekeeper
# ============================================================================

$ErrorActionPreference = "Stop"

# Arquivos-alvo: .ts e .tsx fora de node_modules, .git, e packages/orqui
$files = Get-ChildItem -Recurse -Include *.ts,*.tsx -File |
  Where-Object {
    $_.FullName -notmatch "node_modules|\.git|packages\\orqui|dist|\.next"
  }

$totalChanges = 0

foreach ($file in $files) {
  $content = Get-Content $file.FullName -Raw
  $original = $content
  $changed = $false

  # ── 1. Imports antigos do runtime (v1) ──
  # @uild/runtime → @orqui/runtime
  # @uild/cli/runtime → @orqui/runtime
  # @orqui/cli/runtime → @orqui/runtime
  # ../packages/uild/src/runtime → @orqui/runtime
  # ../packages/orqui/src/runtime → @orqui/runtime
  $patterns = @(
    '@uild/runtime',
    '@uild/cli/runtime',
    '@orqui/cli/runtime',
    '\.\./packages/uild/src/runtime',
    '\.\./packages/orqui/src/runtime',
    '\.\./packages/uild/src/runtime\.tsx',
    '\.\./packages/orqui/src/runtime\.tsx'
  )

  foreach ($pat in $patterns) {
    $regex = [regex]::Escape($pat).Replace('\\\.\\\.\/', '\.\./').Replace('\\\.', '\.')
    if ($content -match $pat) {
      $content = $content -replace [regex]::Escape($pat), '@orqui/runtime'
      $changed = $true
    }
  }

  # Fallback: qualquer variação de import com "uild" apontando para runtime
  if ($content -match 'from\s+[''"].*uild.*runtime.*[''"]') {
    $content = $content -replace '(from\s+[''"]).*uild.*runtime[^''"]*([''"])', '${1}@orqui/runtime${2}'
    $changed = $true
  }

  # ── 2. Imports do ContractProvider direto (se alguém importou de path específico) ──
  if ($content -match 'packages/orqui/src/runtime/context/ContractProvider') {
    $content = $content -replace 'packages/orqui/src/runtime/context/ContractProvider[^''"]*', '@orqui/runtime'
    $changed = $true
  }

  # ── 3. Imports do @uild/cli (sem /runtime) → @orqui/core ──
  if ($content -match '@uild/cli[''"]' -and $content -notmatch '@uild/cli/') {
    $content = $content -replace '@uild/cli([''"])', '@orqui/core$1'
    $changed = $true
  }

  # ── 4. Imports do @uild/cli/vite → @orqui/integration ──
  if ($content -match '@uild/cli/vite') {
    $content = $content -replace '@uild/cli/vite', '@orqui/integration'
    $changed = $true
  }
  if ($content -match '@orqui/cli/vite') {
    $content = $content -replace '@orqui/cli/vite', '@orqui/integration'
    $changed = $true
  }

  # ── 5. Renomear funções v1 → v2 ──
  if ($content -match 'uildVitePlugin') {
    $content = $content -replace 'uildVitePlugin', 'orquiVitePlugin'
    $changed = $true
  }

  # ── Salvar se mudou ──
  if ($changed) {
    Set-Content -Path $file.FullName -Value $content -NoNewline
    $totalChanges++
    Write-Host "[UPDATED] $($file.FullName)" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "Done. $totalChanges file(s) updated." -ForegroundColor Cyan

# ── 6. Relatório: imports que sobreviveram ──
Write-Host ""
Write-Host "Checking for remaining old imports..." -ForegroundColor Yellow

$remaining = Get-ChildItem -Recurse -Include *.ts,*.tsx -File |
  Where-Object { $_.FullName -notmatch "node_modules|\.git|packages\\orqui|dist" } |
  Select-String "@uild|packages/uild|uildVitePlugin"

if ($remaining) {
  Write-Host "WARNING: Found remaining old references:" -ForegroundColor Red
  $remaining | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" }
} else {
  Write-Host "All clean. No old references found." -ForegroundColor Green
}