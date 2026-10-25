import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveSceneEnvironment,projectSceneEnvironment,advanceSceneEnvironment,projectCelestialShadow,resolveSceneComposition,evaluateSceneCompositionCurve,serializeSceneComposition} from '../dist/index.js';
const baseline=JSON.parse(readFileSync(new URL('./fixtures/sceneEnvironmentBaseline.json',import.meta.url),'utf8'));
test('scene evaluation retains the pre-migration behavior without importing any UI surface',()=>{
 for(const row of baseline.environments){
  const state=resolveSceneEnvironment(row.input),p=projectSceneEnvironment(state);
  const {celestialAnnualPaths,...projection}=p;
  assert.deepEqual(projection,row.projection);
  assert.deepEqual(projectCelestialShadow(p),row.shadow);
  assert.deepEqual(advanceSceneEnvironment(state,3.5),row.advance);
 }
});
test('scene curves preserve easing, wrap boundaries and legacy normalization',()=>{
 for(const row of baseline.curves)for(const sample of row.samples)assert.equal(evaluateSceneCompositionCurve(row.keys,sample.time,.5),sample.value);
 for(const row of baseline.legacy)assert.deepEqual(serializeSceneComposition(resolveSceneComposition(row.input)),row.resolved);
});
test('scene contract has no UI, Svelte, renderer or product dependency',()=>{
 for(const name of ['Composition','Environment','Astronomy']){
  const source=readFileSync(new URL(`../dist/scene${name}.js`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/from\s+['"][^'"]*(?:@konitif\/ui|svelte|viewer-3d|@maxtronics)/);
 }
});
