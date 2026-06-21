#!/usr/bin/env -S yarn tsx

import fs from 'node:fs';
import path from 'node:path';

import Parser from './parser';

import log from '@kaetram/common/util/log';

import type { ProcessedTileset } from '@kaetram/common/types/map';
import type { MapRegistry } from '@kaetram/common/types/mapregistry';

let resolve = (dir: string): URL => new URL(dir, import.meta.url),
    relative = (dir: string): string => path.relative('../../../', dir),
    tilesetDirectory = '../../../client/public/img/tilesets/',
    mapDirectory = '../data/',
    serverMapsDirectory = '../../../server/data/maps/',
    clientMapsDirectory = '../../../client/data/maps/',
    clientPublicMapsDirectory = '../../../client/public/data/maps/',
    registryPath = '../../../server/data/maps/registry.json';

export default class Exporter {
    /** The map file we are parsing */
    #map = process.argv[2];
    /** Registered map id (defaults to the source filename). */
    #mapId = process.argv[3];
    #setDefault = process.argv.includes('--default');

    /** Base game world — always the default spawn map unless --default is used on another export. */
    static BASE_MAP_ID = 'world';

    public constructor() {
        if (!this.fileExists()) {
            log.error(`File ${this.#map} could not be found.`);
            return;
        }

        if (!this.#mapId) this.#mapId = path.basename(this.#map!, path.extname(this.#map!));

        this.parse();
    }

    private parse(): void {
        let data = fs.readFileSync(this.#map!, {
            encoding: 'utf8',
            flag: 'r'
        });

        if (!data) {
            log.error('An error has occurred while trying to read the map.');
            return;
        }

        let parser = new Parser(JSON.parse(data)),
            mapId = this.#mapId!,
            isBaseWorld = mapId === Exporter.BASE_MAP_ID,
            clientFile = isBaseWorld ? 'map.json' : `${mapId}.json`,
            serverDestination = isBaseWorld
                ? '../../../server/data/map/world.json'
                : `${serverMapsDirectory}${mapId}.json`,
            clientDestination = `${clientMapsDirectory}${clientFile}`;

        fs.writeFileSync(resolve(serverDestination), parser.getMap());
        log.notice(`Map file successfully saved at ${relative(serverDestination)}.`);

        fs.writeFileSync(resolve(clientDestination), parser.getClientMap());
        log.notice(`Map file successfully saved at ${relative(clientDestination)}.`);

        this.copyClientMapToPublic(clientFile, parser.getClientMap());

        this.updateRegistry(mapId, parser.getSpawn(), clientFile);
        this.copyTilesets(parser.getTilesets());
    }

    /**
     * Registers or updates the map in registry.json without changing defaultMap
     * unless --default was passed.
     */

    private updateRegistry(
        mapId: string,
        spawn: Position | undefined,
        clientFile: string
    ): void {
        let isBaseWorld = mapId === Exporter.BASE_MAP_ID;
        let registry = JSON.parse(
            fs.readFileSync(resolve(registryPath), { encoding: 'utf8' })
        ) as MapRegistry;

        registry.maps[mapId] = {
            displayName: isBaseWorld ? 'Mundo base (Kaelion)' : mapId,
            serverFile: isBaseWorld ? 'map/world.json' : `maps/${mapId}.json`,
            clientFile,
            spawn
        };

        // Keep the base world as default unless the exporter explicitly requests otherwise.
        if (this.#setDefault) registry.defaultMap = mapId;
        else if (!registry.defaultMap || !registry.maps[registry.defaultMap])
            registry.defaultMap = Exporter.BASE_MAP_ID;

        fs.writeFileSync(resolve(registryPath), JSON.stringify(registry, null, 4) + '\n');

        log.notice(
            `Registry updated for map '${mapId}'${this.#setDefault ? ' (set as default)' : ''}.`
        );
    }

    private copyClientMapToPublic(clientFile: string, contents: string): void {
        let destination = `${clientPublicMapsDirectory}${clientFile}`,
            directory = clientPublicMapsDirectory;

        if (!fs.existsSync(resolve(directory))) fs.mkdirSync(resolve(directory), { recursive: true });

        fs.writeFileSync(resolve(destination), contents);

        log.notice(`Map file successfully saved at ${relative(destination)}.`);
    }

    /**
     * Copies a list of tilesets from their directories and places them in the client directory.
     * @param tilesets A list of tilesets used to determine the path of where we copy them
     */

    private copyTilesets(tilesets: ProcessedTileset[]): void {
        for (let tileset of tilesets) {
            let paths = tileset.path.split('/');

            if (paths.length === 1) {
                this.copyTileset(tileset.path);
                continue;
            }

            paths.shift();

            let writePath = paths.join('/'),
                destination = tilesetDirectory;

            for (let directory of paths) {
                destination = `${destination}/${directory}`;

                if (!fs.existsSync(resolve(destination))) fs.mkdirSync(resolve(destination));
            }

            this.copyTileset(writePath, tileset.path);
        }
    }

    private copyTileset(location: string, from = location): void {
        fs.copyFile(
            resolve(path.join(mapDirectory, from)),
            resolve(path.join(tilesetDirectory, location)),
            (error) => {
                if (error)
                    throw new Error(`An error has occurred while copying tilesets:\n`, {
                        cause: error
                    });
            }
        );
    }

    private fileExists(): boolean {
        return !!this.#map && fs.existsSync(this.#map);
    }
}

new Exporter();
