import assert from 'node:assert/strict';
import { attachTranslatorLegacyFacade, createTranslatorState } from '../src/app-shell/translator-state.store';

const translator = createTranslatorState('de');
const legacy = attachTranslatorLegacyFacade({ status: 'ready' }, translator);
assert.equal(legacy.translatorTargetLanguage, 'de');
legacy.translatorText = 'legacy write';
assert.equal(translator.translatorText, 'legacy write');
translator.translatorResult = 'canonical write';
assert.equal(legacy.translatorResult, 'canonical write');
assert.equal(Object.prototype.hasOwnProperty.call(legacy, 'translatorText'), true);
const descriptor = Object.getOwnPropertyDescriptor(legacy, 'translatorText');
assert.equal(typeof descriptor?.get, 'function');
assert.equal(typeof descriptor?.set, 'function');
assert.equal('value' in (descriptor ?? {}), false);
console.log('SR-08A Translator composed state and legacy facade: PASS');
