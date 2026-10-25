import {
  projectCelestialAnnualPaths,
  resolveCelestialDirections,
  resolveMoonPhase,
  resolveSolarPeakAltitude,
  resolveSolarDaySpanDeg,
  type CelestialAnnualPaths
} from './sceneAstronomy.js';
import {
  evaluateSceneCompositionCurve,
  resolveSceneComposition,
  type SceneComposition
} from './sceneComposition.js';

export type ScenePhase = 'night' | 'dawn' | 'day' | 'dusk';
export type SceneSeason = 'winter' | 'spring' | 'summer' | 'autumn';
export interface SceneEnvironment {
  year: number; dayOfYear: number; timeHours: number;
  exposureMin: number; exposureMax: number;
  lightingIntensity: number;
  cyclePlaying: boolean; cycleDurationSeconds: number;
  sunVisible: boolean; moonVisible: boolean;
  celestialPathsVisible: boolean; latitude: number; longitude: number;
  composition: SceneComposition;
}
export interface SceneEnvironmentProjection extends SceneEnvironment {
  phase: ScenePhase; season: SceneSeason;
  monthLabel: string; dayInMonth: number; daylightIntensity: number;
  dayCycleAngleDeg: number; seasonCycleAngleDeg: number; moonCycleAngleDeg: number;
  moonPhase: number; solarDaySpanDeg: number;
  celestialAnnualPaths: CelestialAnnualPaths;
  sunDirection: { x: number; y: number; z: number };
  moonDirection: { x: number; y: number; z: number };
  effectiveExposure: number;
  solarExposureFactor: number;
  lunarExposureFactor: number;
  lightingCurveFactor: number; fogFactor: number; reflectionFactor: number;
  skyZenithColor: string; skyHorizonColor: string; skyGroundColor: string;
  fogColor: string; lightColor: string; fogNear: number; fogFar: number;
}
export const LUNAR_EXPOSURE_MAX = .45;
export const LUNAR_RENDER_LIGHT_MAX = .62;
export function projectLunarRenderLightFactor(
  solarExposureFactor:number,
  lunarExposureFactor:number
):number {
  const sunWeight=clamp(solarExposureFactor,0,1);
  const moonVisibility=1-clamp(sunWeight/.18,0,1);
  const normalizedMoonExposure=clamp(
    lunarExposureFactor/LUNAR_EXPOSURE_MAX,0,1
  );
  // Moonlight is physically faint, but a linear render weight made crescent
  // shadows disappear after night exposure and ambient fill. The perceptual
  // response preserves zero and astronomical ordering; sunlight still masks it.
  return LUNAR_RENDER_LIGHT_MAX*
    Math.pow(normalizedMoonExposure,.4)*moonVisibility;
}
export interface CelestialShadowProjection {
  direction: { x: number; y: number; z: number };
  intensityFactor: number;
  source: 'sun' | 'moon' | 'blend' | 'none';
}
export function projectCelestialShadow(
  projection: Pick<SceneEnvironmentProjection,
    'sunDirection' | 'moonDirection' | 'solarExposureFactor' | 'lunarExposureFactor'>
): CelestialShadowProjection {
  const sunWeight=clamp(projection.solarExposureFactor,0,1);
  const rawMoonWeight=projectLunarRenderLightFactor(
    sunWeight,projection.lunarExposureFactor
  );
  // One directional light cannot represent two celestial sources without
  // inventing a third direction between them. Complete the solar fade at the
  // horizon, then raise moonlight below it so specular highlights never slide
  // across the ground toward the opposite body.
  const moonHandoff=1-smoothstep(-.03,0,projection.sunDirection.y);
  const moonWeight=rawMoonWeight*moonHandoff;
  const source=sunWeight>.0001?'sun':moonWeight>.0001?'moon':'none';
  if(source==='none'){
    return {direction:{x:0,y:1,z:0},intensityFactor:0,source};
  }
  const selected=source==='sun'?projection.sunDirection:projection.moonDirection;
  const x=selected.x;
  const y=Math.max(.025,selected.y);
  const z=selected.z;
  const length=Math.hypot(x,y,z)||1;
  const intensityFactor=clamp(source==='sun'?sunWeight:moonWeight,0,1);
  return {direction:{x:x/length,y:y/length,z:z/length},intensityFactor,source};
}
export const DEFAULT_SCENE_ENVIRONMENT: SceneEnvironment = {
  year: 2026, dayOfYear: 216, timeHours: 12, exposureMin: .22, exposureMax: 1,
  lightingIntensity: 1,
  cyclePlaying: false, cycleDurationSeconds: 120,
  sunVisible: false, moonVisible: false, celestialPathsVisible: false,
  latitude: 48.8566, longitude: 2.3522,
  composition: resolveSceneComposition(null)
};
const MONTH_LABELS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'] as const;
const DAY_MS = 86_400_000;
const SCENE_STOPS = [
  { hour:0, daylight:.12, zenith:'#071326', horizon:'#172b43', ground:'#101a28', fog:'#101d2e', light:'#8da9d4' },
  { hour:5.5, daylight:.28, zenith:'#263c5e', horizon:'#d38368', ground:'#5d5360', fog:'#8d6f71', light:'#ffc29a' },
  { hour:8, daylight:.82, zenith:'#5485ba', horizon:'#bfd8e8', ground:'#8298a4', fog:'#9eb8ca', light:'#ffe2bd' },
  { hour:12, daylight:1, zenith:'#397bc0', horizon:'#c8e2f1', ground:'#91a6ae', fog:'#abc5d4', light:'#fff5dc' },
  { hour:17, daylight:.86, zenith:'#4f78aa', horizon:'#d8d9cf', ground:'#8e9698', fog:'#b4b5ae', light:'#ffe3bd' },
  { hour:20, daylight:.32, zenith:'#303c69', horizon:'#cf765f', ground:'#5c4e5c', fog:'#82656c', light:'#ffb18c' },
  { hour:22, daylight:.14, zenith:'#0b1830', horizon:'#26354d', ground:'#17202d', fog:'#19283a', light:'#91acd2' },
  { hour:24, daylight:.12, zenith:'#071326', horizon:'#172b43', ground:'#101a28', fog:'#101d2e', light:'#8da9d4' }
] as const;
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const smoothstep=(min:number,max:number,value:number)=>{const ratio=clamp((value-min)/Math.max(.000001,max-min),0,1);return ratio*ratio*(3-2*ratio);};
const finite=(value:unknown,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?value:fallback;
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export const wrapSceneValue=(value:number,modulo:number)=>((value%modulo)+modulo)%modulo;
export function sceneDaysInYear(year:number):number {
  const value=Math.round(year);
  return (value%4===0&&value%100!==0)||value%400===0?366:365;
}
function normalizeDate(year:number,dayOfYear:number):{year:number;dayOfYear:number;date:Date}{
  const safeYear=clamp(Math.round(year),1970,2400);
  const date=new Date(Date.UTC(safeYear,0,1)+Math.round(dayOfYear)*DAY_MS);
  const resolvedYear=date.getUTCFullYear();
  const day=Math.floor((Date.UTC(resolvedYear,date.getUTCMonth(),date.getUTCDate())-Date.UTC(resolvedYear,0,1))/DAY_MS);
  return {year:resolvedYear,dayOfYear:day,date};
}
function mixColor(from:string,to:string,ratio:number):string {
  const parse=(color:string)=>[1,3,5].map(offset=>Number.parseInt(color.slice(offset,offset+2),16));
  const a=parse(from),b=parse(to);
  return `#${a.map((channel,index)=>Math.round(channel+(b[index]-channel)*ratio).toString(16).padStart(2,'0')).join('')}`;
}
function resolveSeason(month:number):SceneSeason {
  return month<=1||month===11?'winter':month<=4?'spring':month<=7?'summer':'autumn';
}
function resolveSeasonalDaylight(timeHours:number,solarDaySpanDeg:number):{
  intensity:number;phase:ScenePhase;
}{
  const daylightHours=solarDaySpanDeg/15;
  const sunrise=12-daylightHours/2;
  const sunset=12+daylightHours/2;
  const twilightHours=2;
  if(timeHours>=sunrise&&timeHours<=sunset){
    const dayProgress=(timeHours-sunrise)/Math.max(.001,daylightHours);
    const solarHeight=Math.max(0,Math.sin(dayProgress*Math.PI));
    const intensity=.28+.72*Math.pow(solarHeight,.4);
    const phase:ScenePhase=timeHours<sunrise+1?'dawn':timeHours>sunset-1?'dusk':'day';
    return {intensity,phase};
  }
  const twilightDistance=timeHours<sunrise?sunrise-timeHours:timeHours-sunset;
  const twilightProgress=clamp(1-twilightDistance/twilightHours,0,1);
  return {
    intensity:.12+.16*twilightProgress,
    phase:twilightProgress>0?(timeHours<sunrise?'dawn':'dusk'):'night'
  };
}
export function resolveSceneEnvironment(value:unknown,fallbackExposure=1):SceneEnvironment {
  const source=record(value);
  const normalized=normalizeDate(finite(source.year,2026),finite(source.dayOfYear,216));
  const legacyExposure=finite(source.exposure,fallbackExposure);
  const exposureMax=clamp(finite(source.exposureMax,legacyExposure),.08,1.25);
  const exposureMin=clamp(finite(source.exposureMin,.22),.08,exposureMax);
  return {year:normalized.year,dayOfYear:normalized.dayOfYear,
    timeHours:wrapSceneValue(finite(source.timeHours,12),24),
    exposureMin,exposureMax,
    lightingIntensity:clamp(finite(source.lightingIntensity,1),0,1),
    cyclePlaying:source.cyclePlaying===true,
    cycleDurationSeconds:clamp(finite(source.cycleDurationSeconds,120),5,3600),
    sunVisible:source.sunVisible===true,
    moonVisible:source.moonVisible===true,
    celestialPathsVisible:source.celestialPathsVisible===true,
    latitude:clamp(finite(source.latitude,48.8566),-90,90),
    longitude:wrapSceneValue(finite(source.longitude,2.3522)+180,360)-180,
    composition:resolveSceneComposition(source.composition)};
}
export function projectSceneEnvironment(value:SceneEnvironment):SceneEnvironmentProjection {
  const environment=resolveSceneEnvironment(value,value.exposureMax);
  const normalized=normalizeDate(environment.year,environment.dayOfYear);
  const index=Math.max(1,SCENE_STOPS.findIndex(stop=>stop.hour>=environment.timeHours));
  const from=SCENE_STOPS[index-1],to=SCENE_STOPS[index];
  const ratio=clamp((environment.timeHours-from.hour)/Math.max(.001,to.hour-from.hour),0,1);
  const season=resolveSeason(normalized.date.getUTCMonth());
  const solarDaySpanDeg=resolveSolarDaySpanDeg(environment.year,environment.dayOfYear,environment.latitude);
  const seasonalDaylight=resolveSeasonalDaylight(environment.timeHours,solarDaySpanDeg);
  const celestialDirections=resolveCelestialDirections(environment);
  const solarPeakAltitude=resolveSolarPeakAltitude(
    environment.year,
    environment.dayOfYear,
    environment.latitude
  );
  const solarAltitude=Math.max(0,celestialDirections.sun.y);
  const solarExposureFactor=solarPeakAltitude>0
    ? Math.pow(clamp(solarAltitude/solarPeakAltitude,0,1),.62)
    : 0;
  const moonPhase=resolveMoonPhase(environment.year,environment.dayOfYear,environment.timeHours);
  const moonIllumination=(1-Math.cos(moonPhase*Math.PI*2))/2;
  // Extinction and apparent visibility evolve continuously around the horizon.
  // Keeping a small twilight band avoids the artificial knees produced by max(0, altitude).
  const lunarHorizonVisibility=smoothstep(-.08,.12,celestialDirections.moon.y);
  const lunarAltitudeFactor=Math.pow(clamp((celestialDirections.moon.y+.08)/1.08,0,1),.58);
  const lunarExposureFactor=LUNAR_EXPOSURE_MAX*
    lunarHorizonVisibility*lunarAltitudeFactor*
    Math.pow(moonIllumination,.72);
  const celestialExposureFactor=Math.max(solarExposureFactor,lunarExposureFactor);
  const exposureFactor=evaluateSceneCompositionCurve(
    environment.composition.curves.exposure,environment.timeHours,celestialExposureFactor);
  const effectiveExposure=environment.exposureMin+
    (environment.exposureMax-environment.exposureMin)*exposureFactor;
  const lightingCurveFactor=evaluateSceneCompositionCurve(
    environment.composition.curves.lighting,environment.timeHours,1);
  const defaultFogFactor=clamp((.5-seasonalDaylight.intensity)/.38,0,1);
  const fogFactor=evaluateSceneCompositionCurve(
    environment.composition.curves.fog,environment.timeHours,defaultFogFactor);
  const reflectionFactor=evaluateSceneCompositionCurve(
    environment.composition.curves.reflection,environment.timeHours,celestialExposureFactor);
  const celestialAnnualPaths=environment.celestialPathsVisible
    ? projectCelestialAnnualPaths(environment)
    : {sun:[],moon:[]};
  return {...environment,phase:seasonalDaylight.phase,season,monthLabel:MONTH_LABELS[normalized.date.getUTCMonth()]??'JAN',
    dayInMonth:normalized.date.getUTCDate(),
    daylightIntensity:seasonalDaylight.intensity,
    dayCycleAngleDeg:environment.timeHours*15-180,
    seasonCycleAngleDeg:environment.dayOfYear/sceneDaysInYear(environment.year)*360,
    moonCycleAngleDeg:environment.timeHours*15,
    moonPhase,
    solarDaySpanDeg,
    celestialAnnualPaths,
    sunDirection:celestialDirections.sun,
    moonDirection:celestialDirections.moon,
    effectiveExposure,solarExposureFactor,lunarExposureFactor,
    lightingCurveFactor,fogFactor,reflectionFactor,
    skyZenithColor:mixColor(from.zenith,to.zenith,ratio),skyHorizonColor:mixColor(from.horizon,to.horizon,ratio),
    skyGroundColor:mixColor(from.ground,to.ground,ratio),fogColor:mixColor(from.horizon,to.horizon,ratio),
    lightColor:mixColor(from.light,to.light,ratio),fogNear:3.5,fogFar:14};
}
export function advanceSceneEnvironment(value:SceneEnvironment,elapsedSeconds:number):SceneEnvironment {
  const environment=resolveSceneEnvironment(value,value.exposureMax);
  if(!environment.cyclePlaying||elapsedSeconds<=0)return environment;
  const totalHours=environment.timeHours+elapsedSeconds*24/environment.cycleDurationSeconds;
  return resolveSceneEnvironment({...environment,timeHours:wrapSceneValue(totalHours,24),dayOfYear:environment.dayOfYear+Math.floor(totalHours/24)},environment.exposureMax);
}
export function formatSceneTime(timeHours:number):string {
  const seconds=Math.round(wrapSceneValue(timeHours,24)*3600)%86400;
  return `${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor((seconds%3600)/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
export function resolveSceneDateFromNow(date=new Date()):Pick<SceneEnvironment,'year'|'dayOfYear'|'timeHours'> {
  const year=date.getFullYear();
  const dayOfYear=Math.floor((Date.UTC(year,date.getMonth(),date.getDate())-Date.UTC(year,0,1))/DAY_MS);
  return {year,dayOfYear,timeHours:date.getHours()+date.getMinutes()/60+date.getSeconds()/3600};
}
