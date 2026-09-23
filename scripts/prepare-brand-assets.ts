/**
 * Prepare header/favicon icon assets.
 * Wordmark: only remove solid black background — never resize or recolor art.
 */
import sharp from 'sharp';

const iconSrc =
    'C:/Users/RS TRADERS/.cursor/projects/d-Aitisam-spreadsheet-engine/assets/d__Aitisam_spreadsheet-engine_icon.png';
const wordmarkSrc =
    'C:/Users/RS TRADERS/.cursor/projects/d-Aitisam-spreadsheet-engine/assets/d__Aitisam_spreadsheet-engine_spreadish.png';

async function knockBlack(
    input: string,
    output: string,
    options: { size?: number } = {},
): Promise<void> {
    const { data, info } = await sharp(input)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const threshold = 28;
    for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        if (r <= threshold && g <= threshold && b <= threshold) {
            data[i + 3] = 0;
        }
    }
    let out = sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
    }).png();
    if (options.size) {
        out = out.resize(options.size, options.size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
    }
    await out.toFile(output);
    console.log('wrote', output);
}

await knockBlack(iconSrc, 'apps/docs/src/assets/icon.png', { size: 128 });
await knockBlack(iconSrc, 'apps/playground/src/assets/icon.png', { size: 128 });
await knockBlack(iconSrc, 'icon.png');
await knockBlack(iconSrc, 'apps/docs/public/favicon.png', { size: 256 });
await knockBlack(iconSrc, 'apps/playground/public/favicon.png', { size: 256 });
// Transparent bg only — same pixel dimensions as source.
await knockBlack(wordmarkSrc, 'apps/docs/src/assets/spreadish.png');
console.log('done');
