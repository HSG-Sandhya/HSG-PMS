// Browser extensions (password managers, AI assistants, etc.) inject content
// scripts whose torn-down message channels surface as noisy "Uncaught (in
// promise)" errors in OUR console — e.g. "A listener indicated an asynchronous
// response by returning true, but the message channel closed before a response
// was received". They originate outside the app and are harmless.
//
// One definition, used by every handler here. It previously existed as three
// separate `message.includes('message channel closed')` checks across index.js
// and App.js, each free to drift.
const EXTENSION_NOISE = [
  'message channel closed',
  'Extension context',
  'chrome-extension',
  'moz-extension',
];

export const isExtensionNoise = (msg) =>
  typeof msg === 'string' && EXTENSION_NOISE.some((s) => msg.includes(s));

export default isExtensionNoise;
