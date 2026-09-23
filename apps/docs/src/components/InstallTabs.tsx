import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export type PackageManager = 'bun' | 'pnpm' | 'npm' | 'yarn';

const MANAGERS: readonly PackageManager[] = ['bun', 'pnpm', 'npm', 'yarn'];

function installCommand(manager: PackageManager, packages: string): string {
    switch (manager) {
        case 'bun':
            return `bun add ${packages}`;
        case 'pnpm':
            return `pnpm add ${packages}`;
        case 'npm':
            return `npm install ${packages}`;
        case 'yarn':
            return `yarn add ${packages}`;
    }
}

type InstallTabsProps = {
    /** Space-separated package names */
    packages?: string;
};

const DEFAULT_PACKAGES = '@spreadish/core @spreadish/react @spreadish/sometic';

export function InstallTabs({ packages = DEFAULT_PACKAGES }: InstallTabsProps) {
    const [active, setActive] = useState<PackageManager>('bun');
    const [copied, setCopied] = useState(false);
    const command = installCommand(active, packages);

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div
            className="docs-code-block overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-[#0f172a] shadow-[0_4px_16px_rgb(15_23_42_/_8%)]"
            data-testid="install-tabs"
        >
            <div
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334155] px-3 pt-2"
                role="tablist"
                aria-label="Package manager"
            >
                <div className="flex flex-wrap gap-1">
                    {MANAGERS.map((manager) => {
                        const selected = manager === active;
                        return (
                            <button
                                key={manager}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                className={`rounded-t-[8px] px-3 py-1.5 text-[12px] font-semibold ${
                                    selected
                                        ? 'bg-[#1e293b] text-[var(--pg-accent)]'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                                onClick={() => setActive(manager)}
                                data-testid={`install-tab-${manager}`}
                            >
                                {manager}
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    className="mb-1.5 inline-flex items-center gap-1.5 rounded-[8px] border border-[#334155] bg-[#1e293b] px-2.5 py-1 text-[12px] font-medium text-slate-200 hover:border-[var(--pg-accent)] hover:text-white"
                    onClick={() => {
                        void onCopy();
                    }}
                    data-testid="code-copy-button"
                    aria-label={copied ? 'Copied' : 'Copy code'}
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2} />
                    ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2} />
                    )}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="docs-code-pre m-0 overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed text-[#e2e8f0]">
                <code className="docs-code-inner !bg-transparent !p-0 !text-[#e2e8f0]">
                    {command}
                </code>
            </pre>
            <span className="sr-only" aria-live="polite">
                {copied ? 'Copied to clipboard' : ''}
            </span>
        </div>
    );
}
