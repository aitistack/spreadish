/** GitHub-style heading slug used for in-page anchors. */
export function slugifyHeading(raw: string): string {
    // Whitelist only — do not strip HTML tags with a single-pass regex (incomplete
    // sanitization). Angle brackets and other markup fall out via the charset filter.
    return raw
        .toLowerCase()
        .trim()
        .replace(/[`*_~]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
