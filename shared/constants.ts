export const PROVIDER_COLORS = {
  anthropic: {
    hex: '#D97706',
    tailwind: 'bg-orange-100 text-orange-800',
  },
  openai: {
    hex: '#10B981',
    tailwind: 'bg-green-100 text-green-800',
  },
  google: {
    hex: '#4285F4',
    tailwind: 'bg-blue-100 text-blue-800',
  },
  ollama: {
    hex: '#9333EA',
    tailwind: 'bg-purple-100 text-purple-800',
  },
} as const

export type ProviderName = keyof typeof PROVIDER_COLORS
