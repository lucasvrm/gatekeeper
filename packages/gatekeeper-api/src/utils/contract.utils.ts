import type { ContractV1 } from '../types/contract.types.js'

export const MAX_CONTRACT_JSON_BYTES = 256 * 1024
export const MAX_CONTRACT_EVIDENCE_CHARS = 1024

export function isContractPayloadTooLarge(json?: string): boolean {
  return typeof json === 'string' && Buffer.byteLength(json, 'utf8') > MAX_CONTRACT_JSON_BYTES
}

export function truncateForLog(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

export function createContractLogMetadata(contract: ContractV1) {
  return {
    contractSlug: contract.slug,
    contractMode: contract.mode,
    contractClauseCount: contract.clauses.length,
  }
}

export function contractJsonPreview(contractJson: string | undefined): string | undefined {
  if (!contractJson) return undefined
  return truncateForLog(contractJson, MAX_CONTRACT_EVIDENCE_CHARS)
}

export function summarizeContract(contract: ContractV1) {
  return {
    slug: contract.slug,
    mode: contract.mode,
    clauseCount: contract.clauses.length,
    title: truncateForLog(contract.title, 120),
    artifacts: contract.targetArtifacts.slice(0, 5),
  }
}
