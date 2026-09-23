import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

export type PopoverMenuItem = {
    id: string;
    label: string;
    icon: ReactNode;
    danger?: boolean;
    disabled?: boolean;
    onSelect: () => void;
};

export type PopoverAnchorPoint = {
    readonly x: number;
    readonly y: number;
};

type PopoverMenuProps = {
    open: boolean;
    onClose: () => void;
    items: readonly PopoverMenuItem[];
    /** Preferred alignment relative to the trigger (non-floating menus). */
    align?: 'start' | 'end';
    /**
     * When true with no `anchor`, render as an unpositioned panel (parent sets coords).
     * Prefer `anchor` so the menu can flip to stay in the viewport.
     */
    floating?: boolean;
    /** Pointer/client coordinates; menu self-positions and flips to stay on-screen. */
    anchor?: PopoverAnchorPoint;
    testId?: string;
    /** Extra classes for the menu panel (e.g. wider min-width). */
    className?: string;
};

const VIEWPORT_PAD = 8;

function clampMenuPosition(
    preferredX: number,
    preferredY: number,
    width: number,
    height: number,
): { left: number; top: number } {
    const maxLeft = Math.max(VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD);
    const maxTop = Math.max(VIEWPORT_PAD, window.innerHeight - height - VIEWPORT_PAD);
    let left = preferredX;
    let top = preferredY;

    // Flip horizontally when overflowing the right edge.
    if (left + width > window.innerWidth - VIEWPORT_PAD) {
        left = preferredX - width;
    }
    // Flip vertically when overflowing the bottom edge.
    if (top + height > window.innerHeight - VIEWPORT_PAD) {
        top = preferredY - height;
    }

    return {
        left: Math.min(Math.max(VIEWPORT_PAD, left), maxLeft),
        top: Math.min(Math.max(VIEWPORT_PAD, top), maxTop),
    };
}

export function PopoverMenu({
    open,
    onClose,
    items,
    align = 'end',
    floating = false,
    anchor,
    testId = 'popover-menu',
    className = '',
}: PopoverMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const labelId = useId();
    const anchored = floating && anchor !== undefined;

    useLayoutEffect(() => {
        if (!open || !anchored || !menuRef.current || !anchor) {
            return;
        }
        const node = menuRef.current;
        const rect = node.getBoundingClientRect();
        const next = clampMenuPosition(anchor.x, anchor.y, rect.width, rect.height);
        node.style.left = `${next.left}px`;
        node.style.top = `${next.top}px`;
    }, [open, anchored, anchor, items.length]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointerDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                onClose();
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };
        // Defer outside-close so the opening click/contextmenu does not instantly dismiss.
        const timer = window.setTimeout(() => {
            window.addEventListener('mousedown', onPointerDown, true);
        }, 0);
        window.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('mousedown', onPointerDown, true);
            window.removeEventListener('keydown', onKeyDown, true);
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    const panelClass = anchored
        ? 'fixed z-[900] min-w-[152px] rounded-[10px] border border-[#e5eaf1] bg-white py-0.5 shadow-[0_8px_24px_rgb(15_23_42_/_12%)]'
        : floating
          ? 'min-w-[152px] rounded-[10px] border border-[#e5eaf1] bg-white py-0.5 shadow-[0_8px_24px_rgb(15_23_42_/_12%)]'
          : `absolute top-full z-50 mt-1 min-w-[152px] rounded-[10px] border border-[#e5eaf1] bg-white py-0.5 shadow-[0_8px_24px_rgb(15_23_42_/_12%)] ${
                align === 'end' ? 'right-0' : 'left-0'
            }`;

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-labelledby={labelId}
            data-testid={testId}
            className={`${panelClass} ${className}`.trim()}
            style={
                anchored
                    ? {
                          left: anchor.x,
                          top: anchor.y,
                      }
                    : undefined
            }
        >
            <span id={labelId} className="sr-only">
                Sheet actions
            </span>
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] leading-tight whitespace-nowrap ${
                        item.danger
                            ? 'text-[#dc2626] hover:bg-[#fef2f2]'
                            : 'text-[#374151] hover:bg-[#f9fafb]'
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                    onClick={() => {
                        if (item.disabled) {
                            return;
                        }
                        onClose();
                        item.onSelect();
                    }}
                >
                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                        {item.icon}
                    </span>
                    <span className="whitespace-nowrap">{item.label}</span>
                </button>
            ))}
        </div>
    );
}
