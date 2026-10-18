// Offline tests. Uses the existing TypeScript installation; no API or database calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const project = process.argv[2] || path.resolve(__dirname, '..');
const ts = require(path.join(project, 'node_modules/typescript'));
function load(file, overrides = {}) {
  const sources = { 'scene-feedback.ts': 'src/lib/scene-feedback.ts', 'video-frames.ts': 'src/lib/video-frames.ts', 'scene-route.ts': 'src/app/api/scene/route.ts', 'use-scene-feedback.ts': 'src/hooks/use-scene-feedback.ts' };
  const filename = fs.existsSync(path.join(__dirname, file)) ? path.join(__dirname, file) : path.join(project, sources[file]);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = module.paths;
  mod.require = (name) => Object.hasOwn(overrides, name) ? overrides[name] : name.endsWith('scene-feedback') ? load('scene-feedback.ts') : require(name);
  mod._compile(compiled, filename);
  return mod.exports;
}
async function main() {
  const { isSceneRequest, isSceneFeedback, sampleTimes } = load('scene-feedback.ts');
  const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
  const valid = { text: 'I hold a cup.', language: 'English', frames: [
    { timestamp_ms: 100, image_url: jpeg }, { timestamp_ms: 200, image_url: jpeg },
  ] };
  assert.equal(isSceneRequest(valid), true);
  for (const invalid of [
    { ...valid, frames: [] }, { ...valid, frames: Array(7).fill(valid.frames[0]) },
    { ...valid, frames: [...valid.frames].reverse() },
    { ...valid, frames: [{ timestamp_ms: 0, image_url: 'https://localhost/image.jpg' }] },
    { ...valid, frames: [{ timestamp_ms: -1, image_url: jpeg }] },
    { ...valid, text: 'x'.repeat(4001) }, { ...valid, language: 'unknown' },
  ]) assert.equal(isSceneRequest(invalid), false);
  const feedback = { scene_description: 'A cup is visible.', suggested_expression: 'I am holding a cup.',
    explanation: 'Name the object.', useful_phrases: ['hold a cup'], visual_context_available: true };
  assert.equal(isSceneFeedback(feedback), true);
  assert.equal(isSceneFeedback({ ...feedback, useful_phrases: [3] }), false);
  assert.equal(isSceneFeedback({ ...feedback, visual_context_available: 'yes' }), false);
  assert.equal(sampleTimes(0.1).length, 2);
  assert.equal(sampleTimes(60).length, 6);
  assert(sampleTimes(10).every((t, i, list) => t > 0 && t < 10 && (!i || t > list[i - 1])));
  assert.throws(() => sampleTimes(Infinity));

  // Exercise the extraction lifecycle with a browser stand-in, not a live camera.
  const { extractVideoFrames } = load('video-frames.ts');
  const originalDocument = global.document;
  const originalCreateUrl = URL.createObjectURL;
  const originalRevokeUrl = URL.revokeObjectURL;
  let revoked = 0;
  class FakeVideo extends EventTarget {
    duration = 12; videoWidth = 1920; videoHeight = 1080;
    load() { queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
    set currentTime(value) { this.time = value; queueMicrotask(() => this.dispatchEvent(new Event('seeked'))); }
    pause() {} removeAttribute() {}
  }
  global.document = { createElement: (tag) => tag === 'video' ? new FakeVideo() : {
    getContext: () => ({ drawImage() {} }), toDataURL: () => jpeg,
  } };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => { revoked++; };
  try {
    const frames = await extractVideoFrames(new Blob(['test'], { type: 'video/webm' }), new AbortController().signal);
    assert.equal(frames.length, 3);
    assert(frames[0].timestamp_ms < frames[1].timestamp_ms);
    assert.equal(revoked, 1);
    const controller = new AbortController();
    const pending = extractVideoFrames(new Blob(['test'], { type: 'video/webm' }), controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(revoked, 2);
  } finally {
    global.document = originalDocument;
    URL.createObjectURL = originalCreateUrl;
    URL.revokeObjectURL = originalRevokeUrl;
  }

  const { POST } = load('scene-route.ts');
  const originalFetch = global.fetch;
  let calls = 0;
  process.env.PERCEPTRON_API_KEY = 'offline-test-placeholder';
  global.fetch = async (_url, options) => {
    calls++;
    const payload = JSON.parse(options.body);
    assert.equal(payload.messages[1].content[0].type, 'video_frames');
    assert.equal(payload.messages[1].content[0].video_frames.frames.length, 2);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(feedback) } }] });
  };
  const request = (body) => new Request('http://test/api/scene', { method: 'POST', body: JSON.stringify(body) });
  try {
    assert.equal((await POST(request({ ...valid, frames: [] }))).status, 400);
    assert.equal(calls, 0);
    assert.equal((await POST(new Request('http://test/api/scene', { method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 1) }))).status, 413);
    const response = await POST(request(valid));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), feedback);
    global.fetch = async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] });
    assert.equal((await POST(request(valid))).status, 502);
    delete process.env.PERCEPTRON_API_KEY;
    assert.equal((await POST(request(valid))).status, 503);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PERCEPTRON_API_KEY;
  }

  // A provider may finish after a newer recording starts: the old result
  // must never replace the current recording's feedback.
  let effect;
  let stateValue;
  let finishOldRequest;
  const { useSceneFeedback } = load('use-scene-feedback.ts', {
    react: {
      useState(initial) { return typeof initial === 'number' ? [initial, () => {}] : [null, (value) => { stateValue = value; }]; },
      useEffect(callback) { effect = callback; },
    },
    '@/lib/video-frames': { extractVideoFrames: async () => valid.frames },
  });
  global.fetch = () => new Promise((resolve) => { finishOldRequest = resolve; });
  try {
    useSceneFeedback({ id: 'old', mode: 'video', blob: new Blob(['test']), transcript: 'Original' }, true, 'English');
    const cleanup = effect();
    await new Promise(setImmediate);
    assert.equal(stateValue.status, 'analyzing');
    cleanup();
    finishOldRequest(Response.json(feedback));
    await new Promise(setImmediate);
    assert.equal(stateValue.status, 'analyzing', 'Aborted request must not publish completed feedback');
  } finally {
    global.fetch = originalFetch;
  }
  console.log('Scene validation, sampling and mocked API tests passed. No external calls.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
