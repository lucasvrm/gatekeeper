const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .then(() => p.$disconnect())
  .catch(err => {
    console.error(err);
    p.$disconnect();
  });
