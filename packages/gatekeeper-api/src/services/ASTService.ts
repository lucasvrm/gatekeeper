import { Project, SourceFile } from 'ts-morph'
import type { ASTService as IASTService } from '../types/index.js'

export class ASTService implements IASTService {
  private project: Project

  constructor() {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        jsx: 2, // JsxEmit.React
        allowJs: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
      },
    })
  }

  async parseFile(filePath: string): Promise<SourceFile> {
    const sourceFile = this.project.addSourceFileAtPath(filePath)
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
