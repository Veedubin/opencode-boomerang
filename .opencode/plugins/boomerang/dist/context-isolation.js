import * as fs from "fs";
import * as path from "path";
const EVICTION_THRESHOLD = 500; // words
const CHAR_THRESHOLD = 3000; // characters
export function shouldEvict(output) {
    const wordCount = output.split(/\s+/).length;
    return wordCount > EVICTION_THRESHOLD || output.length > CHAR_THRESHOLD;
}
export function evictToFile(output, taskType, taskId) {
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const timestamp = Date.now();
    const fileName = `${taskType}-${taskId}-${timestamp}.md`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, output, "utf-8");
    const wordCount = output.split(/\s+/).length;
    const summary = `Output evicted to file (${wordCount} words). See ${filePath}`;
    return { summary, filePath };
}
export function isolateResult(rawOutput, taskType, taskId, synthesize) {
    const wordCount = rawOutput.split(/\s+/).length;
    if (shouldEvict(rawOutput)) {
        const { summary, filePath } = evictToFile(rawOutput, taskType, taskId);
        return {
            summary,
            filePath,
            wordCount,
        };
    }
    if (synthesize) {
        return {
            summary: synthesize(rawOutput),
            wordCount,
        };
    }
    return {
        summary: rawOutput,
        wordCount,
    };
}
export function formatIsolatedResult(result) {
    if (result.filePath) {
        return `## ${result.summary}\n\n**Full output:** ${result.filePath}\n`;
    }
    return result.summary;
}
//# sourceMappingURL=context-isolation.js.map