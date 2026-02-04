/**
 * Shared utility for parsing JSX structures with balanced delimiters.
 *
 * Replaces regex-based approaches that use [^}], [^>], [^)] patterns,
 * which truncate at the first occurrence of the delimiter character
 * even when nested inside objects, ternaries, or type annotations.
 *
 * @see AUDITORIA-REGEX-VALIDATORS.md for full context on the bug class.
 */

// ─────────────────────────────────────────────────────────
// Core: Balanced Scanner
// ─────────────────────────────────────────────────────────

/**
 * Checks whether the character at `pos` is escaped by an odd
 * number of preceding backslashes.
 */
function isEscaped(content: string, pos: number): boolean {
  let backslashes = 0
  let i = pos - 1
  while (i >= 0 && content[i] === '\\') {
    backslashes++
    i--
  }
  return backslashes % 2 === 1
}

/**
 * Scans forward from `startPos`, tracking balanced delimiters
 * ({}, (), []) and string literals ("", '', ``).
 *
 * The `stopFn` is called at each non-string position AFTER depth
 * has been updated. It receives the current character, the next
 * character, and the current depth. Return `true` to stop scanning.
 *
 * @returns Position where `stopFn` returned true, or -1 if not found.
 */
export function scanWithBalance(
  content: string,
  startPos: number,
  initialDepth: number,
  stopFn: (ch: string, nextCh: string, depth: number) => boolean,
): number {
  let pos = startPos
  let depth = initialDepth
  let inString: string | null = null

  while (pos < content.length) {
    const ch = content[pos]
    const nextCh = pos + 1 < content.length ? content[pos + 1] : ''

    // ── String literal tracking ──
    if ((ch === '"' || ch === "'" || ch === '`') && !isEscaped(content, pos)) {
      if (inString === ch) {
        inString = null
      } else if (!inString) {
        inString = ch
      }
      pos++
      continue
    }

    if (inString) {
      pos++
      continue
    }

    // ── Depth tracking (only {}, (), []) ──
    if (ch === '{' || ch === '(' || ch === '[') {
      depth++
    } else if (ch === '}' || ch === ')' || ch === ']') {
      depth--
    }

    // ── Stop condition check ──
    if (stopFn(ch, nextCh, depth)) {
      return pos
    }

    // Safety: if depth went negative, we've left our scope
    if (depth < 0) return -1

    pos++
  }

  return -1
}

// ─────────────────────────────────────────────────────────
// JSX Tag Finder
// ─────────────────────────────────────────────────────────

export interface JsxTagMatch {
  /** Component name, e.g. "Button" or "Component.Sub" */
  name: string
  /** Raw props string between the name and closing > or /> */
  propsString: string
  /** Whether the tag is self-closing (/>) */
  isSelfClosing: boolean
}

/**
 * Find all JSX component tags (names starting with uppercase)
 * in the given content. Correctly handles:
 * - Nested objects in props: `data={{ key: 'val' }}`
 * - Comparison operators: `disabled={count > 5}`
 * - Ternaries: `style={active ? styles.on : styles.off}`
 * - Arrow functions: `onClick={() => { handleClick() }}`
 * - Template literals: `` label={`${count} items`} ``
 *
 * Replaces regex patterns like: `/<([A-Z]...)\s*([^>]*?)(?:\/?>)/gs`
 */
export function findJsxTags(content: string): JsxTagMatch[] {
  const tags: JsxTagMatch[] = []
  // Regex only finds the START of a tag — balanced scanning does the rest
  const tagStartRegex = /<([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)?)\s*/g
  let match: RegExpExecArray | null

  while ((match = tagStartRegex.exec(content)) !== null) {
    const name = match[1]
    const afterName = match.index + match[0].length

    // Scan forward respecting balanced delimiters until > or /> at depth 0
    const endPos = scanWithBalance(content, afterName, 0, (ch, nextCh, depth) => {
      if (depth !== 0) return false
      if (ch === '/' && nextCh === '>') return true
      if (ch === '>') return true
      return false
    })

    if (endPos === -1) continue // Malformed tag, skip

    const isSelfClosing = content[endPos] === '/'
    const propsString = content.slice(afterName, endPos).trim()

    tags.push({ name, propsString, isSelfClosing })

    // Advance regex cursor past this tag
    tagStartRegex.lastIndex = isSelfClosing ? endPos + 2 : endPos + 1
  }

  return tags
}

// ─────────────────────────────────────────────────────────
// Props Parser
// ─────────────────────────────────────────────────────────

export interface ParsedProp {
  name: string
  value: string | null
  isDynamic: boolean
  isSpread: boolean
}

/**
 * Parse a props string (already correctly bounded by `findJsxTags`)
 * into individual prop entries.
 *
 * Correctly handles nested {} in dynamic expressions, unlike
 * regex patterns like: `/(\w+)=\{([^}]*)\}/g`
 *
 * Supported patterns:
 * - `{...spread}`
 * - `propName="string"`
 * - `propName='string'`
 * - `propName={expression}`  (dynamic, with balanced {})
 * - `propName`               (boolean shorthand)
 */
export function parsePropsFromString(propsString: string): ParsedProp[] {
  const props: ParsedProp[] = []
  let pos = 0
  const len = propsString.length

  const skipWs = (): void => {
    while (pos < len && /\s/.test(propsString[pos])) pos++
  }

  while (pos < len) {
    skipWs()
    if (pos >= len) break

    // ── Spread: {...expr} ──
    if (
      propsString[pos] === '{' &&
      pos + 3 < len &&
      propsString[pos + 1] === '.' &&
      propsString[pos + 2] === '.' &&
      propsString[pos + 3] === '.'
    ) {
      const closePos = scanWithBalance(propsString, pos + 1, 1, (ch, _, depth) => ch === '}' && depth === 0)
      if (closePos !== -1) {
        props.push({ name: '__spread__', value: null, isDynamic: true, isSpread: true })
        pos = closePos + 1
      } else {
        pos++ // Skip malformed spread
      }
      continue
    }

    // ── Prop name: [a-zA-Z_][\w-]* ──
    const nameMatch = propsString.slice(pos).match(/^([a-zA-Z_][\w-]*)/)
    if (!nameMatch) {
      pos++ // Skip unexpected character
      continue
    }

    const propName = nameMatch[1]
    pos += propName.length
    skipWs()

    // ── Check for = (prop has a value) ──
    if (pos < len && propsString[pos] === '=') {
      pos++ // skip =
      skipWs()

      if (pos >= len) {
        // Dangling =, treat as boolean shorthand
        props.push({ name: propName, value: null, isDynamic: false, isSpread: false })
        continue
      }

      const valCh = propsString[pos]

      if (valCh === '"' || valCh === "'") {
        // ── String literal value ──
        const quote = valCh
        pos++ // skip opening quote
        let value = ''
        while (pos < len && !(propsString[pos] === quote && !isEscaped(propsString, pos))) {
          value += propsString[pos]
          pos++
        }
        if (pos < len) pos++ // skip closing quote
        props.push({ name: propName, value, isDynamic: false, isSpread: false })
      } else if (valCh === '{') {
        // ── Dynamic expression: { ... } with balanced braces ──
        const exprStart = pos + 1
        const closePos = scanWithBalance(propsString, pos + 1, 1, (ch, _, depth) => ch === '}' && depth === 0)
        if (closePos !== -1) {
          const exprValue = propsString.slice(exprStart, closePos).trim()
          props.push({ name: propName, value: exprValue, isDynamic: true, isSpread: false })
          pos = closePos + 1
        } else {
          // Malformed expression
          props.push({ name: propName, value: null, isDynamic: true, isSpread: false })
          pos++
        }
      } else {
        // Unexpected value format (e.g. bare identifier), treat as dynamic
        props.push({ name: propName, value: null, isDynamic: true, isSpread: false })
      }
    } else {
      // ── Boolean shorthand (no =) ──
      props.push({ name: propName, value: null, isDynamic: false, isSpread: false })
    }
  }

  return props
}

// ─────────────────────────────────────────────────────────
// Local Component Detector
// ─────────────────────────────────────────────────────────

/**
 * Find locally defined React component names in the given content.
 * Handles both function declarations and const arrow functions,
 * including those with complex type annotations that contain
 * nested delimiters.
 *
 * Fixes the `[^)]*` truncation in patterns like:
 * `/const\s+Name\s*=\s*(?:\([^)]*\)|[^=])*=>/g`
 *
 * Example that the old regex failed on:
 * ```ts
 * const MyComp = ({ items }: { items: Array<{id: string}> }) => ...
 * //                                                    ^ old regex stopped here
 * ```
 */
export function findLocalComponentNames(content: string): Set<string> {
  const components = new Set<string>()

  // ── 1. Function declarations ──
  // `function ComponentName(` or `export function ComponentName(`
  const funcRegex = /(?:^|\n)\s*(?:export\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = funcRegex.exec(content)) !== null) {
    components.add(match[1])
  }

  // ── 2. Const arrow functions ──
  // `const ComponentName = ...` or `export const ComponentName: Type = ...`
  // Uses balanced scanning to find => within the statement scope.
  const constDeclRegex = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Z][a-zA-Z0-9]*)\s*(?=[\s:=])/g
  while ((match = constDeclRegex.exec(content)) !== null) {
    const name = match[1]
    const searchStart = match.index + match[0].length

    if (hasArrowInStatement(content, searchStart)) {
      components.add(name)
    }
  }

  return components
}

/**
 * Scans forward from `startPos` looking for `=>` within the current
 * statement, respecting balanced delimiters. Stops at `;` at depth 0
 * or after 1000 characters (safety limit).
 *
 * Allows `=>` at any depth to handle HOC-wrapped components:
 * `const X = React.memo((props) => ...)` — arrow is inside `()`
 */
function hasArrowInStatement(content: string, startPos: number): boolean {
  let pos = startPos
  let depth = 0
  let inString: string | null = null
  const maxScan = Math.min(startPos + 1000, content.length)

  while (pos < maxScan) {
    const ch = content[pos]

    // String tracking
    if ((ch === '"' || ch === "'" || ch === '`') && !isEscaped(content, pos)) {
      if (inString === ch) inString = null
      else if (!inString) inString = ch
      pos++
      continue
    }
    if (inString) {
      pos++
      continue
    }

    // Depth tracking (only {}, (), [])
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') {
      depth--
      if (depth < 0) return false // Left scope
    }

    // Found => (at any depth, to handle HOC wrappers)
    if (ch === '=' && pos + 1 < content.length && content[pos + 1] === '>') {
      return true
    }

    // Statement boundary at depth 0
    if (depth === 0 && ch === ';') return false

    pos++
  }

  return false
}
