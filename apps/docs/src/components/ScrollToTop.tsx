import { ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const SHOW_AFTER_PX = 320;

function scrollToHash(hash: string) {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id) {
        window.scrollTo(0, 0);
        return;
    }
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    // MDX may paint after first paint — retry briefly
    window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
}

export function ScrollToTop() {
    const { pathname, hash } = useLocation();
    const [visible, setVisible] = useState(false);
    const hide = pathname === '/playground';

    useEffect(() => {
        if (hash) {
            scrollToHash(hash);
            return;
        }
        window.scrollTo(0, 0);
    }, [pathname, hash]);

    useEffect(() => {
        if (hide) {
            setVisible(false);
            return;
        }
        const onScroll = () => {
            setVisible(window.scrollY > SHOW_AFTER_PX);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
        };
    }, [hide]);

    if (hide || !visible) {
        return null;
    }

    return (
        <button
            type="button"
            className="fixed right-5 bottom-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--pg-border)] bg-white text-[var(--pg-accent-hover)] shadow-[0_8px_24px_rgb(15_23_42_/_12%)] hover:border-[var(--pg-accent)] hover:bg-[var(--pg-accent-soft)]"
            aria-label="Scroll to top"
            data-testid="scroll-to-top"
            onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
        >
            <ChevronUp className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
        </button>
    );
}
