import { PathResolverService } from '../../src/services/PathResolverService.ts'

const pathResolver = new PathResolverService()

console.log('=== TESTE 1: PathResolverService.detectTestType() ===\n')

// Cenário 1: Layout
const manifest1 = {
  files: [
    { path: 'src/ui/layout/Header.tsx', action: 'CREATE' },
    { path: 'src/ui/layout/Sidebar.tsx', action: 'CREATE' }
  ],
  testFile: 'header.spec.tsx'
}
console.log('Cenário 1 - Layout:')
console.log('Files:', manifest1.files.map(f => f.path))
console.log('Detectado:', pathResolver.detectTestType(manifest1))
console.log('Esperado: layout')
console.log()

// Cenário 2: Component
const manifest2 = {
  files: [
    { path: 'src/components/Button.tsx', action: 'CREATE' },
    { path: 'src/components/Input.tsx', action: 'MODIFY' }
  ],
  testFile: 'button.spec.tsx'
}
console.log('Cenário 2 - Component:')
console.log('Files:', manifest2.files.map(f => f.path))
console.log('Detectado:', pathResolver.detectTestType(manifest2))
console.log('Esperado: component')
console.log()

// Cenário 3: Hook
const manifest3 = {
  files: [
    { path: 'src/hooks/useAuth.ts', action: 'CREATE' }
  ],
  testFile: 'useAuth.spec.ts'
}
console.log('Cenário 3 - Hook:')
console.log('Files:', manifest3.files.map(f => f.path))
console.log('Detectado:', pathResolver.detectTestType(manifest3))
console.log('Esperado: hook')
console.log()

// Cenário 4: Widget
const manifest4 = {
  files: [
    { path: 'src/widgets/Calendar.tsx', action: 'CREATE' }
  ],
  testFile: 'calendar.spec.tsx'
}
console.log('Cenário 4 - Widget:')
console.log('Files:', manifest4.files.map(f => f.path))
console.log('Detectado:', pathResolver.detectTestType(manifest4))
console.log('Esperado: widget')
console.log()

// Cenário 5: Lib
const manifest5 = {
  files: [
    { path: 'src/lib/utils.ts', action: 'MODIFY' }
  ],
  testFile: 'utils.spec.ts'
}
console.log('Cenário 5 - Lib:')
console.log('Files:', manifest5.files.map(f => f.path))
console.log('Detectado:', pathResolver.detectTestType(manifest5))
console.log('Esperado: lib')
console.log()

// Cenário 6: Prioridade (layout > components)
const manifest6 = {
  files: [
    { path: 'src/ui/layout/AppLayout.tsx', action: 'CREATE' },
    { path: 'src/components/Button.tsx', action: 'MODIFY' }
  ],
  testFile: 'app-layout.spec.tsx'
}
console.log('Cenário 6 - Prioridade (layout > component):')
console.log('Files:', manifest6.files.map(f => f.path))
console.log('Detectado:', pathResolver.detectTestType(manifest6))
console.log('Esperado: layout (maior prioridade)')
console.log()

// Cenário 7: Sem detecção (default para component)
const manifest7 = {
  files: [
    { path: 'src/types/index.ts', action: 'MODIFY' }
  ],
  testFile: 'index.spec.ts'
}
console.log('Cenário 7 - Sem detecção (fallback):')
console.log('Files:', manifest7.files.map(f => f.path))
console.log('Detectado:', pathResolver.detectTestType(manifest7))
console.log('Esperado: component (fallback padrão)')
