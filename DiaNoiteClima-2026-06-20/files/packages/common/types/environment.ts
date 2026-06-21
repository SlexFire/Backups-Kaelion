/** Períodos do ciclo dia/noite. */
export enum TimeOfDay {
    Morning = 0,
    Afternoon = 1,
    Evening = 2,
    Night = 3,
    DeepNight = 4
}

/** Quantidade de fases no ciclo (Manhã → … → Alta Madrugada → Manhã). */
export const TIME_OF_DAY_COUNT = 5;

/** Tipos de clima disponíveis. */
export enum WeatherType {
    Clear = 0,
    RainDay = 1,
    RainNight = 2,
    FogDay = 3,
    FogNight = 4,
    Snow = 5,
    Storm = 6
}

/** Duração de cada período em milissegundos (tempo real). */
export const TIME_PHASE_DURATION: Record<TimeOfDay, number> = {
    [TimeOfDay.Morning]: 120_000,
    [TimeOfDay.Afternoon]: 180_000,
    [TimeOfDay.Evening]: 90_000,
    [TimeOfDay.Night]: 150_000,
    [TimeOfDay.DeepNight]: 90_000
};

/** Duração da transição suave entre períodos (ms). */
export const TIME_TRANSITION_DURATION = 30_000;

/** Nomes legíveis para comandos de admin. */
export const TIME_OF_DAY_NAMES: Record<string, TimeOfDay> = {
    morning: TimeOfDay.Morning,
    manha: TimeOfDay.Morning,
    afternoon: TimeOfDay.Afternoon,
    tarde: TimeOfDay.Afternoon,
    evening: TimeOfDay.Evening,
    entardecer: TimeOfDay.Evening,
    night: TimeOfDay.Night,
    noite: TimeOfDay.Night,
    deep_night: TimeOfDay.DeepNight,
    deepnight: TimeOfDay.DeepNight,
    alta_madrugada: TimeOfDay.DeepNight,
    madrugada: TimeOfDay.DeepNight,
    latenight: TimeOfDay.DeepNight
};

export const WEATHER_TYPE_NAMES: Record<string, WeatherType> = {
    clear: WeatherType.Clear,
    limpo: WeatherType.Clear,
    none: WeatherType.Clear,
    rain_day: WeatherType.RainDay,
    'chuva_dia': WeatherType.RainDay,
    rain_night: WeatherType.RainNight,
    'chuva_noite': WeatherType.RainNight,
    fog_day: WeatherType.FogDay,
    'nevoa_dia': WeatherType.FogDay,
    fog_night: WeatherType.FogNight,
    'nevoa_noite': WeatherType.FogNight,
    snow: WeatherType.Snow,
    neve: WeatherType.Snow,
    storm: WeatherType.Storm,
    tempestade: WeatherType.Storm
};

export interface EnvironmentState {
    timeOfDay: TimeOfDay;
    transition: number;
    weather: WeatherType;
    cycleEnabled: boolean;
    /** Milissegundos até a próxima fase (ou fim da transição). -1 se ciclo desligado. */
    phaseRemaining: number;
}
