import { existsSync, copyFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(path.join(__dirname, '..'));

const sourceSchema = path.join(apiRoot, 'prisma', 'schema.enterprise.sqlite.sql');
const destSchema = path.join(apiRoot, 'dist', 'schema.sql');

if (existsSync(sourceSchema)) {
  copyFileSync(sourceSchema, destSchema);
  console.log(`✓ Copied schema.sql to dist/`);
} else {
  console.warn(`⚠ schema.enterprise.sqlite.sql not found at ${sourceSchema}`);
}
