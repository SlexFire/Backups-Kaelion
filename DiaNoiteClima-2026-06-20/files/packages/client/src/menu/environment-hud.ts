import { TIME_OF_DAY_COUNT, TimeOfDay, WeatherType } from '@kaetram/common/types/environment';

import type EnvironmentController from '../renderer/environment';

const TIME_ICON_FILES = ['morning', 'afternoon', 'evening', 'night', 'deep_night'];

const WEATHER_ICON_FILES = [
    'clear',
    'rain_day',
    'rain_night',
    'fog_day',
    'fog_night',
    'snow',
    'storm'
];

const TIME_LABELS = ['Manhã', 'Tarde', 'Entardecer', 'Noite', 'Alta Madrugada'];
const WEATHER_LABELS = [
    'Limpo',
    'Chuva',
    'Chuva noturna',
    'Névoa',
    'Névoa noturna',
    'Neve',
    'Tempestade'
];

const ICON_BASE = '/img/interface/environment';

/**
 * HUD ao lado da barra de HP: fase do dia, clima e contagem regressiva.
 */
export default class EnvironmentHud {
    private container: HTMLElement = document.querySelector('#environment-hud')!;
    private bar: HTMLElement = document.querySelector('.env-hud-compact')!;
    private timeIcon: HTMLImageElement = document.querySelector('#env-time-icon')!;
    private weatherIcon: HTMLImageElement = document.querySelector('#env-weather-icon')!;
    private timer: HTMLElement = document.querySelector('#env-time-timer')!;

    private lastTimeIcon = '';
    private lastWeatherIcon = '';

    public update(environment: EnvironmentController): void {
        if (!environment.isHudVisible()) {
            this.container.classList.add('environment-hud-hidden');
            this.container.setAttribute('aria-hidden', 'true');
            return;
        }

        this.container.classList.remove('environment-hud-hidden');
        this.container.setAttribute('aria-hidden', 'false');

        let timeOfDay = environment.getTimeOfDay(),
            weather = environment.getWeather(),
            timeFile = TIME_ICON_FILES[timeOfDay],
            weatherFile = WEATHER_ICON_FILES[weather];

        if (timeFile !== this.lastTimeIcon) {
            this.timeIcon.src = `${ICON_BASE}/${timeFile}.png?v=5`;
            this.lastTimeIcon = timeFile;
        }

        if (weatherFile !== this.lastWeatherIcon) {
            this.weatherIcon.src = `${ICON_BASE}/${weatherFile}.png?v=4`;
            this.lastWeatherIcon = weatherFile;
        }

        let nextPhase = ((timeOfDay + 1) % TIME_OF_DAY_COUNT) as TimeOfDay,
            inTransition = environment.getTransition() > 0,
            phaseLabel = TIME_LABELS[timeOfDay],
            nextLabel = TIME_LABELS[nextPhase],
            weatherLabel = WEATHER_LABELS[weather],
            remaining = environment.getPhaseRemaining();

        this.timer.textContent = this.formatRemaining(remaining, environment.isCycleEnabled());

        let tip = inTransition
            ? `${phaseLabel} → ${nextLabel} (${Math.round(environment.getTransition() * 100)}%) · ${weatherLabel}`
            : `${phaseLabel} · próxima: ${nextLabel} · ${weatherLabel}`;

        this.bar.setAttribute('aria-label', tip);
    }

    private formatRemaining(remaining: number, cycleEnabled: boolean): string {
        if (!cycleEnabled || remaining < 0) return '—';

        let totalSeconds = Math.ceil(remaining / 1000),
            minutes = Math.floor(totalSeconds / 60),
            seconds = totalSeconds % 60;

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
