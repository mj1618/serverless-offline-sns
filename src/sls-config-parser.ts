import * as Serverless from "serverless";

import * as path from "path";
import * as fs from "fs";

class ConfigServerless extends Serverless {
  public service: any;
  private processedInput: any;
  private cli: any;
  private config: any;
  private pluginManager: any;
  private variables: any;

  public async getConfig(servicePath: string) {
    this.processedInput = this.cli.processInput();

    this.config.servicePath = servicePath;
    this.pluginManager.setCliOptions(this.processedInput.options);
    this.pluginManager.setCliCommands(this.processedInput.commands);
    await this.service.load(this.processedInput);

    this.pluginManager.validateCommand(this.processedInput.commands);

    return this.variables.populateService().then(() => {
      this.service.mergeResourceArrays();
      this.service.setFunctionNames(this.processedInput.options);
      this.service.validate();
    });
  }
}

const normalizeResources = (config) => {
  if (!config.resources) {
    return config.resources;
  }

  if (!config.resources.Resources) {
    return {};
  }

  if (!Array.isArray(config.resources.Resources)) {
    return config.resources;
  }

  const newResources = config.resources.Resources.reduce(
    (sum, { Resources, Outputs = {} }) => ({
      ...sum,
      ...Resources,
      Outputs: {
        ...(sum.Outputs || {}),
        ...Outputs,
      },
    }),
    {}
  );

  return {
    Resources: newResources,
  };
};

export async function loadServerlessConfig(cwd = process.cwd(), debug) {
  console.log("debug loadServerlessConfig", cwd);
  const stat = fs.statSync(cwd);
  if (!stat.isDirectory()) {
    cwd = path.dirname(cwd);
  }

  const serverless = new ConfigServerless();
  await serverless.getConfig(cwd);
  const { service: config } = serverless;

  const { custom = {} } = config;

  const output = {
    ...config,
    custom: {
      ...custom,
    },
    resources: normalizeResources(config),
  };

  console.log("output");

  return output;
}
