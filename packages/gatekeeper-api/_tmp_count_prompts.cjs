const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const jsonReplacer = (_k, v) => (typeof v === 'bigint' ? Number(v) : v);

(async () => {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const tableSet = new Set(tables.map((t) => t.name));

  const totals = {};
  if (tableSet.has('PromptInstruction')) {
    totals.promptInstruction = await prisma.promptInstruction.count();
  }

  const byStep = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT step, COUNT(*) as count FROM PromptInstruction GROUP BY step ORDER BY step"
      )
    : [];
  const byKind = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT kind, COUNT(*) as count FROM PromptInstruction GROUP BY kind ORDER BY kind"
      )
    : [];
  const byRole = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT role, COUNT(*) as count FROM PromptInstruction GROUP BY role ORDER BY role"
      )
    : [];
  const byActive = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT isActive, COUNT(*) as count FROM PromptInstruction GROUP BY isActive"
      )
    : [];
  const byStepKindRole = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT step, kind, role, COUNT(*) as count FROM PromptInstruction GROUP BY step, kind, role ORDER BY step, kind, role"
      )
    : [];

  const dynamicLike = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) as count FROM PromptInstruction WHERE name LIKE '%dynamic%' OR content LIKE '%dynamic%'"
      )
    : [];
  const customLike = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) as count FROM PromptInstruction WHERE name LIKE '%custom%' OR content LIKE '%custom%'"
      )
    : [];
  const pipelineLike = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) as count FROM PromptInstruction WHERE name LIKE '%pipeline%' OR content LIKE '%pipeline%'"
      )
    : [];
  const systemCount = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) as count FROM PromptInstruction WHERE role='system'"
      )
    : [];
  const userCount = tableSet.has('PromptInstruction')
    ? await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) as count FROM PromptInstruction WHERE role='user'"
      )
    : [];

  const counts = {};
  const countIfExists = async (name, key) => {
    if (!tableSet.has(name)) return;
    counts[key] = await prisma[name].count();
  };

  await countIfExists('SessionProfile', 'sessionProfile');
  await countIfExists('SessionProfilePrompt', 'sessionProfilePrompt');
  await countIfExists('PipelineEvent', 'pipelineEvent');
  await countIfExists('PipelineState', 'pipelineState');
  await countIfExists('AgentRun', 'agentRun');
  await countIfExists('AgentRunStep', 'agentRunStep');
  await countIfExists('Snippet', 'snippet');
  await countIfExists('ContextPack', 'contextPack');
  await countIfExists('SessionPreset', 'sessionPreset');
  await countIfExists('ValidationRun', 'validationRun');
  await countIfExists('ValidatorResult', 'validatorResult');
  await countIfExists('GateResult', 'gateResult');
  await countIfExists('ManifestFile', 'manifestFile');
  await countIfExists('ValidationLog', 'validationLog');

  console.log(
    JSON.stringify(
      {
        tables,
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
        counts,
      },
      jsonReplacer,
      2
    )
  );

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
