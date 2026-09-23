import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
    type RefObject,
} from 'react';
import type { CellStyle, HorizontalAlign, VerticalAlign } from '@spreadish/core';
import { NUMBER_FORMATS } from '../hooks/useWorkbook';
import { ColorPickerPopover } from './ColorPickerPopover';
import {
    IconAlignBottom,
    IconAlignCenter,
    IconAlignLeft,
    IconAlignMiddle,
    IconAlignRight,
    IconAlignTop,
    // Not in V1 — automation icon kept for later:
    // IconAutomation,
    IconBorderAll,
    IconBorderBottom,
    IconBorderNone,
    IconBorderOuter,
    IconChevronDown,
    IconFillBucket,
} from './icons';
import { ToolbarDropdownTitle, ToolbarOptionDropdown } from './ToolbarOptionDropdown';

const FONT_FAMILIES: readonly string[] = [
    'Inter',
    'Arial',
    'Georgia',
    'Courier New',
    'Times New Roman',
];

const FONT_SIZES: readonly number[] = [10, 11, 12, 14, 16, 18, 20, 24];

const FONT_FAMILY_OPTIONS = FONT_FAMILIES.map((family) => ({ value: family, label: family }));
const FONT_SIZE_OPTIONS = FONT_SIZES.map((size) => ({ value: size, label: String(size) }));
const NUMBER_FORMAT_OPTIONS = NUMBER_FORMATS.map((format) => ({ value: format, label: format }));

function ToolButton({
    children,
    active = false,
    title,
    onClick,
    disabled = false,
    testId,
    label,
    buttonRef,
}: {
    children: ReactNode;
    active?: boolean;
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    testId?: string;
    label?: string;
    buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
    return (
        <button
            ref={buttonRef}
            type="button"
            disabled={disabled}
            title={title}
            aria-label={label ?? title}
            aria-pressed={onClick ? active : undefined}
            data-testid={testId}
            data-active={active ? 'true' : undefined}
            onClick={onClick}
            className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-[6px] px-1.5 text-[12px] ${
                active
                    ? 'bg-[var(--pg-accent-soft)] text-[var(--pg-accent-hover)]'
                    : 'text-[#4b5563]'
            } ${disabled ? '' : 'hover:bg-[#f3f4f6]'}`}
        >
            {children}
        </button>
    );
}

const VIEWPORT_PAD = 8;

function placeBordersMenu(
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

type FormatToolbarProps = {
    style: CellStyle;
    disabled: boolean;
    onToggleBold: () => void;
    onToggleItalic: () => void;
    onToggleUnderline: () => void;
    onAlign: (align: HorizontalAlign) => void;
    onVerticalAlign: (align: VerticalAlign) => void;
    onFillChange: (color: string | null) => void;
    onStrokeChange: (color: string | null) => void;
    onClearBorders: () => void;
    onOuterBorder: (stroke?: string) => void;
    onAllBorders: (stroke?: string) => void;
    onBottomBorder: (stroke?: string) => void;
    onFontFamilyChange: (fontFamily: string) => void;
    onFontSizeChange: (fontSize: number) => void;
    onNumberFormatChange: (format: string) => void;
    /** When true, omit outer padding (parent owns the strip). */
    compact?: boolean;
};

export function FormatToolbar({
    style,
    disabled,
    onToggleBold,
    onToggleItalic,
    onToggleUnderline,
    onAlign,
    onVerticalAlign,
    onFillChange,
    onStrokeChange,
    onClearBorders,
    onOuterBorder,
    onAllBorders,
    onBottomBorder,
    onFontFamilyChange,
    onFontSizeChange,
    onNumberFormatChange,
    compact = false,
}: FormatToolbarProps) {
    const align = style.horizontalAlign ?? 'left';
    const vertical = style.verticalAlign ?? 'middle';
    const stroke = style.color;
    const [bordersOpen, setBordersOpen] = useState(false);
    const [bordersStyle, setBordersStyle] = useState<CSSProperties>({
        left: 0,
        top: 0,
        visibility: 'hidden',
    });
    const bordersRootRef = useRef<HTMLDivElement>(null);
    const bordersTriggerRef = useRef<HTMLButtonElement>(null);
    const bordersMenuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!bordersOpen || !bordersTriggerRef.current || !bordersMenuRef.current) {
            return;
        }
        const trigger = bordersTriggerRef.current.getBoundingClientRect();
        const panel = bordersMenuRef.current.getBoundingClientRect();
        const next = placeBordersMenu(trigger, panel.width || 168, panel.height);
        setBordersStyle({ left: next.left, top: next.top, visibility: 'visible' });
    }, [bordersOpen]);

    useEffect(() => {
        if (!bordersOpen) {
            return;
        }
        const onPointerDown = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }
            if (bordersRootRef.current?.contains(target)) {
                return;
            }
            setBordersOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setBordersOpen(false);
            }
        };
        const onReposition = () => {
            if (!bordersTriggerRef.current || !bordersMenuRef.current) {
                return;
            }
            const trigger = bordersTriggerRef.current.getBoundingClientRect();
            const panel = bordersMenuRef.current.getBoundingClientRect();
            const next = placeBordersMenu(trigger, panel.width || 168, panel.height);
            setBordersStyle({ left: next.left, top: next.top, visibility: 'visible' });
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
    }, [bordersOpen]);

    return (
        <div className={compact ? 'min-w-0 shrink-0' : 'shrink-0 px-3 pb-2'}>
            <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[12px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-1.5 py-1 shadow-[0_1px_2px_rgb(15_23_42_/_5%)]">
                <ToolbarOptionDropdown
                    title="Font"
                    testId="format-font-family"
                    disabled={disabled}
                    value={style.fontFamily ?? 'Inter'}
                    options={FONT_FAMILY_OPTIONS}
                    onChange={onFontFamilyChange}
                    minWidthClass="min-w-[6.5rem]"
                />
                <ToolbarOptionDropdown
                    title="Font size"
                    testId="format-font-size"
                    disabled={disabled}
                    value={style.fontSize ?? 14}
                    options={FONT_SIZE_OPTIONS}
                    onChange={onFontSizeChange}
                    minWidthClass="min-w-[3.5rem]"
                />
                <ToolbarOptionDropdown
                    title="Number format"
                    testId="format-number-format"
                    disabled={disabled}
                    value={style.numberFormat ?? 'General'}
                    options={NUMBER_FORMAT_OPTIONS}
                    onChange={onNumberFormatChange}
                    minWidthClass="min-w-[5.5rem]"
                />
                <div className="mx-1 h-4 w-px shrink-0 bg-[var(--pg-border)]" />
                <ToolButton
                    title="Bold"
                    testId="format-bold"
                    disabled={disabled}
                    active={style.fontWeight === 'bold'}
                    onClick={onToggleBold}
                >
                    <span className="font-bold">B</span>
                </ToolButton>
                <ToolButton
                    title="Italic"
                    testId="format-italic"
                    disabled={disabled}
                    active={style.fontStyle === 'italic'}
                    onClick={onToggleItalic}
                >
                    <span className="italic">I</span>
                </ToolButton>
                <ToolButton
                    title="Underline"
                    testId="format-underline"
                    disabled={disabled}
                    active={style.underline === 'single'}
                    onClick={onToggleUnderline}
                >
                    <span className="underline">U</span>
                </ToolButton>
                <ColorPickerPopover
                    label="Stroke colour"
                    value={stroke}
                    emptyLabel="Default"
                    clearLabel="Default colour"
                    disabled={disabled}
                    testId="format-stroke"
                    variant="toolbar"
                    onChange={onStrokeChange}
                />
                <ColorPickerPopover
                    label="Fill colour"
                    value={style.fill}
                    emptyLabel="No fill"
                    clearLabel="No fill"
                    disabled={disabled}
                    testId="format-fill"
                    variant="toolbar"
                    toolbarIcon={
                        <span className="relative inline-flex">
                            <IconFillBucket />
                            <span
                                className="absolute right-0 -bottom-0.5 left-0 h-0.5 rounded-full"
                                style={{ background: style.fill ?? '#d1d5db' }}
                            />
                        </span>
                    }
                    onChange={onFillChange}
                />
                <div className="mx-1 h-4 w-px shrink-0 bg-[var(--pg-border)]" />
                <ToolButton
                    title="Align left"
                    testId="format-align-left"
                    disabled={disabled}
                    active={align === 'left'}
                    onClick={() => onAlign('left')}
                >
                    <IconAlignLeft />
                </ToolButton>
                <ToolButton
                    title="Align center"
                    testId="format-align-center"
                    disabled={disabled}
                    active={align === 'center'}
                    onClick={() => onAlign('center')}
                >
                    <IconAlignCenter />
                </ToolButton>
                <ToolButton
                    title="Align right"
                    testId="format-align-right"
                    disabled={disabled}
                    active={align === 'right'}
                    onClick={() => onAlign('right')}
                >
                    <IconAlignRight />
                </ToolButton>
                <div className="mx-1 h-4 w-px shrink-0 bg-[var(--pg-border)]" />
                <ToolButton
                    title="Align top"
                    testId="format-align-top"
                    disabled={disabled}
                    active={vertical === 'top'}
                    onClick={() => onVerticalAlign('top')}
                >
                    <IconAlignTop />
                </ToolButton>
                <ToolButton
                    title="Align middle"
                    testId="format-align-middle"
                    disabled={disabled}
                    active={vertical === 'middle'}
                    onClick={() => onVerticalAlign('middle')}
                >
                    <IconAlignMiddle />
                </ToolButton>
                <ToolButton
                    title="Align bottom"
                    testId="format-align-bottom"
                    disabled={disabled}
                    active={vertical === 'bottom'}
                    onClick={() => onVerticalAlign('bottom')}
                >
                    <IconAlignBottom />
                </ToolButton>
                <div className="mx-1 h-4 w-px shrink-0 bg-[var(--pg-border)]" />
                <div ref={bordersRootRef} className="relative shrink-0">
                    <ToolButton
                        title="Borders"
                        testId="format-borders"
                        disabled={disabled}
                        active={style.borders !== undefined || bordersOpen}
                        buttonRef={bordersTriggerRef}
                        onClick={() => setBordersOpen((open) => !open)}
                    >
                        <span className="inline-flex items-center gap-0.5">
                            <IconBorderOuter />
                            <IconChevronDown className="h-3 w-3 text-[#9ca3af]" />
                        </span>
                    </ToolButton>
                    {bordersOpen ? (
                        <div
                            ref={bordersMenuRef}
                            role="menu"
                            data-testid="format-borders-menu"
                            className="fixed z-[900] min-w-[168px] rounded-[10px] border border-[var(--pg-border)] bg-[var(--pg-surface)] py-1.5 shadow-[0_8px_24px_rgb(15_23_42_/_12%)]"
                            style={bordersStyle}
                        >
                            <div className="px-2.5">
                                <ToolbarDropdownTitle>Borders</ToolbarDropdownTitle>
                            </div>
                            {(
                                [
                                    {
                                        id: 'none',
                                        label: 'No borders',
                                        icon: <IconBorderNone />,
                                        run: () => onClearBorders(),
                                    },
                                    {
                                        id: 'outer',
                                        label: 'Outer border',
                                        icon: <IconBorderOuter />,
                                        run: () => onOuterBorder(stroke),
                                    },
                                    {
                                        id: 'all',
                                        label: 'All borders',
                                        icon: <IconBorderAll />,
                                        run: () => onAllBorders(stroke),
                                    },
                                    {
                                        id: 'bottom',
                                        label: 'Bottom border',
                                        icon: <IconBorderBottom />,
                                        run: () => onBottomBorder(stroke),
                                    },
                                ] as const
                            ).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="menuitem"
                                    data-testid={`format-borders-${item.id}`}
                                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)]"
                                    onClick={() => {
                                        item.run();
                                        setBordersOpen(false);
                                    }}
                                >
                                    <span className="inline-flex h-4 w-4 items-center justify-center">
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
                {/* Freeze panes live on the StatusBar sheet menu — not the format strip. */}
                {/* Not in V1 — automation
                <ToolButton
                    title="Not in V1"
                    label="Automation (not in V1)"
                    testId="format-automation"
                    disabled
                >
                    <IconAutomation />
                </ToolButton>
                */}
            </div>
        </div>
    );
}
