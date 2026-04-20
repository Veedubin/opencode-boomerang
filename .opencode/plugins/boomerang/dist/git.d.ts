import { GitStatus, GitCommitResult } from "./types.js";
export declare function checkGitStatus($: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>): Promise<GitStatus>;
export declare function commitCheckpoint($: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>, message?: string): Promise<GitCommitResult>;
export declare function commitWithMessage($: (strings: TemplateStringsArray, ...values: any[]) => Promise<any>, message: string): Promise<GitCommitResult>;
export declare function generateCommitMessage(prompt: string): string;
//# sourceMappingURL=git.d.ts.map