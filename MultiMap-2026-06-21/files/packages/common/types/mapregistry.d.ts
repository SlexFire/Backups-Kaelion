export interface MapRegistryEntry {
    displayName: string;
    /** Path relative to packages/server/data/ */
    serverFile: string;
    /** Filename under packages/client/data/maps/ */
    clientFile: string;
    spawn?: Position;
    tutorialSpawn?: Position;
}

export interface MapRegistry {
    /** Map id used for new players and server default. */
    defaultMap: string;
    maps: { [mapId: string]: MapRegistryEntry };
}
