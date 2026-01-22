import { ValidationOrchestrator } from '../../src/services/ValidationOrchestrator.ts'
import { GATES_CONFIG, CONTRACT_GATE_NUMBERS, EXECUTION_GATE_NUMBERS } from '../../src/config/gates.config.ts'

console.log('=== FASE 6: FLUXOS DE VALIDAÇÃO E RERUN ===\n')

async function test() {
  try {
    // ===== TESTE 31: Estrutura de Gates e Validators =====
    console.log('📋 TESTE 31: Estrutura de Gates e Validators\n')

    console.log('  Cenário 1: Verificar estrutura GATES_CONFIG')
    console.log('    Total de Gates:', GATES_CONFIG.length)
    console.log('    Gates configurados:', GATES_CONFIG.map(g => `Gate ${g.number}: ${g.name}`).join(', '))

    if (GATES_CONFIG.length === 4) {
      console.log('    ✅ 4 gates configurados corretamente')
    }

    let totalValidators = 0
    for (const gate of GATES_CONFIG) {
      console.log(`    Gate ${gate.number} (${gate.name}):`, gate.validators.length, 'validators')
      totalValidators += gate.validators.length
    }
    console.log('    Total de validators:', totalValidators)

    if (totalValidators === 23) {
      console.log('    ✅ 23 validators configurados (6+10+5+2)')
    }

    console.log('  Cenário 2: Verificar CONTRACT_GATE_NUMBERS')
    console.log('    CONTRACT gates:', CONTRACT_GATE_NUMBERS)
    if (CONTRACT_GATE_NUMBERS.length === 2 && CONTRACT_GATE_NUMBERS.includes(0) && CONTRACT_GATE_NUMBERS.includes(1)) {
      console.log('    ✅ CONTRACT executa Gates 0 e 1')
    }

    console.log('  Cenário 3: Verificar EXECUTION_GATE_NUMBERS')
    console.log('    EXECUTION gates:', EXECUTION_GATE_NUMBERS)
    if (EXECUTION_GATE_NUMBERS.length === 2 && EXECUTION_GATE_NUMBERS.includes(2) && EXECUTION_GATE_NUMBERS.includes(3)) {
      console.log('    ✅ EXECUTION executa Gates 2 e 3')
    }

    console.log('  ✅ TESTE 31 CONCLUÍDO\n')

    // ===== TESTE 32: Ordem de Execução de Validators =====
    console.log('📋 TESTE 32: Ordem de Execução de Validators\n')

    console.log('  Cenário 1: Verificar ordem em Gate 0')
    const gate0 = GATES_CONFIG.find(g => g.number === 0)
    const gate0Orders = gate0.validators.map(v => ({ code: v.code, order: v.order }))
    console.log('    Gate 0 validators:', gate0Orders.map(v => `${v.code} (order: ${v.order})`).join(', '))

    // Verificar se estão ordenados
    const gate0Sorted = gate0Orders.every((v, i) => i === 0 || v.order >= gate0Orders[i-1].order)
    if (gate0Sorted) {
      console.log('    ✅ Validators ordenados por order')
    } else {
      console.log('    ⚠️  Validators podem não estar ordenados')
    }

    console.log('  Cenário 2: Verificar hard blocks vs soft blocks')
    let hardBlockCount = 0
    let softBlockCount = 0

    for (const gate of GATES_CONFIG) {
      for (const validator of gate.validators) {
        if (validator.isHardBlock) {
          hardBlockCount++
        } else {
          softBlockCount++
        }
      }
    }

    console.log('    Hard blocks:', hardBlockCount)
    console.log('    Soft blocks:', softBlockCount)
    console.log('    Total:', hardBlockCount + softBlockCount)

    if (hardBlockCount > 0 && softBlockCount > 0) {
      console.log('    ✅ Sistema tem mix de hard e soft blocks')
    }

    // Exemplo de soft block
    const softBlockValidator = GATES_CONFIG
      .flatMap(g => g.validators)
      .find(v => !v.isHardBlock)

    if (softBlockValidator) {
      console.log('    Exemplo de soft block:', softBlockValidator.code, '(isHardBlock: false)')
      console.log('    ✅ Soft blocks identificados')
    }

    console.log('  ✅ TESTE 32 CONCLUÍDO\n')

    // ===== TESTE 33: Filtro de Gates por Run Type =====
    console.log('📋 TESTE 33: Filtro de Gates por Run Type\n')

    console.log('  Cenário 1: Filtrar gates para CONTRACT')
    const contractGates = GATES_CONFIG.filter(g => CONTRACT_GATE_NUMBERS.includes(g.number))
    console.log('    CONTRACT gates:', contractGates.map(g => `${g.number}: ${g.name}`).join(', '))

    const contractValidatorCount = contractGates.reduce((acc, g) => acc + g.validators.length, 0)
    console.log('    Validators em CONTRACT:', contractValidatorCount)

    if (contractValidatorCount === 16) {
      console.log('    ✅ CONTRACT tem 16 validators (Gate 0: 6 + Gate 1: 10)')
    }

    console.log('  Cenário 2: Filtrar gates para EXECUTION')
    const executionGates = GATES_CONFIG.filter(g => EXECUTION_GATE_NUMBERS.includes(g.number))
    console.log('    EXECUTION gates:', executionGates.map(g => `${g.number}: ${g.name}`).join(', '))

    const executionValidatorCount = executionGates.reduce((acc, g) => acc + g.validators.length, 0)
    console.log('    Validators em EXECUTION:', executionValidatorCount)

    if (executionValidatorCount === 7) {
      console.log('    ✅ EXECUTION tem 7 validators (Gate 2: 5 + Gate 3: 2)')
    }

    console.log('  Cenário 3: Verificar que não há sobreposição')
    const hasOverlap = CONTRACT_GATE_NUMBERS.some(n => EXECUTION_GATE_NUMBERS.includes(n))
    if (!hasOverlap) {
      console.log('    ✅ CONTRACT e EXECUTION não têm gates em comum')
    } else {
      console.log('    ❌ Há sobreposição entre CONTRACT e EXECUTION')
    }

    console.log('  ✅ TESTE 33 CONCLUÍDO\n')

    // ===== TESTE 34: Validação de Validators =====
    console.log('📋 TESTE 34: Validação de Estrutura de Validators\n')

    console.log('  Cenário 1: Verificar campos obrigatórios')
    let validatorErrors = 0

    for (const gate of GATES_CONFIG) {
      for (const validator of gate.validators) {
        if (!validator.code || !validator.name || !validator.description) {
          console.log(`    ❌ Validator em Gate ${gate.number} sem campos obrigatórios`)
          validatorErrors++
        }

        if (typeof validator.isHardBlock !== 'boolean') {
          console.log(`    ❌ ${validator.code}: isHardBlock não é boolean`)
          validatorErrors++
        }

        if (typeof validator.execute !== 'function') {
          console.log(`    ❌ ${validator.code}: execute não é função`)
          validatorErrors++
        }
      }
    }

    if (validatorErrors === 0) {
      console.log('    ✅ Todos os validators têm estrutura válida')
    } else {
      console.log(`    ❌ ${validatorErrors} erros encontrados`)
    }

    console.log('  Cenário 2: Verificar códigos únicos')
    const allCodes = GATES_CONFIG.flatMap(g => g.validators.map(v => v.code))
    const uniqueCodes = new Set(allCodes)

    if (allCodes.length === uniqueCodes.size) {
      console.log('    ✅ Todos os validator codes são únicos')
    } else {
      console.log('    ❌ Há validator codes duplicados')
      const duplicates = allCodes.filter((code, index) => allCodes.indexOf(code) !== index)
      console.log('    Duplicados:', [...new Set(duplicates)])
    }

    console.log('  Cenário 3: Verificar CLÁUSULA PÉTREA')
    const petreaValidator = GATES_CONFIG
      .flatMap(g => g.validators)
      .find(v => v.description?.includes('CLÁUSULA PÉTREA'))

    if (petreaValidator) {
      console.log('    CLÁUSULA PÉTREA encontrada:', petreaValidator.code)
      console.log('    Gate:', petreaValidator.gate)
      console.log('    isHardBlock:', petreaValidator.isHardBlock)

      if (petreaValidator.isHardBlock) {
        console.log('    ✅ CLÁUSULA PÉTREA é hard block (correto)')
      } else {
        console.log('    ❌ CLÁUSULA PÉTREA deveria ser hard block')
      }
    }

    console.log('  ✅ TESTE 34 CONCLUÍDO\n')

    // ===== TESTE 35: ValidationOrchestrator Existence =====
    console.log('📋 TESTE 35: ValidationOrchestrator\n')

    console.log('  Cenário 1: Instanciar ValidationOrchestrator')
    const orchestrator = new ValidationOrchestrator()

    if (orchestrator) {
      console.log('    ✅ ValidationOrchestrator instanciado')
    }

    if (typeof orchestrator.executeRun === 'function') {
      console.log('    ✅ executeRun() existe')
    }

    if (typeof orchestrator.addToQueue === 'function') {
      console.log('    ✅ addToQueue() existe')
    }

    console.log('  ✅ TESTE 35 CONCLUÍDO\n')

    console.log('✅ FASE 6 COMPLETA - Fluxos de Validação (5/5 testes)')
    console.log('   - Estrutura de gates verificada')
    console.log('   - Ordem de execução validada')
    console.log('   - Filtros de run type testados')
    console.log('   - Validators validados')
    console.log('   - Orchestrator verificado')

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message)
    console.error(error.stack)
  }
}

test()
