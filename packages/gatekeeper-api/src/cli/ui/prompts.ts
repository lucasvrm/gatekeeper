import inquirer from 'inquirer'
import chalk from 'chalk'

export interface LLMQuestion {
  text: string
  type: 'choice' | 'text' | 'confirm'
  options?: { label: string; value: string }[]
  allowDefault?: boolean
}

export async function askQuestion(question: LLMQuestion): Promise<string> {
  console.log('')

  if (question.type === 'choice' && question.options) {
    const choices = question.options.map((option, index) => ({
      name: `${String.fromCharCode(65 + index)}) ${option.label}`,
      value: option.value,
    }))

    if (question.allowDefault) {
      choices.push({
        name: chalk.dim('Não sei / tanto faz (usar padrão)'),
        value: '__DEFAULT__',
      })
    }

    const { answer } = await inquirer.prompt([
      {
        type: 'list',
        name: 'answer',
        message: question.text,
        choices,
      },
    ])

    return answer
  }

  if (question.type === 'confirm') {
    const { answer } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'answer',
        message: question.text,
        default: true,
      },
    ])

    return answer ? 'yes' : 'no'
  }

  const { answer } = await inquirer.prompt([
    {
      type: 'input',
      name: 'answer',
      message: question.text,
      validate: (input) => {
        if (!input.trim() && !question.allowDefault) {
          return 'Por favor, responda a pergunta.'
        }
        return true
      },
    },
  ])

  return answer.trim() || '__DEFAULT__'
}
