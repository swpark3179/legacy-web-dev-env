declare module 'sql.js' {
    export interface SqlJsConfig {
        locateFile?: (file: string) => string;
    }
    export interface Database {
        run(sql: string, params?: Record<string, unknown>): void;
        exec(sql: string, params?: Record<string, unknown>): ExecResult[];
        get(sql: string, params?: Record<string, unknown>): unknown[];
        close(): void;
        export(): Uint8Array;
    }
    export interface ExecResult {
        columns: string[];
        values: unknown[][];
    }
    export default function initSqlJs(config?: SqlJsConfig): Promise<{
        Database: new (data?: BufferSource) => Database;
    }>;
}
