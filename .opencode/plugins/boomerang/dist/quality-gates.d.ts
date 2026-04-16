export interface QualityGateResult {
    name: string;
    success: boolean;
    output: string;
    duration?: number;
    error?: string;
}
export interface QualityGatesConfig {
    lint: {
        enabled: boolean;
        command: string;
        required: boolean;
    };
    typecheck: {
        enabled: boolean;
        command: string;
        required: boolean;
    };
    test: {
        enabled: boolean;
        command: string;
        required: boolean;
    };
}
export declare const DEFAULT_QUALITY_GATES: QualityGatesConfig;
export declare function runQualityGate(_: any, gate: QualityGatesConfig[keyof QualityGatesConfig], name: string): Promise<QualityGateResult>;
export declare function runAllQualityGates($: any, config?: QualityGatesConfig): Promise<{
    results: QualityGateResult[];
    allPassed: boolean;
    summary: string;
}>;
