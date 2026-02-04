// ============================================================================
// DIAGNOSTIC-SIDEBAR.js — Diagnóstico do layout do Easyblocks Editor
//
// COMO USAR:
//   1. Abrir o Orqui no modo Páginas (http://localhost:5173/__orqui)
//   2. Esperar o EasyblocksEditor carregar completamente
//   3. Abrir DevTools → Console
//   4. Colar este script inteiro e pressionar Enter
//   5. O script vai imprimir um relatório detalhado no console
//
// O QUE ELE FAZ:
//   - Encontra o container raiz do Easyblocks editor
//   - Identifica se usa CSS Grid ou Flexbox
//   - Mapeia todos os painéis (left, canvas, right)
//   - Mostra widths, classes, e computed styles
//   - Recomenda a abordagem de fix mais adequada
// ============================================================================

(function diagnoseSidebar() {
  console.group("🔍 Easyblocks Sidebar Diagnostic");

  // ---- Step 1: Find editor root ----
  console.group("1. Procurando root do editor...");

  const selectors = [
    '[class*="EditorRoot"]',
    '[class*="editor-root"]',
    '[data-testid="editor-root"]',
    '[data-testid*="editor"]',
    '[class*="Editor__"]',
    '[class*="Editor"]',
    '[class*="Shopstory"]',
    '[class*="easyblocks"]',
  ];

  let editorRoot = null;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      console.log(`✅ Encontrado com: ${sel}`, el);
      editorRoot = el;
      break;
    } else {
      console.log(`  ❌ ${sel} — não encontrado`);
    }
  }

  if (!editorRoot) {
    // Fallback: look for the Orqui wrapper
    const orquiWrapper = document.querySelector('[style*="height: 100%"][style*="width: 100%"]');
    if (orquiWrapper) {
      // The EasyblocksEditor should be a child
      editorRoot = orquiWrapper.querySelector(':scope > div');
      console.log("⚠️ Fallback: usando wrapper Orqui →", editorRoot);
    }
  }

  if (!editorRoot) {
    console.error("❌ Não encontrei o editor root. O editor está carregado?");
    console.groupEnd();
    console.groupEnd();
    return;
  }
  console.groupEnd();

  // ---- Step 2: Analyze layout structure ----
  console.group("2. Analisando estrutura do layout...");

  function describeElement(el) {
    const rect = el.getBoundingClientRect();
    const computed = getComputedStyle(el);
    const classes = el.className || "(sem classes)";
    const tagInfo = `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}>`;

    return {
      tag: tagInfo,
      classes: typeof classes === "string" ? classes.substring(0, 80) : String(classes),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: computed.display,
      gridTemplateColumns: computed.gridTemplateColumns,
      flexDirection: computed.flexDirection,
      overflow: computed.overflow,
      position: computed.position,
      inlineStyle: (el.getAttribute("style") || "").substring(0, 120),
    };
  }

  // Walk down from editor root to find the grid/flex container
  const rootDesc = describeElement(editorRoot);
  console.log("Editor root:", rootDesc);

  // Check direct children
  const children = Array.from(editorRoot.children);
  console.log(`  ${children.length} filhos diretos`);

  let gridContainer = null;
  let layoutType = "unknown";

  // Check if root itself is grid/flex
  if (rootDesc.display === "grid" || rootDesc.gridTemplateColumns !== "none") {
    gridContainer = editorRoot;
    layoutType = "grid";
  } else if (rootDesc.display === "flex") {
    gridContainer = editorRoot;
    layoutType = "flex";
  } else {
    // Check children
    for (const child of children) {
      const desc = describeElement(child);
      if (desc.display === "grid" || desc.gridTemplateColumns !== "none") {
        gridContainer = child;
        layoutType = "grid";
        break;
      }
      if (desc.display === "flex") {
        gridContainer = child;
        layoutType = "flex";
        break;
      }
    }
  }

  if (gridContainer) {
    const gcDesc = describeElement(gridContainer);
    console.log(`✅ Layout container encontrado (${layoutType}):`, gcDesc);

    // Analyze layout children (panels)
    const panels = Array.from(gridContainer.children);
    console.log(`  ${panels.length} painéis:`);

    panels.forEach((panel, i) => {
      const desc = describeElement(panel);
      const isIframe = panel.tagName === "IFRAME";
      const role = isIframe ? "CANVAS (iframe)"
        : desc.width < 350 && i === 0 ? "LEFT PANEL (components)"
        : desc.width < 400 && i === panels.length - 1 ? "RIGHT PANEL (properties) ← SIDEBAR"
        : desc.width > 400 ? "CANVAS (main area)"
        : `PAINEL #${i}`;

      console.log(`  [${i}] ${role}:`, {
        width: desc.width,
        tag: desc.tag,
        classes: desc.classes,
        display: desc.display,
        inlineStyle: desc.inlineStyle,
      });

      // Highlight the sidebar
      if (role.includes("SIDEBAR")) {
        panel.style.outline = "3px solid #ff6b6b";
        console.log("    🎯 SIDEBAR identificada! (outline vermelho adicionado)");
        console.log("    Computed width:", getComputedStyle(panel).width);
        console.log("    Computed min-width:", getComputedStyle(panel).minWidth);
        console.log("    Computed max-width:", getComputedStyle(panel).maxWidth);
      }
    });

  } else {
    console.warn("⚠️ Nenhum container grid/flex encontrado. Dump dos filhos:");
    children.forEach((child, i) => {
      console.log(`  [${i}]:`, describeElement(child));
    });
  }

  console.groupEnd();

  // ---- Step 3: Deep scan for sidebar-like elements ----
  console.group("3. Deep scan — elementos com width 250-400px na borda direita...");

  const viewport = document.documentElement.getBoundingClientRect();
  const candidates = [];

  document.querySelectorAll("div").forEach(div => {
    const rect = div.getBoundingClientRect();
    if (
      rect.width >= 250 &&
      rect.width <= 400 &&
      rect.height > viewport.height * 0.3 &&
      rect.right >= viewport.right - 20
    ) {
      candidates.push({
        element: div,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        classes: (div.className || "").substring(0, 60),
        inlineWidth: div.style.width || "(not inline)",
      });
    }
  });

  if (candidates.length > 0) {
    console.log(`Encontrados ${candidates.length} candidatos:`);
    candidates.forEach((c, i) => {
      console.log(`  [${i}]`, c);
    });
  } else {
    console.log("Nenhum candidato sidebar encontrado.");
  }

  console.groupEnd();

  // ---- Step 4: CSS custom properties ----
  console.group("4. CSS custom properties relevantes...");
  const rootStyles = getComputedStyle(document.documentElement);
  const vars = [
    "--easyblocks-sidebar-width",
    "--shopstory-sidebar-width",
    "--editor-right-panel-width",
    "--editor-sidebar-width",
    "--right-panel-width",
  ];
  vars.forEach(v => {
    const val = rootStyles.getPropertyValue(v);
    console.log(`  ${v}: ${val || "(não definida)"}`);
  });
  console.groupEnd();

  // ---- Step 5: Recommendation ----
  console.group("5. 📋 Recomendação");

  if (layoutType === "grid" && gridContainer) {
    const gcStyle = getComputedStyle(gridContainer);
    console.log("Layout: CSS Grid");
    console.log("grid-template-columns:", gcStyle.gridTemplateColumns);
    console.log("");
    console.log("FIX RECOMENDADO:");
    console.log("Adicionar em <style>:");
    console.log(`  /* Targeted sidebar fix */`);
    console.log(`  /* Copiar o seletor exato da classe do grid container */`);
    console.log(`  .CLASSE_DO_CONTAINER {`);
    console.log(`    grid-template-columns: auto 1fr 420px !important;`);
    console.log(`  }`);
  } else if (layoutType === "flex" && gridContainer) {
    console.log("Layout: Flexbox");
    console.log("flex-direction:", getComputedStyle(gridContainer).flexDirection);
    console.log("");
    console.log("FIX RECOMENDADO:");
    console.log("Encontrar o último child do flex container e fazer:");
    console.log(`  lastChild.style.width = "420px";`);
    console.log(`  lastChild.style.minWidth = "420px";`);
    console.log(`  lastChild.style.flexShrink = "0";`);
  } else {
    console.log("⚠️ Layout não identificado.");
    console.log("Inspecione manualmente o DOM para encontrar a sidebar.");
    console.log("Dicas:");
    console.log("  1. Use o seletor de elementos do DevTools (🔍)");
    console.log("  2. Clique na sidebar de propriedades à direita");
    console.log("  3. Suba no DOM até encontrar o container pai com grid/flex");
    console.log("  4. Copie a classe CSS desse container");
  }

  console.groupEnd();
  console.groupEnd();

  console.log("\n✅ Diagnóstico completo. Copie as informações acima para guiar o fix.");
})();
