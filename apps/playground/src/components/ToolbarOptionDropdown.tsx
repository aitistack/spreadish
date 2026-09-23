import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';
import { IconChevronDown } from './icons';

export type ToolbarOption<T extends string | number = string> = {
    readonly value: T;
    readonly label: string;
};

type ToolbarOptionDropdownProps<T extends string | number> = {
    title: string;
    value: T;
    options: readonly ToolbarOption<T>[];
    disabled?: boolean;
    testId: string;
    /** Optional custom trigger label (defaults to matching option label). */
    displayValue?: string;
    onChange: (value: T) => void;
    minWidthClass?: string;
};

const VIEWPORT_PAD = 8;

function placePanel(
    trigger: DOMRect,
    panelWidth: number,
    panelHeight: number,
): { left: number; top: number } {
    const preferBelow = trigger.bottom + 4;
    const preferAbove = trigger.top - panelHeight - 4;

    let top = preferBelow;
    if (preferBelow + panelHeight > window.innerHeight - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, preferAbove);
    }
    top = Math.min(top, Math.max(VIEWPORT_PAD, window.innerHeight - panelHeight - VIEWPORT_PAD));

    let left = trigger.left;
    if (left + panelWidth > window.innerWidth - VIEWPORT_PAD) {
        left = trigger.right - panelWidth;
    }
    left = Math.min(
        Math.max(VIEWPORT_PAD, left),
        Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD),
    );

    return { left, top };
}

export function ToolbarOptionDropdown<T extends string | number>({
    title,
    value,
    options,
    disabled = false,
    testId,
    displayValue,
    onChange,
    minWidthClass = 'min-w-[7rem]',
}: ToolbarOptionDropdownProps<T>) {
    const [open, setOpen] = useState(false);
    const [panelStyle, setPanelStyle] = useState<CSSProperties>({
        left: 0,
        top: 0,
        visibility: 'hidden',
    });
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const matched = options.find((option) => option.value === value);
    const triggerLabel = displayValue ?? matched?.label ?? String(value);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current || !panelRef.current) {
            return;
        }
        const trigger = triggerRef.current.getBoundingClientRect();
        const panel = panelRef.current.getBoundingClientRect();
        const next = placePanel(trigger, panel.width || 168, panel.height);
        setPanelStyle({ left: next.left, top: next.top, visibility: 'visible' });
    }, [open, options.length]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
            }
        };
        const onReposition = () => {
            if (!triggerRef.current || !panelRef.current) {
                return;
            }
            const trigger = triggerRef.current.getBoundingClientRect();
            const panel = panelRef.current.getBoundingClientRect();
            const next = placePanel(trigger, panel.width || 168, panel.height);
            setPanelStyle({ left: next.left, top: next.top, visibility: 'visible' });
        };
        const timer = window.setTimeout(() => {
            window.addEventListener('mousedown', onPointerDown, true);
        }, 0);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('mousedown', onPointerDown, true);
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                title={title}
                aria-label={title}
                aria-expanded={open}
                aria-haspopup="listbox"
                data-testid={testId}
                onClick={() => setOpen((current) => !current)}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-[6px] px-2 text-[12px] text-[var(--pg-text)] ${
                    disabled ? 'opacity-45' : 'hover:bg-[#f3f4f6]'
                } ${minWidthClass}`}
            >
                <span className="max-w-[7rem] truncate">{triggerLabel}</span>
                <IconChevronDown className="h-3 w-3 shrink-0 text-[#9ca3af]" />
            </button>
            {open ? (
                <div
                    ref={panelRef}
                    role="listbox"
                    aria-labelledby={titleId}
                    data-testid={`${testId}-popover`}
                    className="fixed z-[900] min-w-[168px] rounded-[10px] border border-[var(--pg-border)] bg-[var(--pg-surface)] py-1.5 shadow-[0_8px_24px_rgb(15_23_42_/_12%)]"
                    style={panelStyle}
                >
                    <p
                        id={titleId}
                        className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-[var(--pg-muted)] uppercase"
                    >
                        {title}
                    </p>
                    <div className="max-h-56 overflow-y-auto">
                        {options.map((option) => {
                            const active = option.value === value;
                            return (
                                <button
                                    key={String(option.value)}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    data-testid={`${testId}-option-${String(option.value)}`}
                                    data-active={active ? 'true' : undefined}
                                    className={`flex w-full items-center px-2.5 py-1.5 text-left text-[12px] ${
                                        active
                                            ? 'bg-[var(--pg-accent-soft)] text-[var(--pg-accent-hover)]'
                                            : 'text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)]'
                                    }`}
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/** Shared visible panel title used by toolbar dropdowns (borders, colors, etc.). */
export function ToolbarDropdownTitle({ id, children }: { id?: string; children: ReactNode }) {
    return (
        <p
            id={id}
            className="pb-1 text-[11px] font-semibold tracking-wide text-[var(--pg-muted)] uppercase"
        >
            {children}
        </p>
    );
}
