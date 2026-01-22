import { PathResolverService } from '../../src/services/PathResolverService.ts'
import { promises as fs } from 'fs'
import { join } from 'path'

const pathResolver = new PathResolverService()

console.log('=== TESTE 3: PathResolverService.recheckAndCopy() ===\n')

async function test() {
  try {
    const testProjectRoot = 'C:\\Coding\\pipe'
    const testOutputId = 'test-recheck-001'
    const testSpecName = 'recheck-test.spec.tsx'
    const artifactsDir = join(testProjectRoot, 'artifacts', testOutputId)
    const artifactsSpecPath = join(artifactsDir, testSpecName)
    const targetPath = join(testProjectRoot, 'src', 'components', testSpecName)

    // Cenário 1: Arquivo existe no destino
    console.log('📋 Cenário 1: Arquivo existe no destino')
    await fs.mkdir(join(testProjectRoot, 'src', 'components'), { recursive: true })
    await fs.writeFile(targetPath, 'test content existing')
    console.log('  ✅ Criado arquivo no destino:', targetPath)

    const result1 = await pathResolver.recheckAndCopy(targetPath, artifactsSpecPath)
    console.log('  Resultado:', result1)
    console.log('  Esperado: retornar targetPath sem modificar')

    if (result1 === targetPath) {
      console.log('  ✅ PASSOU: Retornou targetPath sem copiar')
    } else {
      console.log('  ❌ FALHOU: Retornou path diferente')
    }

    // Cenário 2: Arquivo NÃO existe no destino (deve copiar de artifacts)
    console.log('\n📋 Cenário 2: Arquivo NÃO existe no destino (rerun scenario)')

    // Deletar arquivo do destino
    await fs.unlink(targetPath)
    console.log('  🗑️  Deletado arquivo do destino (simulando perda)')

    // Criar arquivo em artifacts/
    await fs.mkdir(artifactsDir, { recursive: true })
    await fs.writeFile(artifactsSpecPath, 'test content from artifacts')
    console.log('  ✅ Criado arquivo em artifacts/', artifactsSpecPath)

    const result2 = await pathResolver.recheckAndCopy(targetPath, artifactsSpecPath)
    console.log('  Resultado:', result2)
    console.log('  Esperado: copiar de artifacts/ e retornar targetPath')

    // Verificar se arquivo foi restaurado
    try {
      const content = await fs.readFile(targetPath, 'utf-8')
      console.log('  ✅ Arquivo restaurado:', targetPath)
      console.log('  ✅ Conteúdo:', content)

      if (content === 'test content from artifacts') {
        console.log('  ✅ PASSOU: Arquivo copiado corretamente de artifacts/')
      } else {
        console.log('  ❌ FALHOU: Conteúdo incorreto')
      }
    } catch (error) {
      console.log('  ❌ FALHOU: Arquivo não foi restaurado')
      console.error('  Erro:', error.message)
    }

    // Cleanup
    await fs.rm(targetPath, { force: true })
    await fs.rm(artifactsDir, { recursive: true, force: true })
    console.log('\n🧹 Cleanup concluído')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
