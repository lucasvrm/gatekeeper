import { PageEditor } from "../../packages/orqui/src/editor/page-editor/PageEditor";
import { useContract } from "../../packages/orqui/src/runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function PageEditorPage() {
  const { layout, updateContract } = useContract();
  const navigate = useNavigate();
  const [pages, setPages] = useState(layout.structure.pages || {});

  // Sync local pages with contract
  useEffect(() => {
    setPages(layout.structure.pages || {});
  }, [layout.structure.pages]);

  const handlePagesChange = (updatedPages: Record<string, any>) => {
    setPages(updatedPages);
    updateContract({
      structure: {
        ...layout.structure,
        pages: updatedPages
      }
    });
  };

  const handleExit = () => {
    navigate('/config?tab=orqui');
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <PageEditor
        pages={pages}
        onPagesChange={handlePagesChange}
        tokens={layout.tokens}
        variables={(layout as any).variables}
        onVariablesChange={(vars) => {
          updateContract({ variables: vars });
        }}
        onExitEditor={handleExit}
      />
    </div>
  );
}
