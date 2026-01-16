import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Lint Fixes - Core Files (Evidence-Based)', () => {
  const projectRoot = 'C:\\Coding\\gatekeeper';
  const files = {
    validationOrchestrator: join(projectRoot, 'packages', 'gatekeeper-api', 'src', 'services', 'ValidationOrchestrator.ts'),
    errorHandler: join(projectRoot, 'packages', 'gatekeeper-api', 'src', 'api', 'middlewares', 'errorHandler.ts'),
    runsRoutes: join(projectRoot, 'packages', 'gatekeeper-api', 'src', 'api', 'routes', 'runs.routes.ts'),
    gatesTypes: join(projectRoot, 'packages', 'gatekeeper-api', 'src', 'types', 'gates.types.ts'),
  };

  let fileContents: Record<string, string>;

  beforeEach(() => {
    fileContents = {};
    Object.entries(files).forEach(([key, filePath]) => {
      fileContents[key] = readFileSync(filePath, 'utf-8');
    });
  });

  describe('ValidationOrchestrator.ts - Linha 204 prefer-const error', () => {
    it('should use const instead of let for value variable that is never reassigned', () => {
      const content = fileContents.validationOrchestrator;
      const lines = content.split('\n');
      
      // Encontrar a função buildContext que contém o erro
      const buildContextStart = lines.findIndex(line => line.includes('buildContext'));
      expect(buildContextStart).toBeGreaterThan(-1);
      
      // Procurar na área relevante (próximas 20 linhas após buildContext)
      const relevantArea = lines.slice(buildContextStart, buildContextStart + 20).join('\n');
      
      // Deve ter 'const value' e NÃO deve ter 'let value' para variável não reatribuída
      const hasLetValue = relevantArea.match(/let\s+value\s*=/);
      expect(hasLetValue).toBeNull();
      
      // Deve ter const value
      const hasConstValue = relevantArea.match(/const\s+value\s*=/);
      expect(hasConstValue).not.toBeNull();
    });
  });

  describe('ValidationOrchestrator.ts - Linha 198 no-explicit-any warning', () => {
    it('should use ValidationRun type instead of any for run parameter', () => {
      const content = fileContents.validationOrchestrator;
      
      // Verificar que buildContext usa ValidationRun, não any
      const buildContextMatch = content.match(/buildContext\s*\(\s*run\s*:\s*([^)]+)\)/);
      expect(buildContextMatch).not.toBeNull();
      
      if (buildContextMatch) {
        const paramType = buildContextMatch[1].trim();
        expect(paramType).not.toBe('any');
        expect(paramType).toBe('ValidationRun');
      }
      
      // Verificar que ValidationRun está importado do @prisma/client
      const hasValidationRunImport = content.includes('ValidationRun') && 
                                     content.includes('@prisma/client');
      expect(hasValidationRunImport).toBe(true);
    });
  });

  describe('errorHandler.ts - Linha 4 no-explicit-any warning', () => {
    it('should use unknown instead of any for details field in AppError interface', () => {
      const content = fileContents.errorHandler;
      
      // Encontrar interface AppError
      const appErrorMatch = content.match(/interface\s+AppError[^{]*\{[^}]+\}/s);
      expect(appErrorMatch).not.toBeNull();
      
      if (appErrorMatch) {
        const interfaceBody = appErrorMatch[0];
        
        // Não deve ter 'details?: any'
        expect(interfaceBody).not.toMatch(/details\?:\s*any/);
        
        // Deve ter 'details?: unknown'
        expect(interfaceBody).toMatch(/details\?:\s*unknown/);
      }
    });
  });

  describe('errorHandler.ts - Linha 11 no-unused-vars warning', () => {
    it('should prefix unused next parameter with underscore', () => {
      const content = fileContents.errorHandler;
      
      // Verificar assinatura da função errorHandler
      const errorHandlerMatch = content.match(/errorHandler\s*\([^)]+\)/s);
      expect(errorHandlerMatch).not.toBeNull();
      
      if (errorHandlerMatch) {
        const signature = errorHandlerMatch[0];
        
        // Verificar se next está com underscore OU se é usado no corpo
        const hasUnderscoreNext = signature.includes('_next');
        const nextIsUsed = content.includes('next(');
        
        // Se next não é usado, deve ter underscore
        if (!nextIsUsed) {
          expect(hasUnderscoreNext).toBe(true);
        }
      }
    });
  });

  describe('runs.routes.ts - Linhas 28-29 no-explicit-any warnings', () => {
    it('should not use as any type assertions for flush check', () => {
      const content = fileContents.runsRoutes;
      const lines = content.split('\n');
      
      // Encontrar área onde flush é usado (próximo a res.write)
      const resWriteIndex = lines.findIndex(line => line.includes('res.write'));
      expect(resWriteIndex).toBeGreaterThan(-1);
      
      // Verificar as próximas 5 linhas após res.write
      const flushArea = lines.slice(resWriteIndex, resWriteIndex + 5).join('\n');
      
      // Não deve ter 'as any'
      const hasAsAny = flushArea.match(/as\s+any/g);
      expect(hasAsAny).toBeNull();
      
      // Se usar type assertion, deve ser 'as unknown' ou tipo específico
      if (flushArea.includes('flush')) {
        const hasAsUnknown = flushArea.includes('as unknown');
        const hasSpecificType = flushArea.match(/as\s+\w+Response/);
        
        // Deve ter um dos dois
        expect(hasAsUnknown || hasSpecificType).toBeTruthy();
      }
    });
  });

  describe('gates.types.ts - Linha 62 no-explicit-any warning', () => {
    it('should use Promise<unknown> instead of Promise<any> for parseFile return type', () => {
      const content = fileContents.gatesTypes;
      
      // Encontrar interface ASTService
      const astServiceMatch = content.match(/interface\s+ASTService\s*\{[^}]+\}/s);
      expect(astServiceMatch).not.toBeNull();
      
      if (astServiceMatch) {
        const interfaceBody = astServiceMatch[0];
        
        // Não deve ter 'Promise<any>'
        expect(interfaceBody).not.toMatch(/Promise<any>/);
        
        // Deve ter 'Promise<unknown>'
        expect(interfaceBody).toMatch(/Promise<unknown>/);
      }
    });
  });

  describe('when all lint fixes are applied correctly', () => {
    it('should have no prefer-const violations in ValidationOrchestrator', () => {
      const content = fileContents.validationOrchestrator;
      
      // Verificar que não há 'let' seguido de variável que nunca é reatribuída
      // Proxy: verificar área específica do buildContext
      const buildContextArea = content.substring(
        content.indexOf('buildContext'),
        content.indexOf('buildContext') + 500
      );
      
      // Na área de parsing de config, value não deve ser let
      const configParsingArea = buildContextArea.substring(
        buildContextArea.indexOf('for (const item of config)'),
        buildContextArea.indexOf('for (const item of config)') + 200
      );
      
      expect(configParsingArea).not.toMatch(/let\s+value\s*=/);
    });

    it('should have all any types replaced with proper types', () => {
      const allContents = Object.values(fileContents).join('\n');
      
      // Contar ocorrências de ': any' nos arquivos corrigidos
      const explicitAnyInErrorHandler = fileContents.errorHandler.match(/:\s*any\b/g);
      const explicitAnyInRunsRoutes = fileContents.runsRoutes.match(/as\s+any\b/g);
      const explicitAnyInGatesTypes = fileContents.gatesTypes.match(/Promise<any>/g);
      const explicitAnyInOrchestrator = fileContents.validationOrchestrator
        .match(/buildContext\s*\(\s*run\s*:\s*any\s*\)/);
      
      expect(explicitAnyInErrorHandler).toBeNull();
      expect(explicitAnyInRunsRoutes).toBeNull();
      expect(explicitAnyInGatesTypes).toBeNull();
      expect(explicitAnyInOrchestrator).toBeNull();
    });
  });

  describe('sad path - when fixes are not applied', () => {
    it('should fail when let is used instead of const for non-reassigned variable', () => {
      // No baseRef, este teste deve falhar porque 'let value' existe
      const content = fileContents.validationOrchestrator;
      const hasLetValue = content.match(/let\s+value\s*=\s*item\.value/);
      
      // Este assertion vai PASSAR no targetRef (fix aplicado)
      // e FALHAR no baseRef (let value ainda existe)
      expect(hasLetValue).toBeNull();
    });

    it('should fail when any types are present in corrected files', () => {
      // No baseRef, este teste deve falhar porque any está presente
      const errorHandler = fileContents.errorHandler;
      const hasDetailsAny = errorHandler.match(/details\?:\s*any/);
      
      // Este assertion vai PASSAR no targetRef (fix aplicado)
      // e FALHAR no baseRef (any ainda existe)
      expect(hasDetailsAny).toBeNull();
    });
  });
});
