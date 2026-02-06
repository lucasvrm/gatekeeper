const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const totals = {};
  totals.promptInstruction = await prisma.promptInstruction.count();

  const byStep = await prisma.$queryRawUnsafe(
    "SELECT COALESCE(step,'null') as step, COUNT(*) as count FROM PromptInstruction GROUP BY step ORDER BY step"
  );
  const byKind = await prisma.$queryRawUnsafe(
    "SELECT COALESCE(kind,'null') as kind, COUNT(*) as count FROM PromptInstruction GROUP BY kind ORDER BY kind"
  );
  const byRole = await prisma.$queryRawUnsafe(
    "SELECT role, COUNT(*) as count FROM PromptInstruction GROUP BY role ORDER BY role"
  );
  const byActive = await prisma.$queryRawUnsafe(
    "SELECT isActive, COUNT(*) as count FROM PromptInstruction GROUP BY isActive"
  );
  const byStepKindRole = await prisma.$queryRawUnsafe(
    "SELECT COALESCE(step,'null') as step, COALESCE(kind,'null') as kind, role, COUNT(*) as count FROM PromptInstruction GROUP BY step, kind, role ORDER BY step, kind, role"
  );

  const dynamicLike = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) as count FROM PromptInstruction WHERE name LIKE '%dynamic%' OR content LIKE '%dynamic%'"
  );
  const customLike = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) as count FROM PromptInstruction WHERE name LIKE '%custom%' OR content LIKE '%custom%'"
  );
  const pipelineLike = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) as count FROM PromptInstruction WHERE name LIKE '%pipeline%' OR content LIKE '%pipeline%'"
  );
  const systemCount = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) as count FROM PromptInstruction WHERE role='system'"
  );
  const userCount = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) as count FROM PromptInstruction WHERE role='user'"
  );

  const sessionProfile = await prisma.sessionProfile.count();
  const sessionProfilePrompt = await prisma.sessionProfilePrompt.count();
  const pipelineEvent = await prisma.pipelineEvent.count();
  const pipelineState = await prisma.pipelineState.count();
  const agentRun = await prisma.agentRun.count();
  const agentRunStep = await prisma.agentRunStep.count();
  const snippet = await prisma.snippet.count();
  const contextPack = await prisma.contextPack.count();
  const sessionPreset = await prisma.sessionPreset.count();

  console.log(
    JSON.stringify(
      {
        totals,
        byStep,
        byKind,
        byRole,
        byActive,
        byStepKindRole,
        dynamicLike,
        customLike,
        pipelineLike,
        systemCount,
        userCount,
        sessionProfile,
        sessionProfilePrompt,
        pipelineEvent,
        pipelineState,
        agentRun,
        agentRunStep,
        snippet,
        contextPack,
        sessionPreset,
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
