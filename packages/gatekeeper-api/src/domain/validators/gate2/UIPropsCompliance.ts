import type { ValidatorDefinition, ValidationContext, ValidatorOutput, ValidatorContextFinding, UIComponentProp } from '../../../types/index.js'

// HTML generic props that are always allowed (even in strict mode)
const HTML_GENERIC_PROPS = new Set([
  'className', 'style', 'id', 'key', 'ref', 'children',
  'onClick', 'onChange', 'onSubmit', 'onBlur', 'onFocus',
  'onKeyDown', 'onKeyUp', 'onKeyPress', 'onMouseDown', 'onMouseUp',
  'onMouseEnter', 'onMouseLeave', 'onScroll', 'onLoad', 'onError',
])

// Regex to match JSX opening tags with their props
// Matches: <ComponentName prop="value" prop={expr} {...spread}>
const JSX_TAG_REGEX = /<([A-Z][a-zA-Z0-9]*)\s*([^>]*?)(?:\/?>)/gs

// Regex to extract individual props from the props string
// Matches: propName="value" or propName={expr} or propName (boolean shorthand) or {...spread}
const PROP_REGEX = /(?:(\{\.\.\.[\w.]+\})|([a-zA-Z_][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})|(?=\s|\/|>)))/g

interface PropInfo {
  name: string
  value: string | null  // null for boolean shorthand or dynamic expressions
  isDynamic: boolean    // true if value is {expr}
  isSpread: boolean     // true if {...props}
}

interface ComponentInstance {
  componentName: string
  file: string
  props: PropInfo[]
  hasSpread: boolean
}

function extractProps(propsString: string): PropInfo[] {
  const props: PropInfo[] = []
  const regex = new RegExp(PROP_REGEX.source, 'g')
  let match

  while ((match = regex.exec(propsString)) !== null) {
    const [, spreadMatch, propName, doubleQuoteValue, singleQuoteValue, braceValue] = match

    if (spreadMatch) {
      props.push({
        name: '__spread__',
        value: null,
        isDynamic: true,
        isSpread: true,
      })
    } else if (propName) {
      const literalValue = doubleQuoteValue ?? singleQuoteValue ?? null
      const isDynamic = braceValue !== undefined && literalValue === null

      props.push({
        name: propName,
        value: literalValue,
        isDynamic,
        isSpread: false,
      })
    }
  }

  return props
}

function findComponentInstances(content: string, file: string): ComponentInstance[] {
  const instances: ComponentInstance[] = []
  const regex = new RegExp(JSX_TAG_REGEX.source, 'gs')
  let match

  while ((match = regex.exec(content)) !== null) {
    const [, componentName, propsString] = match
    // Skip HTML elements (lowercase first letter)
    if (componentName[0] === componentName[0].toLowerCase()) continue

    const props = extractProps(propsString || '')
    const hasSpread = props.some(p => p.isSpread)

    instances.push({
      componentName,
      file,
      props,
      hasSpread,
    })
  }

  return instances
}

function isGenericHtmlProp(propName: string): boolean {
  if (HTML_GENERIC_PROPS.has(propName)) return true
  if (propName.startsWith('data-')) return true
  if (propName.startsWith('aria-')) return true
  if (propName.startsWith('on') && propName[2] === propName[2].toUpperCase()) return true
  return false
}

export const UIPropsComplianceValidator: ValidatorDefinition = {
  code: 'UI_PROPS_COMPLIANCE',
  name: 'UI Props Compliance',
  description: 'Verifica se as props passadas a componentes UI estão corretas (enum values, props obrigatórias)',
  gate: 2,
  order: 4,
  isHardBlock: true,

  async execute(ctx: ValidationContext): Promise<ValidatorOutput> {
    // CL-PRP-001: SKIPPED when uiContracts is null
    if (!ctx.uiContracts || !ctx.uiContracts.registry) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No UI registry contract available. Skipping props validation.',
        context: {
          inputs: [{ label: 'uiContracts', value: ctx.uiContracts ? 'present but no registry' : 'null' }],
          analyzed: [],
          findings: [{ type: 'info', message: 'No UI registry contract found' }],
          reasoning: 'UI registry contract not loaded, validation skipped.',
        },
      }
    }

    // CL-PRP-002: SKIPPED when manifest is null or empty
    if (!ctx.manifest || !ctx.manifest.files || ctx.manifest.files.length === 0) {
      return {
        passed: true,
        status: 'SKIPPED',
        message: 'No manifest or empty manifest. Skipping props validation.',
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

    // Get config values
    const strictMode = ctx.config.get('UI_STRICT_PROPS') === 'true'

    // Filter to only TSX/JSX files that are not tests and not DELETE actions
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
    const evidenceLines: string[] = []
    const analyzedFiles: string[] = []

    let totalInstances = 0
    let totalPropsChecked = 0
    let enumViolations = 0
    let missingRequiredProps = 0
    let unknownPropsWarnings = 0
    let spreadWarnings = 0

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

      const instances = findComponentInstances(content, file.path)

      for (const instance of instances) {
        // CL-PRP-009: Skip components not in registry
        if (!registryComponents.has(instance.componentName)) {
          continue
        }

        totalInstances++

        const componentContract = registry.components[instance.componentName]
        const contractProps = componentContract.props || {}
        const instancePropNames = new Set(instance.props.filter(p => !p.isSpread).map(p => p.name))

        // CL-PRP-008, CL-PRP-014: Check for spread operator
        if (instance.hasSpread) {
          spreadWarnings++
          findings.push({
            type: 'warning',
            message: `${instance.componentName} uses spread operator - cannot verify all props`,
            location: instance.file,
          })
          // Skip required props check for spread instances
          continue
        }

        // Check each prop in the instance
        for (const prop of instance.props) {
          if (prop.isSpread) continue

          totalPropsChecked++

          const propContract = contractProps[prop.name]

          // CL-PRP-011, CL-PRP-012: Unknown prop handling
          if (!propContract) {
            // CL-PRP-013: Always allow HTML generic props
            if (isGenericHtmlProp(prop.name)) {
              continue
            }

            // CL-PRP-012: Strict mode - warn about unknown props
            if (strictMode) {
              unknownPropsWarnings++
              findings.push({
                type: 'warning',
                message: `Unknown prop "${prop.name}" on ${instance.componentName}`,
                location: instance.file,
              })
            }
            continue
          }

          // CL-PRP-007: Skip dynamic expressions
          if (prop.isDynamic || prop.value === null) {
            continue
          }

          // CL-PRP-004: Check enum values
          if (propContract.type === 'enum' && propContract.enumValues && prop.value !== null) {
            if (!propContract.enumValues.includes(prop.value)) {
              enumViolations++
              const validValues = propContract.enumValues.join(', ')
              const errorMsg = `[ERROR] ${instance.componentName} in ${instance.file}: ${prop.name}="${prop.value}" is not a valid value.\n  → Valid values: ${validValues}`
              evidenceLines.push(errorMsg)
              findings.push({
                type: 'fail',
                message: `Invalid enum value: ${prop.name}="${prop.value}"`,
                location: instance.file,
              })
            }
          }
        }

        // CL-PRP-005, CL-PRP-006: Check required props (only for non-spread instances)
        for (const [propName, propContract] of Object.entries(contractProps)) {
          if (propContract.required && propContract.default === undefined) {
            // Check if prop is provided (either literally or dynamically)
            const hasProp = instancePropNames.has(propName)
            const hasDynamic = instance.props.some(p => p.name === propName && p.isDynamic)

            if (!hasProp && !hasDynamic) {
              missingRequiredProps++
              const errorMsg = `[ERROR] ${instance.componentName} in ${instance.file}: missing required prop "${propName}"`
              evidenceLines.push(errorMsg)
              findings.push({
                type: 'fail',
                message: `Missing required prop: ${propName}`,
                location: instance.file,
              })
            }
          }
        }
      }
    }

    const hasErrors = enumViolations > 0 || missingRequiredProps > 0
    const hasWarnings = spreadWarnings > 0 || unknownPropsWarnings > 0

    // CL-PRP-003: PASSED when all props are valid
    if (!hasErrors && !hasWarnings) {
      return {
        passed: true,
        status: 'PASSED',
        message: 'All UI component props are valid.',
        context: {
          inputs: [
            { label: 'Files Analyzed', value: analyzedFiles },
            { label: 'Strict Mode', value: strictMode },
          ],
          analyzed: [
            { label: 'Analyzed Files', items: analyzedFiles },
            { label: 'Component Instances Checked', items: [`${totalInstances} instances`] },
          ],
          findings: [{ type: 'pass', message: 'All props are valid' }],
          reasoning: 'All component props comply with the UI registry contract.',
        },
        metrics: {
          totalInstances,
          totalPropsChecked,
          enumViolations: 0,
          missingRequiredProps: 0,
          unknownPropsWarnings: 0,
        },
      }
    }

    // CL-PRP-004, CL-PRP-005: FAILED if errors
    if (hasErrors) {
      return {
        passed: false,
        status: 'FAILED',
        message: `Found ${enumViolations} enum violation(s) and ${missingRequiredProps} missing required prop(s).`,
        evidence: evidenceLines.join('\n\n'),
        context: {
          inputs: [
            { label: 'Files Analyzed', value: analyzedFiles },
            { label: 'Strict Mode', value: strictMode },
          ],
          analyzed: [
            { label: 'Analyzed Files', items: analyzedFiles },
            { label: 'Component Instances Checked', items: [`${totalInstances} instances`] },
          ],
          findings,
          reasoning: `Props validation failed with ${enumViolations} enum violation(s) and ${missingRequiredProps} missing required prop(s).`,
        },
        metrics: {
          totalInstances,
          totalPropsChecked,
          enumViolations,
          missingRequiredProps,
          unknownPropsWarnings,
        },
      }
    }

    // CL-PRP-008: WARNING if only warnings (spread or unknown props in strict mode)
    return {
      passed: true,
      status: 'WARNING',
      message: `Props validation passed with warnings: ${spreadWarnings} spread operator(s), ${unknownPropsWarnings} unknown prop(s).`,
      evidence: spreadWarnings > 0 ? 'Spread operators detected - cannot fully verify required props.' : undefined,
      context: {
        inputs: [
          { label: 'Files Analyzed', value: analyzedFiles },
          { label: 'Strict Mode', value: strictMode },
        ],
        analyzed: [
          { label: 'Analyzed Files', items: analyzedFiles },
          { label: 'Component Instances Checked', items: [`${totalInstances} instances`] },
        ],
        findings,
        reasoning: `Props validation passed but has warnings: ${spreadWarnings} spread operator(s), ${unknownPropsWarnings} unknown prop(s).`,
      },
      metrics: {
        totalInstances,
        totalPropsChecked,
        enumViolations: 0,
        missingRequiredProps: 0,
        unknownPropsWarnings,
      },
    }
  },
}
