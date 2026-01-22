import { PathResolverService } from '../../src/services/PathResolverService.ts'
import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const pathResolver = new PathResolverService()

console.log('=== TESTE 2: PathResolverService.ensureCorrectPath() ===\n')

async function test() {
  try {
    // Setup: criar arquivo de teste em artifacts
    const testProjectRoot = 'C:\\Coding\\pipe'
    const testOutputId = 'test-ensure-path-001'
    const testSpecName = 'test-component.spec.tsx'
    const artifactsDir = join(testProjectRoot, 'artifacts', testOutputId)
    const artifactsSpecPath = join(artifactsDir, testSpecName)

    // Criar diretório e arquivo de teste
    await fs.mkdir(artifactsDir, { recursive: true })
    await fs.writeFile(artifactsSpecPath, 'import { test } from "vitest"\n\ntest("dummy", () => {})')
    console.log('✅ Criado arquivo de teste em:', artifactsSpecPath)

    // Manifest de teste (tipo: component)
    const manifest = {
      files: [
        { path: 'src/components/TestComponent.tsx', action: 'CREATE' }
      ],
      testFile: testSpecName
    }

    console.log('\n📋 Manifest:')
    console.log('  Files:', manifest.files.map(f => f.path))
    console.log('  Test File:', manifest.testFile)

    // Buscar ou criar convention para component
    let convention = await prisma.testPathConvention.findFirst({
      where: { testType: 'component', isActive: true }
    })

    if (!convention) {
      console.log('\n⚠️  Convention "component" não encontrada, criando...')
      convention = await prisma.testPathConvention.create({
        data: {
          workspaceId: '__global__',
          testType: 'component',
          pathPattern: 'src/components/{name}/{name}.spec.tsx',
          description: 'Component test convention',
          isActive: true
        }
      })
      console.log('✅ Convention criada:', convention.pathPattern)
    } else {
      console.log('\n✅ Convention encontrada:', convention.pathPattern)
    }

    // Executar ensureCorrectPath
    console.log('\n🔄 Executando ensureCorrectPath...')
    const correctPath = await pathResolver.ensureCorrectPath(
      artifactsSpecPath,
      manifest,
      testProjectRoot,
      testOutputId
    )

    console.log('\n📂 Resultado:')
    console.log('  Artifacts path:', artifactsSpecPath)
    console.log('  Correct path:', correctPath)

    // Verificar se arquivo foi copiado
    const expectedPath = join(testProjectRoot, 'src', 'components', 'TestComponent', 'test-component.spec.tsx')
    console.log('  Expected path:', expectedPath)

    try {
      await fs.access(correctPath)
      console.log('\n✅ Arquivo existe no path correto!')

      const content = await fs.readFile(correctPath, 'utf-8')
      console.log('✅ Conteúdo preservado:', content.substring(0, 50) + '...')

      if (correctPath === expectedPath) {
        console.log('✅ Path corresponde ao esperado!')
      } else {
        console.log('⚠️  Path diferente do esperado')
      }

      // Cleanup
      await fs.rm(join(testProjectRoot, 'src', 'components', 'TestComponent'), { recursive: true, force: true })
      await fs.rm(artifactsDir, { recursive: true, force: true })
      console.log('\n🧹 Cleanup concluído')

    } catch (error) {
      console.log('\n❌ Arquivo NÃO foi copiado para o path correto!')
      console.error('Erro:', error.message)
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

test()
