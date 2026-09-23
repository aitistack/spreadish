import type { MDXComponents } from 'mdx/types';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { CodeBlock, MdxPre } from './CodeBlock';
import { Alert, Banner, Callout, Checklist, Kicker, Step, Steps } from './DocsChrome';
import { InstallTabs } from './InstallTabs';
import { SnippetPreview } from './SnippetPreview';
import { slugifyHeading } from '../lib/slugify';

function InlineCode(props: { className?: string; children?: ReactNode }) {
    // Fenced blocks go through pre → MdxPre. language-* here is a leftover
    // nested code node and must not get inline "pill" chrome.
    if (props.className?.includes('language-')) {
        return <>{props.children}</>;
    }
    return <code className="docs-inline-code" {...props} />;
}

function plainText(node: ReactNode): string {
    if (node == null || typeof node === 'boolean') {
        return '';
    }
    if (typeof node === 'string' || typeof node === 'number') {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node.map(plainText).join('');
    }
    if (typeof node === 'object' && 'props' in node) {
        const element = node as { props?: { children?: ReactNode } };
        return plainText(element.props?.children);
    }
    return '';
}

function makeHeading(Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
    return function DocsHeading({ children, id, ...rest }: ComponentPropsWithoutRef<typeof Tag>) {
        const text = plainText(children);
        const resolvedId = id ?? (text ? slugifyHeading(text) : undefined);
        return (
            <Tag id={resolvedId} {...rest}>
                {children}
            </Tag>
        );
    };
}

export const mdxComponents: MDXComponents = {
    h1: makeHeading('h1'),
    h2: makeHeading('h2'),
    h3: makeHeading('h3'),
    h4: makeHeading('h4'),
    h5: makeHeading('h5'),
    h6: makeHeading('h6'),
    pre: MdxPre,
    code: InlineCode,
    InstallTabs,
    SnippetPreview,
    CodeBlock,
    Callout,
    Alert,
    Banner,
    Steps,
    Step,
    Checklist,
    Kicker,
};
