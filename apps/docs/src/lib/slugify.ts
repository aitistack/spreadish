/** GitHub-style heading slug used for in-page anchors. */
export function slugifyHeading(raw: string): string {
    return raw
        .toLowerCase()
        .trim()
        .replace(/[`*_~]/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
