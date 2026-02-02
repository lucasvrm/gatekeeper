import type { ValidatorDefinition, ValidationContext, ValidatorOutput, ValidatorContextFinding, UIRegistryComponent } from '../../../types/index.js'

// HTML native elements that should be ignored
const HTML_NATIVE_ELEMENTS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
  'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
  'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd',
  'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'meta', 'meter', 'nav',
  'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress',
  'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small',
  'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'svg', 'table', 'tbody', 'td',
  'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul',
  'var', 'video', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
  'g', 'text', 'tspan', 'defs', 'clipPath', 'mask', 'pattern', 'image', 'use', 'symbol',
  'linearGradient', 'radialGradient', 'stop', 'foreignObject'
])

// Default ignored prefixes
const DEFAULT_IGNORED_PREFIXES = ['Lucide', 'Icon']

// Regex to find JSX components - matches <ComponentName or <Component.Sub
const JSX_COMPONENT_REGEX = /<([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)?)\s*(?:[^>]*?)(?:\/?>)/g

// Regex to find locally defined components
const LOCAL_FUNCTION_COMPONENT_REGEX = /(?:^|\n)\s*(?:export\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*\(/g
const LOCAL_CONST_COMPONENT_REGEX = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*(?:\([^)]*\)|[^=])*=>/g

function findLocalComponents(content: string): Set<string> {
  const localComponents = new Set<string>()

  let match
  const funcRegex = new RegExp(LOCAL_FUNCTION_COMPONENT_REGEX.source, 'g')
  while ((match = funcRegex.exec(content)) !== null) {
    localComponents.add(match[1])
  }

  const constRegex = new RegExp(LOCAL_CONST_COMPONENT_REGEX.source, 'g')
  while ((match = constRegex.exec(content)) !== null) {
    localComponents.add(match[1])
  }

  return localComponents
}

function findJSXComponents(content: string): string[] {
  const components: string[] = []
  const regex = new RegExp(JSX_COMPONENT_REGEX.source, 'g')
  let match
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].split('.')[0] // Handle Component.SubComponent
    components.push(name)
  }
  return components
}

function getSuggestions(unknown: string, registryComponents: string[]): string[] {
  const suggestions: string[] = []
  const lowerUnknown = unknown.toLowerCase()

  for (const comp of registryComponents) {
    const lowerComp = comp.toLowerCase()
    // Check for substring match
    if (lowerComp.includes(lowerUnknown) || lowerUnknown.includes(lowerComp)) {
      suggestions.push(comp)
    }
  }

  // If no substring matches, try common patterns
  if (suggestions.length === 0) {
    // Modal -> Dialog, AlertDialog
    if (lowerUnknown.includes('modal')) {
      for (const comp of registryComponents) {
        if (comp.toLowerCase().includes('dialog')) {
          suggestions.push(comp)
        }
      }
    }
    // Selector -> Select
    if (lowerUnknown.includes('selector')) {
      for (const comp of registryComponents) {
        if (comp.toLowerCase().includes('select')) {
          suggestions.push(comp)
        }
      }
    }
    // Grid -> Table, DataTable
    if (lowerUnknown.includes('grid') || lowerUnknown.includes('data')) {
      for (const comp of registryComponents) {
        if (comp.toLowerCase().includes('table')) {
          suggestions.push(comp)
        }
      }
    }
  }

  return [...new Set(suggestions)].slice(0, 3)
}

export const UIComponentRegistryValidator: ValidatorDefinition = {
  code: 'UI_COMPONENT_REGISTRY',
  name: 'UI Component Registry',
  description: 'Verifica se componentes JSX usados no código existem no registry de componentes do projeto',
  gate: 2,
  order: 3,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-REG-001: SKIPPED when uiContracts is null
    if (!ctx.uiContracts || !ctx.uiContracts.registry) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No UI registry contract available. Skipping component validation.',
        context: {
          inputs: [{ label: 'uiContracts', value: ctx.uiContracts ? 'present but no registry' : 'null' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'No UI registry contract found' }],
          reasoning: 'UI registry contract not loaded, validation skipped.',
        },
      }
    }

    // CL-REG-002: SKIPPED when manifest is null or empty
    if (!ctx.manifest || !ctx.manifest.files || ctx.manifest.files.length === 0) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest or empty manifest. Skipping component validation.',
        context: {
          inputs: [{ label: 'manifest', value: ctx.manifest ? 'empty files' : 'null' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'No manifest files to analyze' }],
          reasoning: 'Manifest is null or has no files, validation skipped.',
        },
      }
    }

    const registry = ctx.uiContracts.registry
    const registryComponents = new Set(Object.keys(registry.components))
    const registryComponentsList = Object.keys(registry.components)

    // Get config values
    const ignoredPrefixesStr = ctx.config.get('UI_IGNORED_COMPONENT_PREFIXES') || 'Lucide,Icon'
    const ignoredPrefixes = ignoredPrefixesStr.split(',').map(p => p.trim())

    const extraComponentsStr = ctx.config.get('UI_ALLOWED_EXTRA_COMPONENTS') || ''
    const extraComponents = new Set(
      extraComponentsStr.split(',').map(c => c.trim()).filter(c => c.length > 0)
    )

    // CL-REG-008: Filter to only TSX/JSX files that are not tests and not DELETE actions
    const filesToAnalyze = ctx.manifest.files.filter(f => {
      if (f.action === 'DELETE') return false
      const path = f.path.toLowerCase()
      if (!path.endsWith('.tsx') && !path.endsWith('.jsx')) return false
      if (path.includes('.spec.') || path.includes('.test.')) return false
      return true
    })

    if (filesToAnalyze.length === 0) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No TSX/JSX files to analyze in manifest.',
        context: {
          inputs: [{ label: 'manifest', value: ctx.manifest }],
          analyzed: [],
          findings: [{ type: 'info', message: 'No analyzable files' }],
          reasoning: 'No TSX/JSX files (excluding tests) found in manifest.',
        },
      }
    }

    const findings: ValidatorContextFinding[] = []
    const unknownComponentsSet = new Set<string>()
    const unknownComponentsDetails: Array<{ component: string; file: string; suggestions: string[] }> = []
    let totalComponentsFound = 0
    let validComponents = 0
    const analyzedFiles: string[] = []

    for (const file of filesToAnalyze) {
      let content: string
      try {
        content = await ctx.services.git.readFile(file.path)
      } catch (error) {
        findings.push({
          type: 'warning',
          message: `Could not read file: ${file.path}`,
          location: file.path,
        })
        continue
      }

      analyzedFiles.push(file.path)

      // CL-REG-011: Find locally defined components
      const localComponents = findLocalComponents(content)

      // Find all JSX components used
      const components = findJSXComponents(content)

      for (const component of components) {
        totalComponentsFound++

        // CL-REG-005: Skip HTML native elements
        if (HTML_NATIVE_ELEMENTS.has(component) || HTML_NATIVE_ELEMENTS.has(component.toLowerCase())) {
          validComponents++
          continue
        }

        // CL-REG-006: Skip ignored prefixes
        if (ignoredPrefixes.some(prefix => component.startsWith(prefix))) {
          validComponents++
          continue
        }

        // Check if in registry
        if (registryComponents.has(component)) {
          validComponents++
          continue
        }

        // CL-REG-007: Check if in extra allowed components
        if (extraComponents.has(component)) {
          validComponents++
          continue
        }

        // CL-REG-011: Check if locally defined
        if (localComponents.has(component)) {
          validComponents++
          continue
        }

        // Unknown component
        if (!unknownComponentsSet.has(component)) {
          unknownComponentsSet.add(component)
          const suggestions = getSuggestions(component, registryComponentsList)
          unknownComponentsDetails.push({
            component,
            file: file.path,
            suggestions,
          })
        }
      }
    }

    const unknownComponents = unknownComponentsSet.size

    // CL-REG-003: PASSED when all components are valid
    if (unknownComponents === 0) {
      return {
        passed: true,
        status: 'PASSED',
        message: 'All UI components are valid.',
        context: {
          inputs: [
            { label: 'Registry Components', value: registryComponentsList.length },
            { label: 'Files Analyzed', value: analyzedFiles },
          ],
          analyzed: [
            { label: 'Analyzed Files', items: analyzedFiles },
            { label: 'Valid Components Found', items: [`${validComponents} components`] },
          ],
          findings: [{ type: 'pass', message: 'All components exist in registry or are allowed' }],
          reasoning: 'All JSX components used in the code are valid.',
        },
        metrics: {
          totalComponentsFound,
          validComponents,
          unknownComponents: 0,
          filesAnalyzed: analyzedFiles.length,
        },
      }
    }

    // CL-REG-004, CL-REG-009, CL-REG-010: FAILED with suggestions
    const evidenceLines: string[] = []
    for (const { component, file, suggestions } of unknownComponentsDetails) {
      let line = `Component "${component}" used in ${file} is not in the UI registry.`
      if (suggestions.length > 0) {
        const suggestionParts = suggestions.map(s => {
          const comp = registry.components[s]
          return comp ? `${s} (category: ${comp.category})` : s
        })
        line += `\n  → Did you mean ${suggestionParts.join(' or ')}?`
      }
      evidenceLines.push(line)

      findings.push({
        type: 'fail',
        message: `Unknown component: ${component}`,
        location: file,
      })
    }

    return {
      passed: false,
      status: 'FAILED',
      message: `${unknownComponents} unknown component(s) found.`,
      evidence: evidenceLines.join('\n\n'),
      context: {
        inputs: [
          { label: 'Registry Components', value: registryComponentsList.length },
          { label: 'Files Analyzed', value: analyzedFiles },
        ],
        analyzed: [
          { label: 'Analyzed Files', items: analyzedFiles },
          { label: 'Unknown Components', items: unknownComponentsDetails.map(d => d.component) },
        ],
        findings,
        reasoning: `Found ${unknownComponents} component(s) not registered in UI registry.`,
      },
      metrics: {
        totalComponentsFound,
        validComponents,
        unknownComponents,
        filesAnalyzed: analyzedFiles.length,
      },
    }
  },
}
