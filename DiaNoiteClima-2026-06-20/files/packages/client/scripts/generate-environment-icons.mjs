/**
 * Gera ícones pixel art 24x24 para a HUD de ambiente (dia/noite e clima).
 * Uso: node scripts/generate-environment-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/img/interface/environment');

const T = 0;
const W = 24;
const H = 24;

function createCanvas() {
    return new Uint8ClampedArray(W * H * 4);
}

function setPixel(data, x, y, r, g, b, a = 255) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;

    let i = (y * W + x) * 4;

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
}

function fillRect(data, x, y, w, h, r, g, b, a = 255) {
    for (let py = y; py < y + h; py++)
        for (let px = x; px < x + w; px++) setPixel(data, px, py, r, g, b, a);
}

function drawCircle(data, cx, cy, radius, r, g, b, a = 255) {
    for (let y = -radius; y <= radius; y++)
        for (let x = -radius; x <= radius; x++)
            if (x * x + y * y <= radius * radius) setPixel(data, cx + x, cy + y, r, g, b, a);
}

function drawHorizon(data, y, r, g, b) {
    fillRect(data, 0, y, W, H - y, r, g, b);
}

const icons = {
    morning: (data) => {
        drawHorizon(data, 14, 255, 180, 80);
        drawCircle(data, 12, 14, 5, 255, 220, 60);
        fillRect(data, 0, 13, W, 2, 180, 100, 40);
    },
    afternoon: (data) => {
        fillRect(data, 0, 0, W, H, 100, 180, 255);
        drawCircle(data, 12, 8, 6, 255, 240, 50);
        for (let i = 0; i < 8; i++) {
            let a = (i / 8) * Math.PI * 2,
                x = 12 + Math.round(Math.cos(a) * 9),
                y = 8 + Math.round(Math.sin(a) * 9);

            setPixel(data, x, y, 255, 240, 80);
            setPixel(data, x + 1, y, 255, 240, 80);
        }
    },
    evening: (data) => {
        drawHorizon(data, 14, 200, 80, 60);
        fillRect(data, 0, 0, W, 14, 120, 50, 80);
        drawCircle(data, 12, 14, 5, 255, 120, 40);
        fillRect(data, 0, 13, W, 2, 140, 60, 30);
    },
    night: (data) => {
        fillRect(data, 0, 0, W, H, 20, 30, 70);
        drawCircle(data, 14, 8, 5, 240, 240, 200);
        fillRect(data, 8, 6, 8, 10, T, T, T);
        setPixel(data, 5, 5, 255, 255, 200);
        setPixel(data, 18, 12, 255, 255, 200);
        setPixel(data, 8, 16, 255, 255, 200);
    },
    deep_night: (data) => {
        for (let y = 4; y < 14; y++)
            for (let x = 10; x < 18; x++) {
                let dx = x - 14,
                    dy = y - 9;

                if (dx * dx + dy * dy <= 18 && x < 15) setPixel(data, x, y, 55, 60, 85);
            }

        setPixel(data, 6, 6, 90, 95, 120);
        setPixel(data, 18, 13, 75, 80, 105);
        setPixel(data, 9, 17, 65, 70, 95);
    },
    clear: (data) => {
        drawCircle(data, 8, 8, 4, 255, 230, 60);
        fillRect(data, 10, 10, 12, 6, 220, 220, 230);
        fillRect(data, 12, 8, 10, 4, 200, 200, 210);
    },
    rain_day: (data) => {
        fillRect(data, 5, 6, 14, 7, 160, 170, 185);
        fillRect(data, 7, 4, 10, 4, 180, 185, 195);
        for (let x = 8; x < 18; x += 3) {
            setPixel(data, x, 14, 80, 140, 255);
            setPixel(data, x, 15, 80, 140, 255);
            setPixel(data, x + 1, 16, 80, 140, 255);
        }
    },
    rain_night: (data) => {
        fillRect(data, 5, 6, 14, 7, 70, 75, 95);
        fillRect(data, 7, 4, 10, 4, 90, 95, 115);
        for (let x = 8; x < 18; x += 3) {
            setPixel(data, x, 14, 100, 120, 200);
            setPixel(data, x, 15, 100, 120, 200);
            setPixel(data, x + 1, 16, 100, 120, 200);
        }
    },
    fog_day: (data) => {
        for (let y of [8, 11, 14, 17])
            fillRect(data, 2, y, 20, 2, 190, 195, 205, 200);
    },
    fog_night: (data) => {
        for (let y of [8, 11, 14, 17])
            fillRect(data, 2, y, 20, 2, 80, 85, 100, 210);
    },
    snow: (data) => {
        fillRect(data, 5, 6, 14, 7, 180, 190, 210);
        fillRect(data, 7, 4, 10, 4, 200, 210, 225);
        for (let x = 7; x < 18; x += 4) {
            setPixel(data, x, 15, 255, 255, 255);
            setPixel(data, x + 1, 14, 255, 255, 255);
            setPixel(data, x, 17, 255, 255, 255);
            setPixel(data, x + 2, 16, 255, 255, 255);
        }
    },
    storm: (data) => {
        fillRect(data, 4, 5, 16, 8, 55, 60, 75);
        fillRect(data, 6, 3, 12, 4, 70, 75, 90);
        fillRect(data, 11, 12, 2, 6, 255, 230, 50);
        fillRect(data, 9, 14, 6, 2, 255, 230, 50);
        fillRect(data, 13, 10, 2, 3, 255, 230, 50);
    }
};

function crc32(buf) {
    let crc = -1;

    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];

        for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }

    return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
    let typeBuf = Buffer.from(type),
        len = Buffer.alloc(4);

    len.writeUInt32BE(data.length);

    let crcBuf = Buffer.alloc(4),
        crc = crc32(Buffer.concat([typeBuf, data]));

    crcBuf.writeUInt32BE(crc);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba) {
    let signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        ihdr = Buffer.alloc(13);

    ihdr.writeUInt32BE(W, 0);
    ihdr.writeUInt32BE(H, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;

    let stride = 1 + W * 4,
        raw = Buffer.alloc(stride * H);

    for (let y = 0; y < H; y++) {
        raw[y * stride] = 0;

        for (let x = 0; x < W; x++) {
            let si = (y * W + x) * 4,
                di = y * stride + 1 + x * 4;

            raw[di] = rgba[si];
            raw[di + 1] = rgba[si + 1];
            raw[di + 2] = rgba[si + 2];
            raw[di + 3] = rgba[si + 3];
        }
    }

    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

fs.mkdirSync(outDir, { recursive: true });

/** Ícones já gerados pelo PixelLab — não sobrescrever. */
const pixellabIcons = new Set([
    'morning',
    'afternoon',
    'evening',
    'night',
    'deep_night',
    'clear'
]);

for (let [name, draw] of Object.entries(icons)) {
    if (pixellabIcons.has(name)) {
        console.log(`Ignorado (PixelLab): ${name}.png`);
        continue;
    }
    let data = createCanvas();

    draw(data);

    fs.writeFileSync(path.join(outDir, `${name}.png`), encodePng(data));
    console.log(`Gerado: ${name}.png`);
}
