import type { Plugin } from "@opencode-ai/plugin";
export interface BoomerangConfig {
    orchestratorModel: string;
    coderModel: string;
    architectModel: string;
    testerModel: string;
    linterModel: string;
    gitCheckBeforeWork: boolean;
    gitCommitAfterWork: boolean;
    qualityGates: {
        lint: boolean;
        typecheck: boolean;
        test: boolean;
    };
    memoryEnabled: boolean;
    lazyCompactionEnabled: boolean;
}
export declare const BoomerangPlugin: Plugin;
export default BoomerangPlugin;
