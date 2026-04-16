export async function checkGitStatus($) {
    try {
        const statusOutput = $ `git status --porcelain`.text().trim();
        const branchOutput = $ `git branch --show-current`.text().trim();
        return {
            isDirty: statusOutput.length > 0,
            files: statusOutput ? statusOutput.split("\n").filter((f) => f.trim()) : [],
            branch: branchOutput || "detached",
            ahead: 0,
            behind: 0,
        };
    }
    catch {
        return {
            isDirty: false,
            files: [],
            branch: "unknown",
            ahead: 0,
            behind: 0,
        };
    }
}
export async function commitCheckpoint($, message = "wip: pre-work checkpoint") {
    try {
        const status = await checkGitStatus($);
        if (!status.isDirty) {
            return { success: true, message: "No changes to commit" };
        }
        $ `git add -A`.text();
        $ `git commit -m "${message}"`.text();
        const hashOutput = $ `git rev-parse HEAD`.text().trim();
        const hash = hashOutput.substring(0, 7);
        return {
            success: true,
            hash,
            message: `Committed: ${message} (${hash})`,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function commitWithMessage($, message) {
    try {
        const status = await checkGitStatus($);
        if (!status.isDirty) {
            return { success: true, message: "No changes to commit" };
        }
        $ `git add -A`.text();
        $ `git commit -m "${message}"`.text();
        const hashOutput = $ `git rev-parse HEAD`.text().trim();
        const hash = hashOutput.substring(0, 7);
        return {
            success: true,
            hash,
            message: `Committed: ${message} (${hash})`,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
export async function getLastCommitMessage($) {
    try {
        const result = $ `git log -1 --format=%s`.text().trim();
        return result;
    }
    catch {
        return "";
    }
}
export function generateCommitMessage(summary) {
    const prefixes = ["feat", "fix", "refactor", "test", "docs", "chore", "style"];
    const lowerSummary = summary.toLowerCase();
    for (const prefix of prefixes) {
        if (lowerSummary.includes(prefix)) {
            return `${prefix}: ${summary}`;
        }
    }
    if (lowerSummary.includes("test"))
        return `test: ${summary}`;
    if (lowerSummary.includes("fix") || lowerSummary.includes("bug"))
        return `fix: ${summary}`;
    if (lowerSummary.includes("doc"))
        return `docs: ${summary}`;
    if (lowerSummary.includes("format") || lowerSummary.includes("style"))
        return `style: ${summary}`;
    return `feat: ${summary}`;
}
