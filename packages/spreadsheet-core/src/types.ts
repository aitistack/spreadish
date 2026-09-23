import type { Brand } from '@spreadish/utils';

export type WorkbookId = Brand<string, 'WorkbookId'>;
export type SheetId = Brand<string, 'SheetId'>;
export type RowId = Brand<string, 'RowId'>;
export type ColumnId = Brand<string, 'ColumnId'>;
export type StyleId = Brand<string, 'StyleId'>;
export type ConditionalFormatId = Brand<string, 'ConditionalFormatId'>;

export type FontWeight = 'normal' | 'bold';
export type FontStyleKind = 'normal' | 'italic';
export type UnderlineStyle = 'none' | 'single';
export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type BorderLineStyle = 'none' | 'thin' | 'medium' | 'thick';

export type BorderEdge = {
    readonly style: BorderLineStyle;
    readonly color?: string;
};

export type CellStyle = {
    readonly fontFamily?: string;
    readonly fontSize?: number;
    readonly fontWeight?: FontWeight;
    readonly fontStyle?: FontStyleKind;
    readonly underline?: UnderlineStyle;
    readonly color?: string;
    readonly fill?: string;
    readonly horizontalAlign?: HorizontalAlign;
    readonly verticalAlign?: VerticalAlign;
    readonly numberFormat?: string;
    readonly borders?: {
        readonly top?: BorderEdge;
        readonly right?: BorderEdge;
        readonly bottom?: BorderEdge;
        readonly left?: BorderEdge;
    };
};

/** Patch shape for style merges: `null` clears `fill` / `color` / `borders`. */
export type CellStylePatch = Partial<Omit<CellStyle, 'fill' | 'color' | 'borders'>> & {
    readonly fill?: string | null;
    readonly color?: string | null;
    readonly borders?: CellStyle['borders'] | null;
};

export type ConditionalFormatWhen =
    | { readonly kind: 'cellEmpty' }
    | { readonly kind: 'cellNotEmpty' }
    | { readonly kind: 'numberGreaterThan'; readonly value: number }
    | { readonly kind: 'numberLessThan'; readonly value: number }
    | { readonly kind: 'numberEquals'; readonly value: number }
    | { readonly kind: 'textContains'; readonly value: string };

export type ConditionalFormatRule = {
    readonly id: ConditionalFormatId;
    readonly ranges: readonly NormalizedRange[];
    readonly when: ConditionalFormatWhen;
    readonly style: Partial<CellStyle>;
    readonly priority: number;
};

export type CellValue =
    | { readonly kind: 'empty' }
    | { readonly kind: 'string'; readonly value: string }
    | { readonly kind: 'number'; readonly value: number }
    | { readonly kind: 'boolean'; readonly value: boolean }
    | { readonly kind: 'error'; readonly code: string; readonly message: string };

export type CellRecord = {
    readonly value: CellValue;
    readonly formula?: string;
    readonly styleId?: StyleId;
    readonly metadata?: Readonly<Record<string, unknown>>;
};

export type RowMeta = {
    readonly size?: number;
    readonly hidden?: boolean;
    readonly frozen?: boolean;
    readonly styleId?: StyleId;
    readonly metadata?: Readonly<Record<string, unknown>>;
};

export type ColumnMeta = {
    readonly size?: number;
    readonly hidden?: boolean;
    readonly frozen?: boolean;
    readonly styleId?: StyleId;
    readonly metadata?: Readonly<Record<string, unknown>>;
};

export type Sheet = {
    readonly id: SheetId;
    readonly name: string;
    readonly rowOrder: readonly RowId[];
    readonly columnOrder: readonly ColumnId[];
    readonly rows: ReadonlyMap<RowId, RowMeta>;
    readonly columns: ReadonlyMap<ColumnId, ColumnMeta>;
    /** Sparse cell map keyed by makeCellKey(rowId, columnId). */
    readonly cells: ReadonlyMap<string, CellRecord>;
    readonly conditionalFormats: readonly ConditionalFormatRule[];
};

export type CellCoord = {
    readonly row: number;
    readonly column: number;
};

export type NormalizedRange = {
    readonly startRow: number;
    readonly startColumn: number;
    readonly endRow: number;
    readonly endColumn: number;
};

export type SelectionMode = 'cells' | 'rows' | 'columns' | 'all';

export type Selection = {
    readonly sheetId: SheetId;
    readonly mode: SelectionMode;
    readonly active: CellCoord;
    readonly anchor: CellCoord;
    readonly ranges: readonly NormalizedRange[];
};

export type EditorState =
    | { readonly status: 'idle' }
    | {
          readonly status: 'editing';
          readonly sheetId: SheetId;
          readonly row: number;
          readonly column: number;
          readonly draft: string;
          readonly intent: 'replace' | 'edit';
      };

export type ClipboardPayload = {
    readonly mode: 'copy' | 'cut';
    readonly width: number;
    readonly height: number;
    readonly values: readonly (readonly (CellRecord | null)[])[];
    readonly tsv: string;
    readonly sourceSheetId: SheetId;
    readonly sourceOrigin: CellCoord;
};

export type WorkbookState = {
    readonly schemaVersion: 1;
    readonly id: WorkbookId;
    readonly name: string;
    readonly sheetOrder: readonly SheetId[];
    readonly sheets: ReadonlyMap<SheetId, Sheet>;
    readonly activeSheetId: SheetId | null;
    readonly styles: ReadonlyMap<StyleId, CellStyle>;
};

export type CellInput =
    | CellValue
    | string
    | number
    | boolean
    | null
    | {
          value?: CellValue | string | number | boolean | null;
          formula?: string | null;
          styleId?: StyleId | null;
          metadata?: Readonly<Record<string, unknown>> | null;
      };

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export type Command =
    | {
          readonly type: 'setCellValue';
          readonly sheetId: SheetId;
          readonly row: number;
          readonly column: number;
          readonly value: CellInput;
      }
    | {
          readonly type: 'clearCells';
          readonly sheetId: SheetId;
          readonly cells: readonly { readonly row: number; readonly column: number }[];
      }
    | {
          readonly type: 'createSheet';
          readonly name?: string;
          readonly activate?: boolean;
      }
    | {
          readonly type: 'renameSheet';
          readonly sheetId: SheetId;
          readonly name: string;
      }
    | {
          readonly type: 'renameWorkbook';
          readonly name: string;
      }
    | {
          readonly type: 'deleteSheet';
          readonly sheetId: SheetId;
      }
    | {
          readonly type: 'moveSheet';
          readonly sheetId: SheetId;
          readonly toIndex: number;
      }
    | {
          readonly type: 'activateSheet';
          readonly sheetId: SheetId;
      }
    | {
          readonly type: 'selectCell';
          readonly sheetId: SheetId;
          readonly row: number;
          readonly column: number;
      }
    | {
          readonly type: 'selectRange';
          readonly sheetId: SheetId;
          readonly start: CellCoord;
          readonly end: CellCoord;
          readonly active?: CellCoord;
          readonly append?: boolean;
      }
    | {
          readonly type: 'extendSelectionTo';
          readonly row: number;
          readonly column: number;
      }
    | {
          readonly type: 'selectRows';
          readonly sheetId: SheetId;
          readonly rows: readonly number[];
          readonly activeColumn?: number;
      }
    | {
          readonly type: 'selectColumns';
          readonly sheetId: SheetId;
          readonly columns: readonly number[];
          readonly activeRow?: number;
      }
    | {
          readonly type: 'selectAll';
          readonly sheetId: SheetId;
          /** When provided, expands the all-selection to at least this many rows (1-based count). */
          readonly rowCount?: number;
          /** When provided, expands the all-selection to at least this many columns (1-based count). */
          readonly columnCount?: number;
      }
    | {
          readonly type: 'moveSelection';
          readonly direction: MoveDirection;
          readonly extend?: boolean;
          readonly jump?: boolean;
      }
    | {
          readonly type: 'startEditing';
          readonly draft?: string;
          readonly intent?: 'replace' | 'edit';
      }
    | {
          readonly type: 'updateDraft';
          readonly draft: string;
      }
    | {
          readonly type: 'commitEditing';
          readonly move?: MoveDirection | 'none';
      }
    | { readonly type: 'cancelEditing' }
    | { readonly type: 'deleteSelection' }
    | { readonly type: 'copySelection' }
    | { readonly type: 'cutSelection' }
    | {
          readonly type: 'pasteClipboard';
          readonly row?: number;
          readonly column?: number;
      }
    | {
          readonly type: 'autofillSelection';
          readonly endRow: number;
          readonly endColumn: number;
      }
    | {
          readonly type: 'importSheetGrid';
          readonly sheetId: SheetId;
          readonly row?: number;
          readonly column?: number;
          readonly values: readonly (readonly (CellRecord | null)[])[];
      }
    | {
          readonly type: 'insertRows';
          readonly sheetId: SheetId;
          readonly index: number;
          readonly count?: number;
      }
    | {
          readonly type: 'insertColumns';
          readonly sheetId: SheetId;
          readonly index: number;
          readonly count?: number;
      }
    | {
          readonly type: 'deleteRows';
          readonly sheetId: SheetId;
          readonly rows: readonly number[];
      }
    | {
          readonly type: 'deleteColumns';
          readonly sheetId: SheetId;
          readonly columns: readonly number[];
      }
    | {
          readonly type: 'moveRows';
          readonly sheetId: SheetId;
          readonly fromIndex: number;
          readonly toIndex: number;
      }
    | {
          readonly type: 'moveColumns';
          readonly sheetId: SheetId;
          readonly fromIndex: number;
          readonly toIndex: number;
      }
    | {
          readonly type: 'resizeRow';
          readonly sheetId: SheetId;
          readonly row: number;
          readonly size: number;
      }
    | {
          readonly type: 'resizeColumn';
          readonly sheetId: SheetId;
          readonly column: number;
          readonly size: number;
      }
    | {
          readonly type: 'setRowsHidden';
          readonly sheetId: SheetId;
          readonly rows: readonly number[];
          readonly hidden: boolean;
      }
    | {
          readonly type: 'setColumnsHidden';
          readonly sheetId: SheetId;
          readonly columns: readonly number[];
          readonly hidden: boolean;
      }
    | {
          readonly type: 'setRowsFrozen';
          readonly sheetId: SheetId;
          readonly rows: readonly number[];
          readonly frozen: boolean;
      }
    | {
          readonly type: 'setColumnsFrozen';
          readonly sheetId: SheetId;
          readonly columns: readonly number[];
          readonly frozen: boolean;
      }
    | {
          readonly type: 'upsertStyle';
          readonly styleId?: StyleId;
          readonly style: CellStyle;
      }
    | {
          readonly type: 'setCellsStyle';
          readonly sheetId: SheetId;
          readonly cells: readonly { readonly row: number; readonly column: number }[];
          readonly styleId: StyleId | null;
      }
    | {
          readonly type: 'applyStylePatch';
          readonly sheetId: SheetId;
          readonly ranges: readonly NormalizedRange[];
          readonly patch: CellStylePatch;
      }
    | {
          readonly type: 'addConditionalFormat';
          readonly sheetId: SheetId;
          readonly ranges: readonly NormalizedRange[];
          readonly when: ConditionalFormatWhen;
          readonly style: Partial<CellStyle>;
          readonly priority?: number;
          readonly id?: ConditionalFormatId;
      }
    | {
          readonly type: 'removeConditionalFormat';
          readonly sheetId: SheetId;
          readonly ruleId: ConditionalFormatId;
      };

export type DomainEvent =
    | {
          readonly type: 'cellChanged';
          readonly sheetId: SheetId;
          readonly rowId: RowId;
          readonly columnId: ColumnId;
          readonly rowIndex: number;
          readonly columnIndex: number;
          readonly previous: CellRecord | undefined;
          readonly next: CellRecord | undefined;
      }
    | { readonly type: 'sheetCreated'; readonly sheetId: SheetId; readonly name: string }
    | { readonly type: 'sheetDeleted'; readonly sheetId: SheetId }
    | {
          readonly type: 'sheetRenamed';
          readonly sheetId: SheetId;
          readonly previousName: string;
          readonly name: string;
      }
    | {
          readonly type: 'workbookRenamed';
          readonly previousName: string;
          readonly name: string;
      }
    | {
          readonly type: 'sheetMoved';
          readonly sheetId: SheetId;
          readonly fromIndex: number;
          readonly toIndex: number;
      }
    | { readonly type: 'sheetActivated'; readonly sheetId: SheetId | null }
    | { readonly type: 'selectionChanged'; readonly selection: Selection | null }
    | { readonly type: 'editorChanged'; readonly editor: EditorState }
    | { readonly type: 'clipboardChanged'; readonly clipboard: ClipboardPayload | null }
    | {
          readonly type: 'rowsChanged';
          readonly sheetId: SheetId;
          readonly reason: 'insert' | 'delete' | 'move' | 'resize' | 'hidden' | 'frozen';
      }
    | {
          readonly type: 'columnsChanged';
          readonly sheetId: SheetId;
          readonly reason: 'insert' | 'delete' | 'move' | 'resize' | 'hidden' | 'frozen';
      }
    | { readonly type: 'formulaRecalculated'; readonly sheetId: SheetId }
    | { readonly type: 'transactionCommitted'; readonly commandType: Command['type'] }
    | {
          readonly type: 'historyChanged';
          readonly canUndo: boolean;
          readonly canRedo: boolean;
      }
    | { readonly type: 'stylesChanged' }
    | {
          readonly type: 'conditionalFormatsChanged';
          readonly sheetId: SheetId;
      };

export type ExecuteResult = {
    readonly applied: boolean;
    readonly events: readonly DomainEvent[];
};

export type CreateWorkbookOptions = {
    readonly name?: string;
    readonly sheetName?: string;
    readonly idFactory?: () => string;
    /** Maximum undo entries retained (default 100). */
    readonly maxHistoryEntries?: number;
};

export type SerializedCell = {
    readonly rowId: string;
    readonly columnId: string;
    readonly value: CellValue;
    readonly formula?: string;
    readonly styleId?: string;
    readonly metadata?: Record<string, unknown>;
};

export type SerializedSheet = {
    readonly id: string;
    readonly name: string;
    readonly rowOrder: readonly string[];
    readonly columnOrder: readonly string[];
    readonly rows: Record<string, RowMeta>;
    readonly columns: Record<string, ColumnMeta>;
    readonly cells: readonly SerializedCell[];
    readonly conditionalFormats?: readonly ConditionalFormatRule[];
};

export type SerializedWorkbook = {
    readonly schemaVersion: 1;
    readonly id: string;
    readonly name: string;
    readonly sheetOrder: readonly string[];
    readonly activeSheetId: string | null;
    readonly sheets: readonly SerializedSheet[];
    readonly styles?: Record<string, CellStyle>;
};
