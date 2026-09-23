#!/usr/bin/env bun
/**
 * GitHub Pages serves unknown paths as 404.html for custom domains / project sites.
 * Copy the SPA shell so React Router deep links work on refresh.
 */
import { copyFile, access } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(import.meta.dir, '../dist');
const indexHtml = path.join(distDir, 'index.html');
const notFoundHtml = path.join(distDir, '404.html');

await access(indexHtml);
await copyFile(indexHtml, notFoundHtml);
console.log('spa-404: wrote dist/404.html');
