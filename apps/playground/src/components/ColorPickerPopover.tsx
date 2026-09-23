import {
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from 'react';
import { COLOR_PALETTE, normalizeHexColor } from '../colors';
import { IconChevronDown } from './icons';
import { ToolbarDropdownTitle } from './ToolbarOptionDropdown';

type ColorPickerPopoverProps = {
    label: string;
    value: string | undefined;
    emptyLabel: string;
    disabled?: boolean;
    allowClear?: boolean;
    clearLabel?: string;
    testId: string;
    /** Compact toolbar trigger vs full-width properties field. */
    variant?: 'field' | 'toolbar';
    toolbarIcon?: ReactNode;
    onChange: (color: string | null) => void;
};

const VIEWPORT_PAD = 8;
const PANEL_WIDTH = 220;

function placePanel(
    trigger: DOMRect,
    panelWidth: number,
    panelHeight: number,
): { left: number; top: number } {
    const preferBelow = trigger.bottom + 4;
    const preferAbove = trigger.top - panelHeight - 4;
    const preferLeft = trigger.left;

    let top = preferBelow;
    if (preferBelow + panelHeight > window.innerHeight - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, preferAbove);
    }
    // If still overflowing below after flip attempt, clamp into the viewport.
    top = Math.min(top, Math.max(VIEWPORT_PAD, window.innerHeight - panelHeight - VIEWPORT_PAD));

    let left = preferLeft;
    if (left + panelWidth > window.innerWidth - VIEWPORT_PAD) {
        left = trigger.right - panelWidth;
    }
    left = Math.min(
        Math.max(VIEWPORT_PAD, left),
        Math.max(VIEWPORT_PAD, window.innerWidth - panelWidth - VIEWPORT_PAD),
    );

    return { left, top };
}

export function ColorPickerPopover({
    label,
    value,
    emptyLabel,
    disabled = false,
    allowClear = true,
    clearLabel = 'No color',
    testId,
    variant = 'field',
    toolbarIcon,
    onChange,
}: ColorPickerPopoverProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value ?? '');
    const [panelStyle, setPanelStyle] = useState<CSSProperties>({
        left: 0,
        top: 0,
        visibility: 'hidden',
    });
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const labelId = useId();

    useEffect(() => {
        setDraft(value ?? '');
    }, [value]);

    useLayoutEffect(() => {
        if (!open || !triggerRef.current || !panelRef.current) {
            return;
        }
        const trigger = triggerRef.current.getBoundingClientRect();
        const panel = panelRef.current.getBoundingClientRect();
        const next = placePanel(trigger, panel.width || PANEL_WIDTH, panel.height);
        setPanelStyle({ left: next.left, top: next.top, visibility: 'visible' });
    }, [open, draft, value]);

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
            const next = placePanel(trigger, panel.width || PANEL_WIDTH, panel.height);
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

    const commitHex = () => {
        if (draft.trim() === '') {
            if (allowClear) {
                onChange(null);
            }
            return;
        }
        const next = normalizeHexColor(draft);
        if (next) {
            onChange(next);
            setDraft(next);
            setOpen(false);
        }
    };

    const trigger =
        variant === 'toolbar' ? (
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                title={label}
                aria-label={label}
                aria-expanded={open}
                aria-haspopup="dialog"
                data-testid={testId}
                data-active={value !== undefined ? 'true' : undefined}
                onClick={() => setOpen((current) => !current)}
                className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center gap-0.5 rounded-[6px] px-1.5 text-[12px] ${
                    value !== undefined ? 'bg-[#ecfdf5] text-[#059669]' : 'text-[#4b5563]'
                } ${disabled ? '' : 'hover:bg-[#f3f4f6]'}`}
            >
                {toolbarIcon ?? (
                    <span className="relative font-semibold">
                        A
                        <span
                            className="absolute right-0 -bottom-0.5 left-0 h-0.5"
                            style={{ background: value ?? '#ef4444' }}
                        />
                    </span>
                )}
                <IconChevronDown className="h-3 w-3 text-[#9ca3af]" />
            </button>
        ) : (
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                title={label}
                aria-expanded={open}
                aria-haspopup="dialog"
                data-testid={testId}
                onClick={() => setOpen((current) => !current)}
                className="flex h-9 w-full items-center gap-2 rounded-[8px] border border-[#e5e7eb] bg-white px-3 text-left text-[13px] text-[#374151]"
            >
                <span
                    className="inline-block h-4 w-4 shrink-0 rounded-full border border-[#e5e7eb]"
                    style={{
                        background: value ?? '#ffffff',
                        backgroundImage: value
                            ? undefined
                            : 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                        backgroundSize: value ? undefined : '6px 6px',
                        backgroundPosition: value ? undefined : '0 0, 0 3px, 3px -3px, -3px 0',
                    }}
                />
                <span className="min-w-0 truncate">{value ?? emptyLabel}</span>
                <IconChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#9ca3af]" />
            </button>
        );

    return (
        <div ref={rootRef} className="relative">
            {variant === 'field' ? (
                <div className="block space-y-1.5">
                    <span className="text-[12px] font-medium text-[#6b7280]">{label}</span>
                    {trigger}
                </div>
            ) : (
                trigger
            )}

            {open ? (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-labelledby={labelId}
                    data-testid={`${testId}-popover`}
                    className="fixed z-[900] w-[220px] rounded-[10px] border border-[#e5eaf1] bg-white p-2.5 shadow-[0_8px_24px_rgb(15_23_42_/_12%)]"
                    style={panelStyle}
                >
                    <ToolbarDropdownTitle id={labelId}>{label}</ToolbarDropdownTitle>
                    {allowClear ? (
                        <button
                            type="button"
                            data-testid={`${testId}-clear`}
                            className="mb-2 flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-[#374151] hover:bg-[#f9fafb]"
                            onClick={() => {
                                onChange(null);
                                setDraft('');
                                setOpen(false);
                            }}
                        >
                            <span
                                className="inline-block h-4 w-4 rounded-full border border-[#e5e7eb]"
                                style={{
                                    backgroundImage:
                                        'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                                    backgroundSize: '6px 6px',
                                    backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0',
                                }}
                            />
                            {clearLabel}
                        </button>
                    ) : null}
                    <div className="grid grid-cols-6 gap-1.5" data-testid={`${testId}-palette`}>
                        {COLOR_PALETTE.map((swatch) => {
                            const active = value?.toLowerCase() === swatch.toLowerCase();
                            return (
                                <button
                                    key={swatch}
                                    type="button"
                                    title={swatch}
                                    aria-label={swatch}
                                    data-testid={`${testId}-swatch-${swatch.replace('#', '')}`}
                                    data-active={active ? 'true' : undefined}
                                    className={`h-6 w-6 rounded-[5px] border ${
                                        active
                                            ? 'border-[#10b981] ring-2 ring-[#10b981]/40'
                                            : 'border-[#e5e7eb]'
                                    }`}
                                    style={{ background: swatch }}
                                    onClick={() => {
                                        onChange(swatch);
                                        setDraft(swatch);
                                        setOpen(false);
                                    }}
                                />
                            );
                        })}
                    </div>
                    <label className="mt-2.5 block space-y-1">
                        <span className="text-[11px] font-medium text-[#6b7280]">Hex</span>
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                value={draft}
                                placeholder="#10b981"
                                spellCheck={false}
                                data-testid={`${testId}-hex`}
                                className="h-8 min-w-0 flex-1 rounded-[6px] border border-[#e5e7eb] px-2 font-mono text-[12px] text-[#111827] outline-none focus:border-[#10b981]"
                                onChange={(event) => setDraft(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        commitHex();
                                    }
                                }}
                            />
                            <button
                                type="button"
                                data-testid={`${testId}-hex-apply`}
                                className="h-8 shrink-0 rounded-[6px] bg-[#10b981] px-2.5 text-[12px] font-semibold text-white"
                                onClick={commitHex}
                            >
                                Apply
                            </button>
                        </div>
                    </label>
                </div>
            ) : null}
        </div>
    );
}
