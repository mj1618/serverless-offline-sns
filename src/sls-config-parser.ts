import fs from "fs";
import path from "path";
import Serverless from "serverless";
import findConfigPath from 'serverless/lib/cli/resolve-configuration-path.js';

export async function loadServerlessConfig(cwd = process.cwd(), debug) {
  console.log("debug loadServerlessConfig", cwd);
  const stat = fs.statSync(cwd);
  if (!stat.isDirectory()) {
    cwd = path.dirname(cwd);
  }

  const configurationPath = await findConfigPath({cwd});
  const serverless = new Serverless({configurationPath});
  await serverless.init();
  return serverless;
}
