// ============================================================================
// Grid Helpers — utility functions for grid layout operations
// ============================================================================

import type { GridLayoutConfig } from "../../runtime/types";

/**
 * Finds the next empty slot in a grid layout.
 * Scans row-by-row, left-to-right to find the first unoccupied cell.
 *
 * @param layout - The grid layout configuration
 * @returns { colStart, rowStart } - Position of the first empty cell
 *
 * @example
 * const layout = {
 *   columns: 3,
 *   items: [
 *     { component: "a", colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 1 }
 *   ]
 * };
 * const next = findNextEmptySlot(layout);
 * // next === { colStart: 3, rowStart: 1 }
 *
 * @example
 * const layout = {
 *   columns: 3,
 *   items: [
 *     { component: "a", colStart: 1, rowStart: 1, colSpan: 3, rowSpan: 1 }
 *   ]
 * };
 * const next = findNextEmptySlot(layout);
 * // next === { colStart: 1, rowStart: 2 }
 */
export function findNextEmptySlot(layout: GridLayoutConfig): { colStart: number; rowStart: number } {
  const { columns, items } = layout;
  const occupied = new Set<string>();

  // Mark all occupied cells
  items.forEach(item => {
    for (let r = item.rowStart; r < item.rowStart + item.rowSpan; r++) {
      for (let c = item.colStart; c < item.colStart + item.colSpan; c++) {
        occupied.add(`${c},${r}`);
      }
    }
  });

  // Find first empty cell (row-major order: scan row by row, left to right)
  let row = 1;
  while (true) {
    for (let col = 1; col <= columns; col++) {
      if (!occupied.has(`${col},${row}`)) {
        return { colStart: col, rowStart: row };
      }
    }
    row++;

    // Safety: prevent infinite loop (should never happen in practice)
    if (row > 1000) {
      return { colStart: 1, rowStart: 1 };
    }
  }
}
