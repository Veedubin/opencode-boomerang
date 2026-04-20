export function parseTasksFromPrompt(prompt) {
    const lines = prompt.split("\n").filter((line) => line.trim().length > 0);
    const tasks = [];
    let taskId = 1;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            tasks.push({
                id: `task-${taskId++}`,
                description: trimmed.replace(/^[-*]\s*/, ""),
                agent: "coder",
                status: "pending",
                dependencies: [],
            });
        }
        else if (trimmed.match(/^\d+\./)) {
            tasks.push({
                id: `task-${taskId++}`,
                description: trimmed.replace(/^\d+\.\s*/, ""),
                agent: "coder",
                status: "pending",
                dependencies: [],
            });
        }
        else {
            tasks.push({
                id: `task-${taskId++}`,
                description: trimmed,
                agent: "coder",
                status: "pending",
                dependencies: [],
            });
        }
    }
    return tasks;
}
export function detectImplicitDependencies(tasks) {
    const updated = [...tasks];
    for (let i = 0; i < updated.length; i++) {
        const task = updated[i];
        const lower = task.description.toLowerCase();
        if (lower.includes("after") || lower.includes("then") || lower.includes("based on")) {
            for (let j = 0; j < i; j++) {
                if (!task.dependencies.includes(updated[j].id)) {
                    task.dependencies.push(updated[j].id);
                }
            }
        }
    }
    return updated;
}
export function buildDAG(tasks) {
    const edges = [];
    for (const task of tasks) {
        for (const dep of task.dependencies) {
            edges.push({ from: dep, to: task.id });
        }
    }
    return {
        tasks,
        edges,
        totalTasks: tasks.length,
    };
}
export function createExecutionPlan(dag) {
    const completed = new Set();
    const remaining = new Set(dag.tasks.map((t) => t.id));
    const phases = [];
    let phaseNum = 1;
    while (remaining.size > 0) {
        const ready = [];
        for (const taskId of remaining) {
            const task = dag.tasks.find((t) => t.id === taskId);
            const depsMet = task.dependencies.every((dep) => completed.has(dep));
            if (depsMet) {
                ready.push(task);
            }
        }
        if (ready.length === 0) {
            break;
        }
        for (const task of ready) {
            remaining.delete(task.id);
            completed.add(task.id);
        }
        phases.push({
            phase: phaseNum++,
            type: (ready.length > 1 ? "parallel" : "sequential"),
            tasks: ready,
        });
    }
    const maxParallel = Math.max(...phases.map((p) => p.tasks.length), 1);
    return {
        dag,
        executionOrder: phases,
        estimatedParallelism: maxParallel,
    };
}
export function formatDAGForPrompt(dag) {
    let output = "```\n";
    for (const task of dag.tasks) {
        const deps = task.dependencies.length > 0 ? ` <-- ${task.dependencies.join(", ")}` : "";
        output += `${task.id}: [${task.agent}] ${task.description}${deps}\n`;
    }
    output += "```\n";
    return output;
}
const AGENT_KEYWORDS = {
    orchestrator: ["plan", "coordinate", "delegate", "orchestrate"],
    coder: ["implement", "create", "write", "add", "build", "fix", "code"],
    architect: ["design", "architecture", "pattern", "structure", "refactor"],
    tester: ["test", "spec", "verify", "validate", "qa"],
    linter: ["lint", "format", "style", "prettier", "eslint"],
    git: ["commit", "push", "pull", "branch", "merge", "git"],
    explorer: ["find", "search", "explore", "locate", "discover"],
    writer: ["doc", "write", "document", "readme", "guide"],
    scraper: ["research", "scrape", "fetch", "search", "web"],
};
export function assignAgentsToTasks(tasks) {
    return tasks.map((task) => {
        const lower = task.description.toLowerCase();
        let assigned = "coder";
        for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
            if (keywords.some((kw) => lower.includes(kw))) {
                assigned = agent;
                break;
            }
        }
        return { ...task, agent: assigned };
    });
}
//# sourceMappingURL=task-parser.js.map