import {evaluateInterpolation as applyTimelineInterpolationProgress} from '@konitif/core';

export type SceneCompositionBuiltInTrackId =
  | 'solar'
  | 'lunar'
  | 'exposure'
  | 'lighting'
  | 'fog'
  | 'reflection';

export type SceneCompositionParameterTrackId = `parameter:${string}`;
export type SceneCompositionTrackId =
  | SceneCompositionBuiltInTrackId
  | SceneCompositionParameterTrackId;

export type SceneCompositionEditableTrackId =
  | Exclude<SceneCompositionBuiltInTrackId, 'solar' | 'lunar'>
  | SceneCompositionParameterTrackId;

export interface SceneCompositionParameterTrack {
  id: SceneCompositionParameterTrackId;
  endpointId: string;
  label: string;
  color: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}

export interface SceneCompositionBuiltInTrack {
  id: SceneCompositionBuiltInTrackId;
  endpointId: string;
  role: 'observation' | 'authority';
  label: string;
  color: string;
  referenceLabel?: string;
}

export type SceneCompositionEasing =
  | 'smooth'
  | 'linear'
  | 'step'
  | 'ease_in'
  | 'ease_out'
  | 'ease_in_out';

export type SceneCompositionTangentMode = 'auto' | 'smooth' | 'free';

export interface SceneCompositionKey {
  timeHours: number;
  value: number;
  interpolationToNext?: SceneCompositionEasing;
  tangentMode?: SceneCompositionTangentMode;
  inTangent?: number;
  outTangent?: number;
}

export interface SceneComposition {
  hiddenTrackIds: SceneCompositionTrackId[];
  parameterTracks: SceneCompositionParameterTrack[];
  curves: Partial<Record<SceneCompositionEditableTrackId, SceneCompositionKey[]>>;
}

export const SCENE_COMPOSITION_BUILT_IN_TRACKS: readonly SceneCompositionBuiltInTrack[] = [
  { id: 'solar', endpointId: 'astronomy.solarExposureFactor', role: 'observation', label: 'Soleil', color: '#ffd45b', referenceLabel: 'réel' },
  { id: 'lunar', endpointId: 'astronomy.lunarRenderLightFactor', role: 'observation', label: 'Lune', color: '#a9bfff', referenceLabel: 'effectif' },
  { id: 'exposure', endpointId: 'viewer.scene.effectiveExposureFactor', role: 'authority', label: 'Exposition', color: '#38dff5' },
  { id: 'lighting', endpointId: 'viewer.scene.lightingFactor', role: 'authority', label: 'Lumière', color: '#73f0a5' },
  { id: 'fog', endpointId: 'viewer.scene.fogNightFactor', role: 'authority', label: 'Fog', color: '#b58cff' },
  { id: 'reflection', endpointId: 'viewer.scene.reflectionFactor', role: 'authority', label: 'Reflet', color: '#ff9f5b' }
];

export const SCENE_COMPOSITION_TRACK_IDS = SCENE_COMPOSITION_BUILT_IN_TRACKS
  .map((track) => track.id);

export const SCENE_COMPOSITION_EDITABLE_TRACK_IDS = SCENE_COMPOSITION_BUILT_IN_TRACKS
  .filter((track) => track.role === 'authority')
  .map((track) => track.id) as Exclude<SceneCompositionBuiltInTrackId, 'solar' | 'lunar'>[];

export const DEFAULT_SCENE_COMPOSITION: SceneComposition = {
  hiddenTrackIds: [],
  parameterTracks: [],
  curves: {
    exposure: [{ timeHours: 0, value: 0.1888 }],
    lighting: [{ timeHours: 0, value: 1 }],
    fog: [{ timeHours: 0, value: 0.63 }],
    reflection: [{ timeHours: 0, value: 0.1888 }]
  }
};

export const SCENE_PARAMETER_TRACK_IDS = {
  materialEnvironmentIntensity: 'parameter:material.environmentIntensity',
  materialRoughnessScale: 'parameter:material.roughnessScale',
  materialMetalnessScale: 'parameter:material.metalnessScale',
  materialClearcoatScale: 'parameter:material.clearcoatScale'
} as const satisfies Record<string, SceneCompositionParameterTrackId>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const wrapHours = (value: number): number => ((value % 24) + 24) % 24;

export function resolveSceneComposition(value: unknown): SceneComposition {
  const source = isRecord(value) ? value : {};
  const parameterTracks = resolveParameterTracks(source.parameterTracks);
  const allowedTrackIds = new Set<SceneCompositionTrackId>([
    ...SCENE_COMPOSITION_TRACK_IDS,
    ...parameterTracks.map((track) => track.id)
  ]);
  const hiddenTrackIds = Array.isArray(source.hiddenTrackIds)
    ? source.hiddenTrackIds.filter((trackId): trackId is SceneCompositionTrackId =>
        typeof trackId === 'string' && allowedTrackIds.has(trackId as SceneCompositionTrackId))
    : [];
  const sourceCurves = isRecord(source.curves) ? source.curves : {};
  const curves: SceneComposition['curves'] = {};
  for (const trackId of [...SCENE_COMPOSITION_EDITABLE_TRACK_IDS, ...parameterTracks.map((track) => track.id)]) {
    const curve = resolveSceneCompositionCurve(sourceCurves[trackId]);
    if (curve.length >= 1) curves[trackId] = curve;
  }
  return { hiddenTrackIds: [...new Set(hiddenTrackIds)], parameterTracks, curves };
}

export function listSceneCompositionTrackIds(
  composition: SceneComposition
): SceneCompositionTrackId[] {
  const observedTrackIds = SCENE_COMPOSITION_BUILT_IN_TRACKS
    .filter((track) => track.role === 'observation')
    .map((track) => track.id);
  const subscribedBuiltInTrackIds = SCENE_COMPOSITION_EDITABLE_TRACK_IDS
    .filter((trackId) => (composition.curves[trackId]?.length ?? 0) > 0);
  return [
    ...observedTrackIds,
    ...subscribedBuiltInTrackIds,
    ...composition.parameterTracks.map((track) => track.id)
  ];
}

export function isSceneCompositionEditableTrackId(
  trackId: SceneCompositionTrackId,
  composition?: SceneComposition
): trackId is SceneCompositionEditableTrackId {
  return SCENE_COMPOSITION_EDITABLE_TRACK_IDS.includes(
    trackId as Exclude<SceneCompositionBuiltInTrackId, 'solar' | 'lunar'>
  ) || composition?.parameterTracks.some((track) => track.id === trackId) === true;
}

export function setSceneCompositionParameterTrack(
  composition: SceneComposition,
  definition: SceneCompositionParameterTrack,
  initialValue: number
): SceneComposition {
  const resolved = resolveSceneComposition(composition);
  const normalized = clamp01((initialValue - definition.min) / Math.max(0.000001, definition.max - definition.min));
  return resolveSceneComposition({
    ...resolved,
    parameterTracks: [...resolved.parameterTracks.filter((track) => track.id !== definition.id), definition],
    curves: { ...resolved.curves, [definition.id]: [{ timeHours: 0, value: normalized }] }
  });
}

export function removeSceneCompositionParameterTrack(
  composition: SceneComposition,
  trackId: SceneCompositionParameterTrackId
): SceneComposition {
  const resolved = resolveSceneComposition(composition);
  const curves = { ...resolved.curves };
  delete curves[trackId];
  return resolveSceneComposition({
    ...resolved,
    hiddenTrackIds: resolved.hiddenTrackIds.filter((id) => id !== trackId),
    parameterTracks: resolved.parameterTracks.filter((track) => track.id !== trackId),
    curves
  });
}

export function evaluateSceneCompositionParameterTrack(
  composition: SceneComposition,
  trackId: SceneCompositionParameterTrackId,
  timeHours: number,
  fallback: number
): number {
  const definition = composition.parameterTracks.find((track) => track.id === trackId);
  if (!definition) return fallback;
  const normalizedFallback = clamp01((fallback - definition.min) / Math.max(0.000001, definition.max - definition.min));
  const normalized = evaluateSceneCompositionCurve(composition.curves[trackId], timeHours, normalizedFallback);
  return definition.min + normalized * (definition.max - definition.min);
}

export function resolveSceneCompositionCurve(value: unknown): SceneCompositionKey[] {
  if (!Array.isArray(value)) return [];
  const keys = value
    .filter(isRecord)
    .map((key) => ({
      timeHours: typeof key.timeHours === 'number' && Number.isFinite(key.timeHours)
        ? wrapHours(Math.min(24, Math.max(0, key.timeHours)))
        : 0,
      value: typeof key.value === 'number' && Number.isFinite(key.value) ? clamp01(key.value) : 0,
      ...(isSceneCompositionEasing(key.interpolationToNext)
        ? { interpolationToNext: key.interpolationToNext }
        : {}),
      ...(isSceneCompositionTangentMode(key.tangentMode) ? { tangentMode: key.tangentMode } : {}),
      ...(typeof key.inTangent === 'number' && Number.isFinite(key.inTangent)
        ? { inTangent: Math.min(4, Math.max(-4, key.inTangent)) }
        : {}),
      ...(typeof key.outTangent === 'number' && Number.isFinite(key.outTangent)
        ? { outTangent: Math.min(4, Math.max(-4, key.outTangent)) }
        : {})
    }))
    .sort((left, right) => left.timeHours - right.timeHours);
  return keys.filter(
    (key, index) => index === 0 || Math.abs(key.timeHours - keys[index - 1].timeHours) > 0.001
  );
}

export function removeSceneCompositionKey(
  curve: readonly SceneCompositionKey[],
  keyIndex: number
): SceneCompositionKey[] {
  const keys = resolveSceneCompositionCurve(curve);
  if (keys.length <= 1 || !Number.isInteger(keyIndex) || keyIndex < 0 || keyIndex >= keys.length) {
    return keys;
  }
  return keys.filter((_, index) => index !== keyIndex);
}

export function resolveSceneCompositionTangents(
  curve: readonly SceneCompositionKey[]
): Array<{ inTangent: number; outTangent: number }> {
  if (curve.length < 2) return curve.map(() => ({ inTangent: 0, outTangent: 0 }));
  const automatic = curve.map((key, index) => {
    const previousIndex = (index - 1 + curve.length) % curve.length;
    const nextIndex = (index + 1) % curve.length;
    const previous = curve[previousIndex];
    const next = curve[nextIndex];
    if (!previous || !next) return 0;
    const previousTime = previousIndex > index ? previous.timeHours - 24 : previous.timeHours;
    const nextTime = nextIndex < index ? next.timeHours + 24 : next.timeHours;
    const previousSpan = Math.max(0.001, key.timeHours - previousTime);
    const nextSpan = Math.max(0.001, nextTime - key.timeHours);
    const previousSlope = (key.value - previous.value) / previousSpan;
    const nextSlope = (next.value - key.value) / nextSpan;
    if (previousSlope === 0 || nextSlope === 0 || previousSlope * nextSlope <= 0) return 0;
    const previousWeight = 2 * nextSpan + previousSpan;
    const nextWeight = nextSpan + 2 * previousSpan;
    return (previousWeight + nextWeight) /
      (previousWeight / previousSlope + nextWeight / nextSlope);
  });

  return curve.map((key, index) => {
    const auto = automatic[index] ?? 0;
    if ((key.tangentMode ?? 'auto') === 'auto') return { inTangent: auto, outTangent: auto };
    const incoming = key.inTangent ?? key.outTangent ?? auto;
    const outgoing = key.outTangent ?? key.inTangent ?? auto;
    if (key.tangentMode === 'free') return { inTangent: incoming, outTangent: outgoing };
    const shared = typeof key.outTangent === 'number' ? outgoing : incoming;
    return { inTangent: shared, outTangent: shared };
  });
}

export function evaluateSceneCompositionCurve(
  curve: readonly SceneCompositionKey[] | undefined,
  timeHours: number,
  fallback: number
): number {
  if (!curve || curve.length === 0) return clamp01(fallback);
  const keys = resolveSceneCompositionCurve(curve);
  if (keys.length < 2) return clamp01(keys[0]?.value ?? fallback);
  const time = wrapHours(timeHours);
  let rightIndex = keys.findIndex((key) => key.timeHours >= time);
  let leftIndex: number;
  let sampleTime = time;
  let rightTime: number;
  if (rightIndex < 0) {
    leftIndex = keys.length - 1;
    rightIndex = 0;
    rightTime = keys[0].timeHours + 24;
  } else if (rightIndex === 0) {
    leftIndex = keys.length - 1;
    sampleTime += 24;
    rightTime = keys[0].timeHours + 24;
  } else {
    leftIndex = rightIndex - 1;
    rightTime = keys[rightIndex].timeHours;
  }
  const left = keys[leftIndex];
  const right = keys[rightIndex];
  const span = Math.max(0.001, rightTime - left.timeHours);
  const ratio = Math.min(1, Math.max(0, (sampleTime - left.timeHours) / span));
  const interpolation = left.interpolationToNext ?? 'smooth';
  if (interpolation === 'smooth') {
    const tangents = resolveSceneCompositionTangents(keys);
    const leftTangent = tangents[leftIndex]?.outTangent ?? 0;
    const rightTangent = tangents[rightIndex]?.inTangent ?? 0;
    const ratioSquared = ratio * ratio;
    const ratioCubed = ratioSquared * ratio;
    const value = (2 * ratioCubed - 3 * ratioSquared + 1) * left.value +
      (ratioCubed - 2 * ratioSquared + ratio) * span * leftTangent +
      (-2 * ratioCubed + 3 * ratioSquared) * right.value +
      (ratioCubed - ratioSquared) * span * rightTangent;
    return clamp01(value);
  }
  const easedRatio = applyTimelineInterpolationProgress(
    interpolation,
    ratio
  );
  return clamp01(left.value + (right.value - left.value) * easedRatio);
}

export function serializeSceneComposition(
  composition: SceneComposition
): Record<string, unknown> {
  return {
    hiddenTrackIds: [...composition.hiddenTrackIds],
    parameterTracks: composition.parameterTracks.map((track) => ({ ...track })),
    curves: Object.fromEntries(Object.entries(composition.curves).map(([trackId, keys]) => [
      trackId,
      keys?.map((key) => ({ ...key })) ?? []
    ]))
  };
}

function resolveParameterTracks(value: unknown): SceneCompositionParameterTrack[] {
  if (!Array.isArray(value)) return [];
  const tracks = value.filter(isRecord).flatMap((track) => {
    if (
      typeof track.id !== 'string' || !track.id.startsWith('parameter:') ||
      typeof track.endpointId !== 'string' || typeof track.label !== 'string' || typeof track.color !== 'string' ||
      typeof track.min !== 'number' || !Number.isFinite(track.min) ||
      typeof track.max !== 'number' || !Number.isFinite(track.max) || track.max <= track.min ||
      typeof track.step !== 'number' || !Number.isFinite(track.step) || track.step <= 0
    ) return [];
    return [{
      id: track.id as SceneCompositionParameterTrackId,
      endpointId: track.endpointId,
      label: track.label,
      color: track.color,
      min: track.min,
      max: track.max,
      step: track.step,
      ...(typeof track.suffix === 'string' ? { suffix: track.suffix } : {})
    }];
  });
  return [...new Map(tracks.map((track) => [track.id, track])).values()];
}

function isSceneCompositionEasing(value: unknown): value is SceneCompositionEasing {
  return value === 'smooth' ||
    value === 'linear' ||
    value === 'step' ||
    value === 'ease_in' ||
    value === 'ease_out' ||
    value === 'ease_in_out';
}

function isSceneCompositionTangentMode(value: unknown): value is SceneCompositionTangentMode {
  return value === 'auto' || value === 'smooth' || value === 'free';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
