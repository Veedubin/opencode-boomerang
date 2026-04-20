import { execSync } from "child_process";
export const DEFAULT_QUALITY_GATES = [
    {
        name: "lint",
        command: "npx --yes eslint . --max-warnings=0",
        enabled: true,
    },
    {
        name: "typecheck",
        command: "npx --yes tsc --noEmit",
        enabled: true,
    },
    {
        name: "test",
        command: "npx --yes vitest --run",
        enabled: true,
    },
];
export async function runQualityGate(gate) {
    if (!gate.enabled) {
        return { gate: gate.name, passed: true, output: "Skipped (disabled)" };
    }
    try {
        const output = execSync(gate.command, { encoding: "utf-8", stdio: "pipe" });
        return { gate: gate.name, passed: true, output: output || "Passed" };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { gate: gate.name, passed: false, output: "", error: message };
    }
}
export async function runAllQualityGates(gates) {
    const results = [];
    for (const gate of gates) {
        results.push(await runQualityGate(gate));
    }
    const allPassed = results.every((r) => r.passed);
    const summary = results
        .map((r) => `${r.gate}: ${r.passed ? "✅" : "❌"} ${r.error || "OK"}`)
        .join("\n");
    return { allPassed, summary, results };
}
//# sourceMappingURL=quality-gates.js.map