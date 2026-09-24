import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Size tokens are **caps**, not fixed boxes:
 * the dialog hugs its content and only grows up to these viewport maxima.
 */
const SIZE_MAX: Record<ModalSize, { maxWidth: string; maxHeight: string; minWidth: string }> = {
    sm: { maxWidth: '48vw', maxHeight: '48vh', minWidth: 'min(100%, 20rem)' },
    md: { maxWidth: '64vw', maxHeight: '64vh', minWidth: 'min(100%, 28rem)' },
    lg: { maxWidth: '82vw', maxHeight: '82vh', minWidth: 'min(100%, 36rem)' },
    xl: { maxWidth: '96vw', maxHeight: '96vh', minWidth: 'min(100%, 44rem)' },
};

function cx(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(' ');
}

type ModalProps = {
    open: boolean;
    title: string;
    size?: ModalSize;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    /** Extra classes merged onto the dialog panel (wins for one-off layouts). */
    className?: string;
    /** Accessible label for the dialog. Defaults to title. */
    'aria-label'?: string;
};

export function Modal({
    open,
    title,
    size = 'md',
    onClose,
    children,
    footer,
    className,
    'aria-label': ariaLabel,
}: ModalProps) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const caps = SIZE_MAX[size];

    useEffect(() => {
        if (!open) {
            return;
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        const previous = document.activeElement;
        panelRef.current?.focus();
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            if (previous instanceof HTMLElement) {
                previous.focus();
            }
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0f172a]/40 p-4"
            role="presentation"
            data-testid="modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-label={ariaLabel ?? title}
                tabIndex={-1}
                data-testid="modal"
                data-size={size}
                style={{
                    maxWidth: caps.maxWidth,
                    maxHeight: caps.maxHeight,
                    minWidth: caps.minWidth,
                }}
                className={cx(
                    'flex w-fit max-w-full flex-col overflow-hidden rounded-[14px] border border-[var(--pg-border)] bg-[var(--pg-surface)] shadow-[0_16px_48px_rgb(15_23_42_/_18%)] outline-none',
                    className,
                )}
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eef0f3] px-4 py-3">
                    <h2
                        id={titleId}
                        className="truncate text-[15px] font-semibold text-[var(--pg-text)]"
                    >
                        {title}
                    </h2>
                    <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--pg-muted)] hover:bg-[var(--pg-surface-soft)] hover:text-[var(--pg-text)]"
                        aria-label="Close"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>
                <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 text-[13px] text-[#374151]">
                    {children}
                </div>
                {footer ? (
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#eef0f3] px-4 py-3">
                        {footer}
                    </div>
                ) : null}
            </div>
        </div>,
        document.body,
    );
}
