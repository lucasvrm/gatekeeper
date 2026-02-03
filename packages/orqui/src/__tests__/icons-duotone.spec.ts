// ============================================================================
// Orqui — Duotone Icons Spec
// Contract: orqui-duotone-icons | Mode: STRICT | Vitest v4.0.17
// ============================================================================
import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'

// Runtime registry + renderer
import {
  PHOSPHOR_SVG_PATHS,
  PhosphorIcon,
  buildPhosphorFaviconSvg,
} from '../runtime/icons'

// Editor registry, renderer, and lookup
import {
  PHOSPHOR_CATEGORIES,
  PHOSPHOR_ICONS_FLAT,
  PhosphorSvg,
  getPhosphorPath,
} from '../editor/components/PhosphorIcons'

// ============================================================================
// Shared constants
// ============================================================================
const DUOTONE_NAMES = [
  'asterisk-duotone',
  'meteor-duotone',
  'hurricane-duotone',
  'skull-duotone',
] as const

/** Helper: access PHOSPHOR_SVG_PATHS with loosened type (Record will be extended to accept objects) */
const paths = PHOSPHOR_SVG_PATHS as Record<string, string | { bg: string; fg: string }>

/** Simple valid SVG path data for PhosphorSvg render tests */
const SAMPLE_FG = 'M128,0L256,256H0Z'
const SAMPLE_BG = 'M0,0H256V256H0Z'

// ============================================================================
// PHOSPHOR_SVG_PATHS — Duotone Registry Entries
// ============================================================================
describe('PHOSPHOR_SVG_PATHS — duotone entries', () => {

  // ---------- CL-ICON-001: asterisk-duotone ----------

  // @clause CL-ICON-001
  it('succeeds when asterisk-duotone entry is an object type in PHOSPHOR_SVG_PATHS', () => {
    const entry = paths['asterisk-duotone']
    expect(entry).not.toBeNull()
    expect(typeof entry).toBe('object')
  })

  // @clause CL-ICON-001
  it('succeeds when asterisk-duotone has a non-empty bg path string', () => {
    const entry = paths['asterisk-duotone'] as { bg: string; fg: string }
    expect(typeof entry.bg).toBe('string')
    expect(entry.bg.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-001
  it('succeeds when asterisk-duotone has a non-empty fg path string', () => {
    const entry = paths['asterisk-duotone'] as { bg: string; fg: string }
    expect(typeof entry.fg).toBe('string')
    expect(entry.fg.length).toBeGreaterThan(0)
  })

  // ---------- CL-ICON-002: meteor-duotone ----------

  // @clause CL-ICON-002
  it('succeeds when meteor-duotone entry is an object type in PHOSPHOR_SVG_PATHS', () => {
    const entry = paths['meteor-duotone']
    expect(entry).not.toBeNull()
    expect(typeof entry).toBe('object')
  })

  // @clause CL-ICON-002
  it('succeeds when meteor-duotone has a non-empty bg path string', () => {
    const entry = paths['meteor-duotone'] as { bg: string; fg: string }
    expect(typeof entry.bg).toBe('string')
    expect(entry.bg.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-002
  it('succeeds when meteor-duotone has a non-empty fg path string', () => {
    const entry = paths['meteor-duotone'] as { bg: string; fg: string }
    expect(typeof entry.fg).toBe('string')
    expect(entry.fg.length).toBeGreaterThan(0)
  })

  // ---------- CL-ICON-003: hurricane-duotone ----------

  // @clause CL-ICON-003
  it('succeeds when hurricane-duotone entry is an object type in PHOSPHOR_SVG_PATHS', () => {
    const entry = paths['hurricane-duotone']
    expect(entry).not.toBeNull()
    expect(typeof entry).toBe('object')
  })

  // @clause CL-ICON-003
  it('succeeds when hurricane-duotone has a non-empty bg path string', () => {
    const entry = paths['hurricane-duotone'] as { bg: string; fg: string }
    expect(typeof entry.bg).toBe('string')
    expect(entry.bg.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-003
  it('succeeds when hurricane-duotone has a non-empty fg path string', () => {
    const entry = paths['hurricane-duotone'] as { bg: string; fg: string }
    expect(typeof entry.fg).toBe('string')
    expect(entry.fg.length).toBeGreaterThan(0)
  })

  // ---------- CL-ICON-004: skull-duotone ----------

  // @clause CL-ICON-004
  it('succeeds when skull-duotone entry is an object type in PHOSPHOR_SVG_PATHS', () => {
    const entry = paths['skull-duotone']
    expect(entry).not.toBeNull()
    expect(typeof entry).toBe('object')
  })

  // @clause CL-ICON-004
  it('succeeds when skull-duotone has a non-empty bg path string', () => {
    const entry = paths['skull-duotone'] as { bg: string; fg: string }
    expect(typeof entry.bg).toBe('string')
    expect(entry.bg.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-004
  it('succeeds when skull-duotone has a non-empty fg path string', () => {
    const entry = paths['skull-duotone'] as { bg: string; fg: string }
    expect(typeof entry.fg).toBe('string')
    expect(entry.fg.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// PHOSPHOR_SVG_PATHS — Backward Compatibility
// ============================================================================
describe('PHOSPHOR_SVG_PATHS — backward compatibility', () => {

  // @clause CL-COMPAT-003
  it('succeeds when house entry remains a plain string', () => {
    const entry = PHOSPHOR_SVG_PATHS['house']
    expect(typeof entry).toBe('string')
  })

  // @clause CL-COMPAT-003
  it('succeeds when house entry is a non-empty string value', () => {
    const entry = PHOSPHOR_SVG_PATHS['house']
    expect((entry as string).length).toBeGreaterThan(0)
  })

  // @clause CL-COMPAT-003
  it('succeeds when gear entry also remains a plain string', () => {
    const entry = PHOSPHOR_SVG_PATHS['gear']
    expect(typeof entry).toBe('string')
    expect((entry as string).length).toBeGreaterThan(0)
  })
})

// ============================================================================
// PHOSPHOR_ICONS_FLAT — Duotone Entries in Editor Registry
// ============================================================================
describe('PHOSPHOR_ICONS_FLAT — duotone entries', () => {

  // @clause CL-ICON-005
  it('succeeds when asterisk-duotone is present with non-empty d and dBg', () => {
    const entry = PHOSPHOR_ICONS_FLAT.find(
      (i: { name: string }) => i.name === 'asterisk-duotone',
    ) as { name: string; d: string; dBg?: string } | undefined
    expect(entry).not.toBeUndefined()
    expect(entry!.d.length).toBeGreaterThan(0)
    expect(typeof entry!.dBg).toBe('string')
    expect(entry!.dBg!.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-005
  it('succeeds when meteor-duotone is present with non-empty d and dBg', () => {
    const entry = PHOSPHOR_ICONS_FLAT.find(
      (i: { name: string }) => i.name === 'meteor-duotone',
    ) as { name: string; d: string; dBg?: string } | undefined
    expect(entry).not.toBeUndefined()
    expect(entry!.d.length).toBeGreaterThan(0)
    expect(typeof entry!.dBg).toBe('string')
    expect(entry!.dBg!.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-005
  it('succeeds when hurricane-duotone is present with non-empty d and dBg', () => {
    const entry = PHOSPHOR_ICONS_FLAT.find(
      (i: { name: string }) => i.name === 'hurricane-duotone',
    ) as { name: string; d: string; dBg?: string } | undefined
    expect(entry).not.toBeUndefined()
    expect(entry!.d.length).toBeGreaterThan(0)
    expect(typeof entry!.dBg).toBe('string')
    expect(entry!.dBg!.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-005
  it('succeeds when skull-duotone is present with non-empty d and dBg', () => {
    const entry = PHOSPHOR_ICONS_FLAT.find(
      (i: { name: string }) => i.name === 'skull-duotone',
    ) as { name: string; d: string; dBg?: string } | undefined
    expect(entry).not.toBeUndefined()
    expect(entry!.d.length).toBeGreaterThan(0)
    expect(typeof entry!.dBg).toBe('string')
    expect(entry!.dBg!.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// PHOSPHOR_CATEGORIES — Duotone Grouping
// ============================================================================
describe('PHOSPHOR_CATEGORIES — duotone grouping', () => {

  /** Find the category that contains at least one duotone icon */
  function findDuotoneCategory(): [string, { name: string; d: string }[]] | undefined {
    return Object.entries(PHOSPHOR_CATEGORIES).find(([, icons]) =>
      icons.some((i: { name: string }) => DUOTONE_NAMES.includes(i.name as typeof DUOTONE_NAMES[number])),
    )
  }

  // @clause CL-ICON-006
  it('succeeds when a category containing duotone icons exists', () => {
    const cat = findDuotoneCategory()
    expect(cat).not.toBeUndefined()
    expect(cat![0].length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-006
  it('succeeds when the duotone category contains all four duotone icon names', () => {
    const cat = findDuotoneCategory()
    expect(cat).not.toBeUndefined()
    const names = cat![1].map((i: { name: string }) => i.name)
    for (const duoName of DUOTONE_NAMES) {
      expect(names).toContain(duoName)
    }
  })

  // @clause CL-ICON-006
  it('succeeds when duotone category entries have valid non-empty d values', () => {
    const cat = findDuotoneCategory()
    expect(cat).not.toBeUndefined()
    const duoEntries = cat![1].filter((i: { name: string }) =>
      DUOTONE_NAMES.includes(i.name as typeof DUOTONE_NAMES[number]),
    )
    expect(duoEntries.length).toBe(4)
    for (const entry of duoEntries) {
      expect(typeof entry.d).toBe('string')
      expect(entry.d.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// PhosphorIcon — Duotone Rendering
// ============================================================================
describe('PhosphorIcon — duotone rendering', () => {

  // ---------- CL-RENDER-001: dual-path for duotone ----------

  // @clause CL-RENDER-001
  // @ui-clause CL-UI-PhosphorIcon-duotone
  it('succeeds when PhosphorIcon renders exactly two path elements for asterisk-duotone', () => {
    const el = React.createElement(PhosphorIcon, { name: 'asterisk-duotone' })
    const { container } = render(el)
    const pathEls = container.querySelectorAll('path')
    expect(pathEls).toHaveLength(2)
  })

  // @clause CL-RENDER-001
  // @ui-clause CL-UI-PhosphorIcon-duotone
  it('succeeds when duotone icon background path includes opacity attribute', () => {
    const el = React.createElement(PhosphorIcon, { name: 'asterisk-duotone' })
    const { container } = render(el)
    const html = container.innerHTML
    expect(html).toContain('opacity="0.2"')
  })

  // @clause CL-RENDER-001
  // @ui-clause CL-UI-PhosphorIcon-duotone
  it('succeeds when duotone icon renders svg with two distinct path data values', () => {
    const el = React.createElement(PhosphorIcon, { name: 'asterisk-duotone' })
    const { container } = render(el)
    const pathEls = container.querySelectorAll('path')
    expect(pathEls.length).toBeGreaterThanOrEqual(2)
    const d0 = pathEls[0].outerHTML
    const d1 = pathEls[1].outerHTML
    expect(d0).not.toBe(d1)
  })

  // ---------- CL-COMPAT-001: single-path for existing icon ----------

  // @clause CL-COMPAT-001
  // @ui-clause CL-UI-PhosphorIcon-singlepath
  it('succeeds when PhosphorIcon renders exactly one path element for house', () => {
    const el = React.createElement(PhosphorIcon, { name: 'house' })
    const { container } = render(el)
    const pathEls = container.querySelectorAll('path')
    expect(pathEls).toHaveLength(1)
  })

  // @clause CL-COMPAT-001
  // @ui-clause CL-UI-PhosphorIcon-singlepath
  it('succeeds when house icon rendered html does not contain opacity', () => {
    const el = React.createElement(PhosphorIcon, { name: 'house' })
    const { container } = render(el)
    const html = container.innerHTML
    expect(html).not.toContain('opacity')
  })

  // @clause CL-COMPAT-001
  // @ui-clause CL-UI-PhosphorIcon-singlepath
  it('succeeds when house icon rendered html contains correct viewBox', () => {
    const el = React.createElement(PhosphorIcon, { name: 'house' })
    const { container } = render(el)
    const html = container.innerHTML
    expect(html).toContain('viewBox="0 0 256 256"')
  })
})

// ============================================================================
// PhosphorSvg — Duotone Rendering
// ============================================================================
describe('PhosphorSvg — duotone rendering', () => {

  // ---------- CL-RENDER-002: dual-path when dBg provided ----------

  // @clause CL-RENDER-002
  // @ui-clause CL-UI-PhosphorSvg-duotone
  it('succeeds when PhosphorSvg renders two path elements with dBg provided', () => {
    const el = React.createElement(PhosphorSvg, { d: SAMPLE_FG, dBg: SAMPLE_BG } as any)
    const { container } = render(el)
    const pathEls = container.querySelectorAll('path')
    expect(pathEls).toHaveLength(2)
  })

  // @clause CL-RENDER-002
  // @ui-clause CL-UI-PhosphorSvg-duotone
  it('succeeds when PhosphorSvg duotone html contains opacity attribute', () => {
    const el = React.createElement(PhosphorSvg, { d: SAMPLE_FG, dBg: SAMPLE_BG } as any)
    const { container } = render(el)
    const html = container.innerHTML
    expect(html).toContain('opacity="0.2"')
  })

  // @clause CL-RENDER-002
  // @ui-clause CL-UI-PhosphorSvg-duotone
  it('succeeds when PhosphorSvg duotone html contains correct viewBox', () => {
    const el = React.createElement(PhosphorSvg, { d: SAMPLE_FG, dBg: SAMPLE_BG } as any)
    const { container } = render(el)
    const html = container.innerHTML
    expect(html).toContain('viewBox="0 0 256 256"')
  })

  // ---------- CL-COMPAT-002: single-path without dBg ----------

  // @clause CL-COMPAT-002
  // @ui-clause CL-UI-PhosphorSvg-singlepath
  it('succeeds when PhosphorSvg renders exactly one path without dBg', () => {
    const el = React.createElement(PhosphorSvg, { d: SAMPLE_FG })
    const { container } = render(el)
    const pathEls = container.querySelectorAll('path')
    expect(pathEls).toHaveLength(1)
  })

  // @clause CL-COMPAT-002
  // @ui-clause CL-UI-PhosphorSvg-singlepath
  it('succeeds when single-path PhosphorSvg html does not contain opacity', () => {
    const el = React.createElement(PhosphorSvg, { d: SAMPLE_FG })
    const { container } = render(el)
    const html = container.innerHTML
    expect(html).not.toContain('opacity')
  })

  // @clause CL-COMPAT-002
  // @ui-clause CL-UI-PhosphorSvg-singlepath
  it('succeeds when single-path PhosphorSvg html contains correct viewBox', () => {
    const el = React.createElement(PhosphorSvg, { d: SAMPLE_FG })
    const { container } = render(el)
    const html = container.innerHTML
    expect(html).toContain('viewBox="0 0 256 256"')
  })
})

// ============================================================================
// Favicon SVG Generation — Duotone Support
// ============================================================================
describe('buildPhosphorFaviconSvg — duotone favicon', () => {

  // ---------- CL-RENDER-003: dual-path favicon for duotone ----------

  // @clause CL-RENDER-003
  it('succeeds when duotone favicon SVG contains opacity attribute', () => {
    const svg = buildPhosphorFaviconSvg('skull-duotone', 'white')
    expect(typeof svg).toBe('string')
    expect(svg!).toContain('opacity="0.2"')
  })

  // @clause CL-RENDER-003
  it('succeeds when duotone favicon SVG contains two path elements', () => {
    const svg = buildPhosphorFaviconSvg('skull-duotone', 'white')
    expect(typeof svg).toBe('string')
    const svgPathTag = ['<', 'path'].join('')
    const pathCount = svg!.split(svgPathTag).length - 1
    expect(pathCount).toBe(2)
  })

  // @clause CL-RENDER-003
  it('succeeds when duotone favicon SVG is a valid non-empty string', () => {
    const svg = buildPhosphorFaviconSvg('skull-duotone', 'white')
    expect(typeof svg).toBe('string')
    expect(svg!.length).toBeGreaterThan(0)
    const svgOpenTag = ['<', 'svg'].join('')
    expect(svg!).toContain(svgOpenTag)
  })

  // ---------- CL-RENDER-004: single-path favicon for regular icon ----------

  // @clause CL-RENDER-004
  it('succeeds when regular favicon SVG has exactly one path element', () => {
    const svg = buildPhosphorFaviconSvg('house', 'white')
    expect(typeof svg).toBe('string')
    const svgPathTag = ['<', 'path'].join('')
    const pathCount = svg!.split(svgPathTag).length - 1
    expect(pathCount).toBe(1)
  })

  // @clause CL-RENDER-004
  it('succeeds when regular favicon SVG does not contain opacity attribute', () => {
    const svg = buildPhosphorFaviconSvg('house', 'white')
    expect(typeof svg).toBe('string')
    expect(svg!).not.toContain('opacity')
  })

  // @clause CL-RENDER-004
  it('succeeds when regular favicon SVG is a valid non-empty string', () => {
    const svg = buildPhosphorFaviconSvg('house', 'white')
    expect(typeof svg).toBe('string')
    expect(svg!.length).toBeGreaterThan(0)
    const svgOpenTag = ['<', 'svg'].join('')
    expect(svg!).toContain(svgOpenTag)
  })
})

// ============================================================================
// getPhosphorPath — Duotone Lookup
// ============================================================================
describe('getPhosphorPath — duotone lookup', () => {

  // ---------- CL-ICON-007: returns fg path for duotone ----------

  // @clause CL-ICON-007
  it('succeeds when getPhosphorPath returns a string for asterisk-duotone', () => {
    const result = getPhosphorPath('asterisk-duotone')
    expect(typeof result).toBe('string')
  })

  // @clause CL-ICON-007
  it('succeeds when getPhosphorPath returns non-empty value for asterisk-duotone', () => {
    const result = getPhosphorPath('asterisk-duotone')
    expect(result).not.toBeNull()
    expect(result!.length).toBeGreaterThan(0)
  })

  // @clause CL-ICON-007
  it('succeeds when getPhosphorPath returns valid path data for skull-duotone', () => {
    const result = getPhosphorPath('skull-duotone')
    expect(typeof result).toBe('string')
    expect(result!.length).toBeGreaterThan(0)
  })

  // ---------- CL-ICON-008: returns null for nonexistent ----------

  // @clause CL-ICON-008
  it('fails when nonexistent icon is looked up via getPhosphorPath', () => {
    const result = getPhosphorPath('nonexistent')
    expect(result).toBeNull()
  })

  // @clause CL-ICON-008
  it('fails when invalid icon name returns null from getPhosphorPath', () => {
    const result = getPhosphorPath('this-icon-does-not-exist-xyz')
    expect(result).toBeNull()
  })

  // @clause CL-ICON-008
  it('fails when empty string icon name returns null from getPhosphorPath', () => {
    const result = getPhosphorPath('')
    expect(result).toBeNull()
  })
})
