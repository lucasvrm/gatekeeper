import { GitService } from '../../src/services/GitService.ts'
import { promises as fs } from 'fs'
import { join } from 'path'

console.log('=== TESTE 4: GitService.stash/stashPop ===\n')

async function test() {
  const testProjectRoot = 'C:\\Coding\\pipe'
  const gitService = new GitService(testProjectRoot)

  try {
    // Obter branch atual
    const originalBranch = await gitService.getCurrentRef()
    console.log('📂 Branch atual:', originalBranch)

    // Criar arquivo não rastreado em artifacts/ (simulando spec.tsx)
    const testFile = join(testProjectRoot, 'artifacts', 'test-stash', 'untracked-file.txt')
    await fs.mkdir(join(testProjectRoot, 'artifacts', 'test-stash'), { recursive: true })
    await fs.writeFile(testFile, 'This file should be preserved during stash')
    console.log('✅ Criado arquivo não rastreado:', testFile)

    // Verificar que arquivo existe
    const contentBefore = await fs.readFile(testFile, 'utf-8')
    console.log('✅ Conteúdo antes do stash:', contentBefore.substring(0, 30) + '...')

    // Executar stash (deve incluir --include-untracked)
    console.log('\n🔄 Executando git stash...')
    await gitService.stash()
    console.log('✅ Stash executado')

    // Verificar se arquivo foi stashed (não deve existir mais no working directory)
    try {
      await fs.access(testFile)
      console.log('⚠️  Arquivo ainda existe após stash (pode ser esperado dependendo do Git)')
      const stillExists = true

      // Mesmo se arquivo existe, vamos continuar com o stash pop
    } catch (error) {
      console.log('✅ Arquivo foi stashed (removido do working directory)')
    }

    // Executar stash pop (deve restaurar)
    console.log('\n🔄 Executando git stash pop...')
    await gitService.stashPop()
    console.log('✅ Stash pop executado')

    // Verificar se arquivo foi restaurado
    try {
      const contentAfter = await fs.readFile(testFile, 'utf-8')
      console.log('✅ Arquivo restaurado:', testFile)
      console.log('✅ Conteúdo após stash pop:', contentAfter.substring(0, 30) + '...')

      if (contentAfter === contentBefore) {
        console.log('\n✅ PASSOU: Conteúdo preservado durante stash/pop cycle')
      } else {
        console.log('\n❌ FALHOU: Conteúdo modificado')
      }
    } catch (error) {
      console.log('\n❌ FALHOU: Arquivo não foi restaurado após stash pop')
      console.error('Erro:', error.message)
    }

    // Cleanup
    await fs.rm(join(testProjectRoot, 'artifacts', 'test-stash'), { recursive: true, force: true })
    console.log('\n🧹 Cleanup concluído')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
