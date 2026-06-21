import Packet from '../packet';

import { Packets } from '@kaetram/common/network';

export interface ChangeMapPacketData {
    mapId: string;
    version: number;
    x: number;
    y: number;
    width: number;
    height: number;
    tileSize: number;
    clientFile: string;
}

export type ChangeMapPacketCallback = (data: ChangeMapPacketData) => void;

export default class ChangeMapPacket extends Packet {
    public constructor(data: ChangeMapPacketData) {
        super(Packets.ChangeMap, undefined, data);
    }
}
