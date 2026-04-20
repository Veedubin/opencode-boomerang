import { IsolatedResult } from "./types.js";
export declare function shouldEvict(output: string): boolean;
export declare function evictToFile(output: string, taskType: string, taskId: string): {
    summary: string;
    filePath: string;
};
export declare function isolateResult(rawOutput: string, taskType: string, taskId: string, synthesize?: (raw: string) => string): IsolatedResult;
export declare function formatIsolatedResult(result: IsolatedResult): string;
//# sourceMappingURL=context-isolation.d.ts.map