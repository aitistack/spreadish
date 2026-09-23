import { useRef, useState } from 'react';
import { PopoverMenu } from './PopoverMenu';
import {
    IconExportCsv,
    IconExportJson,
    IconExportTsv,
    IconImportCsv,
    IconImportJson,
    IconImportTsv,
    IconMoreVertical,
} from './icons';

type ImportExportMenuProps = {
    onExportJson: () => void;
    onExportCsv: () => void;
    onExportTsv: () => void;
    onImportJson: (text: string) => void;
    onImportCsv: (text: string) => void;
    onImportTsv: (text: string) => void;
};

export function ImportExportMenu({
    onExportJson,
    onExportCsv,
    onExportTsv,
    onImportJson,
    onImportCsv,
    onImportTsv,
}: ImportExportMenuProps) {
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const jsonInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const tsvInputRef = useRef<HTMLInputElement>(null);

    const readAndClose = async (
        file: File | undefined,
        handler: (text: string) => void,
    ): Promise<void> => {
        if (!file) {
            return;
        }
        const text = await file.text();
        handler(text);
        setOpen(false);
    };

    return (
        <div className="relative">
            <button
                type="button"
                className="pg-chrome-btn"
                title="Import / Export"
                aria-label="Import and export"
                data-testid="import-export-menu"
                aria-expanded={open}
                onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setAnchor({ x: rect.right, y: rect.bottom + 4 });
                    setOpen((value) => !value);
                }}
            >
                <IconMoreVertical />
            </button>
            <PopoverMenu
                open={open}
                onClose={() => setOpen(false)}
                floating
                anchor={anchor}
                align="end"
                testId="import-export-popover"
                className="min-w-[220px]"
                items={[
                    {
                        id: 'export-json',
                        label: 'Export JSON',
                        icon: <IconExportJson className="h-3.5 w-3.5" />,
                        onSelect: () => {
                            onExportJson();
                            setOpen(false);
                        },
                    },
                    {
                        id: 'export-csv',
                        label: 'Export CSV (sheet)',
                        icon: <IconExportCsv className="h-3.5 w-3.5" />,
                        onSelect: () => {
                            onExportCsv();
                            setOpen(false);
                        },
                    },
                    {
                        id: 'export-tsv',
                        label: 'Export TSV (sheet)',
                        icon: <IconExportTsv className="h-3.5 w-3.5" />,
                        onSelect: () => {
                            onExportTsv();
                            setOpen(false);
                        },
                    },
                    {
                        id: 'import-json',
                        label: 'Import JSON',
                        icon: <IconImportJson className="h-3.5 w-3.5" />,
                        onSelect: () => jsonInputRef.current?.click(),
                    },
                    {
                        id: 'import-csv',
                        label: 'Import CSV (sheet)',
                        icon: <IconImportCsv className="h-3.5 w-3.5" />,
                        onSelect: () => csvInputRef.current?.click(),
                    },
                    {
                        id: 'import-tsv',
                        label: 'Import TSV (sheet)',
                        icon: <IconImportTsv className="h-3.5 w-3.5" />,
                        onSelect: () => tsvInputRef.current?.click(),
                    },
                ]}
            />
            <input
                ref={jsonInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                data-testid="import-json-input"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void readAndClose(file, onImportJson);
                }}
            />
            <input
                ref={csvInputRef}
                type="file"
                accept="text/csv,.csv"
                className="hidden"
                data-testid="import-csv-input"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void readAndClose(file, onImportCsv);
                }}
            />
            <input
                ref={tsvInputRef}
                type="file"
                accept="text/tab-separated-values,.tsv,.txt"
                className="hidden"
                data-testid="import-tsv-input"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void readAndClose(file, onImportTsv);
                }}
            />
        </div>
    );
}
