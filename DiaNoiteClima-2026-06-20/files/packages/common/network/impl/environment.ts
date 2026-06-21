import Packet from '../packet';

import { Packets } from '@kaetram/common/network';

import type { EnvironmentState } from '@kaetram/common/types/environment';
import type { Opcodes } from '@kaetram/common/network';

export type EnvironmentPacketCallback = (
    opcode: Opcodes.Environment,
    info?: EnvironmentState
) => void;

export default class EnvironmentPacket extends Packet {
    public constructor(opcode: Opcodes.Environment, data?: EnvironmentState) {
        super(Packets.Environment, opcode, data);
    }
}
