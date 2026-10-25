import type {SceneComposition} from './sceneComposition.js';
export interface SceneGroundSettings {size:number;tileSize:number;roughness:number;metalness:number;reflectionOpacity:number;variationStrength:number}
export const defaultSceneGroundSettings:SceneGroundSettings={size:160,tileSize:.1,roughness:.58,metalness:.04,reflectionOpacity:.14,variationStrength:.11};
export interface SceneLayers {ground:boolean;grid:boolean;axes:boolean;fog:boolean;fogDensity:number|null}
export const defaultSceneLayers:SceneLayers={ground:true,grid:true,axes:true,fog:true,fogDensity:null};
export interface SceneCompositionPreset {id:string;name:string;builtIn:boolean;composition:SceneComposition}
