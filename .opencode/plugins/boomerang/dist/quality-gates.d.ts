import { QualityGate, QualityGateSummary } from "./types.js";
export declare const DEFAULT_QUALITY_GATES: QualityGate[];
export declare function runQualityGate(gate: QualityGate): Promise<{
    gate: string;
    passed: boolean;
    output: string;
    error?: string;
}>;
export declare function runAllQualityGates(gates: QualityGate[]): Promise<QualityGateSummary>;
//# sourceMappingURL=quality-gates.d.ts.map