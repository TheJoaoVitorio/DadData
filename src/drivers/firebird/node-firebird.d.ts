declare module 'node-firebird' {
  export interface Options {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    lowercase_keys?: boolean;
    role?: string;
    pageSize?: number;
    retryConnectionInterval?: number;
    blobAddTextDecoder?: boolean;
    [key: string]: any;
  }

  export interface Database {
    query(query: string, params: any[], callback: (err: any, result: any) => void): void;
    query(query: string, callback: (err: any, result: any) => void): void;
    execute(query: string, params: any[], callback: (err: any, result: any) => void): void;
    detach(callback?: (err?: any) => void): void;
    transaction(isolation: any, callback: (err: any, transaction: any) => void): void;
  }

  export function attach(options: Options, callback: (err: any, db: Database) => void): void;
  export function attachAsync(options: Options): Promise<Database>;
  export function escape(value: any): string;

  const Firebird: {
    attach: typeof attach;
    attachAsync: typeof attachAsync;
    escape: typeof escape;
    [key: string]: any;
  };

  export default Firebird;
}
