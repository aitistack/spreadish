/** Inline icons matching playground.png — thin stroke, Hallmark chrome. */

type IconProps = {
    className?: string;
};

export function IconSearch({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="m16 16 3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconChevronDown({ className = 'h-3.5 w-3.5' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconCheck({ className = 'h-3.5 w-3.5' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconCloudSaved({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M7.5 18h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5 1.6A3.5 3.5 0 0 0 7.5 18Z"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path
                d="m9.5 12.5 1.8 1.8 3.4-3.6"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconUndo({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M9 7 5 11l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M5 11h8.5a5.5 5.5 0 1 1 0 11H12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconRedo({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="m15 7 4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M19 11H10.5a5.5 5.5 0 1 0 0 11H12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconComment({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-3.5 3.2V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path d="M12 8.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="13.2" r="0.7" fill="currentColor" />
        </svg>
    );
}

export function IconSun({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconMoon({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M19.5 14.2A7.5 7.5 0 0 1 9.8 4.5 7.6 7.6 0 1 0 19.5 14.2Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconSharePeople({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="9" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="16.5" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M3.8 17.5c.7-2.4 2.6-3.6 5.2-3.6s4.5 1.2 5.2 3.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M14.2 14.2c1.3-.7 2.8-.7 4.2.2 1 .7 1.6 1.8 1.8 3.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconMoreVertical({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="6" r="1.25" fill="currentColor" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" />
            <circle cx="12" cy="18" r="1.25" fill="currentColor" />
        </svg>
    );
}

export function IconPlus({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconSheet({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
                x="4"
                y="4"
                width="16"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path d="M4 10h16M4 15h16M10 4v16M15 4v16" stroke="currentColor" strokeWidth="1.25" />
        </svg>
    );
}

export function IconMoreHorizontal({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="6" cy="12" r="1.25" fill="currentColor" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" />
            <circle cx="18" cy="12" r="1.25" fill="currentColor" />
        </svg>
    );
}

export function IconRename({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path d="m13.5 6.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function IconTrash({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M5 7h14M10 11v6M14 11v6M8 7l1-2h6l1 2m-1 0v11a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 18V7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconDuplicate({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
                x="8"
                y="8"
                width="11"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path
                d="M6 15H5.5A1.5 1.5 0 0 1 4 13.5v-8A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5V6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconSettings({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path
                d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconAlignLeft({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 6h16M4 10h10M4 14h14M4 18h9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconAlignCenter({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 6h16M7 10h10M5 14h14M8 18h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconAlignRight({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 6h16M10 10h10M6 14h14M11 18h9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconAlignTop({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 5h16M8 10v9M12 10v9M16 10v9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconAlignMiddle({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 12h16M8 5v5M12 5v5M16 5v5M8 14v5M12 14v5M16 14v5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconAlignBottom({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M4 19h16M8 5v9M12 5v9M16 5v9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconBorders({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
                x="5"
                y="5"
                width="14"
                height="14"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
            />
            <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="1.25" />
        </svg>
    );
}

/** Empty cell — no borders. */
export function IconBorderNone({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
                x="5.5"
                y="5.5"
                width="13"
                height="13"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray="2.5 2"
            />
        </svg>
    );
}

/** Outer perimeter only. */
export function IconBorderOuter({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
                x="5"
                y="5"
                width="14"
                height="14"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="2"
            />
        </svg>
    );
}

/** All four edges (and visual cross for “all”). */
export function IconBorderAll({ className = 'h-4 w-4' }: IconProps) {
    return <IconBorders className={className} />;
}

/** Bottom edge only. */
export function IconBorderBottom({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect
                x="5.5"
                y="5.5"
                width="13"
                height="13"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.25"
                opacity="0.35"
            />
            <path d="M5 18.5h14" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
    );
}

export function IconFillBucket({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M7 11.5 12.5 6a1.5 1.5 0 0 1 2.1 0l3.4 3.4a1.5 1.5 0 0 1 0 2.1L12.5 17.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path
                d="M7 11.5v5.2A2.3 2.3 0 0 0 9.3 19h5.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M16.5 17.5c0 1.2.9 2 2 2s2-.8 2-2-.9-2.5-2-3.5c-1.1 1-2 2.3-2 3.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconAutomation({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M8 4h7l3 3v13a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V5.5A1.5 1.5 0 0 1 8 4Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <path d="M15 4v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="2.25" stroke="currentColor" strokeWidth="1.4" />
            <path
                d="M12 9.5v1M12 15.5v1M8.8 13h1M14.2 13h1"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconMenu({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M5 7h14M5 12h14M5 17h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconChevronLeft({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="m14 6-6 6 6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconChevronRight({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="m10 6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconMinus({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function IconFullscreen({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconFx({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M5.5 6.5c1.8-2.4 4.4-2.6 5.6-.2 1 2 .2 5.4-1.6 7.6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <path
                d="M13 7.5h6.5M14.2 7.5 16.8 18M19.2 7.5 16.6 18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconExportJson({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M9 7.5c-1.2 0-2 .8-2 2v1.2c0 .7-.4 1.3-1 1.3.6 0 1 .6 1 1.3V14.5c0 1.2.8 2 2 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M15 7.5c1.2 0 2 .8 2 2v1.2c0 .7.4 1.3 1 1.3-.6 0-1 .6-1 1.3V14.5c0 1.2-.8 2-2 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M12 3.5v6.5M9.5 7.5 12 10l2.5-2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconExportCsv({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 3.5v10.2M8.5 10.5 12 14l3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M5.5 16.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7 19.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function IconExportTsv({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3.5v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path
                d="M8.8 9.2 12 12.4l3.2-3.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M6 15.5h3.2M10.8 15.5h2.4M15.6 15.5H18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M6 18.5h3.2M10.8 18.5h2.4M15.6 18.5H18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function IconImportJson({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M9 7.5c-1.2 0-2 .8-2 2v1.2c0 .7-.4 1.3-1 1.3.6 0 1 .6 1 1.3V14.5c0 1.2.8 2 2 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M15 7.5c1.2 0 2 .8 2 2v1.2c0 .7.4 1.3 1 1.3-.6 0-1 .6-1 1.3V14.5c0 1.2-.8 2-2 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M12 16.5V10M9.5 12.5 12 10l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconImportCsv({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 14.5V4.3M8.5 7.8 12 4.3l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M5.5 16.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M7 19.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function IconImportTsv({ className = 'h-4 w-4' }: IconProps) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 13.5V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path
                d="M8.8 7.8 12 4.6l3.2 3.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M6 15.5h3.2M10.8 15.5h2.4M15.6 15.5H18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <path
                d="M6 18.5h3.2M10.8 18.5h2.4M15.6 18.5H18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
