# Documentation Roadmap - Remaining Tasks (T130-T150)

**Version:** 1.0.0
**Created:** 2026-01-18
**Status:** Pending Execution

This document outlines remaining documentation tasks for final review and standardization.

---

## Completed Tasks (T091-T129) ✅

### Phase 1: Core Documentation
- ✅ T091-T094: Created REFERENCE.md (complete API reference)
- ✅ T095-T099: Created plannerGuide.md (planner instructions)
- ✅ T100-T104: Created RULES_ADDENDUM.md (contract validator catalog)
- ✅ T105-T107: Created TESTS_RULES.md (test writing rules)
- ✅ T108-T109: Created execGuide.md (executor guide)

### Phase 2: Internal Documentation
- ✅ T110: Updated QUICK_REFERENCE.md (25 validators)
- ✅ T118-T129: Created OPERATIONAL_PROCEDURES.md (procedures)

### Phase 3: Migration & Support
- ✅ T116-T117: Created MIGRATION_GUIDE.md (migration guide & common errors)

---

## Remaining Tasks (T130-T150) 📋

### Category 1: Terminology & Consistency (T130-T135)

#### T130: Remove Prohibited/Ambiguous Terms

**Task:** Review all documentation for ambiguous terms and align with `ambiguousTerms` database

**Target Files:**
- `docs/*.md`
- `packages/gatekeeper-api/*.md`
- `README.md`

**Prohibited Terms (from ValidationConfig):**
- "melhore" → Replace with specific action
- "otimize" → Replace with "improve performance by..."
- "refatore" → Replace with "restructure code to..."
- "arrume" → Replace with "fix/organize..."
- "ajuste" → Replace with "modify/configure..."

**Action Items:**
- [ ] Grep for prohibited terms in all markdown files
- [ ] Replace with specific language
- [ ] Document approved alternatives in style guide

**Priority:** Medium
**Estimated Time:** 2-3 hours

---

#### T131: Review Examples for Manifest Limits

**Task:** Ensure all examples follow MAX_FILES_PER_TASK (≤10)

**Target Files:**
- `docs/REFERENCE.md` example requests
- `docs/execGuide.md` examples
- `docs/plannerGuide.md` examples
- `docs/examples/*.json`

**Validation:**
- [ ] Count files in each `manifest.files[]` array
- [ ] Ensure count ≤ 10
- [ ] Add comment if close to limit

**Priority:** High
**Estimated Time:** 1 hour

---

#### T132: Review Examples for NO_IMPLICIT_FILES

**Task:** Ensure no vague file references in examples

**Target Files:**
- All `plan.json` examples
- All `manifest.files[]` examples

**Prohibited Patterns:**
- "etc", "other files", "related files", "...", "and more"

**Action Items:**
- [ ] Grep for prohibited patterns
- [ ] Replace with explicit file lists
- [ ] Add NOTE about prohibition

**Priority:** High
**Estimated Time:** 1 hour

---

#### T133: Review for Gate 2 Test Modification Prohibition

**Task:** Ensure docs don't instruct modifying tests in Gate 2

**Target Files:**
- `docs/execGuide.md`
- `docs/TESTS_RULES.md`
- `docs/OPERATIONAL_PROCEDURES.md`

**Check For:**
- References to modifying existing tests after Gate 1
- TEST_READ_ONLY_ENFORCEMENT explanation
- Exception for manifest.testFile creation

**Action Items:**
- [ ] Add explicit warning about test immutability
- [ ] Clarify exception (new test file creation OK)
- [ ] Document TEST_READ_ONLY_ENFORCEMENT behavior

**Priority:** Medium
**Estimated Time:** 1 hour

---

#### T134: Standardize "contract" vs "contrato"

**Task:** Decide on English vs Portuguese terminology

**Current State:**
- Mixed usage of "contract" and "contrato"
- Validator descriptions in Portuguese
- Technical terms in English

**Recommendation:**
- **Code/APIs:** English only (`contract`, not `contrato`)
- **User-facing messages:** Portuguese OK for Brazilian users
- **Documentation:** English (international audience)
- **Validator descriptions:** Can be Portuguese (local team)

**Action Items:**
- [ ] Choose standard for each context
- [ ] Update inconsistent files
- [ ] Document decision in style guide

**Priority:** Low
**Estimated Time:** 2 hours

---

#### T135: Approve Baseline Documental (PR Review)

**Task:** Create PR for all documentation changes and get approval

**Files to Include:**
- All new `docs/*.md` files
- Updated `packages/gatekeeper-api/*.md` files
- New `docs/examples/*.json` files

**PR Checklist:**
- [ ] All T091-T129 tasks completed
- [ ] Links between docs work
- [ ] Examples are valid
- [ ] No broken references
- [ ] Consistent formatting

**Priority:** High
**Estimated Time:** 1 hour (PR creation) + review time

---

### Category 2: Final Review Round (T136-T150)

#### T136-T140: First Review Pass

**T136: Review REFERENCE.md for Accuracy**
- [ ] Verify all field types match code
- [ ] Verify all defaults match `defaults.ts`
- [ ] Verify validator descriptions match implementation
- [ ] Check example requests are valid
- [ ] Verify cross-references work

**T137: Review RULES.md for Completeness**
- [ ] All T031-T090 addressed
- [ ] No contradictions with REFERENCE.md
- [ ] Examples follow own rules
- [ ] Migration path clear

**T138: Review plannerGuide.md for Usability**
- [ ] Template is copy-paste ready
- [ ] Checklist is complete
- [ ] Common mistakes section helpful
- [ ] Examples cover edge cases

**T139: Review TESTS_RULES.md for Clarity**
- [ ] All 25 validators documented
- [ ] Examples are correct
- [ ] Tag format clear
- [ ] Snapshot policy actionable

**T140: Review execGuide.md for Accuracy**
- [ ] Pipeline diagram matches code
- [ ] Input/output examples valid
- [ ] Error recovery steps work
- [ ] Retry logic sound

**Priority:** High
**Estimated Time:** 4-5 hours total

---

#### T141-T145: Second Review Pass (Consistency)

**T141: Cross-Reference Validation**
- [ ] All internal links work (`[text](file.md#anchor)`)
- [ ] All file references exist
- [ ] All code references match actual code
- [ ] All examples reference valid validators

**T142: Terminology Consistency**
- [ ] Validator names consistent across docs
- [ ] Mode names consistent (STRICT/CREATIVE)
- [ ] Clause ID format consistent
- [ ] Tag format consistent

**T143: Format Consistency**
- [ ] Headings use same levels
- [ ] Code blocks use same language tags
- [ ] Tables formatted consistently
- [ ] Lists use same style

**T144: Example Consistency**
- [ ] All examples use same project structure
- [ ] All examples use valid JSON
- [ ] All examples follow best practices
- [ ] No contradictory examples

**T145: Error Message Consistency**
- [ ] All error messages follow T119 format
- [ ] Action items are specific
- [ ] No vague language
- [ ] Helpful context provided

**Priority:** Medium
**Estimated Time:** 3-4 hours total

---

#### T146-T150: Final Polish

**T146: Add Missing Diagrams**
- [ ] Contract validation flow diagram
- [ ] Tag proximity diagram (50-line rule)
- [ ] Mode decision tree
- [ ] Coverage calculation diagram

**T147: Add Navigation Aids**
- [ ] Add "See also" sections
- [ ] Add related docs links
- [ ] Add breadcrumbs where helpful
- [ ] Improve table of contents

**T148: Improve Readability**
- [ ] Break up long paragraphs
- [ ] Add more examples where complex
- [ ] Simplify technical jargon
- [ ] Add TL;DR sections

**T149: Final Proofread**
- [ ] Fix typos
- [ ] Fix grammar
- [ ] Fix formatting issues
- [ ] Verify all TODOs removed

**T150: Freeze Documentation v1.0.0**
- [ ] Tag documentation version
- [ ] Archive in version control
- [ ] Announce to team
- [ ] Plan v1.1.0 improvements

**Priority:** Low to Medium
**Estimated Time:** 4-5 hours total

---

## Execution Plan

### Week 1: Terminology & Consistency (T130-T135)
**Goal:** Standardize terminology and fix prohibited terms
**Output:** Consistent documentation without ambiguous language

**Tasks:**
1. Day 1-2: T130 (Remove prohibited terms)
2. Day 2: T131-T132 (Review examples)
3. Day 3: T133-T134 (Test modification & terminology)
4. Day 4-5: T135 (Create PR and address feedback)

---

### Week 2: Review Round 1 (T136-T140)
**Goal:** Verify accuracy of all documentation
**Output:** Documentation matches implementation

**Tasks:**
1. Day 1: T136-T137 (REFERENCE + RULES)
2. Day 2: T138-T139 (plannerGuide + TESTS_RULES)
3. Day 3: T140 (execGuide)
4. Day 4-5: Fix issues found in review

---

### Week 3: Review Round 2 (T141-T145)
**Goal:** Ensure consistency across all docs
**Output:** Unified documentation set

**Tasks:**
1. Day 1: T141-T142 (Cross-refs + terminology)
2. Day 2: T143-T144 (Format + examples)
3. Day 3: T145 (Error messages)
4. Day 4-5: Apply fixes

---

### Week 4: Final Polish (T146-T150)
**Goal:** Publish documentation v1.0.0
**Output:** Production-ready documentation

**Tasks:**
1. Day 1-2: T146-T148 (Diagrams, navigation, readability)
2. Day 3: T149 (Final proofread)
3. Day 4: T150 (Freeze and announce)
4. Day 5: Buffer for unexpected issues

---

## Success Criteria

Documentation is complete when:
- [ ] All T130-T150 tasks checked off
- [ ] PR approved and merged
- [ ] No broken links
- [ ] All examples validated
- [ ] Team trained on new docs
- [ ] Adoption metrics tracked

---

## Quick Reference: Task Categories

**High Priority (Do First):**
- T131, T132 (Examples follow rules)
- T135 (PR approval)
- T136-T140 (Accuracy review)

**Medium Priority:**
- T130, T133 (Terminology cleanup)
- T141-T145 (Consistency review)

**Low Priority (Polish):**
- T134 (Language choice)
- T146-T150 (Diagrams and polish)

---

## Notes for Reviewers

**When reviewing T130-T150:**

1. **Accuracy over perfection**
   - Focus on correctness first
   - Polish can come later

2. **User perspective**
   - Is it clear for first-time users?
   - Are examples helpful?
   - Is navigation easy?

3. **Consistency matters**
   - Same terms throughout
   - Same format throughout
   - No contradictions

4. **Testability**
   - Can examples be copy-pasted?
   - Do procedures actually work?
   - Are error messages helpful?

---

**Version:** 1.0.0
**Status:** 📋 TODO
**Created:** 2026-01-18
**Target Completion:** 4 weeks from start
