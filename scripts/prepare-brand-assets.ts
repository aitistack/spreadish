/**
 * Prepare header/favicon icon assets from repo-local sources.
 * Wordmark: only remove solid black background — never resize or recolor art.
 */
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dir, '..');
const iconSrc = path.join(root, 'icon.png');
const wordmarkSrc = path.join(root, 'apps/docs/src/assets/spreadish.png');

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
        raw: { width: info.width, height: info.height, channels: info.channels },
    }).png();
    if (options.size) {
        out = out.resize(options.size, options.size, { fit: 'contain' });
    }
    await out.toFile(output);
    console.log('wrote', output);
}

await knockBlack(iconSrc, path.join(root, 'apps/docs/src/assets/icon.png'), { size: 128 });
await knockBlack(iconSrc, path.join(root, 'apps/playground/src/assets/icon.png'), { size: 128 });
await knockBlack(iconSrc, path.join(root, 'apps/docs/public/favicon.png'), { size: 64 });
await knockBlack(wordmarkSrc, path.join(root, 'apps/docs/src/assets/spreadish.png'));
console.log('prepare-brand-assets: done');
