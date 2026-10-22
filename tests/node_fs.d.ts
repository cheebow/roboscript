// The one Node API the record generator uses, declared here instead of pulling in
// @types/node, which would add Node's globals to the whole project.
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string): void;
}
