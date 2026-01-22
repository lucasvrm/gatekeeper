import { TaskClarityCheckValidator } from '../../../src/domain/validators/gate0/TaskClarityCheck.ts'

console.log('=== TESTE 10: TaskClarityCheckValidator ===\n')

async function test() {
  try {
    // Lista de termos ambíguos comuns
    const ambiguousTerms = [
      'maybe',
      'probably',
      'might',
      'should',
      'could',
      'perhaps',
      'possibly',
      'fix it',
      'make it better',
      'improve',
    ]

    // Cenário 1: Prompt CLARO (sem termos ambíguos)
    console.log('📋 Cenário 1: Prompt CLARO (sem termos ambíguos)')
    const clearContext = {
      taskPrompt: 'Add a login button to the header component with email and password fields',
      ambiguousTerms,
      config: {},
      services: {}
    }

    const result1 = await TaskClarityCheckValidator.execute(clearContext)
    console.log('  Resultado:')
    console.log('    passed:', result1.passed)
    console.log('    status:', result1.status)
    console.log('    message:', result1.message)

    if (result1.passed && result1.status === 'PASSED') {
      console.log('  ✅ PASSOU: Prompt claro aceito')
    } else {
      console.log('  ❌ FALHOU: Deveria passar com prompt claro')
    }

    // Cenário 2: Prompt AMBÍGUO (com termos)
    console.log('\n📋 Cenário 2: Prompt AMBÍGUO (contém termos)')
    const ambiguousContext = {
      taskPrompt: 'Maybe we should fix it and make it better',
      ambiguousTerms,
      config: {},
      services: {}
    }

    const result2 = await TaskClarityCheckValidator.execute(ambiguousContext)
    console.log('  Resultado:')
    console.log('    passed:', result2.passed)
    console.log('    status:', result2.status)
    console.log('    message:', result2.message)
    console.log('    details:', result2.details)

    if (!result2.passed && result2.status === 'FAILED') {
      console.log('  ✅ PASSOU: Prompt ambíguo corretamente rejeitado')

      const expectedTerms = ['maybe', 'should', 'fix it', 'make it better']
      const allFound = expectedTerms.every(term => result2.details.foundTerms.includes(term))

      if (allFound) {
        console.log('  ✅ PASSOU: Todos os termos ambíguos detectados:', result2.details.foundTerms)
      } else {
        console.log('  ⚠️  AVISO: Alguns termos não detectados')
        console.log('    Esperados:', expectedTerms)
        console.log('    Encontrados:', result2.details.foundTerms)
      }
    } else {
      console.log('  ❌ FALHOU: Deveria falhar com termos ambíguos')
    }

    // Cenário 3: Case INSENSITIVE
    console.log('\n📋 Cenário 3: Case INSENSITIVE (MAYBE em maiúsculas)')
    const caseInsensitiveContext = {
      taskPrompt: 'MAYBE we need to add this feature',
      ambiguousTerms,
      config: {},
      services: {}
    }

    const result3 = await TaskClarityCheckValidator.execute(caseInsensitiveContext)
    console.log('  Resultado:')
    console.log('    passed:', result3.passed)
    console.log('    status:', result3.status)
    console.log('    details:', result3.details)

    if (!result3.passed && result3.details.foundTerms.includes('maybe')) {
      console.log('  ✅ PASSOU: Case insensitive funcionando (detectou "maybe" em "MAYBE")')
    } else {
      console.log('  ❌ FALHOU: Não detectou termo em maiúsculas')
    }

    // Cenário 4: Múltiplos termos ambíguos
    console.log('\n📋 Cenário 4: Múltiplos termos ambíguos')
    const multipleAmbiguousContext = {
      taskPrompt: 'We could probably improve this component, maybe add caching',
      ambiguousTerms,
      config: {},
      services: {}
    }

    const result4 = await TaskClarityCheckValidator.execute(multipleAmbiguousContext)
    console.log('  Resultado:')
    console.log('    passed:', result4.passed)
    console.log('    details:', result4.details)

    if (!result4.passed && result4.details.totalFound >= 3) {
      console.log('  ✅ PASSOU: Múltiplos termos detectados:', result4.details.foundTerms)
    } else {
      console.log('  ⚠️  AVISO: Nem todos os termos foram detectados')
    }

    // Cenário 5: Prompt com palavra similar mas NÃO ambígua
    console.log('\n📋 Cenário 5: Prompt com palavra similar (shouldnt != should)')
    const similarContext = {
      taskPrompt: "We shouldn't skip this validation step",
      ambiguousTerms,
      config: {},
      services: {}
    }

    const result5 = await TaskClarityCheckValidator.execute(similarContext)
    console.log('  Resultado:')
    console.log('    passed:', result5.passed)
    console.log('    status:', result5.status)

    // Note: O validator usa regex simples, então "shouldn't" vai detectar "should"
    // Este é um comportamento esperado (detecta qualquer ocorrência do termo)
    if (!result5.passed) {
      console.log('  ⚠️  INFO: "should" detectado em "shouldn\'t" (comportamento esperado da regex)')
    } else {
      console.log('  ✅ INFO: Prompt aceito')
    }

    // Cenário 6: Verificar propriedades do validator
    console.log('\n📋 Cenário 6: Verificar propriedades do validator')
    console.log('  code:', TaskClarityCheckValidator.code)
    console.log('  gate:', TaskClarityCheckValidator.gate)
    console.log('  isHardBlock:', TaskClarityCheckValidator.isHardBlock)
    console.log('  order:', TaskClarityCheckValidator.order)

    if (
      TaskClarityCheckValidator.code === 'TASK_CLARITY_CHECK' &&
      TaskClarityCheckValidator.gate === 0 &&
      TaskClarityCheckValidator.isHardBlock === true &&
      TaskClarityCheckValidator.order === 3
    ) {
      console.log('  ✅ PASSOU: Propriedades corretas (Gate 0, Hard Block, Order 3)')
    } else {
      console.log('  ❌ FALHOU: Propriedades incorretas')
    }

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
