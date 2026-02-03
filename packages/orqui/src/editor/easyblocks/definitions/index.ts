// ============================================================================
// All 21 Orqui NoCode Component Definitions
// ============================================================================

export { stackDefinition, rowDefinition, gridDefinition, containerDefinition } from "./layout";
export { headingDefinition, textDefinition, buttonDefinition, badgeDefinition, iconDefinition, imageDefinition, dividerDefinition, spacerDefinition } from "./content";
export { statCardDefinition, cardDefinition, tableDefinition, listDefinition, keyValueDefinition } from "./data";
export { tabsDefinition, searchDefinition, selectDefinition, slotDefinition } from "./misc";

import type { NoCodeComponentDefinition } from "@easyblocks/core";
import { stackDefinition, rowDefinition, gridDefinition, containerDefinition } from "./layout";
import { headingDefinition, textDefinition, buttonDefinition, badgeDefinition, iconDefinition, imageDefinition, dividerDefinition, spacerDefinition } from "./content";
import { statCardDefinition, cardDefinition, tableDefinition, listDefinition, keyValueDefinition } from "./data";
import { tabsDefinition, searchDefinition, selectDefinition, slotDefinition } from "./misc";

export const ALL_DEFINITIONS: NoCodeComponentDefinition[] = [
  stackDefinition, rowDefinition, gridDefinition, containerDefinition,
  headingDefinition, textDefinition, buttonDefinition, badgeDefinition,
  iconDefinition, imageDefinition, dividerDefinition, spacerDefinition,
  statCardDefinition, cardDefinition, tableDefinition, listDefinition, keyValueDefinition,
  tabsDefinition,
  searchDefinition, selectDefinition,
  slotDefinition,
];
