import { PrismaRlsClient, globalClient } from "./prisma-rls-client";

async function requestHandler(req) {
  const client = new PrismaRlsClient();
  client.rls.orgId = req.orgId;

  // call model methods as usaul
  await client.user.findFirst();

  // call transaction with original method
  await client.$transaction([
    client._global.org.update(),
    client._global.user.update(),
  ]);
}
