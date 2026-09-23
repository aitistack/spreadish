import { useEffect } from 'react';
import { App as PlaygroundApp } from '@playground/App';
import '@playground/styles.css';

/**
 * Full-viewport playground embedded in the docs site.
 * Fixed-viewport rules apply; only the grid region scrolls.
 */
export function PlaygroundPage() {
    useEffect(() => {
        document.documentElement.classList.add('playground-lock');
        document.body.classList.remove('docs-scroll');
        return () => {
            document.documentElement.classList.remove('playground-lock');
            document.body.classList.add('docs-scroll');
        };
    }, []);

    return <PlaygroundApp brandHomeHref="/" />;
}
