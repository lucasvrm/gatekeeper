// ============================================================================
// All 43 Orqui NoCode Component Definitions
// ============================================================================

// Layout (4 original + 2 new = 6)
export { stackDefinition, rowDefinition, gridDefinition, containerDefinition } from "./layout";
export { accordionDefinition, sidebarDefinition } from "./layout-extra";

// Content (8)
export {
  headingDefinition, textDefinition, buttonDefinition, badgeDefinition,
  iconDefinition, imageDefinition, dividerDefinition, spacerDefinition,
} from "./content";

// Data (5)
export {
  statCardDefinition, cardDefinition, tableDefinition, listDefinition, keyValueDefinition,
} from "./data";

// Navigation (1 original + 4 new = 5)
export { tabsDefinition, searchDefinition, selectDefinition, slotDefinition } from "./misc";
export { breadcrumbDefinition, paginationDefinition, navMenuDefinition, linkDefinition } from "./navigation";

// Forms (5) — NEW
export { inputDefinition, textareaDefinition, checkboxDefinition, switchDefinition, radioDefinition } from "./forms";

// Feedback (4) — NEW
export { alertDefinition, progressDefinition, spinnerDefinition, skeletonDefinition } from "./feedback";

// Overlay (3) — NEW
export { modalDefinition, drawerDefinition, tooltipDefinition } from "./overlay";

// Media (3) — NEW
export { avatarDefinition, videoDefinition, carouselDefinition } from "./media";

// ---- Convenience: all definitions as a flat array ----

import { stackDefinition, rowDefinition, gridDefinition, containerDefinition } from "./layout";
import { accordionDefinition, sidebarDefinition } from "./layout-extra";
import { headingDefinition, textDefinition, buttonDefinition, badgeDefinition, iconDefinition, imageDefinition, dividerDefinition, spacerDefinition } from "./content";
import { statCardDefinition, cardDefinition, tableDefinition, listDefinition, keyValueDefinition } from "./data";
import { tabsDefinition, searchDefinition, selectDefinition, slotDefinition } from "./misc";
import { breadcrumbDefinition, paginationDefinition, navMenuDefinition, linkDefinition } from "./navigation";
import { inputDefinition, textareaDefinition, checkboxDefinition, switchDefinition, radioDefinition } from "./forms";
import { alertDefinition, progressDefinition, spinnerDefinition, skeletonDefinition } from "./feedback";
import { modalDefinition, drawerDefinition, tooltipDefinition } from "./overlay";
import { avatarDefinition, videoDefinition, carouselDefinition } from "./media";

import type { NoCodeComponentDefinition } from "../types";

/** All 43 Orqui component definitions, ready to pass to Easyblocks Config.components */
export const ALL_DEFINITIONS: NoCodeComponentDefinition[] = [
  // Layout (6)
  stackDefinition,
  rowDefinition,
  gridDefinition,
  containerDefinition,
  accordionDefinition,
  sidebarDefinition,
  // Content (8)
  headingDefinition,
  textDefinition,
  buttonDefinition,
  badgeDefinition,
  iconDefinition,
  imageDefinition,
  dividerDefinition,
  spacerDefinition,
  // Data (5)
  statCardDefinition,
  cardDefinition,
  tableDefinition,
  listDefinition,
  keyValueDefinition,
  // Navigation (5)
  tabsDefinition,
  breadcrumbDefinition,
  paginationDefinition,
  navMenuDefinition,
  linkDefinition,
  // Input / Forms (7)
  searchDefinition,
  selectDefinition,
  inputDefinition,
  textareaDefinition,
  checkboxDefinition,
  switchDefinition,
  radioDefinition,
  // Special (1)
  slotDefinition,
  // Feedback (4)
  alertDefinition,
  progressDefinition,
  spinnerDefinition,
  skeletonDefinition,
  // Overlay (3)
  modalDefinition,
  drawerDefinition,
  tooltipDefinition,
  // Media (3)
  avatarDefinition,
  videoDefinition,
  carouselDefinition,
];
