// ============================================================================
// Form Component Definitions — Input, Textarea, Checkbox, Switch, Radio
//
// Phase 3: borderRadius tokens on Input/Textarea, space for gaps.
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { THUMB_INPUT, THUMB_TEXTAREA, THUMB_CHECKBOX, THUMB_SWITCH, THUMB_RADIO } from "./thumbnails";

export const inputDefinition: NoCodeComponentDefinition = {
  id: "OrquiInput",
  thumbnail: THUMB_INPUT,
  label: "Input",
  type: "item",
  paletteLabel: "Formulários",
  schema: [
    { prop: "label", type: "string", label: "Label", defaultValue: "Campo" },
    { prop: "placeholder", type: "string", label: "Placeholder", defaultValue: "Digite aqui..." },
    {
      prop: "inputType",
      type: "select",
      label: "Tipo",
      params: {
        options: [
          { value: "text", label: "Texto" },
          { value: "email", label: "E-mail" },
          { value: "password", label: "Senha" },
          { value: "number", label: "Número" },
          { value: "tel", label: "Telefone" },
          { value: "url", label: "URL" },
        ],
      },
      defaultValue: "text",
    },
    { prop: "required", type: "boolean", label: "Obrigatório", defaultValue: false },
    { prop: "disabled", type: "boolean", label: "Desabilitado", defaultValue: false },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
      },
    },
  }),
};

export const textareaDefinition: NoCodeComponentDefinition = {
  id: "OrquiTextarea",
  thumbnail: THUMB_TEXTAREA,
  label: "Textarea",
  type: "item",
  paletteLabel: "Formulários",
  schema: [
    { prop: "label", type: "string", label: "Label", defaultValue: "Mensagem" },
    { prop: "placeholder", type: "string", label: "Placeholder", defaultValue: "Digite sua mensagem..." },
    {
      prop: "rows",
      type: "select",
      label: "Linhas",
      params: {
        options: [
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6" },
          { value: "8", label: "8" },
          { value: "10", label: "10" },
        ],
      },
      defaultValue: "4",
    },
    { prop: "required", type: "boolean", label: "Obrigatório", defaultValue: false },
    { prop: "disabled", type: "boolean", label: "Desabilitado", defaultValue: false },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
      },
    },
  }),
};

export const checkboxDefinition: NoCodeComponentDefinition = {
  id: "OrquiCheckbox",
  thumbnail: THUMB_CHECKBOX,
  label: "Checkbox",
  type: "item",
  paletteLabel: "Formulários",
  schema: [
    { prop: "label", type: "string", label: "Label", defaultValue: "Aceito os termos" },
    { prop: "checked", type: "boolean", label: "Marcado", defaultValue: false },
    { prop: "disabled", type: "boolean", label: "Desabilitado", defaultValue: false },
    {
      prop: "accentColor",
      type: "color",
      label: "Cor de destaque",
      group: "Estilo",
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
      },
    },
  }),
};

export const switchDefinition: NoCodeComponentDefinition = {
  id: "OrquiSwitch",
  thumbnail: THUMB_SWITCH,
  label: "Switch",
  type: "item",
  paletteLabel: "Formulários",
  schema: [
    { prop: "label", type: "string", label: "Label", defaultValue: "Ativo" },
    { prop: "checked", type: "boolean", label: "Ligado", defaultValue: false },
    { prop: "disabled", type: "boolean", label: "Desabilitado", defaultValue: false },
    {
      prop: "accentColor",
      type: "color",
      label: "Cor de destaque",
      group: "Estilo",
    },
  ],
  styles: () => ({
    styled: {
      Root: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        cursor: "pointer",
      },
    },
  }),
};

export const radioDefinition: NoCodeComponentDefinition = {
  id: "OrquiRadio",
  thumbnail: THUMB_RADIO,
  label: "Radio",
  type: "item",
  paletteLabel: "Formulários",
  schema: [
    { prop: "name", type: "string", label: "Nome do grupo", defaultValue: "radio-group" },
    {
      prop: "optionsJson",
      type: "string",
      label: "Opções (JSON)",
      defaultValue: JSON.stringify([
        { value: "opt1", label: "Opção 1" },
        { value: "opt2", label: "Opção 2" },
        { value: "opt3", label: "Opção 3" },
      ]),
    },
    { prop: "disabled", type: "boolean", label: "Desabilitado", defaultValue: false },
    {
      prop: "accentColor",
      type: "color",
      label: "Cor de destaque",
      group: "Estilo",
    },
    {
      prop: "gap",
      type: "space",
      label: "Gap entre opções",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        display: "flex",
        flexDirection: "column",
        gap: values.gap || "8px",
      },
    },
  }),
};
