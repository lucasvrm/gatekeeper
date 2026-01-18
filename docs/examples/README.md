# Contract.json Examples

This directory contains reference examples for the `contract.json` v1 specification.

## Available Examples

### 1. API Contract Example

**File:** `contract_user-authentication-api.json`

**Description:** Demonstrates a STRICT mode contract for a backend API authentication feature.

**Key Features:**
- STRICT mode (100% coverage required)
- High criticality (enforces rigorous testing)
- Mixed clause types: behavior, error, security
- HTTP assertion surface
- Negative test cases for error and security clauses

**Use Case:** Backend API development with security requirements

---

### 2. UI Contract Example

**File:** `contract_user-profile-ui.json`

**Description:** Demonstrates a CREATIVE mode contract for a frontend UI feature.

**Key Features:**
- CREATIVE mode (partial coverage allowed with warnings)
- Medium criticality
- UI-specific clauses
- UI assertion surface with selectors
- Allows untagged tests (exploratory testing)

**Use Case:** Frontend development with UX requirements

---

## How to Use These Examples

### 1. As Templates

Copy an example and modify it for your feature:

```bash
cp docs/examples/contract_user-authentication-api.json outputs/my-feature/contract.json
```

Then edit the contract to match your requirements.

### 2. For Learning

Study the structure and field usage to understand the contract.json format.

### 3. For Testing

Use these examples to test Gatekeeper validators:

```bash
# Run validation with example contract
npm run gatekeeper -- --contract=docs/examples/contract_user-authentication-api.json
```

---

## Field Reference

For detailed documentation of each field, see: `docs/RULES.md`

**Key Sections:**
- Contract-Level Metadata (T031-T040)
- Clause Structure (T041-T052)
- Assertion Surface (T056-T062)
- Test Mapping (T063-T072)

---

## Customization Guide

### Choosing a Mode

**STRICT Mode:**
- Use for: Critical features, production APIs, security features
- Requires: 100% clause coverage, all assertions mapped
- Example: `contract_user-authentication-api.json`

**CREATIVE Mode:**
- Use for: UI features, prototypes, iterative development
- Allows: Partial coverage, unmapped tests, exploratory testing
- Example: `contract_user-profile-ui.json`

---

### Setting Criticality

**Critical:**
- Forces STRICT mode regardless of `mode` field
- 100% coverage required
- Use for: Payment systems, authentication, data integrity

**High:**
- 90% minimum coverage in CREATIVE mode
- Use for: Core features, public APIs

**Medium:**
- 80% minimum coverage in CREATIVE mode
- Use for: Standard features

**Low:**
- 60% minimum coverage in CREATIVE mode
- Use for: Minor features, UI tweaks

---

### Defining Clauses

**Minimal Clause:**
```json
{
  "id": "CL-FEATURE-001",
  "kind": "behavior",
  "normativity": "MUST",
  "title": "Short stable title",
  "spec": "When X happens, then Y should occur",
  "observables": ["http"]
}
```

**Full Clause (recommended):**
```json
{
  "id": "CL-FEATURE-001",
  "kind": "behavior",
  "normativity": "MUST",
  "title": "Short stable title",
  "spec": "When X happens, then Y should occur",
  "when": ["Precondition 1", "Precondition 2"],
  "inputs": {"param": "string"},
  "outputs": {"result": "200"},
  "observables": ["http"],
  "tags": ["feature", "happy-path"],
  "notes": "Additional context or implementation hints"
}
```

---

## Validation

Validate your contract against the schema:

```bash
npm run validate-contract -- outputs/my-feature/contract.json
```

---

## Next Steps

1. Read the full specification: `docs/RULES.md`
2. Choose an example as a starting point
3. Customize for your feature
4. Validate with Gatekeeper
5. Iterate based on feedback

---

**Version:** 1.0.0
**Last Updated:** 2026-01-18
