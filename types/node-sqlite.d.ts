declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...values: unknown[]): unknown;
      all(...values: unknown[]): Array<Record<string, unknown>>;
    };
    close(): void;
  }
}
