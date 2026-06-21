import { TIME_OF_DAY_COUNT, TimeOfDay, WeatherType } from '@kaetram/common/types/environment';

import EnvironmentHud from '../menu/environment-hud';

import type { EnvironmentState } from '@kaetram/common/types/environment';
import type Game from '../game';

interface Tint {
    r: number;
    g: number;
    b: number;
    a: number;
}

interface SnowFlake {
    x: number;
    y: number;
    speed: number;
    size: number;
    opacity: number;
    drift: number;
}

interface RainDrop {
    x: number;
    y: number;
    speed: number;
    length: number;
    opacity: number;
    drift: number;
    depth: number;
    width: number;
}

interface RainSplash {
    x: number;
    y: number;
    life: number;
    maxLife: number;
    radius: number;
    opacity: number;
}

/** Cores de iluminação ambiente por período do dia. */
const TIME_TINTS: Tint[] = [
    { r: 255, g: 210, b: 140, a: 0.1 },
    { r: 255, g: 255, b: 255, a: 0 },
    { r: 255, g: 130, b: 60, a: 0.18 },
    { r: 15, g: 25, b: 70, a: 0.5 },
    { r: 4, g: 8, b: 28, a: 0.72 }
];

const WEATHER_DARKEN: Record<WeatherType, number> = {
    [WeatherType.Clear]: 0,
    [WeatherType.RainDay]: 0.06,
    [WeatherType.RainNight]: 0.1,
    [WeatherType.FogDay]: 0.04,
    [WeatherType.FogNight]: 0.08,
    [WeatherType.Snow]: 0.05,
    [WeatherType.Storm]: 0.15
};

/**
 * Renderiza iluminação ambiente e efeitos climáticos nos mapas externos.
 */
export default class EnvironmentController {
    public active = false;

    private timeOfDay = TimeOfDay.Afternoon;
    private weather = WeatherType.Clear;
    private transition = 0;
    private cycleEnabled = true;
    private phaseRemaining = -1;

    private hud = new EnvironmentHud();

    private currentTint: Tint = { r: 0, g: 0, b: 0, a: 0 };
    private targetTint: Tint = { r: 0, g: 0, b: 0, a: 0 };

    private snowFlakes: SnowFlake[] = [];
    private rainDrops: RainDrop[] = [];
    private splashes: RainSplash[] = [];

    private lightningAlpha = 0;
    private nextLightning = 0;

    private fogPulse = 0;
    private rainMistPulse = 0;
    private rainWind = 0;
    private rainWindTarget = 0;
    private nextWindShift = 0;

    public constructor(private game: Game) {}

    public sync(state: EnvironmentState): void {
        let weatherChanged = this.weather !== state.weather;

        this.active = true;
        this.timeOfDay = state.timeOfDay;
        this.weather = state.weather;
        this.transition = state.transition;
        this.cycleEnabled = state.cycleEnabled;
        this.phaseRemaining = state.phaseRemaining;

        if (weatherChanged) this.resetWeatherEffects();

        this.updateTargetTint();
        Object.assign(this.currentTint, this.targetTint);

        if (weatherChanged) this.initWeatherParticles();

        this.hud.update(this);
    }

    public remove(): void {
        this.active = false;
        this.resetWeatherEffects();
        this.currentTint = { r: 0, g: 0, b: 0, a: 0 };
        this.targetTint = { r: 0, g: 0, b: 0, a: 0 };
        this.hud.update(this);
    }

    public isHudVisible(): boolean {
        return this.active;
    }

    public getTimeOfDay(): TimeOfDay {
        return this.timeOfDay;
    }

    public getWeather(): WeatherType {
        return this.weather;
    }

    public getTransition(): number {
        return this.transition;
    }

    public getPhaseRemaining(): number {
        return this.phaseRemaining;
    }

    public isCycleEnabled(): boolean {
        return this.cycleEnabled;
    }

    private resetWeatherEffects(): void {
        this.snowFlakes = [];
        this.rainDrops = [];
        this.splashes = [];
        this.lightningAlpha = 0;
        this.nextLightning = 0;
        this.fogPulse = 0;
        this.rainMistPulse = 0;
        this.rainWind = 0;
        this.rainWindTarget = 0;
        this.nextWindShift = 0;
    }

    private isRainWeather(): boolean {
        return (
            this.weather === WeatherType.RainDay ||
            this.weather === WeatherType.RainNight ||
            this.weather === WeatherType.Storm
        );
    }

    private isNightRain(): boolean {
        return this.weather === WeatherType.RainNight || this.weather === WeatherType.Storm;
    }

    private getNextTimeOfDay(): TimeOfDay {
        return ((this.timeOfDay + 1) % TIME_OF_DAY_COUNT) as TimeOfDay;
    }

    private lerpTint(from: Tint, to: Tint, t: number): Tint {
        return {
            r: from.r + (to.r - from.r) * t,
            g: from.g + (to.g - from.g) * t,
            b: from.b + (to.b - from.b) * t,
            a: from.a + (to.a - from.a) * t
        };
    }

    private updateTargetTint(): void {
        let from = TIME_TINTS[this.timeOfDay],
            to = TIME_TINTS[this.getNextTimeOfDay()],
            base = this.lerpTint(from, to, this.transition),
            darken = WEATHER_DARKEN[this.weather];

        this.targetTint = {
            r: base.r * (1 - darken),
            g: base.g * (1 - darken),
            b: base.b * (1 - darken * 0.5),
            a: Math.min(0.75, base.a + darken)
        };
    }

    private initWeatherParticles(): void {
        let { canvasWidth, canvasHeight } = this.game.renderer;

        if (!canvasWidth || !canvasHeight) return;

        switch (this.weather) {
            case WeatherType.RainDay:
            case WeatherType.RainNight:
                this.initRain(canvasWidth, canvasHeight, 520);
                break;

            case WeatherType.Storm:
                this.initRain(canvasWidth, canvasHeight, 780);
                break;

            case WeatherType.Snow:
                for (let i = 0; i < 250; i++)
                    this.snowFlakes.push(this.createSnowFlake(canvasWidth, canvasHeight, true));
                break;
        }
    }

    private initRain(width: number, height: number, count: number): void {
        this.rainDrops = [];

        for (let i = 0; i < count; i++)
            this.rainDrops.push(this.createRainDrop(width, height, true));
    }

    private createSnowFlake(width: number, height: number, randomY = false): SnowFlake {
        return {
            x: Math.random() * width,
            y: randomY ? Math.random() * height : -10,
            speed: 0.8 + Math.random() * 1.5,
            size: 2 + Math.random() * 3,
            opacity: 0.45 + Math.random() * 0.4,
            drift: (Math.random() - 0.5) * 0.8
        };
    }

    private createRainDrop(width: number, height: number, randomY = false): RainDrop {
        let isStorm = this.weather === WeatherType.Storm,
            depth = Math.random(),
            depthFactor = 0.45 + depth * 0.55;

        return {
            x: Math.random() * width,
            y: randomY ? Math.random() * height : -30 - Math.random() * 80,
            speed: (7 + Math.random() * 7) * depthFactor * (isStorm ? 1.25 : 1),
            length: (10 + Math.random() * 18) * depthFactor,
            opacity: (0.15 + depth * 0.55) * (isStorm ? 1.1 : 1),
            drift: (-1.8 + Math.random() * 0.6) * (isStorm ? 1.4 : 1),
            depth,
            width: (0.6 + depth * 1.6) * (isStorm ? 1.2 : 1)
        };
    }

    private spawnSplash(x: number, y: number): void {
        let isStorm = this.weather === WeatherType.Storm,
            maxSplashes = isStorm ? 140 : 100;

        if (this.splashes.length >= maxSplashes) this.splashes.shift();

        this.splashes.push({
            x,
            y,
            life: 0,
            maxLife: 180 + Math.random() * 140,
            radius: 1.2 + Math.random() * (isStorm ? 3.5 : 2.5),
            opacity: 0.35 + Math.random() * 0.45
        });
    }

    public update(time: number): void {
        if (!this.active) return;

        this.updateTargetTint();

        let speed = 0.06;

        this.currentTint.r += (this.targetTint.r - this.currentTint.r) * speed;
        this.currentTint.g += (this.targetTint.g - this.currentTint.g) * speed;
        this.currentTint.b += (this.targetTint.b - this.currentTint.b) * speed;
        this.currentTint.a += (this.targetTint.a - this.currentTint.a) * speed;

        this.fogPulse = Math.sin(time / 2000) * 0.5 + 0.5;
        this.rainMistPulse = Math.sin(time / 3200) * 0.5 + 0.5;

        if (this.isRainWeather()) {
            if (time >= this.nextWindShift) {
                this.rainWindTarget = (Math.random() - 0.5) * 2.2;
                this.nextWindShift = time + 1800 + Math.random() * 4000;
            }

            this.rainWind += (this.rainWindTarget - this.rainWind) * 0.02;
        }

        let dt = Math.min(this.game.timeDiff || 16, 50);

        this.updateSnow(dt);
        this.updateRain(dt);
        this.updateSplashes(dt);
        this.updateStorm(time);
        this.tickPhaseRemaining(dt);
        this.hud.update(this);
    }

    private tickPhaseRemaining(dt: number): void {
        if (!this.active || !this.cycleEnabled || this.phaseRemaining < 0) return;

        this.phaseRemaining = Math.max(0, this.phaseRemaining - dt);
    }

    private updateSnow(dt: number): void {
        if (!this.snowFlakes.length) return;

        let { canvasWidth, canvasHeight } = this.game.renderer;

        if (!canvasWidth || !canvasHeight) return;

        for (let flake of this.snowFlakes) {
            flake.y += flake.speed * (dt / 16);
            flake.x += flake.drift * (dt / 16);

            if (flake.y > canvasHeight + 20 || flake.x < -20 || flake.x > canvasWidth + 20)
                Object.assign(flake, this.createSnowFlake(canvasWidth, canvasHeight));
        }
    }

    private updateRain(dt: number): void {
        if (!this.rainDrops.length) return;

        let { canvasWidth, canvasHeight } = this.game.renderer;

        if (!canvasWidth || !canvasHeight) return;

        let groundY = canvasHeight - 4,
            wind = this.rainWind;

        for (let drop of this.rainDrops) {
            let prevY = drop.y;

            drop.y += drop.speed * (dt / 16);
            drop.x += (drop.drift + wind) * (dt / 16);

            let hitGround = prevY < groundY && drop.y + drop.length >= groundY;

            if (hitGround) {
                if (Math.random() < 0.72) this.spawnSplash(drop.x, groundY - Math.random() * 2);
                Object.assign(drop, this.createRainDrop(canvasWidth, canvasHeight));
                continue;
            }

            if (drop.y > canvasHeight + 40 || drop.x < -40 || drop.x > canvasWidth + 40)
                Object.assign(drop, this.createRainDrop(canvasWidth, canvasHeight));
        }
    }

    private updateSplashes(dt: number): void {
        if (!this.splashes.length) return;

        for (let i = this.splashes.length - 1; i >= 0; i--) {
            let splash = this.splashes[i];

            splash.life += dt;

            if (splash.life >= splash.maxLife) this.splashes.splice(i, 1);
        }
    }

    private updateStorm(time: number): void {
        if (this.weather !== WeatherType.Storm) return;

        if (this.lightningAlpha > 0) this.lightningAlpha = Math.max(0, this.lightningAlpha - 0.08);

        if (time >= this.nextLightning && this.lightningAlpha <= 0) {
            this.lightningAlpha = 0.35 + Math.random() * 0.35;
            this.nextLightning = time + 3000 + Math.random() * 8000;
            this.playThunder();
        }
    }

    private playThunder(): void {
        try {
            let audioCtx = new AudioContext(),
                buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.8, audioCtx.sampleRate),
                data = buffer.getChannelData(0);

            for (let i = 0; i < data.length; i++)
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.15));

            let source = audioCtx.createBufferSource();

            source.buffer = buffer;

            let gain = audioCtx.createGain();

            gain.gain.value = 0.12;
            source.connect(gain);
            gain.connect(audioCtx.destination);
            source.start();
            source.addEventListener('ended', () => audioCtx.close());
        } catch {
            // Audio não disponível
        }
    }

    public render(context: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.active || !width || !height) return;

        if (this.isRainWeather() && !this.rainDrops.length) this.initWeatherParticles();
        if (this.weather === WeatherType.Snow && !this.snowFlakes.length)
            this.initWeatherParticles();

        let { r, g, b, a } = this.currentTint;

        if (a > 0.005) {
            context.save();
            context.fillStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a.toFixed(3)})`;
            context.fillRect(0, 0, width, height);
            context.restore();
        }

        this.drawFog(context, width, height);
        this.drawRainMist(context, width, height);
        this.drawWetGround(context, width, height);
        this.drawRainLayer(context, true);
        this.drawSplashes(context);
        this.drawRainLayer(context, false);
        this.drawSnow(context);
        this.drawLightning(context, width, height);
    }

    private drawWetGround(context: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.isRainWeather()) return;

        let isNight = this.isNightRain(),
            bandH = height * 0.22,
            shimmer = 0.04 + this.rainMistPulse * 0.025;

        context.save();

        let gradient = context.createLinearGradient(0, height - bandH, 0, height);

        if (isNight) {
            gradient.addColorStop(0, 'rgba(60, 80, 110, 0)');
            gradient.addColorStop(0.55, `rgba(90, 115, 150, ${shimmer * 0.6})`);
            gradient.addColorStop(1, `rgba(120, 145, 180, ${shimmer})`);
        } else {
            gradient.addColorStop(0, 'rgba(180, 200, 220, 0)');
            gradient.addColorStop(0.55, `rgba(200, 220, 235, ${shimmer * 0.55})`);
            gradient.addColorStop(1, `rgba(220, 235, 250, ${shimmer * 0.9})`);
        }

        context.fillStyle = gradient;
        context.fillRect(0, height - bandH, width, bandH);
        context.restore();
    }

    private drawRainMist(context: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.isRainWeather()) return;

        let isNight = this.isNightRain(),
            alpha = (isNight ? 0.06 : 0.04) + this.rainMistPulse * 0.03;

        context.save();

        let gradient = context.createLinearGradient(0, 0, 0, height);

        gradient.addColorStop(0, `rgba(${isNight ? '120, 140, 170' : '200, 220, 240'}, ${alpha})`);
        gradient.addColorStop(0.45, `rgba(${isNight ? '90, 110, 140' : '180, 200, 220'}, ${alpha * 0.7})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.restore();
    }

    private drawFog(context: CanvasRenderingContext2D, width: number, height: number): void {
        let isFog =
            this.weather === WeatherType.FogDay || this.weather === WeatherType.FogNight;

        if (!isFog) return;

        let isNight = this.weather === WeatherType.FogNight,
            baseAlpha = isNight ? 0.35 : 0.25,
            alpha = baseAlpha + this.fogPulse * 0.1;

        context.save();

        let gradient = context.createLinearGradient(0, 0, 0, height);

        if (isNight) {
            gradient.addColorStop(0, `rgba(180, 190, 210, ${alpha * 0.5})`);
            gradient.addColorStop(0.5, `rgba(140, 150, 170, ${alpha})`);
            gradient.addColorStop(1, `rgba(100, 110, 130, ${alpha * 1.2})`);
        } else {
            gradient.addColorStop(0, `rgba(230, 235, 240, ${alpha * 0.4})`);
            gradient.addColorStop(0.5, `rgba(210, 215, 220, ${alpha})`);
            gradient.addColorStop(1, `rgba(190, 195, 200, ${alpha * 0.8})`);
        }

        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.restore();
    }

    private drawRainLayer(context: CanvasRenderingContext2D, background: boolean): void {
        if (!this.rainDrops.length) return;

        let isStorm = this.weather === WeatherType.Storm,
            isNight = this.isNightRain(),
            drops = this.rainDrops.filter((drop) =>
                background ? drop.depth < 0.55 : drop.depth >= 0.55
            );

        context.save();
        context.lineCap = 'round';

        for (let drop of drops) {
            let tailX = drop.x + drop.drift * 2.5,
                tailY = drop.y + drop.length,
                alpha = Math.min(0.9, drop.opacity),
                r = isNight ? 175 : 195,
                g = isNight ? 200 : 220,
                b = isNight ? 230 : 255;

            context.lineWidth = drop.width;
            context.globalAlpha = alpha * (background ? 0.55 : 1);

            let gradient = context.createLinearGradient(drop.x, drop.y, tailX, tailY);

            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
            gradient.addColorStop(0.15, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
            gradient.addColorStop(0.85, `rgba(${r}, ${g}, ${b}, ${alpha})`);
            gradient.addColorStop(1, `rgba(${isStorm ? 220 : 240}, ${isStorm ? 235 : 248}, 255, ${alpha * 0.35})`);

            context.strokeStyle = gradient;
            context.beginPath();
            context.moveTo(drop.x, drop.y);
            context.lineTo(tailX, tailY);
            context.stroke();
        }

        context.restore();
    }

    private drawSplashes(context: CanvasRenderingContext2D): void {
        if (!this.splashes.length) return;

        let isNight = this.isNightRain();

        context.save();

        for (let splash of this.splashes) {
            let progress = splash.life / splash.maxLife,
                fade = 1 - progress,
                expand = splash.radius * (0.4 + progress * 1.6),
                alpha = splash.opacity * fade * fade,
                r = isNight ? 170 : 200,
                g = isNight ? 200 : 225,
                b = isNight ? 235 : 255;

            if (alpha <= 0.01) continue;

            context.globalAlpha = alpha;

            // Centro brilhante do impacto
            context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.85})`;
            context.beginPath();
            context.ellipse(splash.x, splash.y, expand * 0.25, expand * 0.12, 0, 0, Math.PI * 2);
            context.fill();

            // Anel do pingo no chão
            context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`;
            context.lineWidth = 1.2;
            context.beginPath();
            context.ellipse(splash.x, splash.y, expand, expand * 0.35, 0, 0, Math.PI * 2);
            context.stroke();

            // Segundo anel mais fino
            if (progress < 0.65) {
                let ring2 = expand * (1.15 + progress * 0.35);

                context.globalAlpha = alpha * 0.45;
                context.lineWidth = 0.6;
                context.beginPath();
                context.ellipse(splash.x, splash.y, ring2, ring2 * 0.3, 0, 0, Math.PI * 2);
                context.stroke();
            }

            // Micro-respingos verticais
            if (progress < 0.5) {
                let burst = (0.5 - progress) / 0.5,
                    dropH = 2.5 + burst * 5;

                context.globalAlpha = alpha * 0.9;
                context.lineWidth = 0.9;
                context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                context.beginPath();
                context.moveTo(splash.x - expand * 0.55, splash.y);
                context.lineTo(splash.x - expand * 0.55, splash.y - dropH);
                context.moveTo(splash.x, splash.y);
                context.lineTo(splash.x, splash.y - dropH * 1.15);
                context.moveTo(splash.x + expand * 0.5, splash.y);
                context.lineTo(splash.x + expand * 0.5, splash.y - dropH * 0.8);
                context.stroke();
            }
        }

        context.restore();
    }

    private drawSnow(context: CanvasRenderingContext2D): void {
        if (!this.snowFlakes.length) return;

        context.save();

        for (let flake of this.snowFlakes) {
            context.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
            context.beginPath();
            context.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
            context.fill();
        }

        context.restore();
    }

    private drawLightning(
        context: CanvasRenderingContext2D,
        width: number,
        height: number
    ): void {
        if (this.lightningAlpha <= 0) return;

        context.save();
        context.fillStyle = `rgba(220, 230, 255, ${this.lightningAlpha})`;
        context.fillRect(0, 0, width, height);
        context.restore();
    }
}
