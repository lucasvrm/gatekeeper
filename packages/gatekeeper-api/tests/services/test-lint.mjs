import { LintService } from '../../src/services/LintService.ts'

console.log('=== TESTE 7: LintService.lint() ===\n')

async function test() {
  const testProjectRoot = 'C:\\Coding\\pipe'
  const lint = new LintService(testProjectRoot)

  try {
    // Cenário 1: Lint em arquivo específico
    console.log('📋 Cenário 1: Lint em arquivo específico')
    const testFiles = [
      'src/ui/layout/Rail.tsx',
      'src/ui/layout/Sidebar.tsx'
    ]
    console.log('  Arquivos:', testFiles)

    const result1 = await lint.lint(testFiles)
    console.log('  Resultado:')
    console.log('    success:', result1.success)
    console.log('    errorCount:', result1.errorCount)
    console.log('    warningCount:', result1.warningCount)

    if (result1.output) {
      console.log('    output (primeiras 200 chars):', result1.output.substring(0, 200))
    }

    if (result1.success) {
      console.log('  ✅ PASSOU: Arquivos passam no lint')
    } else {
      console.log('  ⚠️  INFO: Arquivos têm avisos/erros de lint (pode ser esperado)')
    }

    // Cenário 2: Lint em múltiplos arquivos
    console.log('\n📋 Cenário 2: Lint em múltiplos arquivos')
    const multipleFiles = [
      'src/components/ui/button.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/card.tsx'
    ]
    console.log('  Arquivos:', multipleFiles)

    const result2 = await lint.lint(multipleFiles)
    console.log('  Resultado:')
    console.log('    success:', result2.success)
    console.log('    errorCount:', result2.errorCount)
    console.log('    warningCount:', result2.warningCount)

    if (result2.success) {
      console.log('  ✅ PASSOU: Múltiplos arquivos processados')
    } else {
      console.log('  ⚠️  INFO: Alguns arquivos têm avisos/erros')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
