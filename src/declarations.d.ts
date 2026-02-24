declare module "serverless/lib/cli/resolve-configuration-path.js" {
  function findConfigPath(options: { cwd?: string }): Promise<string>;
  export default findConfigPath;
}
