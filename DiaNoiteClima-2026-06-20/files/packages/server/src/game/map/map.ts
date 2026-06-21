import AreasIndex from './areas';
import Grids from './grids';
import Regions from './regions';

import mapData from '../../../data/map/world.json';

import { Modules } from '@kaetram/common/network';

import type World from '../world';
import type Areas from './areas/areas';
import type Player from '../entity/character/player/player';
import type { ProcessedArea, ProcessedDoor, ProcessedMap, Tile, InteriorZone } from '@kaetram/common/types/map';
import type Entity from '../entity/entity';

let map = mapData as ProcessedMap;

export default class Map {
    // Map versioning and information
    public version = map.version;
    public width = map.width;
    public height = map.height;
    public tileSize = map.tileSize;

    // Map handlers
    public regions: Regions;
    public grids: Grids = new Grids(this.width, this.height);

    // Map data and collisions
    public data: (number | number[])[] = map.data;
    public collisions: number[] = map.collisions || [];
    private entities: { [tileId: number]: string } = map.entities;

    public plateau: { [index: number]: number } = map.plateau;
    public objects: number[] = map.objects;
    public cursors: { [tileId: number]: string } = map.cursors;
    public doors: { [index: number]: ProcessedDoor } = {};
    public interiorZones: InteriorZone[] = [];
    public warps: ProcessedArea[] = map.areas.warps || [];
    public lights: ProcessedArea[] = map.areas.lights || [];
    public signs: ProcessedArea[] = map.areas.signs || [];

    // Static chest areas, named as singular to prevent confusion with `chests` area.
    public chest: ProcessedArea[] = map.areas.chest || [];

    private areas: { [name: string]: Areas } = {};

    public constructor(public world: World) {
        this.loadAreas();
        this.loadDoors();
        this.regions = new Regions(this);
        this.loadInteriorZones();
    }

    /**
     * Iterates through the static areas and incorporates
     * them into the server by creating instances of them.
     * This allows them to be manipulated and interacted with.
     */

    private loadAreas(): void {
        for (let key in map.areas) {
            if (!(key in AreasIndex)) continue;

            this.areas[key] = new AreasIndex[key as keyof typeof AreasIndex](
                map.areas[key],
                this.world
            );
        }
    }

    /**
     * Iterates through the doors saved in the static map
     * and links them together. We create a clone of all the
     * doors due to the pointer properties of JavaScript.
     * We link each door with their respective destination,
     * and return a list of all doors (ensuring it is not circular).
     * Doors are a dictionary, where the index represents the tileIndex
     * of the door the player goes through, and the value represents
     * the destination information.
     */

    private loadDoors(): void {
        let doorsClone = map.areas.doors.map((door) => ({ ...door }));

        // Iterate through the doors in the map.
        for (let door of map.areas.doors) {
            // Skip if the door does not have a destination.
            if (!door.destination) continue;

            // Find destination door in the clone list of doors.
            let index = this.coordToIndex(door.x, door.y),
                destination = doorsClone.find((cloneDoor) => {
                    return door.destination === cloneDoor.id;
                });

            if (!destination) continue;

            // Assign destination door information to the door we are parsing.
            this.doors[index] = {
                x: destination.x,
                y: destination.y,
                orientation: destination.orientation || 'd',
                quest: door.quest || '',
                achievement: door.achievement || '',
                reqAchievement: door.reqAchievement || '',
                reqQuest: door.reqQuest || '',
                reqItem: door.reqItem || '',
                reqItemCount: door.reqItemCount || 0,
                stage: door.stage || 0,
                skill: door.skill || '',
                level: door.level || 0,
                npc: door.npc || ''
            };
        }
    }

    /**
     * Gera zonas interiores (casas, lojas) a partir de portas que teleportam
     * para salas isoladas. Usa flood-fill limitado sem atravessar outras portas.
     */
    /** Tamanho máximo de uma sala interior (evita zonas gigantes). */
    private readonly maxInteriorZoneSize = 55;
    private readonly maxInteriorZoneArea = 2500;
    private readonly maxInteriorFloodTiles = 400;

    private loadInteriorZones(): void {
        let doors = map.areas.doors,
            doorTiles = new Set(doors.map((door) => this.coordToIndex(door.x, door.y))),
            byId: { [id: number]: ProcessedArea } = {},
            zones: InteriorZone[] = [];

        for (let door of doors) byId[door.id] = door;

        let processedPairs = new Set<string>();

        for (let door of doors) {
            if (!door.destination || door.quest || door.reqItem || door.level) continue;

            let destination = byId[door.destination];

            if (!destination) continue;

            let pairKey =
                door.id < destination.id
                    ? `${door.id}:${destination.id}`
                    : `${destination.id}:${door.id}`;

            if (processedPairs.has(pairKey)) continue;

            processedPairs.add(pairKey);

            let distance =
                Math.abs(destination.x - door.x) + Math.abs(destination.y - door.y);

            if (distance < 50) continue;

            let entranceZone = this.getInteriorZoneBounds(door.x, door.y, doorTiles),
                destinationZone = this.getInteriorZoneBounds(
                    destination.x,
                    destination.y,
                    doorTiles
                );

            this.collectInteriorZone(zones, entranceZone, destinationZone);

            let sides = this.resolveInteriorDoorPair(
                door,
                destination,
                entranceZone,
                destinationZone
            );

            if (!sides) continue;

            let insideIndex = this.coordToIndex(sides.insideDoor.x, sides.insideDoor.y),
                outsideIndex = this.coordToIndex(sides.outsideDoor.x, sides.outsideDoor.y),
                insideDoorData = this.doors[insideIndex],
                outsideDoorData = this.doors[outsideIndex];

            if (outsideDoorData) {
                outsideDoorData.hasInteriorToggle = true;
                outsideDoorData.interiorState = true;
            }

            if (insideDoorData) {
                insideDoorData.hasInteriorToggle = true;
                insideDoorData.interiorState = false;
            }
        }

        this.interiorZones = this.dedupeInteriorZones(zones);
    }

    /**
     * Registra apenas zonas pequenas o bastante para serem salas interiores.
     */
    private collectInteriorZone(
        zones: InteriorZone[],
        entranceZone: InteriorZone | undefined,
        destinationZone: InteriorZone | undefined
    ): void {
        if (entranceZone && destinationZone) {
            let entranceArea = entranceZone.width * entranceZone.height,
                destinationArea = destinationZone.width * destinationZone.height;

            zones.push(entranceArea <= destinationArea ? entranceZone : destinationZone);

            return;
        }

        let sole = entranceZone || destinationZone;

        if (!sole) return;

        if (sole.width * sole.height <= this.maxInteriorZoneArea / 2) zones.push(sole);
    }

    /**
     * Determina qual porta fica no interior e qual fica no exterior.
     */
    private resolveInteriorDoorPair(
        door: ProcessedArea,
        destination: ProcessedArea,
        entranceZone: InteriorZone | undefined,
        destinationZone: InteriorZone | undefined
    ): { insideDoor: ProcessedArea; outsideDoor: ProcessedArea } | undefined {
        if (entranceZone && destinationZone) {
            let interiorZone =
                    entranceZone.width * entranceZone.height <=
                    destinationZone.width * destinationZone.height
                        ? entranceZone
                        : destinationZone,
                doorInside = this.isPositionInZone(door.x, door.y, interiorZone),
                destInside = this.isPositionInZone(destination.x, destination.y, interiorZone);

            if (doorInside !== destInside)
                return {
                    insideDoor: doorInside ? door : destination,
                    outsideDoor: doorInside ? destination : door
                };
        }

        let entranceArea = entranceZone ? entranceZone.width * entranceZone.height : -1,
            destinationArea = destinationZone ? destinationZone.width * destinationZone.height : -1,
            smallInteriorThreshold = this.maxInteriorZoneArea / 2;

        if (entranceArea < 0 && destinationArea < 0) return;

        if (entranceArea >= 0 && destinationArea >= 0) {
            if (entranceArea === destinationArea) return;

            return entranceArea < destinationArea
                ? { insideDoor: door, outsideDoor: destination }
                : { insideDoor: destination, outsideDoor: door };
        }

        if (entranceArea >= 0)
            return entranceArea <= smallInteriorThreshold
                ? { insideDoor: door, outsideDoor: destination }
                : { insideDoor: destination, outsideDoor: door };

        return destinationArea! <= smallInteriorThreshold
            ? { insideDoor: destination, outsideDoor: door }
            : { insideDoor: door, outsideDoor: destination };
    }

    private getInteriorZoneBounds(
        startX: number,
        startY: number,
        doorTiles: Set<number>
    ): InteriorZone | undefined {
        let starts: Position[] = [];

        if (!this.isOutOfBounds(startX, startY) && !this.isColliding(startX, startY))
            starts.push({ x: startX, y: startY });
        else
            for (let [dx, dy] of [
                [0, 1],
                [0, -1],
                [1, 0],
                [-1, 0]
            ]) {
                let nextX = startX + dx,
                    nextY = startY + dy,
                    index = this.coordToIndex(nextX, nextY);

                if (
                    this.isOutOfBounds(nextX, nextY) ||
                    doorTiles.has(index) ||
                    this.isColliding(nextX, nextY)
                )
                    continue;

                starts.push({ x: nextX, y: nextY });
            }

        if (!starts.length) return;

        let queue = [...starts],
            visited = new Set<number>();

        for (let start of starts) visited.add(this.coordToIndex(start.x, start.y));

        let minX = startX,
            maxX = startX,
            minY = startY,
            maxY = startY,
            count = 0,
            maxTiles = this.maxInteriorFloodTiles;

        while (queue.length > 0 && count < maxTiles) {
            let { x, y } = queue.shift()!;

            count++;

            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            for (let [dx, dy] of [
                [0, 1],
                [0, -1],
                [1, 0],
                [-1, 0]
            ]) {
                let nextX = x + dx,
                    nextY = y + dy,
                    index = this.coordToIndex(nextX, nextY);

                if (
                    this.isOutOfBounds(nextX, nextY) ||
                    visited.has(index) ||
                    doorTiles.has(index) ||
                    this.isColliding(nextX, nextY)
                )
                    continue;

                visited.add(index);
                queue.push({ x: nextX, y: nextY });
            }
        }

        if (count < 20) return;

        let width = maxX - minX + 1,
            height = maxY - minY + 1;

        if (
            width > this.maxInteriorZoneSize ||
            height > this.maxInteriorZoneSize ||
            width * height > this.maxInteriorZoneArea
        )
            return;

        return { x: minX, y: minY, width, height };
    }

    private isPositionInZone(
        x: number,
        y: number,
        zone: InteriorZone | undefined
    ): boolean {
        if (!zone) return false;

        return (
            x >= zone.x &&
            y >= zone.y &&
            x < zone.x + zone.width &&
            y < zone.y + zone.height
        );
    }

    /**
     * Remove zonas duplicadas sem fundir áreas distantes (evita bloquear o mapa externo).
     */
    private dedupeInteriorZones(zones: InteriorZone[]): InteriorZone[] {
        let unique: InteriorZone[] = [];

        for (let zone of zones) {
            let duplicate = unique.some(
                (existing) =>
                    existing.x === zone.x &&
                    existing.y === zone.y &&
                    existing.width === zone.width &&
                    existing.height === zone.height
            );

            if (!duplicate) unique.push(zone);
        }

        return unique;
    }

    /**
     * Verifica se a posição está dentro de uma zona interior (casa, loja, etc.).
     */
    public isInteriorPosition(x: number, y: number): boolean {
        for (let zone of this.interiorZones)
            if (
                x >= zone.x &&
                y >= zone.y &&
                x < zone.x + zone.width &&
                y < zone.y + zone.height
            )
                return true;

        return false;
    }

    /**
     * Converts a coordinate (x and y) into an array index.
     * @returns Index position relative to a 1 dimensional array.
     */

    public coordToIndex(x: number, y: number): number {
        return y * this.width + x;
    }

    /**
     * Works in reverse to `coordToIndex`. Takes an index
     * within a one dimensional array and returns the
     * coordinate variant of that index.
     * @param index The index of the coordinate
     */

    public indexToCoord(index: number): Position {
        return {
            x: index % this.width,
            y: ~~(index / this.width)
        };
    }

    /**
     * Checks whether a tileId is flipped or not by comparing
     * the value against the lowest flipped bitflag.
     * @param tileId The tileId we are checking.
     */

    public isFlippedTileId(tileId: number): boolean {
        return tileId > (Modules.MapFlags.DIAGONAL_FLAG as number);
    }

    /**
     * Grabs the x and y cooridnates specified and checks
     * the tileIndex against the array of doors in the world.
     * @param x The grid x coordinate we are checking.
     * @param y The grid y coordinate we are checking.
     * @returns Boolean on whether or not the door exists.
     */

    public isDoor(x: number, y: number): boolean {
        return !!this.doors[this.coordToIndex(x, y)];
    }

    /**
     * Checks if the specified `x` and `y` coordinates are outside
     * the map bounds.
     * @param x Grid x coordinate we are checking.
     * @param y Grid y coordinate we are checking.
     * @returns Whether or not the x and y grid coordinates are within the bounds.
     */

    public isOutOfBounds(x: number, y: number): boolean {
        return x < 0 || x >= this.width || y < 0 || y >= this.height;
    }

    /**
     * Checks if the tile data is a collision.
     * @param data Contains tile information.
     * @returns Whether or not the tile is a collision.
     */

    public isCollision(data: Tile): boolean {
        let collision = false;

        this.forEachTile(data, (tile: number) => {
            // Remove the tile transformation flags if they exist.
            if (this.isFlippedTileId(tile)) tile = this.getFlippedTileId(tile);

            if (this.collisions.includes(tile)) collision = true;
        });

        return collision;
    }

    /**
     * Checks if the tileIndex exists in the map collisions. We check against
     * tile ids instead of indexes because indexes will scale exponentially as
     * more map content is added. Think of it as this; you are more likely to add
     * more tiles into the map than add more tilesets.
     * @param index Tile index to check.
     * @returns If the array of collision indexes contains the tileIndex.
     */

    public isCollisionIndex(index: number): boolean {
        let data = this.data[index];

        // Empty data means the tile is a collision.
        if (!data) return true;

        return this.isCollision(data);
    }

    /**
     * Checks if a position is a collision. Checks the tileIndex against
     * the array of collision indexes and verifies that the tile is not null.
     * @param x Grid x coordinate we are checking.
     * @param y Grid y coordinate we are checking.
     * @param player Optional parameter used to check the dynamic tile collision.
     * @returns True if the position is a collision.
     */

    public isColliding(x: number, y: number, player?: Player): boolean {
        if (this.isOutOfBounds(x, y)) return true;

        /**
         * This is the cleanest way I could've done dynamic collision detection.
         * It checks whether the player exists, region has valid dynamic areas,
         * and if we can find the mapped tile. If any of those fail, the if statement
         * nest will exit and check collisions against the static map.
         */

        // Verify dynamic tile collision if player is provided as a parameter.
        let region = this.regions.get(this.regions.getRegion(x, y)),
            index = this.coordToIndex(x, y);

        // Skip if there are no dynamic areas in the region.
        if (player && region.hasDynamicAreas()) {
            let dynamicArea = region.getDynamicArea(x, y);

            // Skip if no dynamic area is found or it doesn't fulfill requirements.
            if (dynamicArea?.fulfillsRequirement(player)) {
                let mappedTile = dynamicArea.getMappedTile(x, y);

                // Check collision if we can find a mapping tile.
                if (mappedTile) return this.isColliding(mappedTile.x, mappedTile.y);
            }
        }

        let hasEntity = false;

        if (this.grids.hasEntityAt(x, y))
            this.grids.forEachEntityAt(x, y, (entity: Entity) => {
                if (entity.isResource()) hasEntity = true;
            });

        // Check the collision at a specified index.
        return hasEntity || this.isCollisionIndex(index);
    }

    /**
     * Checks the tile data on whether or not it contains an object tile.
     * @param data The tile data (number or number array) we are checking.
     * @returns Boolean conditional if the tile data contains an object.
     */

    public isObject(data: Tile): boolean {
        let isObject = false;

        this.forEachTile(data, (tileId: number) => {
            if (this.objects.includes(tileId)) isObject = true;
        });

        return isObject;
    }

    /**
     * Grabs the chest areas group parsed in the map.
     * @returns The chests areas parsed upon loading.
     */

    public getChestAreas(): Areas {
        return this.areas.chests;
    }

    /**
     * Grabs the dynamic areas group parsed in the map.
     * @returns The dynamic areas parsed upon loading.
     */

    public getDynamicAreas(): Areas {
        return this.areas.dynamic;
    }

    /**
     * Grabs the minigame areas in the map.
     * @returns The minigame areas parsed upon loading.
     */

    public getMinigameAreas(): Areas {
        return this.areas.minigame;
    }

    /**
     * Converts the coordinate x and y into a tileIndex
     * and returns a door at the index. Defaults to undefined
     * if no door is found.
     * @param x The grid x coordinate we are checking.
     * @param y The grid y coordinate we are checking.
     * @returns ProcessedDoor object if it exists in the door array.
     */

    public getDoor(x: number, y: number): ProcessedDoor {
        return this.doors[this.coordToIndex(x, y)];
    }

    /**
     * Given the index we try to obtain the tile data and look through
     * it to see if it contains a cursor name.
     * @param data The tile data we are checking.
     * @returns The cursor name if it exists.
     */

    public getCursor(index: number): string {
        let cursor = '';

        this.forEachTile(this.data[index], (tileId: number) => {
            if (tileId in this.cursors) cursor = this.cursors[tileId];
        });

        return cursor;
    }

    /**
     * Returns the current plateau level of the specified coordinates.
     * @param x Grid x coordinate we are checking.
     * @param y Grid y coordinate we are checking.
     * @returns The plateau level of the coordinate or 0 if none exists.
     */

    public getPlateauLevel(x: number, y: number): number {
        let index = this.coordToIndex(x, y);

        if (!(index in this.plateau)) return 0;

        // Plateau at the coordinate index.
        return this.plateau[index];
    }

    /**
     * Extracts the original tileId from a flipped tile. We are essentially unbitmasking
     * the tileId to get the original tileId.
     * @param tileId The flipped tile id we are extracting.
     * @returns The original tile id (used for collision checking).
     */

    public getFlippedTileId(tileId: number): number {
        return (
            tileId &
            ~(
                Modules.MapFlags.DIAGONAL_FLAG |
                Modules.MapFlags.VERTICAL_FLAG |
                Modules.MapFlags.HORIZONTAL_FLAG
            )
        );
    }

    /**
     * A callback function used to iterate through all the areas in the map.
     * Specifically used in the player's handler, it is used to check
     * various activities within the areas.
     * @param callback Returns an areas group (i.e. chest areas) and the key of the group.
     * @param list Optional parameter used for iterating through specified areas. Prevents iterating
     * through unnecessary areas.
     */

    public forEachAreas(callback: (areas: Areas, key: string) => void, list: string[] = []): void {
        for (let name in this.areas) {
            if (list.length > 0 && !list.includes(name)) continue;

            callback(this.areas[name], name);
        }
    }

    /**
     * Iterates through all the tiles at a given index if it's an array, otherwise we just return
     * the number contained at that location. This is used to speed up code when trying to handle
     * logic for multiple tiles at a location.
     * @param data The raw tile data (generally contained in the umodified map) at an index.
     * @param callback The tile id and index of the tile currently being iterated.
     */

    public forEachTile(data: Tile, callback: (tileId: number, index?: number) => void): void {
        if (Array.isArray(data)) for (let index in data) callback(data[index], parseInt(index));
        else callback(data);
    }

    /**
     * Parses through the entities in the raw map data and converts data for the controller.
     * @param callback The position of the entity and its string id.
     */

    public forEachEntity(callback: (position: Position, key: string) => void): void {
        for (let index in this.entities) {
            let position = this.indexToCoord(parseInt(index));

            callback(position, this.entities[index]);
        }
    }
}
