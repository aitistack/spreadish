/** Trigger a browser file download for exported workbook/sheet payloads. */
export function downloadTextFile(filename: string, contents: string, mime: string): void {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(typeof reader.result === 'string' ? reader.result : '');
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error('Failed to read file'));
        };
        reader.readAsText(file);
    });
}
