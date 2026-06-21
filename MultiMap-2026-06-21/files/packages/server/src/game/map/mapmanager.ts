import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Map from './map';

import log from '@kaetram/common/util/log';

import type World from '../world';
import type { MapRegistry, MapRegistryEntry } from '@kaetram/common/types/mapregistry';
import type { ProcessedMap } from '@kaetram/common/types/map';

/**
 * Resolves `packages/server/data` in dev (tsx) and production (`dist/main.js` bundle).
 */
function resolveServerDataDirectory(): string {
    let moduleDir = path.dirname(fileURLToPath(import.meta.url)),
        candidates = [path.join(moduleDir, '../data'), path.join(moduleDir, '../../../data')];

    for (let candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'maps/registry.json'))) return candidate;
    }

    throw new Error(
        `Server data directory not found. Expected maps/registry.json under: ${candidates.join(' or ')}`
    );
}

const dataDirectory = resolveServerDataDirectory();

/** Id of the original base world map shipped with the game. */
export const BASE_MAP_ID = 'world';

export default class MapManager {
    private registry: MapRegistry;
    private maps: { [mapId: string]: Map } = {};

    public constructor(private world: World) {
        this.registry = this.loadRegistry();

        for (let mapId in this.registry.maps) this.load(mapId);

        log.info(`Default map: '${this.registry.defaultMap}'.`);
    }

    /**
     * Loads or returns a cached map instance.
     */

    public get(mapId: string): Map | undefined {
        return this.maps[mapId] ?? this.load(mapId);
    }

    public getDefault(): Map {
        return this.get(this.registry.defaultMap)!;
    }

    public getDefaultId(): string {
        return this.registry.defaultMap;
    }

    public has(mapId: string): boolean {
        return mapId in this.registry.maps;
    }

    public getAll(): Map[] {
        return Object.values(this.maps);
    }

    public getRegistry(): MapRegistry {
        return this.registry;
    }

    public getEntry(mapId: string): MapRegistryEntry | undefined {
        return this.registry.maps[mapId];
    }

    /**
     * Reads registry.json from the server data directory.
     */

    private loadRegistry(): MapRegistry {
        let registryPath = path.join(dataDirectory, 'maps/registry.json'),
            raw = fs.readFileSync(registryPath, { encoding: 'utf8' }),
            registry = JSON.parse(raw) as MapRegistry;

        if (!registry.defaultMap || !registry.maps[registry.defaultMap])
            throw new Error(`Invalid map registry: default map '${registry.defaultMap}' is missing.`);

        if (!registry.defaultMap || !registry.maps[registry.defaultMap]) {
            log.warning(`Invalid defaultMap in registry. Falling back to '${BASE_MAP_ID}'.`);
            registry.defaultMap = BASE_MAP_ID;
        }

        return registry;
    }

    /**
     * Loads map JSON from disk and constructs a Map instance.
     */

    private load(mapId: string): Map | undefined {
        if (mapId in this.maps) return this.maps[mapId];

        let entry = this.registry.maps[mapId];

        if (!entry) {
            log.error(`Map '${mapId}' is not registered.`);
            return undefined;
        }

        let mapPath = path.join(dataDirectory, entry.serverFile),
            raw = fs.readFileSync(mapPath, { encoding: 'utf8' }),
            mapData = JSON.parse(raw) as ProcessedMap;

        let map = new Map(this.world, mapData, mapId);

        this.maps[mapId] = map;

        log.info(`Loaded map '${mapId}' (${map.width}x${map.height}).`);

        return map;
    }
}
