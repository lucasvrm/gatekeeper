#!/bin/bash

echo "🧪 Executando Suite Completa de Testes Gatekeeper"
echo "=================================================="
echo ""

total_tests=0
passed_phases=0

run_phase() {
  local phase_name=$1
  local phase_path=$2
  local test_count=$3

  echo "📋 $phase_name ($test_count testes)"
  echo "---"

  for file in $phase_path/*.mjs; do
    if [ -f "$file" ]; then
      echo "  Executando: $(basename $file)"
      if npx tsx "$file" > /dev/null 2>&1; then
        echo "    ✅ PASSOU"
      else
        echo "    ❌ FALHOU"
        return 1
      fi
    fi
  done

  echo ""
  return 0
}

# Fase 1: Services
if run_phase "Fase 1: Backend Services" "tests/services" 7; then
  ((passed_phases++))
fi
((total_tests+=7))

# Fase 2: Gate 0
if run_phase "Fase 2: Gate 0 - SANITIZATION" "tests/validators/gate0" 6; then
  ((passed_phases++))
fi
((total_tests+=6))

# Fase 3: Gate 1
if run_phase "Fase 3: Gate 1 - CONTRACT" "tests/validators/gate1" 10; then
  ((passed_phases++))
fi
((total_tests+=10))

# Fase 4: Gate 2
if run_phase "Fase 4: Gate 2 - EXECUTION" "tests/validators/gate2" 5; then
  ((passed_phases++))
fi
((total_tests+=5))

# Fase 5: Gate 3
if run_phase "Fase 5: Gate 3 - INTEGRITY" "tests/validators/gate3" 2; then
  ((passed_phases++))
fi
((total_tests+=2))

# Fase 6: Flows
if run_phase "Fase 6: Validation Flows" "tests/flows" 5; then
  ((passed_phases++))
fi
((total_tests+=5))

# Fase 7: Integration
if run_phase "Fase 7: Integration & Schemas" "tests/integration" 5; then
  ((passed_phases++))
fi
((total_tests+=5))

# Fase 8: Edge Cases
if run_phase "Fase 8: Edge Cases" "tests/edge-cases" 7; then
  ((passed_phases++))
fi
((total_tests+=7))

# Fase 9: Workspaces
if run_phase "Fase 9: Multi-Workspace" "tests/workspaces" 4; then
  ((passed_phases++))
fi
((total_tests+=4))

echo "=================================================="
echo "📊 RESUMO FINAL"
echo "=================================================="
echo "Fases passadas: $passed_phases/9"
echo "Total de testes: $total_tests"
echo ""

if [ $passed_phases -eq 9 ]; then
  echo "🎉 TODOS OS TESTES PASSARAM! 🎉"
  exit 0
else
  echo "❌ Algumas fases falharam"
  exit 1
fi
