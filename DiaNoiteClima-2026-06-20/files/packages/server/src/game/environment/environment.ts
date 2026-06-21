import {
    TIME_OF_DAY_COUNT,
    TIME_OF_DAY_NAMES,
    TIME_PHASE_DURATION,
    TIME_TRANSITION_DURATION,
    TimeOfDay,
    WeatherType,
    WEATHER_TYPE_NAMES
} from '@kaetram/common/types/environment';
import { EnvironmentPacket } from '@kaetram/common/network/impl';
import { Opcodes } from '@kaetram/common/network';

import type World from '../world';
import type Player from '../entity/character/player/player';
import type { EnvironmentState } from '@kaetram/common/types/environment';

const TIME_LABELS = ['Manhã', 'Tarde', 'Entardecer', 'Noite', 'Alta Madrugada'];
const WEATHER_LABELS = [
    'Limpo',
    'Chuva (dia)',
    'Chuva (noite)',
    'Névoa (dia)',
    'Névoa (noite)',
    'Neve',
    'Tempestade'
];

/**
 * Gerencia o ciclo dia/noite e o clima global do mundo.
 * Afeta apenas jogadores em mapas externos (fora de overlay areas).
 */
export default class Environment {
    public timeOfDay: TimeOfDay = TimeOfDay.Morning;
    public weather: WeatherType = WeatherType.Clear;
    public transition = 0;
    public cycleEnabled = true;

    private phaseElapsed = 0;
    private lastTick = Date.now();
    private lastSync = 0;

    /** Intervalo mínimo entre sincronizações com clientes (ms). */
    private readonly syncInterval = 2000;

    public constructor(private world: World) {
        this.startTick();
    }

    /**
     * Avança o ciclo temporal automaticamente.
     */
    private startTick(): void {
        setInterval(() => this.tick(), 1000);
    }

    private tick(): void {
        let now = Date.now(),
            delta = now - this.lastTick;

        this.lastTick = now;

        if (!this.cycleEnabled) return;

        let phaseDuration = TIME_PHASE_DURATION[this.timeOfDay],
            totalDuration = phaseDuration + TIME_TRANSITION_DURATION;

        this.phaseElapsed += delta;

        if (this.phaseElapsed >= phaseDuration) {
            this.transition = Math.min(
                1,
                (this.phaseElapsed - phaseDuration) / TIME_TRANSITION_DURATION
            );
        } else {
            this.transition = 0;
        }

        if (this.phaseElapsed >= totalDuration) {
            this.phaseElapsed = 0;
            this.transition = 0;
            this.timeOfDay = this.getNextTimeOfDay();
        }

        if (now - this.lastSync >= this.syncInterval) {
            this.lastSync = now;
            this.syncAllExterior();
        }
    }

    private getNextTimeOfDay(): TimeOfDay {
        return ((this.timeOfDay + 1) % TIME_OF_DAY_COUNT) as TimeOfDay;
    }

    public getState(): EnvironmentState {
        return {
            timeOfDay: this.timeOfDay,
            transition: this.transition,
            weather: this.weather,
            cycleEnabled: this.cycleEnabled,
            phaseRemaining: this.getPhaseRemaining()
        };
    }

    /**
     * Tempo restante até a próxima fase do dia (ms). -1 quando o ciclo está pausado.
     */
    public getPhaseRemaining(): number {
        if (!this.cycleEnabled) return -1;

        let phaseDuration = TIME_PHASE_DURATION[this.timeOfDay],
            totalDuration = phaseDuration + TIME_TRANSITION_DURATION;

        return Math.max(0, totalDuration - this.phaseElapsed);
    }

    /**
     * Verifica se o jogador está em interior (overlay area, casas, lojas, cavernas).
     */
    public isPlayerExterior(player: Player): boolean {
        return !player.isInInterior();
    }

    /**
     * Envia o estado ambiental para um jogador em mapa externo.
     */
    public syncPlayer(player: Player): void {
        if (!this.isPlayerExterior(player)) return;

        player.send(new EnvironmentPacket(Opcodes.Environment.Sync, this.getState()));
    }

    /**
     * Remove efeitos ambientais do cliente (interior).
     */
    public removeFromPlayer(player: Player): void {
        player.send(new EnvironmentPacket(Opcodes.Environment.Remove));
    }

    /**
     * Sincroniza todos os jogadores em mapas externos.
     */
    public syncAllExterior(): void {
        this.world.entities.forEachPlayer((player: Player) => this.syncPlayer(player));
    }

    /**
     * Define o período do dia manualmente.
     */
    public setTimeOfDay(time: TimeOfDay): void {
        this.timeOfDay = time;
        this.transition = 0;
        this.phaseElapsed = 0;
        this.syncAllExterior();
    }

    /**
     * Define o clima manualmente, interrompendo o clima anterior.
     */
    public setWeather(weather: WeatherType): void {
        this.weather = weather;
        this.syncAllExterior();
    }

    /**
     * Remove todos os efeitos de clima, mantendo o período do dia.
     */
    public clearWeather(): void {
        this.weather = WeatherType.Clear;
        this.syncAllExterior();
    }

    /**
     * Restaura o ambiente padrão: manhã, sem clima e sem transição.
     */
    public reset(): void {
        this.timeOfDay = TimeOfDay.Morning;
        this.weather = WeatherType.Clear;
        this.transition = 0;
        this.phaseElapsed = 0;
        this.syncAllExterior();
    }

    /**
     * Liga/desliga o ciclo automático dia/noite.
     */
    public setCycleEnabled(enabled: boolean): void {
        this.cycleEnabled = enabled;

        if (enabled) {
            this.phaseElapsed = 0;
            this.transition = 0;
        }

        this.syncAllExterior();
    }

    public parseTimeName(name: string): TimeOfDay | undefined {
        return TIME_OF_DAY_NAMES[name.toLowerCase()];
    }

    public parseWeatherName(name: string): WeatherType | undefined {
        return WEATHER_TYPE_NAMES[name.toLowerCase()];
    }

    public getTimeLabel(): string {
        let next = this.getNextTimeOfDay(),
            label = TIME_LABELS[this.timeOfDay];

        if (this.transition > 0) label += ` → ${TIME_LABELS[next]} (${Math.round(this.transition * 100)}%)`;

        return label;
    }

    public getWeatherLabel(): string {
        return WEATHER_LABELS[this.weather] || 'Desconhecido';
    }
}
