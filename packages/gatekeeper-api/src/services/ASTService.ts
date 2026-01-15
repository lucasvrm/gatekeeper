import { Project, SourceFile } from 'ts-morph'
import type { ASTService as IASTService } from '../types/index.js'

export class ASTService implements IASTService {
  private project: Project

  constructor() {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
    })
  }

  async parseFile(filePath: string): Promise<SourceFile> {
    const sourceFile = this.project.addSourceFileAtPath(filePath)
    
    const diagnostics = sourceFile.getPreEmitDiagnostics()
    if (diagnostics.length > 0) {
      const errors = diagnostics.map((d) => d.getMessageText().toString()).join('\n')
      throw new Error(`Parse error in ${filePath}: ${errors}`)
    }
    
    return sourceFile
  }

  async getImports(filePath: string): Promise<string[]> {
    const sourceFile = await this.parseFile(filePath)
    const imports: string[] = []

    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDeclaration.getModuleSpecifierValue()
      imports.push(moduleSpecifier)
    }

    return imports
  }
}
