import { Project, SourceFile, SyntaxKind } from 'ts-morph'
import type { ASTService as IASTService, TestBlock } from '../types/index.js'

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

  async getTestBlocksWithComments(filePath: string): Promise<TestBlock[]> {
    const sourceFile = await this.parseFile(filePath)
    const testBlocks: TestBlock[] = []

    sourceFile.forEachDescendant((node) => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const callExpression = node.asKindOrThrow(SyntaxKind.CallExpression)
        const expression = callExpression.getExpression()

        const functionName = expression.getText()
        if (functionName === 'it' || functionName === 'test') {
          const args = callExpression.getArguments()
          if (args.length >= 2) {
            const firstArg = args[0]
            const testName = firstArg.isKind(SyntaxKind.StringLiteral)
              ? firstArg.getLiteralText()
              : firstArg.getText()

            const startLine = callExpression.getStartLineNumber()

            const precedingComments: string[] = []
            const leadingCommentRanges = callExpression.getLeadingCommentRanges()

            for (const commentRange of leadingCommentRanges) {
              const commentText = commentRange.getText()
              precedingComments.push(commentText)
            }

            testBlocks.push({
              name: testName,
              startLine,
              precedingComments,
            })
          }
        }
      }
    })

    return testBlocks
  }
}
