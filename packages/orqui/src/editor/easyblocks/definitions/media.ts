// ============================================================================
// Media Component Definitions — Avatar, Video, Carousel
//
// Phase 3: color tokens for Avatar background, borderRadius tokens on Video/Carousel.
// ============================================================================

import type { NoCodeComponentDefinition } from "../types";
import { THUMB_AVATAR, THUMB_VIDEO, THUMB_CAROUSEL } from "./thumbnails";
import { ALL_COMPONENT_IDS } from "../types";

export const avatarDefinition: NoCodeComponentDefinition = {
  id: "OrquiAvatar",
  thumbnail: THUMB_AVATAR,
  label: "Avatar",
  type: "item",
  paletteLabel: "Mídia",
  schema: [
    { prop: "src", type: "string", label: "URL da imagem", defaultValue: "" },
    { prop: "alt", type: "string", label: "Alt text", defaultValue: "Avatar" },
    { prop: "fallback", type: "string", label: "Iniciais (fallback)", defaultValue: "AB" },
    {
      prop: "size",
      type: "select",
      label: "Tamanho",
      params: {
        options: [
          { value: "sm", label: "Pequeno (32px)" },
          { value: "md", label: "Médio (40px)" },
          { value: "lg", label: "Grande (56px)" },
          { value: "xl", label: "Extra grande (80px)" },
        ],
      },
      defaultValue: "md",
    },
    {
      prop: "shape",
      type: "select",
      label: "Formato",
      params: {
        options: [
          { value: "circle", label: "Círculo" },
          { value: "square", label: "Quadrado" },
          { value: "rounded", label: "Arredondado" },
        ],
      },
      defaultValue: "circle",
    },
    {
      prop: "background",
      type: "color",
      label: "Cor de fundo",
      group: "Estilo",
    },
    {
      prop: "color",
      type: "color",
      label: "Cor do texto",
      group: "Estilo",
    },
  ],
  styles: ({ values }) => {
    const sizeMap: Record<string, string> = {
      sm: "32px", md: "40px", lg: "56px", xl: "80px",
    };
    const radiusMap: Record<string, string> = {
      circle: "50%", square: "0", rounded: "8px",
    };
    const sz = sizeMap[values.size] || "40px";
    return {
      styled: {
        Root: {
          width: sz,
          height: sz,
          borderRadius: radiusMap[values.shape] || "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: values.background || "var(--orqui-surface-3, #2a2a33)",
          color: values.color || "var(--orqui-text, #e4e4e7)",
          fontSize: parseInt(sz) * 0.4 + "px",
          fontWeight: 600,
          flexShrink: 0,
        },
      },
    };
  },
};

export const videoDefinition: NoCodeComponentDefinition = {
  id: "OrquiVideo",
  thumbnail: THUMB_VIDEO,
  label: "Vídeo",
  type: "item",
  paletteLabel: "Mídia",
  schema: [
    { prop: "src", type: "string", label: "URL do vídeo", defaultValue: "" },
    { prop: "poster", type: "string", label: "URL do poster", defaultValue: "" },
    { prop: "autoplay", type: "boolean", label: "Autoplay", defaultValue: false },
    { prop: "controls", type: "boolean", label: "Controles", defaultValue: true },
    { prop: "loop", type: "boolean", label: "Loop", defaultValue: false },
    { prop: "muted", type: "boolean", label: "Sem áudio", defaultValue: false },
    {
      prop: "aspectRatio",
      type: "select",
      label: "Proporção",
      params: {
        options: [
          { value: "16/9", label: "16:9" },
          { value: "4/3", label: "4:3" },
          { value: "1/1", label: "1:1" },
          { value: "21/9", label: "21:9" },
        ],
      },
      defaultValue: "16/9",
    },
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
        width: "100%",
        aspectRatio: values.aspectRatio || "16/9",
        borderRadius: values.borderRadius || "8px",
        overflow: "hidden",
        background: "#000",
      },
    },
  }),
};

export const carouselDefinition: NoCodeComponentDefinition = {
  id: "OrquiCarousel",
  thumbnail: THUMB_CAROUSEL,
  label: "Carrossel",
  type: "item",
  paletteLabel: "Mídia",
  schema: [
    { prop: "autoplay", type: "boolean", label: "Autoplay", defaultValue: false },
    {
      prop: "interval",
      type: "select",
      label: "Intervalo (seg)",
      params: {
        options: [
          { value: "2", label: "2s" },
          { value: "3", label: "3s" },
          { value: "5", label: "5s" },
          { value: "8", label: "8s" },
          { value: "10", label: "10s" },
        ],
      },
      defaultValue: "5",
    },
    { prop: "showDots", type: "boolean", label: "Indicadores", defaultValue: true },
    { prop: "showArrows", type: "boolean", label: "Setas", defaultValue: true },
    {
      prop: "gap",
      type: "space",
      label: "Gap entre slides",
      group: "Estilo",
    },
    {
      prop: "borderRadius",
      type: "orqui-border-radius",
      label: "Border radius",
      group: "Estilo",
    },
    {
      prop: "Children",
      type: "component-collection",
      accepts: ALL_COMPONENT_IDS,
      placeholderAppearance: { height: 120, width: 200, label: "Slide" },
    },
  ],
  styles: ({ values }) => ({
    styled: {
      Root: {
        position: "relative" as const,
        width: "100%",
        overflow: "hidden",
        borderRadius: values.borderRadius || "8px",
      },
    },
  }),
};
