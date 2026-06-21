import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let root = path.dirname(path.dirname(fileURLToPath(import.meta.url))),
    source = path.join(root, 'data', 'maps'),
    destination = path.join(root, 'public', 'data', 'maps');

if (!fs.existsSync(source)) process.exit(0);

fs.mkdirSync(destination, { recursive: true });

for (let file of fs.readdirSync(source)) {
    if (!file.endsWith('.json')) continue;

    fs.copyFileSync(path.join(source, file), path.join(destination, file));
}
