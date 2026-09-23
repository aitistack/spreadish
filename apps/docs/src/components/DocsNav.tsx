import { BookOpen, Code2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { DOC_NAV } from '../site';

type DocsNavProps = {
    onNavigate?: () => void;
};

export function DocsNav({ onNavigate }: DocsNavProps) {
    return (
        <nav className="space-y-6" aria-label="Documentation">
            {DOC_NAV.map((group) => {
                const GroupIcon = group.title === 'API' ? Code2 : BookOpen;
                return (
                    <div key={group.title}>
                        <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-[var(--pg-muted)] uppercase">
                            <GroupIcon className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={2} />
                            {group.title}
                        </div>
                        <ul className="space-y-0.5">
                            {group.items.map((item) => (
                                <li key={item.href}>
                                    <NavLink
                                        to={item.href}
                                        onClick={onNavigate}
                                        className={({ isActive }) =>
                                            `block rounded-[8px] px-2.5 py-1.5 text-[13px] ${
                                                isActive
                                                    ? 'bg-[var(--pg-accent-soft)] font-semibold text-[var(--pg-accent-hover)]'
                                                    : 'text-[var(--pg-text)] hover:bg-white'
                                            }`
                                        }
                                    >
                                        {item.title}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </nav>
    );
}
