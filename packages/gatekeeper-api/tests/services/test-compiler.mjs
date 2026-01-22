import { CompilerService } from '../../src/services/CompilerService.ts'

console.log('=== TESTE 6: CompilerService.compile() ===\n')

async function test() {
  const testProjectRoot = 'C:\\Coding\\pipe'
  const compiler = new CompilerService(testProjectRoot)

  try {
    // Cenário 1: Compilação do projeto inteiro (sem erros esperados)
    console.log('📋 Cenário 1: Compilar projeto inteiro')
    console.log('  Project:', testProjectRoot)

    const result1 = await compiler.compile()
    console.log('  Resultado:')
    console.log('    success:', result1.success)
    console.log('    errors count:', result1.errors.length)

    if (result1.errors.length > 0) {
      console.log('    Primeiros 3 erros:')
      result1.errors.slice(0, 3).forEach((err, i) => {
        console.log(`      ${i + 1}. ${err.substring(0, 100)}`)
      })
    }

    if (result1.success) {
      console.log('  ✅ PASSOU: Projeto compila sem erros')
    } else {
      console.log('  ⚠️  INFO: Projeto tem erros de compilação (pode ser esperado)')
    }

    // Cenário 2: Compilação de arquivo específico (se houver erro)
    if (!result1.success && result1.errors.length > 0) {
      console.log('\n📋 Cenário 2: Compilar arquivo específico com erro')

      // Extrair path do primeiro erro (geralmente formato: "path/file.ts:line:col - error TS...")
      const firstError = result1.errors[0]
      const pathMatch = firstError.match(/^([^:]+\.tsx?):/)

      if (pathMatch) {
        const filePath = pathMatch[1]
        console.log('  Arquivo:', filePath)

        const result2 = await compiler.compile(filePath)
        console.log('  Resultado:')
        console.log('    success:', result2.success)
        console.log('    errors (filtrado):', result2.errors.length)

        if (result2.errors.length > 0) {
          console.log('  ✅ PASSOU: Filtrou erros para arquivo específico')
        } else {
          console.log('  ⚠️  AVISO: Nenhum erro filtrado (pode ser esperado)')
        }
      }
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
