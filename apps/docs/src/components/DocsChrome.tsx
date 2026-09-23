import type { ReactNode } from 'react';

export type CalloutTone = 'note' | 'tip' | 'important' | 'warning' | 'danger';

const DEFAULT_TITLES: Record<CalloutTone, string> = {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    danger: 'Danger',
};

export function Callout({
    tone = 'note',
    title,
    children,
}: {
    tone?: CalloutTone;
    title?: string;
    children?: ReactNode;
}) {
    return (
        <aside className="docs-callout" data-tone={tone} data-testid={`docs-callout-${tone}`}>
            <p className="docs-callout-title">{title ?? DEFAULT_TITLES[tone]}</p>
            <div className="docs-callout-body">{children}</div>
        </aside>
    );
}

/** Alias for Callout — MDX authors may prefer Alert. */
export function Alert(props: { tone?: CalloutTone; title?: string; children?: ReactNode }) {
    return <Callout {...props} />;
}

export function Banner({ title, children }: { title?: string; children?: ReactNode }) {
    return (
        <div className="docs-banner" data-testid="docs-banner">
            {title ? <p className="docs-banner-title">{title}</p> : null}
            <div className="docs-callout-body">{children}</div>
        </div>
    );
}

export function Kicker({ children }: { children?: ReactNode }) {
    return <p className="spreadish-kicker">{children}</p>;
}

export function Steps({ children }: { children?: ReactNode }) {
    return (
        <ol className="docs-steps" data-testid="docs-steps">
            {children}
        </ol>
    );
}

export function Step({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <li className="docs-step">
            <p className="docs-step-title">{title}</p>
            <div className="docs-callout-body">{children}</div>
        </li>
    );
}

export function Checklist({
    variant = 'do',
    children,
}: {
    variant?: 'do' | 'dont';
    children?: ReactNode;
}) {
    return (
        <ul
            className="docs-checklist"
            data-variant={variant}
            data-testid={`docs-checklist-${variant}`}
        >
            {children}
        </ul>
    );
}
