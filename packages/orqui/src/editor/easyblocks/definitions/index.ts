// ============================================================================
// All 21 Orqui NoCode Component Definitions
// ============================================================================

// Layout (4)
export { stackDefinition, rowDefinition, gridDefinition, containerDefinition } from "./layout";

// Content (8)
export {
  headingDefinition, textDefinition, buttonDefinition, badgeDefinition,
  iconDefinition, imageDefinition, dividerDefinition, spacerDefinition,
} from "./content";

// Data (5)
export {
  statCardDefinition, cardDefinition, tableDefinition, listDefinition, keyValueDefinition,
} from "./data";

// Navigation (1) + Input (2) + Special (1)
export {
  tabsDefinition, searchDefinition, selectDefinition, slotDefinition,
} from "./misc";

// ---- Convenience: all definitions as a flat array ----

import { stackDefinition, rowDefinition, gridDefinition, containerDefinition } from "./layout";
import { headingDefinition, textDefinition, buttonDefinition, badgeDefinition, iconDefinition, imageDefinition, dividerDefinition, spacerDefinition } from "./content";
import { statCardDefinition, cardDefinition, tableDefinition, listDefinition, keyValueDefinition } from "./data";
import { tabsDefinition, searchDefinition, selectDefinition, slotDefinition } from "./misc";

import type { NoCodeComponentDefinition } from "../types";

/** All 21 Orqui component definitions, ready to pass to Easyblocks Config.components */
export const ALL_DEFINITIONS: NoCodeComponentDefinition[] = [
  // Layout
  stackDefinition,
  rowDefinition,
  gridDefinition,
  containerDefinition,
  // Content
  headingDefinition,
  textDefinition,
  buttonDefinition,
  badgeDefinition,
  iconDefinition,
  imageDefinition,
  dividerDefinition,
  spacerDefinition,
  // Data
  statCardDefinition,
  cardDefinition,
  tableDefinition,
  listDefinition,
  keyValueDefinition,
  // Navigation
  tabsDefinition,
  // Input
  searchDefinition,
  selectDefinition,
  // Special
  slotDefinition,
];
