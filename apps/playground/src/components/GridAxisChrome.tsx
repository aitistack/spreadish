import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    useDraggable,
    useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type ReactNode,
} from 'react';
import { MAX_AXIS_SIZE, MIN_AXIS_SIZE, type Sheet } from '@spreadish/core';
import { columnIndexToLabel } from '../address';
import { Modal } from './Modal';
import { PopoverMenu } from './PopoverMenu';
import { IconPlus, IconTrash } from './icons';

const DEFAULT_ROW_SIZE = 28;
const DEFAULT_COLUMN_SIZE = 100;

export function rowHeaderId(row: number): string {
    return `row:${row}`;
}

export function columnHeaderId(column: number): string {
    return `col:${column}`;
}

function parseAxisId(id: string | number): { axis: 'row' | 'column'; index: number } | null {
    const value = String(id);
    const match = /^(row|col):(\d+)$/.exec(value);
    if (!match) {
        return null;
    }
    return {
        axis: match[1] === 'row' ? 'row' : 'column',
        index: Number(match[2]),
    };
}

type AxisMenuState =
    | { kind: 'none' }
    | { kind: 'menu'; axis: 'row' | 'column'; index: number; x: number; y: number }
    | { kind: 'delete'; axis: 'row' | 'column'; index: number };

type GridAxisChromeProps = {
    sheet: Sheet | undefined;
    activeRow: number;
    activeColumn: number;
    onMoveRow: (from: number, to: number) => void;
    onMoveColumn: (from: number, to: number) => void;
    onResizeRow: (row: number, size: number) => void;
    onResizeColumn: (column: number, size: number) => void;
    onInsertRow: (index: number) => void;
    onInsertColumn: (index: number) => void;
    onDeleteRow: (row: number) => void;
    onDeleteColumn: (column: number) => void;
    onSetRowHidden: (row: number, hidden: boolean) => void;
    onSetColumnHidden: (column: number, hidden: boolean) => void;
    onSelectRow: (row: number) => void;
    onSelectColumn: (column: number) => void;
    children: (api: {
        renderColumnHeader: (column: number, style?: CSSProperties) => ReactNode;
        renderRowHeader: (row: number, style?: CSSProperties) => ReactNode;
        rowHeight: (row: number) => number;
        columnWidth: (column: number) => number;
        isRowHidden: (row: number) => boolean;
        isColumnHidden: (column: number) => boolean;
    }) => ReactNode;
};

export function GridAxisChrome({
    sheet,
    activeRow,
    activeColumn,
    onMoveRow,
    onMoveColumn,
    onResizeRow,
    onResizeColumn,
    onInsertRow,
    onInsertColumn,
    onDeleteRow,
    onDeleteColumn,
    onSetRowHidden,
    onSetColumnHidden,
    onSelectRow,
    onSelectColumn,
    children,
}: GridAxisChromeProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 4 },
        }),
    );
    const [menu, setMenu] = useState<AxisMenuState>({ kind: 'none' });
    const resizeRef = useRef<{
        axis: 'row' | 'column';
        index: number;
        start: number;
        size: number;
    } | null>(null);

    useEffect(() => {
        const onMove = (event: PointerEvent | MouseEvent) => {
            const current = resizeRef.current;
            if (!current) {
                return;
            }
            const delta =
                current.axis === 'row'
                    ? event.clientY - current.start
                    : event.clientX - current.start;
            const next = Math.min(
                MAX_AXIS_SIZE,
                Math.max(MIN_AXIS_SIZE, Math.round(current.size + delta)),
            );
            if (current.axis === 'row') {
                onResizeRow(current.index, next);
            } else {
                onResizeColumn(current.index, next);
            }
        };
        const onUp = () => {
            resizeRef.current = null;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [onResizeColumn, onResizeRow]);

    const rowHeight = (row: number) => {
        const id = sheet?.rowOrder[row];
        if (!id) {
            return DEFAULT_ROW_SIZE;
        }
        return sheet?.rows.get(id)?.size ?? DEFAULT_ROW_SIZE;
    };

    const columnWidth = (column: number) => {
        const id = sheet?.columnOrder[column];
        if (!id) {
            return DEFAULT_COLUMN_SIZE;
        }
        return sheet?.columns.get(id)?.size ?? DEFAULT_COLUMN_SIZE;
    };

    const isRowHidden = (row: number) => {
        const id = sheet?.rowOrder[row];
        return id ? sheet?.rows.get(id)?.hidden === true : false;
    };

    const isColumnHidden = (column: number) => {
        const id = sheet?.columnOrder[column];
        return id ? sheet?.columns.get(id)?.hidden === true : false;
    };

    const onDragEnd = (event: DragEndEvent) => {
        const active = parseAxisId(event.active.id);
        const over = event.over ? parseAxisId(event.over.id) : null;
        if (!active || !over || active.axis !== over.axis) {
            return;
        }
        if (active.index === over.index) {
            return;
        }
        if (active.axis === 'row') {
            onMoveRow(active.index, over.index);
        } else {
            onMoveColumn(active.index, over.index);
        }
    };

    const openMenu = (axis: 'row' | 'column', index: number, event: ReactMouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setMenu({ kind: 'menu', axis, index, x: event.clientX, y: event.clientY });
    };

    const renderColumnHeader = (column: number, style?: CSSProperties) => (
        <AxisHeader
            key={column}
            id={columnHeaderId(column)}
            label={columnIndexToLabel(column)}
            active={activeColumn === column}
            hidden={isColumnHidden(column)}
            style={{
                width: columnWidth(column),
                minWidth: columnWidth(column),
                height: style?.height,
                ...style,
            }}
            testId={`column-header-${column}`}
            resizeEdge="end"
            onSelect={() => onSelectColumn(column)}
            onContextMenu={(event) => openMenu('column', column, event)}
            onResizeStart={(client) => {
                resizeRef.current = {
                    axis: 'column',
                    index: column,
                    start: client,
                    size: columnWidth(column),
                };
            }}
        />
    );

    const renderRowHeader = (row: number, style?: CSSProperties) => (
        <AxisHeader
            key={row}
            id={rowHeaderId(row)}
            label={String(row + 1)}
            active={activeRow === row}
            hidden={isRowHidden(row)}
            style={{
                height: rowHeight(row),
                width: style?.width,
                ...style,
            }}
            testId={`row-header-${row}`}
            resizeEdge="bottom"
            onSelect={() => onSelectRow(row)}
            onContextMenu={(event) => openMenu('row', row, event)}
            onResizeStart={(client) => {
                resizeRef.current = {
                    axis: 'row',
                    index: row,
                    start: client,
                    size: rowHeight(row),
                };
            }}
        />
    );

    return (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {children({
                renderColumnHeader,
                renderRowHeader,
                rowHeight,
                columnWidth,
                isRowHidden,
                isColumnHidden,
            })}

            {menu.kind === 'menu' ? (
                <PopoverMenu
                    open
                    floating
                    align="start"
                    testId="axis-context-menu"
                    anchor={{ x: menu.x, y: menu.y }}
                    onClose={() => setMenu({ kind: 'none' })}
                    items={[
                        {
                            id: 'insert-before',
                            label: menu.axis === 'row' ? 'Insert row above' : 'Insert column left',
                            icon: <IconPlus className="h-3.5 w-3.5" />,
                            onSelect: () => {
                                if (menu.axis === 'row') {
                                    onInsertRow(menu.index);
                                } else {
                                    onInsertColumn(menu.index);
                                }
                            },
                        },
                        {
                            id: 'insert-after',
                            label: menu.axis === 'row' ? 'Insert row below' : 'Insert column right',
                            icon: <IconPlus className="h-3.5 w-3.5" />,
                            onSelect: () => {
                                if (menu.axis === 'row') {
                                    onInsertRow(menu.index + 1);
                                } else {
                                    onInsertColumn(menu.index + 1);
                                }
                            },
                        },
                        {
                            id: 'hide',
                            label: (() => {
                                const hidden =
                                    menu.axis === 'row'
                                        ? isRowHidden(menu.index)
                                        : isColumnHidden(menu.index);
                                return hidden ? 'Unhide' : 'Hide';
                            })(),
                            icon: <IconPlus className="h-3.5 w-3.5" />,
                            onSelect: () => {
                                const hidden =
                                    menu.axis === 'row'
                                        ? isRowHidden(menu.index)
                                        : isColumnHidden(menu.index);
                                if (menu.axis === 'row') {
                                    onSetRowHidden(menu.index, !hidden);
                                } else {
                                    onSetColumnHidden(menu.index, !hidden);
                                }
                            },
                        },
                        {
                            id: 'delete',
                            label: menu.axis === 'row' ? 'Delete row' : 'Delete column',
                            icon: <IconTrash className="h-3.5 w-3.5" />,
                            danger: true,
                            onSelect: () => {
                                setMenu({
                                    kind: 'delete',
                                    axis: menu.axis,
                                    index: menu.index,
                                });
                            },
                        },
                    ]}
                />
            ) : null}

            <Modal
                open={menu.kind === 'delete'}
                title={
                    menu.kind === 'delete' && menu.axis === 'row' ? 'Delete row?' : 'Delete column?'
                }
                size="sm"
                onClose={() => setMenu({ kind: 'none' })}
                footer={
                    <>
                        <button
                            type="button"
                            className="rounded-[8px] border border-[var(--pg-border)] bg-[var(--pg-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--pg-text)] hover:bg-[var(--pg-surface-soft)]"
                            onClick={() => setMenu({ kind: 'none' })}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-[8px] bg-[#dc2626] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#b91c1c]"
                            data-testid="delete-axis-confirm"
                            onClick={() => {
                                if (menu.kind !== 'delete') {
                                    return;
                                }
                                if (menu.axis === 'row') {
                                    onDeleteRow(menu.index);
                                } else {
                                    onDeleteColumn(menu.index);
                                }
                                setMenu({ kind: 'none' });
                            }}
                        >
                            Delete
                        </button>
                    </>
                }
            >
                <p>
                    Delete{' '}
                    {menu.kind === 'delete'
                        ? menu.axis === 'row'
                            ? `row ${menu.index + 1}`
                            : `column ${columnIndexToLabel(menu.index)}`
                        : ''}
                    ? This cannot be undone from the playground yet.
                </p>
            </Modal>
        </DndContext>
    );
}

type AxisHeaderProps = {
    id: string;
    label: string;
    active: boolean;
    hidden: boolean;
    style?: CSSProperties;
    testId: string;
    resizeEdge: 'end' | 'bottom';
    onSelect: () => void;
    onContextMenu: (event: ReactMouseEvent) => void;
    onResizeStart: (client: number) => void;
};

function AxisHeader({
    id,
    label,
    active,
    hidden,
    style,
    testId,
    resizeEdge,
    onSelect,
    onContextMenu,
    onResizeStart,
}: AxisHeaderProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
    const { setNodeRef: setDropRef, isOver } = useDroppable({ id });

    // Only translate while actively dragging to reorder — never during resize.
    const dragStyle =
        isDragging && transform
            ? { transform: CSS.Translate.toString(transform), zIndex: 40 }
            : undefined;

    return (
        <div
            ref={setDropRef}
            role={resizeEdge === 'bottom' ? 'rowheader' : 'columnheader'}
            className={`relative box-border flex items-center justify-center border-r border-b border-[color:var(--se-grid-border,#e5e7eb)] text-[11px] font-medium ${
                active
                    ? 'bg-[var(--se-grid-header-active-bg,#ecfdf5)] text-[var(--se-grid-header-active-fg,#059669)]'
                    : 'bg-[var(--se-grid-header-bg,#f3f4f6)] text-[var(--se-grid-header-fg,#6b7280)]'
            } ${hidden ? 'opacity-40' : ''} ${isOver ? 'ring-2 ring-inset ring-[var(--se-grid-active,#10b981)]' : ''} ${
                isDragging ? 'opacity-70' : ''
            }`}
            style={{
                ...style,
                ...dragStyle,
                width: style?.width ?? style?.minWidth,
                height: style?.height,
                minWidth: style?.minWidth ?? style?.width,
            }}
            data-testid={testId}
            onClick={onSelect}
            onContextMenu={onContextMenu}
        >
            <button
                type="button"
                ref={setNodeRef}
                className="flex h-full w-full cursor-grab items-center justify-center truncate px-1 active:cursor-grabbing"
                aria-label={`Drag to reorder ${label}`}
                {...listeners}
                {...attributes}
            >
                {label}
            </button>
            <span
                role="separator"
                aria-orientation={resizeEdge === 'bottom' ? 'horizontal' : 'vertical'}
                data-testid={`${testId}-resize`}
                className={
                    resizeEdge === 'bottom'
                        ? 'absolute right-0 bottom-0 left-0 z-10 h-1.5 cursor-row-resize'
                        : 'absolute top-0 right-0 bottom-0 z-10 w-1.5 cursor-col-resize'
                }
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onResizeStart(resizeEdge === 'bottom' ? event.clientY : event.clientX);
                }}
            />
        </div>
    );
}
