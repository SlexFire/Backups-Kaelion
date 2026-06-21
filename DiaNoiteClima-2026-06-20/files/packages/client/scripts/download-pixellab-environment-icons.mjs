/**
 * Baixa ícones de ambiente do PixelLab quando estiverem prontos.
 * Uso: node scripts/download-pixellab-environment-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/img/interface/environment');

/** object_id → nome do arquivo */
const JOBS = {
    rain_day: '5486a10e-ce74-4642-ac9d-720154ee5a36',
    rain_night: '09870ec1-00b6-4373-8443-4fea0ecc5a85',
    fog_day: '32ef4deb-6699-4980-8901-b45c1109e557',
    fog_night: '65a59a31-ab00-4da2-b411-8b4c66392aca',
    snow: '7c800890-e132-45f4-b810-75c8948d0f35',
    storm: '87c24b8d-197a-4c1a-a4d5-b1960ff51348'
};

async function download(name, objectId) {
    let url = `https://api.pixellab.ai/mcp/map-objects/${objectId}/download`,
        response = await fetch(url);

    if (!response.ok) return false;

    let buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length < 200) return false;

    fs.writeFileSync(path.join(outDir, `${name}.png`), buffer);
    console.log(`OK: ${name}.png`);

    return true;
}

async function main() {
    fs.mkdirSync(outDir, { recursive: true });

    let pending = { ...JOBS },
        attempts = 0,
        maxAttempts = 40;

    while (Object.keys(pending).length && attempts < maxAttempts) {
        for (let [name, id] of Object.entries(pending)) {
            if (await download(name, id)) delete pending[name];
        }

        if (!Object.keys(pending).length) break;

        attempts++;
        console.log(`Aguardando ${Object.keys(pending).join(', ')}... (${attempts}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, 15000));
    }

    if (Object.keys(pending).length)
        console.log('Pendentes:', Object.keys(pending).join(', '));
}

main();
