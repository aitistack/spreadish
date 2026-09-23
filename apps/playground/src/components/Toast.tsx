type ToastProps = {
    open: boolean;
    message: string;
};

export function Toast({ open, message }: ToastProps) {
    if (!open) {
        return null;
    }

    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="autosave-toast"
            className="pointer-events-none fixed bottom-16 left-1/2 z-[1000] -translate-x-1/2 rounded-[10px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--pg-text)] shadow-[0_8px_24px_rgb(15_23_42_/_14%)]"
        >
            {message}
        </div>
    );
}
