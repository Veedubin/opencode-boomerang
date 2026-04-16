export interface GitStatus {
    isDirty: boolean;
    files: string[];
    branch: string;
    ahead: number;
    behind: number;
}
export interface GitCommitResult {
    success: boolean;
    hash?: string;
    message?: string;
    error?: string;
}
export declare function checkGitStatus($: any): Promise<GitStatus>;
export declare function commitCheckpoint($: any, message?: string): Promise<GitCommitResult>;
export declare function commitWithMessage($: any, message: string): Promise<GitCommitResult>;
export declare function getLastCommitMessage($: any): Promise<string>;
export declare function generateCommitMessage(summary: string): string;
