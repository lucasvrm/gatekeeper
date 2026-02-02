import React, { useState, useEffect } from "react";
import { COLORS, s } from "../lib/constants";
import { Field, Row, Section, EmptyState } from "../components/shared";

// ============================================================================
// Prop Editor
// ============================================================================
export function PropEditor({ props, onChange }) {
  const [newPropKey, setNewPropKey] = useState("");

  const addProp = () => {
    if (!newPropKey.trim()) return;
    const key = newPropKey.trim();
    onChange({ ...props, [key]: { type: "string", required: false, description: "" } });
    setNewPropKey("");
  };

  const updateProp = (key, field, val) => {
    const updated = { ...props, [key]: { ...props[key], [field]: val } };
    // Auto-add enumValues for enum type
    if (field === "type" && val === "enum" && !updated[key].enumValues) {
      updated[key].enumValues = [""];
    }
    if (field === "type" && val === "array" && !updated[key].items) {
      updated[key].items = { type: "string" };
    }
    if (field === "type" && val === "object" && !updated[key].shape) {
      updated[key].shape = {};
    }
    onChange(updated);
  };

  const removeProp = (key) => {
    const updated = { ...props };
    delete updated[key];
    onChange(updated);
  };

  const updateEnumValues = (key, valStr) => {
    const vals = valStr.split(",").map((v) => v.trim()).filter(Boolean);
    onChange({ ...props, [key]: { ...props[key], enumValues: vals } });
  };

  return (
    <div>
      {Object.entries(props).map(([key, prop]) => (
        <div key={key} style={{ padding: 10, marginBottom: 8, background: COLORS.surface2, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace", minWidth: 100 }}>{key}</span>
            <select value={prop.type} onChange={(e) => updateProp(key, "type", e.target.value)} style={{ ...s.select, width: 100 }}>
              {["string", "number", "boolean", "enum", "ReactNode", "function", "object", "array"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textMuted, cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={prop.required} onChange={(e) => updateProp(key, "required", e.target.checked)} /> required
            </label>
            <button onClick={() => removeProp(key)} style={s.btnDanger}>✕</button>
          </div>
          <input value={prop.description} onChange={(e) => updateProp(key, "description", e.target.value)} placeholder="descrição da prop" style={{ ...s.input, marginBottom: 6 }} />
          {prop.type === "enum" && (
            <input value={(prop.enumValues || []).join(", ")} onChange={(e) => updateEnumValues(key, e.target.value)} placeholder="valores separados por vírgula" style={{ ...s.input, fontSize: 11, color: COLORS.warning }} />
          )}
          {!prop.required && prop.type !== "function" && prop.type !== "ReactNode" && (
            <input value={prop.default ?? ""} onChange={(e) => updateProp(key, "default", prop.type === "number" ? Number(e.target.value) : prop.type === "boolean" ? e.target.value === "true" : e.target.value)} placeholder="default" style={{ ...s.input, marginTop: 4, fontSize: 11 }} />
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input value={newPropKey} onChange={(e) => setNewPropKey(e.target.value)} placeholder="nome da prop (camelCase)" style={s.input} onKeyDown={(e) => e.key === "Enter" && addProp()} />
        <button onClick={addProp} style={s.btnSmall}>+ Prop</button>
      </div>
    </div>
  );
}


// ============================================================================
// Slot Editor
// ============================================================================
export function SlotEditor({ slots, onChange }) {
  const [newKey, setNewKey] = useState("");

  const addSlot = () => {
    if (!newKey.trim()) return;
    onChange({ ...slots, [newKey.trim()]: { description: "", required: false, acceptedComponents: [] } });
    setNewKey("");
  };

  const updateSlot = (key, field, val) => {
    onChange({ ...slots, [key]: { ...slots[key], [field]: val } });
  };

  const removeSlot = (key) => {
    const updated = { ...slots };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div>
      {Object.entries(slots || {}).map(([key, slot]) => (
        <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: 8, background: COLORS.surface2, borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: COLORS.accent, fontFamily: "monospace", minWidth: 80 }}>{key}</span>
          <input value={slot.description} onChange={(e) => updateSlot(key, "description", e.target.value)} placeholder="descrição" style={{ ...s.input, flex: 1 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: COLORS.textMuted, cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={slot.required} onChange={(e) => updateSlot(key, "required", e.target.checked)} /> req
          </label>
          <button onClick={() => removeSlot(key)} style={s.btnDanger}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="nome do slot" style={s.input} onKeyDown={(e) => e.key === "Enter" && addSlot()} />
        <button onClick={addSlot} style={s.btnSmall}>+ Slot</button>
      </div>
    </div>
  );
}


// ============================================================================
// Component Editor
// ============================================================================
export function ComponentEditor({ comp, onChange }) {
  const update = (field, val) => onChange({ ...comp, [field]: val });

  const updateTags = (val) => {
    update("tags", val.split(",").map((t) => t.trim()).filter(Boolean));
  };

  const addVariant = () => {
    update("variants", [...(comp.variants || []), { name: "", props: {} }]);
  };

  const updateVariant = (i, field, val) => {
    const variants = [...comp.variants];
    variants[i] = { ...variants[i], [field]: val };
    update("variants", variants);
  };

  const removeVariant = (i) => {
    update("variants", comp.variants.filter((_, idx) => idx !== i));
  };

  const addExample = () => {
    update("examples", [...(comp.examples || []), { name: "", props: {} }]);
  };

  const updateExample = (i, field, val) => {
    const examples = [...comp.examples];
    examples[i] = { ...examples[i], [field]: val };
    update("examples", examples);
  };

  const removeExample = (i) => {
    update("examples", comp.examples.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <Row gap={12}>
        <Field label="Category" style={{ flex: 1 }}>
          <select value={comp.category} onChange={(e) => update("category", e.target.value)} style={s.select}>
            {["primitive", "semantic", "layout", "feedback", "navigation", "data-display", "form"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Source" style={{ flex: 1 }}>
          <select value={comp.source || "custom"} onChange={(e) => update("source", e.target.value)} style={s.select}>
            {["shadcn-ui", "custom", "html-native"].map((s2) => <option key={s2}>{s2}</option>)}
          </select>
        </Field>
      </Row>
      <Field label="Description">
        <input value={comp.description} onChange={(e) => update("description", e.target.value)} style={s.input} />
      </Field>
      <Field label="Tags (vírgula)">
        <input value={(comp.tags || []).join(", ")} onChange={(e) => updateTags(e.target.value)} style={s.input} />
      </Field>

      <Section title={`Props (${Object.keys(comp.props || {}).length})`}>
        <PropEditor props={comp.props || {}} onChange={(p) => update("props", p)} />
      </Section>

      <Section title={`Slots (${Object.keys(comp.slots || {}).length})`} defaultOpen={false}>
        <SlotEditor slots={comp.slots || {}} onChange={(sl) => update("slots", sl)} />
      </Section>

      <Section title={`Variants (${(comp.variants || []).length})`} defaultOpen={false}>
        {(comp.variants || []).map((v, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input value={v.name} onChange={(e) => updateVariant(i, "name", e.target.value)} placeholder="nome" style={{ ...s.input, width: 150 }} />
            <input value={JSON.stringify(v.props)} onChange={(e) => { try { updateVariant(i, "props", JSON.parse(e.target.value)); } catch {} }} placeholder='{"prop": "value"}' style={{ ...s.input, flex: 1, fontSize: 11 }} />
            <button onClick={() => removeVariant(i)} style={s.btnDanger}>✕</button>
          </div>
        ))}
        <button onClick={addVariant} style={s.btnSmall}>+ Variant</button>
      </Section>

      <Section title={`Examples (${(comp.examples || []).length})`} defaultOpen={false}>
        {(comp.examples || []).map((ex, i) => (
          <div key={i} style={{ padding: 8, marginBottom: 6, background: COLORS.surface2, borderRadius: 6 }}>
            <input value={ex.name} onChange={(e) => updateExample(i, "name", e.target.value)} placeholder="nome do exemplo" style={{ ...s.input, marginBottom: 4 }} />
            <input value={JSON.stringify(ex.props)} onChange={(e) => { try { updateExample(i, "props", JSON.parse(e.target.value)); } catch {} }} placeholder='{"prop": "value"}' style={{ ...s.input, fontSize: 11 }} />
            <button onClick={() => removeExample(i)} style={{ ...s.btnDanger, marginTop: 4 }}>✕</button>
          </div>
        ))}
        <button onClick={addExample} style={s.btnSmall}>+ Example</button>
      </Section>

      {/* Component-specific Style Editor */}
      {comp.name === "ScrollArea" && (
        <ScrollAreaStyleEditor styles={comp.styles || {}} onChange={(st) => update("styles", st)} />
      )}
    </div>
  );
}


// ============================================================================
// ScrollArea Style Editor
// ============================================================================
export function ScrollAreaStyleEditor({ styles, onChange }) {
  const st = styles || {};
  const upd = (field, val) => onChange({ ...st, [field]: val });

  const PRESETS = [
    { value: "minimal", label: "Minimal — fino, sem setas, discreto" },
    { value: "default", label: "Default — scrollbar padrão do OS" },
    { value: "overlay", label: "Overlay — aparece só no hover" },
    { value: "hidden", label: "Hidden — sem scrollbar visível" },
    { value: "custom", label: "Custom — configuração manual" },
  ];

  const applyPreset = (preset) => {
    switch (preset) {
      case "minimal":
        onChange({ preset: "minimal", thumbWidth: 4, thumbColor: "rgba(255,255,255,0.15)", trackColor: "transparent", thumbRadius: 99, showArrows: false, hoverThumbWidth: 6, hoverThumbColor: "rgba(255,255,255,0.3)" });
        break;
      case "overlay":
        onChange({ preset: "overlay", thumbWidth: 6, thumbColor: "rgba(255,255,255,0.2)", trackColor: "transparent", thumbRadius: 99, showArrows: false, autoHide: true, hoverThumbWidth: 8, hoverThumbColor: "rgba(255,255,255,0.4)" });
        break;
      case "hidden":
        onChange({ preset: "hidden", thumbWidth: 0, thumbColor: "transparent", trackColor: "transparent", showArrows: false });
        break;
      case "default":
        onChange({ preset: "default" });
        break;
      default:
        onChange({ ...st, preset: "custom" });
    }
  };

  const isCustom = st.preset === "custom" || (!st.preset && (st.thumbWidth || st.thumbColor));
  const showCustom = st.preset === "custom" || st.preset === "minimal" || st.preset === "overlay" || isCustom;

  // Live preview
  const previewThumbW = st.thumbWidth ?? 6;
  const previewThumbC = st.thumbColor ?? "rgba(255,255,255,0.2)";
  const previewTrackC = st.trackColor ?? "transparent";
  const previewRadius = st.thumbRadius ?? 99;

  return (
    <Section title="Styles — Scrollbar" defaultOpen={true}>
      <div style={{ ...s.card, marginBottom: 12 }}>
        {/* Live preview */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 180, height: 120, border: `1px solid ${COLORS.border}`, borderRadius: 8,
            overflow: "hidden", position: "relative", background: COLORS.surface2,
          }}>
            <div style={{ padding: 10, fontSize: 11, color: COLORS.textMuted, lineHeight: 1.8 }}>
              {Array.from({ length: 8 }, (_, i) => <div key={i} style={{ padding: "2px 0", borderBottom: `1px solid ${COLORS.border}30` }}>Item {i + 1}</div>)}
            </div>
            {/* Fake scrollbar thumb */}
            {st.preset !== "hidden" && (
              <div style={{
                position: "absolute", right: 1, top: 8,
                width: previewThumbW, height: 40,
                borderRadius: previewRadius,
                background: previewThumbC,
                transition: "all 0.15s",
              }} />
            )}
            {/* Track */}
            {previewTrackC !== "transparent" && st.preset !== "hidden" && (
              <div style={{
                position: "absolute", right: 0, top: 0, bottom: 0,
                width: Math.max(previewThumbW + 2, 8),
                background: previewTrackC,
              }} />
            )}
          </div>
          <div style={{ flex: 1, fontSize: 11, color: COLORS.textDim, lineHeight: 1.6 }}>
            {st.preset === "minimal" && "Scrollbar ultra-discreto: 4px, sem setas, quase invisível até o hover."}
            {st.preset === "overlay" && "Scrollbar aparece com opacity ao passar o mouse na área de scroll."}
            {st.preset === "hidden" && "Scrollbar completamente oculto. O conteúdo ainda é scrollável."}
            {st.preset === "default" && "Scrollbar nativo do navegador/OS."}
            {st.preset === "custom" && "Configuração manual de cada propriedade do scrollbar."}
            {!st.preset && "Selecione um preset ou customize manualmente."}
          </div>
        </div>

        {/* Preset selector */}
        <Field label="Preset">
          <select value={st.preset || ""} onChange={(e) => applyPreset(e.target.value)} style={s.select}>
            <option value="">— selecionar —</option>
            {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>

        {/* Custom controls */}
        {showCustom && (
          <div style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Thumb</div>
            <Row gap={12}>
              <Field label="Largura (px)" style={{ flex: 1 }}>
                <input type="number" min={0} max={20} value={st.thumbWidth ?? 6} onChange={(e) => upd("thumbWidth", Number(e.target.value))} style={s.input} />
              </Field>
              <Field label="Cor" style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={st.thumbColor?.startsWith("rgba") ? "#ffffff" : (st.thumbColor || "#666666")} onChange={(e) => upd("thumbColor", e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                  <input value={st.thumbColor || ""} onChange={(e) => upd("thumbColor", e.target.value)} placeholder="rgba(255,255,255,0.15)" style={{ ...s.input, flex: 1, fontSize: 10 }} />
                </div>
              </Field>
              <Field label="Radius" style={{ flex: 0, minWidth: 60 }}>
                <input type="number" min={0} max={99} value={st.thumbRadius ?? 99} onChange={(e) => upd("thumbRadius", Number(e.target.value))} style={s.input} />
              </Field>
            </Row>

            <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Hover</div>
            <Row gap={12}>
              <Field label="Largura hover (px)" style={{ flex: 1 }}>
                <input type="number" min={0} max={20} value={st.hoverThumbWidth ?? st.thumbWidth ?? 6} onChange={(e) => upd("hoverThumbWidth", Number(e.target.value))} style={s.input} />
              </Field>
              <Field label="Cor hover" style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={st.hoverThumbColor?.startsWith("rgba") ? "#ffffff" : (st.hoverThumbColor || "#999999")} onChange={(e) => upd("hoverThumbColor", e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                  <input value={st.hoverThumbColor || ""} onChange={(e) => upd("hoverThumbColor", e.target.value)} placeholder="rgba(255,255,255,0.3)" style={{ ...s.input, flex: 1, fontSize: 10 }} />
                </div>
              </Field>
            </Row>

            <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Track</div>
            <Row gap={12}>
              <Field label="Cor do track" style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="color" value={st.trackColor?.startsWith("rgba") || st.trackColor === "transparent" ? "#111111" : (st.trackColor || "#111111")} onChange={(e) => upd("trackColor", e.target.value)} style={{ width: 28, height: 24, border: "none", background: "none", cursor: "pointer" }} />
                  <input value={st.trackColor || ""} onChange={(e) => upd("trackColor", e.target.value)} placeholder="transparent" style={{ ...s.input, flex: 1, fontSize: 10 }} />
                </div>
              </Field>
              <Field label="Setas" style={{ flex: 0, minWidth: 80 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer", paddingTop: 4 }}>
                  <input type="checkbox" checked={st.showArrows ?? false} onChange={(e) => upd("showArrows", e.target.checked)} />
                  Exibir
                </label>
              </Field>
            </Row>

            {st.preset === "overlay" && (
              <>
                <div style={{ marginTop: 8, marginBottom: 4, fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Comportamento</div>
                <Field label="Auto-hide">
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>
                    <input type="checkbox" checked={st.autoHide ?? true} onChange={(e) => upd("autoHide", e.target.checked)} />
                    Ocultar quando parado
                  </label>
                </Field>
              </>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}


// ============================================================================
// UI Registry Editor
// ============================================================================
export function UIRegistryEditor({ registry, onChange }) {
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState("");

  const componentNames = Object.keys(registry.components || {});

  useEffect(() => {
    if (selected && !registry.components[selected]) setSelected(null);
  }, [registry, selected]);

  const addComponent = () => {
    if (!newName.trim()) return;
    const name = newName.trim().replace(/^./, (c) => c.toUpperCase());
    if (registry.components[name]) return;
    onChange({
      ...registry,
      components: {
        ...registry.components,
        [name]: {
          name,
          category: "primitive",
          description: "",
          source: "custom",
          props: {},
          slots: {},
          variants: [],
          examples: [{ name: "Default", props: {} }],
          tags: [],
        },
      },
    });
    setSelected(name);
    setNewName("");
  };

  const removeComponent = (name) => {
    const updated = { ...registry.components };
    delete updated[name];
    onChange({ ...registry, components: updated });
    if (selected === name) setSelected(null);
  };

  const updateComponent = (comp) => {
    onChange({ ...registry, components: { ...registry.components, [comp.name]: comp } });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: 0, marginBottom: 4 }}>UI Registry Contract Editor</h2>
        <p style={{ fontSize: 12, color: COLORS.textDim, margin: 0 }}>Gerencie componentes, props, slots e variantes</p>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Component list */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="NovoComponente" style={{ ...s.input, fontSize: 12 }} onKeyDown={(e) => e.key === "Enter" && addComponent()} />
            <button onClick={addComponent} style={s.btnSmall}>+</button>
          </div>
          {componentNames.map((name) => (
            <div key={name} onClick={() => setSelected(name)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", marginBottom: 2, borderRadius: 6, background: selected === name ? COLORS.surface3 : "transparent", cursor: "pointer", border: selected === name ? `1px solid ${COLORS.border2}` : "1px solid transparent", transition: "all 0.1s" }}>
              <span style={{ fontSize: 13, color: selected === name ? COLORS.text : COLORS.textMuted, fontWeight: selected === name ? 600 : 400 }}>{name}</span>
              <button onClick={(e) => { e.stopPropagation(); removeComponent(name); }} style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 11, padding: "2px 4px" }}>✕</button>
            </div>
          ))}
          {componentNames.length === 0 && <div style={{ fontSize: 12, color: COLORS.textDim, padding: 8 }}>Nenhum componente</div>}
        </div>

        {/* Component editor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selected && registry.components[selected] ? (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.accent, margin: 0, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>{selected}</h3>
              <ComponentEditor comp={registry.components[selected]} onChange={updateComponent} />
            </div>
          ) : (
            <EmptyState message="Selecione um componente para editar" />
          )}
        </div>
      </div>
    </div>
  );
}

