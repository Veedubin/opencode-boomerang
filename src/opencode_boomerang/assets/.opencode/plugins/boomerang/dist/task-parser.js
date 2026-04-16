export function parseTasksFromPrompt(prompt) {
    const tasks = [];
    const lines = prompt.split("\n").filter((l) => l.trim());
    let taskId = 1;
    for (const line of lines) {
        const cleaned = line.replace(/^[-*•]\s*/, "").trim();
        if (cleaned.length > 0) {
            tasks.push({
                id: `task-${taskId++}`,
                description: cleaned,
                dependencies: [],
                status: "pending",
            });
        }
    }
    return tasks;
}
export function detectImplicitDependencies(tasks) {
    const taskTexts = tasks.map((t) => t.description.toLowerCase());
    for (let i = 1; i < tasks.length; i++) {
        const current = tasks[i].description.toLowerCase();
        const previous = tasks[i - 1].description.toLowerCase();
        if (current.includes("after") ||
            current.includes("then") ||
            current.includes("following") ||
            current.includes("once") ||
            current.includes("use") ||
            current.includes("based on") ||
            current.includes("result of")) {
            tasks[i].dependencies.push(tasks[i - 1].id);
        }
        for (let j = 0; j < i; j++) {
            const prev = taskTexts[j];
            if (current.includes(prev) ||
                (prev.includes("create") && current.includes("test")) ||
                (prev.includes("setup") && current.includes("run"))) {
                if (!tasks[i].dependencies.includes(tasks[j].id)) {
                    tasks[i].dependencies.push(tasks[j].id);
                }
            }
        }
    }
    return tasks;
}
export function buildDAG(tasks) {
    const withDeps = detectImplicitDependencies(tasks);
    const taskMap = new Map(withDeps.map((t) => [t.id, t]));
    const parallelGroups = [];
    const inDegree = new Map();
    for (const task of withDeps) {
        inDegree.set(task.id, task.dependencies.length);
    }
    let currentGroup = [];
    let groupNum = 0;
    const remaining = [...withDeps];
    while (remaining.length > 0) {
        const ready = remaining.filter((t) => inDegree.get(t.id) === 0);
        if (ready.length === 0) {
            const cyclic = remaining[0];
            cyclic.dependencies = [];
            currentGroup.push(cyclic);
            remaining.splice(0, 1);
            continue;
        }
        for (const task of ready) {
            task.parallelGroup = groupNum;
            currentGroup.push(task);
            const idx = remaining.indexOf(task);
            if (idx > -1)
                remaining.splice(idx, 1);
            for (const [id, degree] of inDegree) {
                if (taskMap.get(id)?.dependencies.includes(task.id)) {
                    inDegree.set(id, degree - 1);
                }
            }
        }
        if (currentGroup.length > 0) {
            parallelGroups.push([...currentGroup]);
            currentGroup = [];
            groupNum++;
        }
    }
    if (currentGroup.length > 0) {
        parallelGroups.push(currentGroup);
    }
    const sequentialTasks = withDeps.filter((t) => t.dependencies.length > 0 && t.parallelGroup === undefined);
    return {
        nodes: withDeps,
        parallelGroups,
        sequentialTasks,
        totalTasks: withDeps.length,
    };
}
export function createExecutionPlan(dag) {
    const executionOrder = [];
    for (let i = 0; i < dag.parallelGroups.length; i++) {
        executionOrder.push({
            phase: i + 1,
            type: "parallel",
            tasks: dag.parallelGroups[i],
        });
    }
    if (dag.sequentialTasks.length > 0) {
        executionOrder.push({
            phase: executionOrder.length + 1,
            type: "sequential",
            tasks: dag.sequentialTasks,
        });
    }
    const maxParallel = Math.max(...dag.parallelGroups.map((g) => g.length), 0);
    return {
        dag,
        executionOrder,
        estimatedParallelism: maxParallel,
    };
}
export function formatDAGForPrompt(dag) {
    let output = `## Task Dependency Graph\n\n`;
    output += `**Total Tasks:** ${dag.totalTasks}\n\n`;
    for (let i = 0; i < dag.parallelGroups.length; i++) {
        output += `### Parallel Group ${i + 1} (can run concurrently)\n`;
        for (const task of dag.parallelGroups[i]) {
            output += `- **${task.id}**: ${task.description}`;
            if (task.dependencies.length > 0) {
                output += ` (depends on: ${task.dependencies.join(", ")})`;
            }
            output += `\n`;
        }
        output += `\n`;
    }
    if (dag.sequentialTasks.length > 0) {
        output += `### Sequential Tasks (must run in order)\n`;
        for (const task of dag.sequentialTasks) {
            output += `- **${task.id}**: ${task.description}`;
            if (task.dependencies.length > 0) {
                output += ` (depends on: ${task.dependencies.join(", ")})`;
            }
            output += `\n`;
        }
    }
    return output;
}
export function assignAgentsToTasks(tasks) {
    const agentKeywords = {
        architect: {
            keywords: ["design", "architecture", "pattern", "structure", "refactor", "review"],
            agent: "architect",
        },
        tester: {
            keywords: ["test", "spec", "verify", "validate", "qa", "coverage"],
            agent: "tester",
        },
        linter: {
            keywords: ["lint", "format", "style", "prettier", "eslint"],
            agent: "linter",
        },
        git: {
            keywords: ["commit", "push", "pull", "branch", "merge", "git"],
            agent: "git",
        },
        coder: {
            keywords: ["implement", "create", "write", "add", "build", "fix", "update", "change"],
            agent: "coder",
        },
    };
    for (const task of tasks) {
        const desc = task.description.toLowerCase();
        for (const [, config] of Object.entries(agentKeywords)) {
            if (config.keywords.some((kw) => desc.includes(kw))) {
                task.agent = config.agent;
                break;
            }
        }
        if (!task.agent) {
            task.agent = "coder";
        }
    }
    return tasks;
}
