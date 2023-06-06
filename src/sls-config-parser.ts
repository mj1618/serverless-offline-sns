import * as fs from "fs";
import * as path from "path";
import * as Serverless from "serverless";
import * as findConfigPath from "serverless/lib/cli/resolve-configuration-path";

export async function loadServerlessConfig(cwd = process.cwd(), debug) {
  console.log("debug loadServerlessConfig", cwd);
  const stat = fs.statSync(cwd);
  if (!stat.isDirectory()) {
    cwd = path.dirname(cwd);
  }

  const configurationPath = await findConfigPath({ cwd });
  const serverless = new Serverless({ configurationPath });
  await serverless.init();
  return serverless;
}
