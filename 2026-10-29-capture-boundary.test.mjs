import test from 'node:test';
import assert from 'node:assert/strict';
import {captureNextLyric} from './2026-10-29-capture-boundary.mjs';
const cues=[{start:.08,end:4.548,text:'first'},{start:4.548,end:23.217,text:'second'},{start:23.217,end:29.202,text:'third'}];
test('one captured playback position sets first end and second start together',()=>{const out=captureNextLyric(cues,11.47,17.2344,40);assert.equal(out.boundary,17.234);assert.deepEqual(out.cues[0],{start:11.47,end:17.234,text:'first'});assert.deepEqual(out.cues[1],{start:17.234,end:23.217,text:'second'});assert.deepEqual(out.cues[2],cues[2]);assert.equal(cues[0].end,4.548);});
test('capture before the first voice cannot overwrite existing caption times',()=>{for(const time of [0,11.47,11.4701,NaN])assert.throws(()=>captureNextLyric(cues,11.47,time,40),/두 번째 가사/);assert.equal(cues[1].start,4.548);});
test('capture after the second caption or outside the song is rejected clearly',()=>{for(const time of [23.217,24,Infinity])assert.throws(()=>captureNextLyric(cues,11.47,time,40));assert.throws(()=>captureNextLyric(cues,11.47,18,17));});
test('a single-caption song is not assigned a nonexistent next lyric',()=>{assert.throws(()=>captureNextLyric([cues[0]],1,3,40),/두 번째 가사/);});
