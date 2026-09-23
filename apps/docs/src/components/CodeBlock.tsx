import { Check, Copy } from 'lucide-react';
import { isValidElement, useState, type ReactNode } from 'react';

type CodeBlockProps = {
    children?: ReactNode;
    className?: string;
    /** Explicit source when not wrapping MDX pre children */
    code?: string;
    language?: string;
    /**
     * When true, render only the code body (no outer chrome).
     * Used inside InstallTabs which owns the shared shell.
     */
    embedded?: boolean;
    /** Stretch to fill a parent flex/grid cell */
    fill?: boolean;
};

function extractText(node: ReactNode): string {
    if (node == null || typeof node === 'boolean') {
        return '';
    }
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(extractText).join('');
    }
    if (typeof node === 'object' && 'props' in node) {
        const element = node as { props?: { children?: ReactNode } };
        return extractText(element.props?.children);
    }
    return '';
}

export function CodeBlock({
    children,
    className,
    code,
    language,
    embedded = false,
    fill = false,
}: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const text = (code ?? extractText(children)).replace(/\n$/, '');
    const lang =
        language ??
        className
            ?.split(/\s+/)
            .find((part) => part.startsWith('language-'))
            ?.replace('language-', '') ??
        '';

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };

    const body = (
        <pre
            className={`docs-code-pre m-0 overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed text-[#e2e8f0] ${
                fill ? 'min-h-0 flex-1' : ''
            }`}
        >
            <code
                className={`docs-code-inner !bg-transparent !p-0 !text-[#e2e8f0] ${className ?? ''}`}
            >
                {code ?? children}
            </code>
        </pre>
    );

    if (embedded) {
        return body;
    }

    return (
        <div
            className={`docs-code-block group relative overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-[#0f172a] shadow-[0_4px_16px_rgb(15_23_42_/_8%)] ${
                fill ? 'flex h-full min-h-0 flex-col' : ''
            }`}
            data-testid="code-block"
        >
            <div className="flex shrink-0 items-center justify-between border-b border-[#334155] px-5 py-2">
                <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                    {lang || 'code'}
                </span>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#334155] bg-[#1e293b] px-2.5 py-1 text-[12px] font-medium text-slate-200 hover:border-[var(--pg-accent)] hover:text-white"
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
            {body}
            <span className="sr-only" aria-live="polite">
                {copied ? 'Copied to clipboard' : ''}
            </span>
        </div>
    );
}

/** MDX maps fenced blocks to <pre><code>...</code></pre>; unwrap into CodeBlock. */
export function MdxPre({ children }: { children?: ReactNode }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (isValidElement(child)) {
        const props = child.props as { className?: string; children?: ReactNode };
        // MDX may map `code` to a function component, so do not require type === 'code'.
        return (
            <CodeBlock {...(props.className ? { className: props.className } : {})}>
                {props.children}
            </CodeBlock>
        );
    }
    return <CodeBlock>{children}</CodeBlock>;
}
