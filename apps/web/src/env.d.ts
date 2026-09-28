/** The shared data files, loaded by the JSON5 plugin in vite.config.ts. */
declare module "*.json5" {
  const value: unknown;
  export default value;
}
