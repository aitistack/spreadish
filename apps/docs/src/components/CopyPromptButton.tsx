import { Check, ClipboardCopy } from 'lucide-react';
import { useId, useState } from 'react';
import { SPREADISH_AGENT_PROMPT } from '../lib/agent-prompt';

export type CopyPromptButtonVariant = 'hero' | 'header' | 'menu';

const variantClass: Record<CopyPromptButtonVariant, string> = {
    hero: 'copy-prompt-button inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--pg-border)] bg-white px-5 text-[14px] font-semibold text-[var(--pg-text)] shadow-[0_1px_2px_rgb(15_23_42_/_6%)] hover:border-[var(--pg-accent)] hover:text-[var(--pg-accent-hover)] sm:w-auto',
    header: 'copy-prompt-button inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-transparent px-3 text-[13px] font-medium leading-none text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]',
    menu: 'copy-prompt-button inline-flex w-full items-center gap-2 rounded-[10px] bg-transparent px-3 py-2.5 text-left text-[14px] font-medium text-[var(--pg-text)] hover:text-[var(--pg-accent-hover)]',
};

type CopyPromptButtonProps = {
    readonly variant?: CopyPromptButtonVariant;
    readonly className?: string;
    readonly onCopied?: () => void;
};

export function CopyPromptButton({
    variant = 'hero',
    className = '',
    onCopied,
}: CopyPromptButtonProps) {
    const [copied, setCopied] = useState(false);
    const statusId = useId();
    const iconSize =
        variant === 'hero' ? 'h-4 w-4' : variant === 'header' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5';
    const label = copied ? 'Copied' : 'Copy Prompt';

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(SPREADISH_AGENT_PROMPT);
            setCopied(true);
            onCopied?.();
            window.setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    }

    return (
        <>
            <button
                type="button"
                className={`${variantClass[variant]} ${className}`.trim()}
                onClick={() => {
                    void handleCopy();
                }}
                data-testid="copy-prompt-button"
            >
                {copied ? (
                    <Check
                        className={`${iconSize} text-[var(--pg-accent-hover)]`}
                        aria-hidden="true"
                        strokeWidth={2}
                    />
                ) : (
                    <ClipboardCopy className={iconSize} aria-hidden="true" strokeWidth={2} />
                )}
                {label}
            </button>
            <span id={statusId} className="sr-only" aria-live="polite">
                {copied ? 'Spreadish agent prompt copied to clipboard' : ''}
            </span>
        </>
    );
}
