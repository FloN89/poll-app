import { access, cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browserBuild = path.join(projectRoot, 'dist', 'poll-app', 'browser');
const uploadDirectory = path.join(projectRoot, 'dist', 'ftp-upload');
const csrIndex = path.join(uploadDirectory, 'index.csr.html');
const index = path.join(uploadDirectory, 'index.html');

const apacheRewriteRules = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>
`;

await access(browserBuild);
await rm(uploadDirectory, { recursive: true, force: true });
await mkdir(uploadDirectory, { recursive: true });
await cp(browserBuild, uploadDirectory, { recursive: true });
await rename(csrIndex, index);
await writeFile(path.join(uploadDirectory, '.htaccess'), apacheRewriteRules, 'utf8');

console.log(`FTP upload package created at ${uploadDirectory}`);
