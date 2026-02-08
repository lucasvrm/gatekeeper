# Auditoria: ValidationOrchestrator Context Construction

**Data**: 2026-02-07
**Status**: **EXECUTAR AGORA** (remoção de dead code)

---

## 🎯 Descoberta

**ValidationOrchestrator monta o ctx com**:
- ✅ `microplan` → usado por 10/10 validators
- ❌ `manifest` → cache redundante de microplan (usado apenas por 1 função)
- ❌ `contract` → dead code completo (usado por ninguém)

**Conclusão**: `manifest` e `contract` são dead code. Remover ambos AGORA.

---

## 📊 Evidências

### 1. Validators usam APENAS microplan

```bash
$ grep -r "ctx\.microplan" src/domain/validators/ --include="*.ts" | grep -v "\.spec\.ts" | wc -l
10  # 10/10 validators ativos

$ grep -r "ctx\.manifest\|ctx\.contract" src/domain/validators/ --include="*.ts" | grep -v "\.spec\.ts"
# (nenhum resultado)
```

### 2. manifest é usado APENAS por ensureSpecAtCorrectPath

**ValidationOrchestrator.ts:34-52**:
```typescript
// Parse manifest to get testFile
const manifest = JSON.parse(run.manifestJson)
if (!manifest?.testFile) return
const targetPath = join(run.projectPath, manifest.testFile)
```

**Solução**: Trocar por microplan (1 linha)

### 3. manifest é gerado a partir de microplan

**GatekeeperValidationBridge.ts:467-491**:
```typescript
private convertMicroplansToManifest(microplans: any) {
  // Agrega files de todos microplans
  const allFiles = []
  let testFile = undefined

  for (const mp of microplans.microplans) {
    for (const file of mp.files) {
      allFiles.push(file)
      if (!testFile && /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(file.path)) {
        testFile = file.path
      }
    }
  }

  return { files: allFiles, testFile }
}
```

**Ou seja**: manifest é um **cache redundante** de microplan.

---

## 🧹 Plano de Execução

### Arquivos a modificar (6 arquivos):

1. **ValidationOrchestrator.ts** (~100 linhas removidas)
   - Remover carregamento de manifest (linhas 421-428)
   - Remover carregamento de contract (linhas 430-437)
   - Refatorar ensureSpecAtCorrectPath (1 linha)
   - Remover manifest/contract do return buildContext (linhas 539-540)

2. **GatekeeperValidationBridge.ts** (~50 linhas removidas)
   - Remover convertMicroplansToManifest() (linhas 467-491)
   - Remover chamadas ao método (linhas 416-422)
   - Remover leitura de contract.json (linhas 451-456)
   - Remover manifestJson/contractJson da interface (linhas 349-350, 372-373)

3. **gates.types.ts** (~40 linhas removidas)
   - Remover ManifestInput interface (linhas ~150-160)
   - Remover ContractInput interface (linhas ~110-140)
   - Remover campos manifest/contract de ValidationContext (linhas 255-257)

4. **RunsController.ts** (~10 linhas)
   - Verificar se usa manifestJson (linhas ~180-185)
   - Remover se não necessário

5. **ValidationController.ts** (~10 linhas)
   - Verificar se usa manifestJson/contractJson (linhas ~90-95)
   - Remover se não necessário

6. **schema.prisma** (opcional - migration)
   - Remover campos manifestJson/contractJson de ValidationRun
   - OU marcar como deprecated (comentário)

---

## 🔧 Diff Principal

### 1. ValidationOrchestrator.ts:ensureSpecAtCorrectPath()

```diff
  private async ensureSpecAtCorrectPath(run: ValidationRun): Promise<void> {
-   // Parse manifest to get testFile
-   if (!run.manifestJson) {
-     console.warn('[ensureSpecAtCorrectPath] No manifest found, skipping spec copy')
+   // Parse microplan to get testFile
+   if (!run.microplanJson) {
+     console.warn('[ensureSpecAtCorrectPath] No microplan found, skipping spec copy')
      return
    }

-   let manifest: { testFile?: string } | null = null
+   let microplan: { microplans?: Array<{ files?: Array<{ path: string }> }> } | null = null
    try {
-     manifest = JSON.parse(run.manifestJson)
+     microplan = JSON.parse(run.microplanJson)
    } catch (error) {
-     console.warn('[ensureSpecAtCorrectPath] Failed to parse manifest JSON:', error)
+     console.warn('[ensureSpecAtCorrectPath] Failed to parse microplan JSON:', error)
      return
    }

-   if (!manifest?.testFile) {
-     console.warn('[ensureSpecAtCorrectPath] No testFile in manifest, skipping spec copy')
+   const testFile = microplan?.microplans
+     ?.flatMap(mp => mp.files || [])
+     .find(f => /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(f.path))?.path
+
+   if (!testFile) {
+     console.warn('[ensureSpecAtCorrectPath] No test file found in microplan, skipping spec copy')
      return
    }

-   if (isAbsolute(manifest.testFile)) {
+   if (isAbsolute(testFile)) {
      throw new Error('manifest.testFile must be a relative path inside the project root.')
    }

-   const resolvedTestPath = resolve(run.projectPath, manifest.testFile)
+   const resolvedTestPath = resolve(run.projectPath, testFile)
    // ... resto do método usa `testFile` ao invés de `manifest.testFile`
```

### 2. ValidationOrchestrator.ts:buildContext()

```diff
  private async buildContext(run: ValidationRun): Promise<ValidationContext> {
    const config = await prisma.validationConfig.findMany()
    // ...

-   let manifest: ManifestInput | null = null
-   if (run.manifestJson) {
-     try {
-       manifest = JSON.parse(run.manifestJson)
-     } catch (error) {
-       console.error('Failed to parse manifest JSON:', error)
-     }
-   }
-
-   let contract: ContractInput | null = null
-   if (run.contractJson) {
-     try {
-       contract = JSON.parse(run.contractJson) as ContractInput
-     } catch (error) {
-       console.error('Failed to parse contract JSON:', error)
-     }
-   }

    let microplan: Microplan | null = null
    if (run.microplanJson) {
      try {
        microplan = JSON.parse(run.microplanJson) as Microplan
        console.log(`[buildContext] Loaded microplan from run: ${microplan.id}`)
      } catch (error) {
        console.warn('[buildContext] Failed to parse microplanJson:', error)
      }
    }

    return {
      runId: run.id,
      projectPath: run.projectPath,
      baseRef: run.baseRef,
      targetRef: run.targetRef,
      taskPrompt: run.taskPrompt,
      microplan,
-     manifest,
-     contract,
      testFilePath: run.testFilePath,
      // ...
    }
  }
```

### 3. GatekeeperValidationBridge.ts

```diff
- private convertMicroplansToManifest(microplans: any): { files: any[]; testFile?: string } | null {
-   if (!microplans.microplans || !Array.isArray(microplans.microplans)) {
-     return null
-   }
-
-   const allFiles: any[] = []
-   let testFile: string | undefined
-
-   for (const mp of microplans.microplans) {
-     if (mp.files && Array.isArray(mp.files)) {
-       for (const file of mp.files) {
-         allFiles.push(file)
-         if (!testFile && /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(file.path)) {
-           testFile = file.path
-         }
-       }
-     }
-   }
-
-   return { files: allFiles, testFile }
- }

  private async readArtifactData(outputId: string, projectPath: string) {
    // ...

-   // Convert microplans to manifest equivalent
-   const manifest = this.convertMicroplansToManifest(microplans)
-   if (manifest) {
-     result.manifestJson = JSON.stringify(manifest)
-     if (manifest.testFile) {
-       result.testFilePath = join(projectPath, manifest.testFile).replace(/\\/g, '/')
-     }
-   }

+   // Extract testFile directly from microplans
+   const testFile = microplans.microplans
+     ?.flatMap(mp => mp.files || [])
+     .find(f => /\.(spec|test)\.(ts|tsx|js|jsx)$/.test(f.path))?.path
+
+   if (testFile) {
+     result.testFilePath = join(projectPath, testFile).replace(/\\/g, '/')
+   }

-   // Read contract.json if present
-   const contractPath = join(artifactDir, 'contract.json')
-   if (existsSync(contractPath)) {
-     try {
-       result.contractJson = readFileSync(contractPath, 'utf-8')
-     } catch (err) {
-       console.warn('[GatekeeperValidationBridge] Failed to read contract.json:', err)
-     }
-   }
  }
```

### 4. gates.types.ts

```diff
  export interface ValidationContext {
    runId: string
    projectPath: string
    baseRef: string
    targetRef: string
    taskPrompt: string
    microplan: Microplan | null
-   /** @deprecated Use microplan.files instead */
-   manifest: ManifestInput | null
-   /** @deprecated Use microplan.verify instead */
-   contract: ContractInput | null
    testFilePath: string | null
    dangerMode: boolean
    services: { /* ... */ }
    // ...
  }

- export interface ManifestInput {
-   files: Array<{
-     path: string
-     action: 'CREATE' | 'EDIT' | 'DELETE'
-     what: string
-   }>
-   testFile?: string
- }

- export interface ContractInput {
-   schemaVersion: string
-   slug: string
-   title: string
-   // ...
- }
```

---

## ✅ Checklist de Execução

- [ ] 1. Refatorar `ValidationOrchestrator.ensureSpecAtCorrectPath()` (trocar manifest → microplan)
- [ ] 2. Remover carregamento de manifest/contract em `ValidationOrchestrator.buildContext()`
- [ ] 3. Remover `convertMicroplansToManifest()` de `GatekeeperValidationBridge`
- [ ] 4. Remover leitura de contract.json em `GatekeeperValidationBridge`
- [ ] 5. Remover manifest/contract de `ValidationContext` interface
- [ ] 6. Remover `ManifestInput` e `ContractInput` interfaces
- [ ] 7. Verificar imports não usados (cleanups)
- [ ] 8. Rodar typecheck: `npm run typecheck -w gatekeeper-api`
- [ ] 9. Rodar testes: `npm run test -w gatekeeper-api`
- [ ] 10. Verificar se há uso de manifestJson/contractJson em controllers (remover se inútil)

---

## 📊 Impacto

**Linhas removidas**: ~200 linhas
**Arquivos tocados**: 6 arquivos
**Tempo estimado**: 10 minutos
**Risco**: BAIXO (manifest era cache de microplan, contract era dead code)
**Breaking changes**: ZERO (nenhum validator usa manifest/contract)

---

## 🚀 Executar Agora

**Motivo**: Dead code. Não há consumidor externo. É só o seu código.

**Não precisa de**:
- ❌ Migration guide (você está vivendo a migração)
- ❌ Deprecation warnings (você já sabe que está deprecated)
- ❌ Versionamento v1.x → v2.0 (overengineering para 1 dev)

**Precisa apenas**:
- ✅ Remover o código morto
- ✅ Typecheck passar
- ✅ Testes passarem

---

## 🔗 Referências

- ValidationOrchestrator.ts:34-136 (ensureSpecAtCorrectPath)
- ValidationOrchestrator.ts:388-559 (buildContext)
- GatekeeperValidationBridge.ts:467-491 (convertMicroplansToManifest)
- gates.types.ts:247-275 (ValidationContext)
- gates.types.ts:~150-160 (ManifestInput)
- gates.types.ts:~110-140 (ContractInput)
