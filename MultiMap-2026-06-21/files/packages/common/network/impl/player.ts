import Packet from '../packet';

import { Packets } from '@kaetram/common/network';

import type { Opcodes, Modules } from '@kaetram/common/network';
import type { EntityData } from '@kaetram/common/types/entity';
import type { EquipmentData } from '@kaetram/common/network/impl/equipment';

export interface PlayerPacketData {
    username: string;
    serverId?: number;
    guild?: string;
}

export interface PlayerData extends EntityData {
    rank: Modules.Ranks;
    pvp: boolean;
    orientation: number;
    guildName?: string;

    experience?: number;
    nextExperience?: number;
    prevExperience?: number;

    mana?: number;
    maxMana?: number;

    equipments: EquipmentData[];

    /** Active map instance id (multi-map support). */
    mapId?: string;

    /** Client map filename under /data/maps/ (multi-map support). */
    clientFile?: string;

    battlePassClaims?: string[];
    battlePassExp?: number;
    battlePassPremium?: boolean;
}

export default class PlayerPacket extends Packet {
    public constructor(opcode: Opcodes.Player, data?: PlayerPacketData) {
        super(Packets.Player, opcode, data);
    }
}
