import { execSync } from "child_process";
import { existsSync } from "fs";
function runCommand(cmd) {
    try {
        return execSync(cmd, { encoding: "utf-8", stdio: "pipe" });
    }
    catch (error) {
        return error.stdout?.toString?.() || error.stderr?.toString?.() || String(error);
    }
}
function hasPackageJson() {
    return existsSync("package.json");
}
export const DEFAULT_QUALITY_GATES = {
    lint: {
        enabled: true,
        command: "npx --yes eslint . --max-warnings=0",
        required: false,
    },
    typecheck: {
        enabled: true,
        command: "npx --yes tsc --noEmit",
        required: false,
    },
    test: {
        enabled: true,
        command: "npx --yes vitest --run",
        required: false,
    },
};
export async function runQualityGate(_, gate, name) {
    if (!gate.enabled) {
        return {
            name,
            success: true,
            output: "Skipped (disabled)",
        };
    }
    const start = Date.now();
    let output = runCommand(gate.command);
    const duration = Date.now() - start;
    const isSuccess = typeof output === "string" &&
        !output.toLowerCase().includes("error") &&
        !output.toLowerCase().includes("failed") &&
        !output.includes("Command failed") &&
        (output.toLowerCase().includes("passed") || output.toLowerCase().includes("success") || output.includes("0 errors") || output.includes("no errors") || output.includes("OK"));
    return {
        name,
        success: isSuccess,
        output: output.substring(0, 500),
        duration,
    };
}
export async function runAllQualityGates($, config = DEFAULT_QUALITY_GATES) {
    const results = [];
    const hasPkg = hasPackageJson();
    if (!hasPkg) {
        results.push({ name: "Lint", success: true, output: "Skipped (no package.json)" });
        results.push({ name: "TypeCheck", success: true, output: "Skipped (no package.json)" });
        results.push({ name: "Test", success: true, output: "Skipped (no package.json)" });
    }
    else {
        results.push(await runQualityGate($, config.lint, "Lint"));
        results.push(await runQualityGate($, config.typecheck, "TypeCheck"));
        results.push(await runQualityGate($, config.test, "Test"));
    }
    const allPassed = results.every((r) => r.success);
    let summary = "## Quality Gates Results\n\n";
    summary += `**Overall:** ${allPassed ? "✅ All Passed" : "⚠️ Some Skipped/Failed"}\n\n`;
    for (const result of results) {
        const icon = result.success ? "✅" : "❌";
        summary += `### ${icon} ${result.name}\n`;
        if (result.duration) {
            summary += `- Duration: ${result.duration}ms\n`;
        }
        if (result.output) {
            summary += `- Output: ${result.output.substring(0, 200)}\n`;
        }
        if (result.error) {
            summary += `- Error: ${result.error}\n`;
        }
        summary += "\n";
    }
    return {
        results,
        allPassed,
        summary,
    };
}
