import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const conventions = await prisma.testPathConvention.findMany()
console.log(JSON.stringify(conventions, null, 2))

await prisma.$disconnect()
