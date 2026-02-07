/**
 * LogFilters Demo
 *
 * Exemplo de uso do componente LogFilters para desenvolvimento e testes.
 * Para usar: importe e renderize este componente em uma página de teste.
 */

import { useState } from 'react'
import { LogFilters } from './log-filters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { LogFilterOptions } from '@/lib/types'

export function LogFiltersDemo() {
  const [filters, setFilters] = useState<LogFilterOptions>({})

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">LogFilters Demo</h1>
        <p className="text-muted-foreground">
          Componente de filtros para logs do orquestrador
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de Logs</CardTitle>
          <CardDescription>
            Configure os filtros e veja o objeto resultante abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogFilters
            filters={filters}
            onFiltersChange={setFilters}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estado Atual</CardTitle>
          <CardDescription>
            Objeto <code>LogFilterOptions</code> gerado pelos filtros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
            <code className="text-sm">
              {JSON.stringify(filters, null, 2)}
            </code>
          </pre>

          {Object.keys(filters).length === 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              Nenhum filtro aplicado. Configure os filtros acima para ver o resultado.
            </p>
          )}

          {Object.keys(filters).length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Resumo:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {filters.level && <li>• Nível: <strong>{filters.level}</strong></li>}
                {filters.stage && <li>• Estágio: <strong>{filters.stage}</strong></li>}
                {filters.type && <li>• Tipo: <strong>{filters.type}</strong></li>}
                {filters.search && <li>• Busca: <strong>"{filters.search}"</strong></li>}
                {filters.startDate && (
                  <li>• Data Inicial: <strong>{new Date(filters.startDate).toLocaleString('pt-BR')}</strong></li>
                )}
                {filters.endDate && (
                  <li>• Data Final: <strong>{new Date(filters.endDate).toLocaleString('pt-BR')}</strong></li>}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Query String Simulada</CardTitle>
          <CardDescription>
            Como os filtros seriam enviados para o backend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm break-all">
            {buildQueryString(filters) || <span className="text-muted-foreground">(nenhum parâmetro)</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exemplos Pré-configurados</CardTitle>
          <CardDescription>
            Clique para aplicar filtros de exemplo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <button
            onClick={() => setFilters({ level: 'error' })}
            className="w-full text-left px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <strong>Apenas Erros</strong>
            <br />
            <span className="text-sm text-muted-foreground">level: error</span>
          </button>

          <button
            onClick={() => setFilters({ level: 'error', stage: 'planning' })}
            className="w-full text-left px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <strong>Erros no Planning</strong>
            <br />
            <span className="text-sm text-muted-foreground">level: error, stage: planning</span>
          </button>

          <button
            onClick={() => setFilters({ search: 'timeout' })}
            className="w-full text-left px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <strong>Buscar "timeout"</strong>
            <br />
            <span className="text-sm text-muted-foreground">search: timeout</span>
          </button>

          <button
            onClick={() => {
              const now = new Date()
              const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
              setFilters({
                startDate: oneHourAgo.toISOString(),
                endDate: now.toISOString(),
              })
            }}
            className="w-full text-left px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <strong>Última Hora</strong>
            <br />
            <span className="text-sm text-muted-foreground">startDate: 1h atrás, endDate: agora</span>
          </button>

          <button
            onClick={() => setFilters({
              level: 'error',
              stage: 'planning',
              search: 'timeout',
              type: 'agent:error'
            })}
            className="w-full text-left px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            <strong>Múltiplos Filtros</strong>
            <br />
            <span className="text-sm text-muted-foreground">
              level: error, stage: planning, search: timeout, type: agent:error
            </span>
          </button>

          <button
            onClick={() => setFilters({})}
            className="w-full text-left px-4 py-2 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          >
            <strong>Limpar Tudo</strong>
            <br />
            <span className="text-sm">Remove todos os filtros</span>
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper para construir query string a partir dos filtros
function buildQueryString(filters: LogFilterOptions): string {
  const params = new URLSearchParams()

  if (filters.level) params.append('level', filters.level)
  if (filters.stage) params.append('stage', filters.stage)
  if (filters.type) params.append('type', filters.type)
  if (filters.search) params.append('search', filters.search)
  if (filters.startDate) params.append('startDate', filters.startDate)
  if (filters.endDate) params.append('endDate', filters.endDate)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}
