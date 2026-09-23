export const workbookQueryKeys = {
    all: ['spreadsheet-workbook'] as const,
    detail: (workbookId: string) => [...workbookQueryKeys.all, workbookId] as const,
    status: (workbookId: string) => [...workbookQueryKeys.detail(workbookId), 'status'] as const,
};
