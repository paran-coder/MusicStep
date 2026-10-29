import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceGate} from './2026-10-29-fast-voice.mjs';
test('eight voiced frames identify first voice and ignore preceding music scores',()=>{const gate=new VoiceGate();for(let i=0;i<10;i++)assert.equal(gate.push(i*.032,.02),null);let result;for(let i=10;i<18;i++)result=gate.push(i*.032,.9);assert.equal(result.start,.32);assert.equal(result.status,'review');});
test('an isolated loud event cannot become a voice onset',()=>{const gate=new VoiceGate();for(let i=0;i<100;i++)assert.equal(gate.push(i*.032,i===50?.95:.01),null);});
test('zero is a valid vocal start and nonfinite scores never create a candidate',()=>{let gate=new VoiceGate(),result;for(let i=0;i<8;i++)result=gate.push(i*.032,.9);assert.equal(result.start,0);gate=new VoiceGate();for(let i=0;i<50;i++)assert.equal(gate.push(i*.032,NaN),null);});
test('short dropouts are tolerated without counting silence as voiced time',()=>{const gate=new VoiceGate();let result;for(let i=0;i<10;i++)result=gate.push(i*.032,[4,5].includes(i)?.1:.9);assert.equal(result.start,0);});
test('a long gap resets onset state',()=>{const gate=new VoiceGate();for(let i=0;i<5;i++)assert.equal(gate.push(i*.032,.9),null);for(let i=5;i<10;i++)assert.equal(gate.push(i*.032,.01),null);let result;for(let i=10;i<18;i++)result=gate.push(i*.032,.9);assert.equal(result.start,.32);});
test('singing syllable gaps retain the first onset without accepting a single burst',()=>{const gate=new VoiceGate({threshold:.7,minFrames:3,maxGapFrames:1});assert.equal(gate.push(1,.99),null);assert.equal(gate.push(1.25,.9),null);assert.equal(gate.push(1.5,.02),null);assert.equal(gate.push(1.75,.91).start,1);});
