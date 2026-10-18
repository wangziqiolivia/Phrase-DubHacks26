// Offline only: no .env loading, live camera, database or external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const project = process.argv[2] || path.resolve(__dirname, '..');
const sourceRoot = process.argv[3] || project;
const ts = require(path.join(project, 'node_modules/typescript'));
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.require = (name) => {
    if (name.startsWith('@/')) return load(path.join(sourceRoot, 'src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name) + '.ts');
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
const src = (file) => load(path.join(sourceRoot, 'src', file));
async function main() {
  const feedback = { scene_description: 'A cup.', suggested_expression: 'I hold a cup.', explanation: 'Name it.', useful_phrases: ['hold a cup'], visual_context_available: true };
  const video = src('app/api/scene/video/route.ts');
  const frames = src('app/api/scene/route.ts');
  const originalFetch = global.fetch;
  let calls = [];
  process.env.PERCEPTRON_API_KEY = 'offline-placeholder';
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(feedback) } }] });
  };
  const jpeg = 'data:image/jpeg;base64,/9j/2Q==';
  const frameRequest = { text: 'I hold this.', language: 'English', frames: [{ timestamp_ms: 0, image_url: jpeg }, { timestamp_ms: 500, image_url: jpeg }] };
  try {
    const form = new FormData();
    const videoBytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 1, 2, 3]);
    form.set('video', new Blob([videoBytes], { type: 'video/webm' }), 'recording.webm');
    form.set('text', 'I hold this.'); form.set('language', 'English');
    const result = await video.POST(new Request('http://test/api/scene/video', { method: 'POST', body: form }));
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), feedback);
    const media = calls[0].messages[1].content[0];
    assert.equal(media.type, 'video_url');
    assert.equal(media.video_url.url, 'data:video/webm;base64,' + Buffer.from(videoBytes).toString('base64'));
    assert.match(calls[0].messages[0].content, /complete video/i);
    const liveResult = await frames.POST(new Request('http://test/api/scene', { method: 'POST', body: JSON.stringify(frameRequest) }));
    assert.equal(liveResult.status, 200);
    assert.equal(calls[1].messages[1].content[0].type, 'video_frames');
    assert.match(calls[1].messages[0].content, /live/i);
    assert.equal((await frames.POST(new Request('http://test/api/scene', { method: 'POST', body: JSON.stringify({ ...frameRequest, frames: [{ timestamp_ms: 0, image_url: 'http://localhost/a.jpg' }] }) }))).status, 400);
    assert.equal(calls.length, 2);
    const single = await frames.POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ ...frameRequest, frames: frameRequest.frames.slice(0, 1) }) }));
    assert.equal(single.status, 200);
    assert.equal(calls[2].messages[1].content[0].type, 'image_url', 'A final single frame must still be sent');
    assert.equal((await frames.POST(new Request('http://test', { method: 'POST', body: 'x'.repeat(2 * 1024 * 1024 + 1) }))).status, 413);
    const bad = new FormData(); bad.set('video', new Blob(['not video'], { type: 'video/webm' }), 'bad.webm'); bad.set('language', 'English');
    assert.equal((await video.POST(new Request('http://test/api/scene/video', { method: 'POST', body: bad }))).status, 400);
    const { MAX_VIDEO_BODY_BYTES } = src('lib/scene-feedback.ts');
    assert.equal((await video.POST(new Request('http://test/api/scene/video', { method: 'POST', body: 'bad', headers: { 'content-length': String(MAX_VIDEO_BODY_BYTES + 1) } }))).status, 413);
    global.fetch = async () => Response.json({ choices: [{ finish_reason: 'length' }] });
    assert.equal((await frames.POST(new Request('http://test', { method: 'POST', body: JSON.stringify(frameRequest) }))).status, 502);
    global.fetch = async () => new Response('', { status: 429 });
    assert.equal((await frames.POST(new Request('http://test', { method: 'POST', body: JSON.stringify(frameRequest) }))).status, 429);
    delete process.env.PERCEPTRON_API_KEY;
    assert.equal((await frames.POST(new Request('http://test', { method: 'POST', body: JSON.stringify(frameRequest) }))).status, 503);
  } finally { global.fetch = originalFetch; delete process.env.PERCEPTRON_API_KEY; }

  const { startLiveSceneCapture } = src('lib/live-scene-capture.ts');
  const originalDocument = global.document;
  const originalInterval = global.setInterval;
  const originalClear = global.clearInterval;
  let tick; let captureCount = 0; let paused = false; let release;
  let sendCount = 0; let results = 0; let sentCount = 0;
  global.setInterval = (callback, ms) => { assert.equal(ms, 500); tick = callback; return 1; };
  global.clearInterval = () => {};
  global.document = { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ drawImage() { captureCount++; } }), toDataURL: () => jpeg }) };
  try {
    const session = startLiveSceneCapture({ videoWidth: 1280, videoHeight: 720, readyState: 2 }, {
      isPaused: () => paused, getText: () => 'I hold this.',
      sendFrames: async (batch) => { sendCount++; sentCount += batch.length; await new Promise((resolve) => { release = resolve; }); return feedback; },
      onFeedback: () => { results++; }, onError: (error) => { throw error; }, onStatus: () => {},
    });
    for (let i = 0; i < 4; i++) tick();
    assert.equal(captureCount, 4); assert.equal(sendCount, 1);
    for (let i = 0; i < 20; i++) tick();
    assert.equal(sendCount, 1, 'Only one request may be in flight');
    paused = true; tick(); assert.equal(captureCount, 24);
    session.finish(); release(); await new Promise(setImmediate);
    assert.equal(sendCount, 2); assert(sentCount <= 10, 'Pending frames must be bounded');
    session.abort(); release(); await new Promise(setImmediate);
    assert.equal(results, 1, 'Canceled session must ignore late responses');
  } finally { global.document = originalDocument; global.setInterval = originalInterval; global.clearInterval = originalClear; }
  console.log('Full-video payload, live frame batching, backpressure, cancellation, and route validation passed offline.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
