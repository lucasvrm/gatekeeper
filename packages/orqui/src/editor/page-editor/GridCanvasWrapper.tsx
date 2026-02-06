// ============================================================================
// GridCanvasWrapper — Wrapper for GridCanvas with config panel
// Handles grid layout creation and integration with PageEditor state
// ============================================================================

import React, { useState, useEffect, type CSSProperties } from "react";
import { usePageEditor } from "./PageEditorProvider";
import { treeToGrid } from "./gridConverter";
import { GridCanvas } from "../components/GridCanvas";
import { C } from "./styles";

export function GridCanvasWrapper() {
  const { state, dispatch, currentPage } = usePageEditor();
  const [columns, setColumns] = useState(3);
  const pageId = state.currentPageId!;
  const gridLayout = state.gridLayouts[pageId];

  // Auto-convert to grid on first load (no config panel needed)
  useEffect(() => {
    if (!gridLayout && currentPage?.content && pageId) {
      // Auto-create grid layout with default 3 columns
      const layout = treeToGrid(currentPage.content, columns);
      dispatch({ type: "SET_GRID_LAYOUT", pageId, layout });
    }
  }, [gridLayout, currentPage, pageId, columns, dispatch]);

  const handleConvert = () => {
    if (!currentPage?.content) return;

    // Convert tree to grid using treeToGrid
    const layout = treeToGrid(currentPage.content, columns);

    // Dispatch SET_GRID_LAYOUT to store in state
    dispatch({
      type: "SET_GRID_LAYOUT",
      pageId,
      layout,
    });
  };

  // Show config panel if grid doesn't exist yet
  if (!gridLayout) {
    return (
      <GridConfigPanel
        columns={columns}
        setColumns={setColumns}
        onConvert={handleConvert}
      />
    );
  }

  // Render GridCanvas with current layout
  return (
    <GridCanvas
      layout={gridLayout}
      selectedItemId={state.selectedNodeId}
      onSelectItem={(id) => dispatch({ type: "SELECT_NODE", nodeId: id })}
      onUpdateItem={(id, updates) => {
        dispatch({ type: "UPDATE_GRID_ITEM", pageId, itemId: id, updates });
      }}
    />
  );
}

// ============================================================================
// GridConfigPanel — Initial setup panel for grid conversion
// ============================================================================

interface GridConfigPanelProps {
  columns: number;
  setColumns: (n: number) => void;
  onConvert: () => void;
}

function GridConfigPanel({ columns, setColumns, onConvert }: GridConfigPanelProps) {
  return (
    <div style={configPanelStyle}>
      <div style={configContentStyle}>
        <h3 style={configTitleStyle}>Configure Grid Layout</h3>
        <p style={configDescStyle}>
          Convert your tree structure to a visual grid layout for precise positioning
        </p>

        <div style={configFormStyle}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Columns:</span>
            <input
              type="number"
              value={columns}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1 && val <= 12) {
                  setColumns(val);
                }
              }}
              min={1}
              max={12}
              style={inputStyle}
            />
          </label>

          <button onClick={onConvert} style={convertButtonStyle}>
            📐 Convert to Grid
          </button>
        </div>

        <div style={infoBoxStyle}>
          <p style={infoTextStyle}>
            💡 Grid mode allows you to drag and resize components with pixel-perfect precision.
            You can switch back to Tree mode at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const configPanelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  background: C.bg,
  padding: "32px",
};

const configContentStyle: CSSProperties = {
  maxWidth: "480px",
  width: "100%",
  background: C.surface,
  padding: "32px",
  borderRadius: "12px",
  border: `1px solid ${C.border}`,
};

const configTitleStyle: CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: C.text,
  marginBottom: "8px",
};

const configDescStyle: CSSProperties = {
  fontSize: "14px",
  color: C.textMuted,
  lineHeight: 1.5,
  marginBottom: "24px",
};

const configFormStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  marginBottom: "24px",
};

const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelTextStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: C.text,
};

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "6px",
  border: `1px solid ${C.border}`,
  background: C.surface2,
  color: C.text,
  fontSize: "14px",
  outline: "none",
  transition: "border-color 0.15s",
  fontFamily: "'Inter', sans-serif",
};

const convertButtonStyle: CSSProperties = {
  padding: "12px 20px",
  borderRadius: "6px",
  border: "none",
  background: C.accent,
  color: "#fff",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s",
  fontFamily: "'Inter', sans-serif",
};

const infoBoxStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: "8px",
  background: C.accent + "10",
  border: `1px solid ${C.accent}25`,
};

const infoTextStyle: CSSProperties = {
  fontSize: "12px",
  color: C.textMuted,
  lineHeight: 1.5,
  margin: 0,
};

const placeholderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  background: C.bg,
};

const placeholderContentStyle: CSSProperties = {
  textAlign: "center",
  padding: "32px",
};

const placeholderTitleStyle: CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: C.text,
  marginBottom: "8px",
};

const placeholderTextStyle: CSSProperties = {
  fontSize: "14px",
  color: C.textMuted,
  marginBottom: "4px",
};
