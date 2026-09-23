/**
 * Dependency graph utilities. Keys are opaque strings; `@spreadish/core`
 * uses `${row},${column}` (see `cellKey` in `refs.ts`).
 */

export type FormulaNode = { key: string; deps: string[] };

type NormalizedGraph = {
    keys: string[];
    /** `edges[i]` holds indices of the nodes that node `i` depends on. */
    edges: number[][];
};

function normalize(nodes: readonly FormulaNode[]): NormalizedGraph {
    const indexByKey = new Map<string, number>();
    const keys: string[] = [];

    for (const node of nodes) {
        if (!indexByKey.has(node.key)) {
            indexByKey.set(node.key, keys.length);
            keys.push(node.key);
        }
    }

    const edges: number[][] = keys.map(() => []);
    const seen = keys.map(() => new Set<number>());

    for (const node of nodes) {
        const from = indexByKey.get(node.key);
        if (from === undefined) {
            continue;
        }
        const bucket = edges[from];
        const seenBucket = seen[from];
        if (!bucket || !seenBucket) {
            continue;
        }
        for (const dep of node.deps) {
            const to = indexByKey.get(dep);
            // Dependencies on cells without formulas are inputs, not graph nodes.
            if (to === undefined || seenBucket.has(to)) {
                continue;
            }
            seenBucket.add(to);
            bucket.push(to);
        }
    }

    return { keys, edges };
}

/** Iterative Tarjan so huge graphs cannot overflow the stack. */
function stronglyConnectedComponents(graph: NormalizedGraph): number[][] {
    const count = graph.keys.length;
    const index = new Array<number>(count).fill(-1);
    const lowlink = new Array<number>(count).fill(0);
    const onStack = new Array<boolean>(count).fill(false);
    const stack: number[] = [];
    const components: number[][] = [];
    let nextIndex = 0;

    for (let root = 0; root < count; root += 1) {
        if (index[root] !== -1) {
            continue;
        }
        const frame: Array<{ node: number; edge: number }> = [{ node: root, edge: 0 }];
        index[root] = nextIndex;
        lowlink[root] = nextIndex;
        nextIndex += 1;
        stack.push(root);
        onStack[root] = true;

        while (frame.length > 0) {
            const current = frame[frame.length - 1];
            if (!current) {
                break;
            }
            const neighbours = graph.edges[current.node] ?? [];
            if (current.edge < neighbours.length) {
                const next = neighbours[current.edge] ?? 0;
                current.edge += 1;
                if (index[next] === -1) {
                    index[next] = nextIndex;
                    lowlink[next] = nextIndex;
                    nextIndex += 1;
                    stack.push(next);
                    onStack[next] = true;
                    frame.push({ node: next, edge: 0 });
                } else if (onStack[next]) {
                    lowlink[current.node] = Math.min(lowlink[current.node] ?? 0, index[next] ?? 0);
                }
                continue;
            }

            frame.pop();
            const parent = frame[frame.length - 1];
            if (parent) {
                lowlink[parent.node] = Math.min(
                    lowlink[parent.node] ?? 0,
                    lowlink[current.node] ?? 0,
                );
            }
            if (lowlink[current.node] === index[current.node]) {
                const component: number[] = [];
                for (;;) {
                    const member = stack.pop();
                    if (member === undefined) {
                        break;
                    }
                    onStack[member] = false;
                    component.push(member);
                    if (member === current.node) {
                        break;
                    }
                }
                components.push(component);
            }
        }
    }

    return components;
}

function collectCycles(graph: NormalizedGraph): { cycles: string[][]; cycleNodes: Set<number> } {
    const cycles: string[][] = [];
    const cycleNodes = new Set<number>();

    for (const component of stronglyConnectedComponents(graph)) {
        const isCycle =
            component.length > 1 ||
            (component.length === 1 &&
                component[0] !== undefined &&
                (graph.edges[component[0]] ?? []).includes(component[0]));
        if (!isCycle) {
            continue;
        }
        const sorted = [...component].sort((a, b) => a - b);
        for (const member of sorted) {
            cycleNodes.add(member);
        }
        cycles.push(sorted.map((member) => graph.keys[member] ?? ''));
    }

    // Deterministic output: cycles ordered by their earliest declared member.
    cycles.sort((a, b) => graph.keys.indexOf(a[0] ?? '') - graph.keys.indexOf(b[0] ?? ''));
    return { cycles, cycleNodes };
}

/** Finds every cycle participant, including self references and cycles through ranges. */
export function detectCycles(nodes: readonly FormulaNode[]): { cycles: string[][] } {
    return { cycles: collectCycles(normalize(nodes)).cycles };
}

/**
 * Deterministic evaluation order (precedents first). Cycle participants are
 * excluded from `order` and reported in `cycles`; everything else stays calculable.
 */
export function topologicalOrder(nodes: readonly FormulaNode[]): {
    order: string[];
    cycles: string[][];
} {
    const graph = normalize(nodes);
    const { cycles, cycleNodes } = collectCycles(graph);

    const remaining = graph.keys.map((_key, node) => node).filter((node) => !cycleNodes.has(node));
    const included = new Set(remaining);

    const pendingCount = new Map<number, number>();
    const dependents = new Map<number, number[]>();

    for (const node of remaining) {
        const deps = (graph.edges[node] ?? []).filter((dep) => included.has(dep));
        pendingCount.set(node, deps.length);
        for (const dep of deps) {
            const list = dependents.get(dep);
            if (list) {
                list.push(node);
            } else {
                dependents.set(dep, [node]);
            }
        }
    }

    const ready = remaining.filter((node) => (pendingCount.get(node) ?? 0) === 0);
    const order: string[] = [];

    while (ready.length > 0) {
        // Stable selection by declaration index keeps results reproducible.
        let pick = 0;
        for (let i = 1; i < ready.length; i += 1) {
            if ((ready[i] ?? 0) < (ready[pick] ?? 0)) {
                pick = i;
            }
        }
        const node = ready.splice(pick, 1)[0];
        if (node === undefined) {
            break;
        }
        order.push(graph.keys[node] ?? '');
        for (const dependent of dependents.get(node) ?? []) {
            const next = (pendingCount.get(dependent) ?? 0) - 1;
            pendingCount.set(dependent, next);
            if (next === 0) {
                ready.push(dependent);
            }
        }
    }

    return { order, cycles };
}
