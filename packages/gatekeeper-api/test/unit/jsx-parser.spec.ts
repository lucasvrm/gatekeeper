/**
 * Tests for the balanced JSX parser utility.
 *
 * These tests verify that the parser correctly handles the cases
 * that caused truncation bugs with regex patterns [^}], [^>], [^)].
 */
import { describe, it, expect } from 'vitest'
import { scanWithBalance, findJsxTags, parsePropsFromString, findLocalComponentNames } from '../../src/domain/validators/utils/jsx-parser.js'

// ─────────────────────────────────────────────────────────
// scanWithBalance
// ─────────────────────────────────────────────────────────

describe('scanWithBalance', () => {
  it('finds matching } at depth 0', () => {
    const content = '{ key: "val" }'
    const pos = scanWithBalance(content, 1, 1, (ch, _, depth) => ch === '}' && depth === 0)
    expect(pos).toBe(13)
  })

  it('handles nested objects', () => {
    const content = '{ outer: { inner: "val" } }'
    const pos = scanWithBalance(content, 1, 1, (ch, _, depth) => ch === '}' && depth === 0)
    expect(pos).toBe(content.length - 1)
  })

  it('respects string literals containing delimiters', () => {
    const content = '{ key: "val with } inside" }'
    const pos = scanWithBalance(content, 1, 1, (ch, _, depth) => ch === '}' && depth === 0)
    expect(pos).toBe(content.length - 1)
  })

  it('respects template literals', () => {
    const content = '{ key: `template ${v}` }'
    const pos = scanWithBalance(content, 1, 1, (ch, _, depth) => ch === '}' && depth === 0)
    expect(pos).toBe(content.length - 1)
  })

  it('handles > inside {} for JSX tag scanning', () => {
    const content = 'disabled={count > 5} variant="primary" />'
    const pos = scanWithBalance(content, 0, 0, (ch, nextCh, depth) => {
      if (depth !== 0) return false
      if (ch === '/' && nextCh === '>') return true
      if (ch === '>') return true
      return false
    })
    expect(pos).toBe(content.length - 2) // position of /
  })

  it('returns -1 for unbalanced content', () => {
    const content = '{ unclosed'
    const pos = scanWithBalance(content, 1, 1, (ch, _, depth) => ch === '}' && depth === 0)
    expect(pos).toBe(-1)
  })
})

// ─────────────────────────────────────────────────────────
// findJsxTags
// ─────────────────────────────────────────────────────────

describe('findJsxTags', () => {
  it('finds simple self-closing tags', () => {
    const tags = findJsxTags('<Button variant="primary" />')
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('Button')
    expect(tags[0].isSelfClosing).toBe(true)
    expect(tags[0].propsString).toBe('variant="primary"')
  })

  it('finds opening tags', () => {
    const tags = findJsxTags('<Container className="main">content</Container>')
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('Container')
    expect(tags[0].isSelfClosing).toBe(false)
  })

  it('handles comparison operators in props (the key bug fix)', () => {
    const tags = findJsxTags('<Button disabled={count > 5} variant="primary" />')
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('Button')
    expect(tags[0].propsString).toContain('variant="primary"')
  })

  it('handles ternary operators in props', () => {
    const tags = findJsxTags('<Text color={active ? "green" : "red"} size="lg" />')
    expect(tags).toHaveLength(1)
    expect(tags[0].propsString).toContain('size="lg"')
  })

  it('handles nested objects in props', () => {
    const tags = findJsxTags('<DataTable config={{ columns: [{ id: "name" }] }} />')
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('DataTable')
  })

  it('handles arrow functions in props', () => {
    const tags = findJsxTags('<Button onClick={() => { handleClick() }} label="click" />')
    expect(tags).toHaveLength(1)
    expect(tags[0].propsString).toContain('label="click"')
  })

  it('handles template literals in props', () => {
    const tags = findJsxTags('<Label text={`${count} items`} visible />')
    expect(tags).toHaveLength(1)
    expect(tags[0].propsString).toContain('visible')
  })

  it('handles dotted component names', () => {
    const tags = findJsxTags('<Form.Field name="email" />')
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('Form.Field')
  })

  it('ignores lowercase HTML elements', () => {
    const tags = findJsxTags('<div className="box"><span>text</span></div>')
    expect(tags).toHaveLength(0)
  })

  it('finds multiple tags', () => {
    const content = `
      <Header title="Test" />
      <Button onClick={() => { submit() }} />
      <Footer year={2025} />
    `
    const tags = findJsxTags(content)
    expect(tags).toHaveLength(3)
    expect(tags.map(t => t.name)).toEqual(['Header', 'Button', 'Footer'])
  })

  it('handles JSX inside prop expressions', () => {
    const tags = findJsxTags('<Button icon={<Icon name="star" />} label="Save" />')
    expect(tags.length).toBeGreaterThanOrEqual(1)
    const button = tags.find(t => t.name === 'Button')
    expect(button).toBeDefined()
    expect(button!.propsString).toContain('label="Save"')
  })

  it('handles multiline tags', () => {
    const content = `<Card
      title="Hello"
      subtitle={greeting}
      onClick={() => {
        navigate('/home')
      }}
    />`
    const tags = findJsxTags(content)
    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('Card')
    expect(tags[0].propsString).toContain('title="Hello"')
    expect(tags[0].propsString).toContain('subtitle={greeting}')
  })

  it('handles generics in prop expressions', () => {
    const tags = findJsxTags('<List items={filterItems<ItemType>(data)} count={5} />')
    expect(tags).toHaveLength(1)
    expect(tags[0].propsString).toContain('count={5}')
  })
})

// ─────────────────────────────────────────────────────────
// parsePropsFromString
// ─────────────────────────────────────────────────────────

describe('parsePropsFromString', () => {
  it('parses string props', () => {
    const props = parsePropsFromString('variant="primary" size="lg"')
    expect(props).toHaveLength(2)
    expect(props[0]).toMatchObject({ name: 'variant', value: 'primary', isDynamic: false })
    expect(props[1]).toMatchObject({ name: 'size', value: 'lg', isDynamic: false })
  })

  it('parses single-quoted string props', () => {
    const props = parsePropsFromString("variant='primary'")
    expect(props).toHaveLength(1)
    expect(props[0]).toMatchObject({ name: 'variant', value: 'primary', isDynamic: false })
  })

  it('parses dynamic props (simple expression)', () => {
    const props = parsePropsFromString('value={someVar}')
    expect(props).toHaveLength(1)
    expect(props[0]).toMatchObject({ name: 'value', isDynamic: true, isSpread: false })
  })

  it('parses dynamic props with nested objects (the key bug fix)', () => {
    const props = parsePropsFromString('config={{ key: "val", nested: { a: 1 } }}')
    expect(props).toHaveLength(1)
    expect(props[0].name).toBe('config')
    expect(props[0].isDynamic).toBe(true)
    expect(props[0].value).toContain('nested')
    expect(props[0].value).toContain('a: 1')
  })

  it('parses dynamic props with arrow functions', () => {
    const props = parsePropsFromString('onClick={() => { handleClick(); setOpen(true) }}')
    expect(props).toHaveLength(1)
    expect(props[0].name).toBe('onClick')
    expect(props[0].isDynamic).toBe(true)
    expect(props[0].value).toContain('setOpen(true)')
  })

  it('parses boolean shorthand', () => {
    const props = parsePropsFromString('disabled visible')
    expect(props).toHaveLength(2)
    expect(props[0]).toMatchObject({ name: 'disabled', value: null, isDynamic: false })
    expect(props[1]).toMatchObject({ name: 'visible', value: null, isDynamic: false })
  })

  it('parses spread operators', () => {
    const props = parsePropsFromString('{...rest} name="test"')
    expect(props).toHaveLength(2)
    expect(props[0]).toMatchObject({ name: '__spread__', isSpread: true })
    expect(props[1]).toMatchObject({ name: 'name', value: 'test' })
  })

  it('parses mixed props correctly', () => {
    const input = 'label="Save" onClick={() => { save() }} disabled data={{ id: 1 }} {...rest}'
    const props = parsePropsFromString(input)
    expect(props).toHaveLength(5)
    expect(props[0]).toMatchObject({ name: 'label', value: 'Save', isDynamic: false })
    expect(props[1]).toMatchObject({ name: 'onClick', isDynamic: true })
    expect(props[2]).toMatchObject({ name: 'disabled', value: null, isDynamic: false })
    expect(props[3]).toMatchObject({ name: 'data', isDynamic: true })
    expect(props[4]).toMatchObject({ name: '__spread__', isSpread: true })
  })

  it('handles data- and aria- attributes', () => {
    const props = parsePropsFromString('data-testid="btn" aria-label="Submit"')
    expect(props).toHaveLength(2)
    expect(props[0]).toMatchObject({ name: 'data-testid', value: 'btn' })
    expect(props[1]).toMatchObject({ name: 'aria-label', value: 'Submit' })
  })

  it('handles empty props string', () => {
    const props = parsePropsFromString('')
    expect(props).toHaveLength(0)
  })

  it('handles comparison inside dynamic expression', () => {
    const props = parsePropsFromString('disabled={count > 0} variant="primary"')
    expect(props).toHaveLength(2)
    expect(props[0]).toMatchObject({ name: 'disabled', isDynamic: true })
    expect(props[0].value).toContain('count > 0')
    expect(props[1]).toMatchObject({ name: 'variant', value: 'primary', isDynamic: false })
  })
})

// ─────────────────────────────────────────────────────────
// findLocalComponentNames
// ─────────────────────────────────────────────────────────

describe('findLocalComponentNames', () => {
  it('finds function declarations', () => {
    const content = `
      function MyComponent() { return null }
      export function AnotherComponent() { return null }
    `
    const names = findLocalComponentNames(content)
    expect(names.has('MyComponent')).toBe(true)
    expect(names.has('AnotherComponent')).toBe(true)
  })

  it('finds simple const arrow functions', () => {
    const content = `const MyButton = () => null`
    const names = findLocalComponentNames(content)
    expect(names.has('MyButton')).toBe(true)
  })

  it('finds const arrow functions with complex type annotations (the key bug fix)', () => {
    const content = `const MyComp = ({ items }: { items: Array<{id: string}> }) => null`
    const names = findLocalComponentNames(content)
    expect(names.has('MyComp')).toBe(true)
  })

  it('finds typed FC components', () => {
    const content = `const MyComp: React.FC<{ data: ComplexType<Nested> }> = (props) => null`
    const names = findLocalComponentNames(content)
    expect(names.has('MyComp')).toBe(true)
  })

  it('finds HOC-wrapped components', () => {
    const content = `const MyComp = React.memo((props) => null)`
    const names = findLocalComponentNames(content)
    expect(names.has('MyComp')).toBe(true)
  })

  it('finds forwardRef components', () => {
    const content = `const MyComp = React.forwardRef<HTMLDivElement, Props>((props, ref) => null)`
    const names = findLocalComponentNames(content)
    expect(names.has('MyComp')).toBe(true)
  })

  it('ignores lowercase const declarations', () => {
    const content = `const myHelper = () => 'not a component'`
    const names = findLocalComponentNames(content)
    expect(names.has('myHelper')).toBe(false)
  })

  it('finds exported const arrow functions', () => {
    const content = `export const MyDialog = ({ open }: DialogProps) => null`
    const names = findLocalComponentNames(content)
    expect(names.has('MyDialog')).toBe(true)
  })
})
