declare module "node:sqlite" {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;

  export class StatementSync {
    get(...anonymousParameters: SQLInputValue[]): unknown;
    run(...anonymousParameters: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
