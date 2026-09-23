import { useRef } from 'react';
import { IconChevronDown, IconFx } from './icons';

type FormulaBarProps = {
    addressLabel: string;
    draft: string;
    editing: boolean;
    onDraftChange: (value: string) => void;
    onCommit: () => void;
    onCancel: () => void;
    onBeginEdit: () => void;
    disabled?: boolean;
    /** When true, omit outer padding (parent owns the strip). */
    compact?: boolean;
};

export function FormulaBar({
    addressLabel,
    draft,
    editing,
    onDraftChange,
    onCommit,
    onCancel,
    onBeginEdit,
    disabled = false,
    compact = false,
}: FormulaBarProps) {
    const skipBlurCommit = useRef(false);

    return (
        <div
            className={`flex min-w-0 items-center gap-2 ${
                compact ? 'w-full min-w-0 flex-1' : 'w-full shrink-0 px-3 pt-3 pb-2'
            }`}
        >
            <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-3 text-[13px] font-medium text-[var(--pg-text)] shadow-[0_1px_1px_rgb(15_23_42_/_3%)]"
            >
                {addressLabel}
                <IconChevronDown className="h-3 w-3 text-[#9ca3af]" />
            </button>
            <div
                className={`flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border bg-[var(--pg-surface)] px-3 shadow-[0_1px_1px_rgb(15_23_42_/_3%)] ${
                    editing
                        ? 'border-[var(--pg-accent)] ring-1 ring-[var(--pg-accent)]/40'
                        : 'border-[var(--pg-border)]'
                }`}
                data-testid="formula-bar-shell"
            >
                <IconFx className="h-4 w-4 shrink-0 text-[#9ca3af]" />
                <input
                    className="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[var(--pg-text)] outline-none placeholder:text-[#9ca3af]"
                    value={draft}
                    disabled={disabled}
                    placeholder="Enter value or formula..."
                    onFocus={() => {
                        if (!disabled) {
                            onBeginEdit();
                        }
                    }}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            skipBlurCommit.current = true;
                            onCommit();
                            (event.target as HTMLInputElement).blur();
                            return;
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            skipBlurCommit.current = true;
                            onCancel();
                            (event.target as HTMLInputElement).blur();
                        }
                    }}
                    onBlur={() => {
                        if (skipBlurCommit.current) {
                            skipBlurCommit.current = false;
                            return;
                        }
                        if (editing) {
                            onCommit();
                        }
                    }}
                    aria-label="Formula bar"
                    data-testid="formula-bar"
                    data-editing={editing ? 'true' : 'false'}
                />
            </div>
        </div>
    );
}
