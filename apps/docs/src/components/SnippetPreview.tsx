import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CodeBlock } from './CodeBlock';

type SnippetPreviewCodeProps = {
    variant?: 'code';
    title: string;
    description?: string;
    language?: string;
    code: string;
    children?: ReactNode;
};

type SnippetPreviewPlaygroundProps = {
    variant: 'playground';
    title: string;
    description?: string;
    image: string;
    imageAlt?: string;
    caption?: string;
    playgroundHref?: string;
};

export type SnippetPreviewProps = SnippetPreviewCodeProps | SnippetPreviewPlaygroundProps;

export function SnippetPreview(props: SnippetPreviewProps) {
    if (props.variant === 'playground') {
        const {
            title,
            description,
            image,
            imageAlt = title,
            caption,
            playgroundHref = '/playground',
        } = props;
        return (
            <section
                className="my-6 flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-white shadow-[0_4px_16px_rgb(15_23_42_/_5%)]"
                data-testid="snippet-preview-playground"
            >
                <div className="shrink-0 border-b border-[var(--pg-border)] px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="rounded-[6px] bg-[var(--pg-accent-soft)] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--pg-accent-hover)] uppercase">
                            Preview
                        </span>
                        <h3 className="m-0 text-[15px] font-semibold text-[var(--pg-text)]">
                            {title}
                        </h3>
                    </div>
                    {description ? (
                        <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-[var(--pg-muted)]">
                            {description}
                        </p>
                    ) : null}
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--pg-bg)] p-3">
                    <img
                        src={image}
                        alt={imageAlt}
                        className="max-h-full w-full rounded-[10px] border border-[var(--pg-border)] bg-white object-contain shadow-[0_2px_8px_rgb(15_23_42_/_6%)]"
                        loading="lazy"
                        draggable={false}
                    />
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--pg-border)] px-4 py-3">
                    <p className="m-0 text-[13px] text-[var(--pg-muted)]">
                        {caption ?? 'Live playground UI'}
                    </p>
                    <Link
                        to={playgroundHref}
                        className="text-[13px] font-semibold text-[var(--pg-accent-hover)] underline-offset-2 hover:underline"
                    >
                        Open playground
                    </Link>
                </div>
            </section>
        );
    }

    const { title, description, language = 'tsx', code, children } = props;
    return (
        <section
            className="my-6 flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-[var(--pg-border)] bg-white shadow-[0_4px_16px_rgb(15_23_42_/_5%)]"
            data-testid="snippet-preview"
        >
            <div className="shrink-0 border-b border-[var(--pg-border)] px-4 py-3">
                <div className="flex items-center gap-2">
                    <span className="rounded-[6px] bg-[var(--pg-accent-soft)] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--pg-accent-hover)] uppercase">
                        Preview
                    </span>
                    <h3 className="m-0 text-[15px] font-semibold text-[var(--pg-text)]">{title}</h3>
                </div>
                {description ? (
                    <p className="mt-1.5 mb-0 text-[13px] leading-relaxed text-[var(--pg-muted)]">
                        {description}
                    </p>
                ) : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3 [&>.docs-code-block]:my-0 [&>.docs-code-block]:h-full [&>.docs-code-block]:min-h-0">
                {children ?? <CodeBlock code={code} language={language} fill />}
            </div>
        </section>
    );
}
