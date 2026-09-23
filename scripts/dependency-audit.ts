#!/usr/bin/env bun
/**
 * Dependency audit wrapper for Phase 09.
 * Fails the process when bun audit reports high or critical advisories.
 */
export {};

const level = process.env.AUDIT_LEVEL ?? 'high';
const proc = Bun.spawn(['bun', 'audit', `--audit-level=${level}`], {
    stdout: 'pipe',
    stderr: 'pipe',
});

const stdout = await new Response(proc.stdout).text();
const stderr = await new Response(proc.stderr).text();
const code = await proc.exited;

if (stdout.trim()) {
    console.log(stdout.trimEnd());
}
if (stderr.trim()) {
    console.error(stderr.trimEnd());
}

const report = {
    generatedAt: new Date().toISOString(),
    auditLevel: level,
    exitCode: code,
};

console.log(JSON.stringify(report, null, 2));

if (code !== 0) {
    process.exit(code);
}
