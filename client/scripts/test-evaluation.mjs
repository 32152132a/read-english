import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

async function setup({ miniProgram = true, respond } = {}) {
  let source = await readFile(new URL('../pages/evaluation/use-word-evaluation.uts', import.meta.url), 'utf8')
  source = source.replace("import { request } from '../../src/services/http.uts'", '')
    .replace(/\/\/ #ifdef MP-WEIXIN([\s\S]*?)\/\/ #endif/g, (_, body) => miniProgram ? body : '')
  const callbacks = {}, lifecycle = {}, requests = [], removed = [], timers = new Map()
  let startOptions, stopped = 0, timer = 0
  const recorder = { start: (options) => { startOptions = options; callbacks.Start() }, stop: () => { stopped++ } }
  for (const event of ['Start', 'Stop', 'Error', 'InterruptionBegin']) {
    recorder['on' + event] = (callback) => { callbacks[event] = callback }
    recorder['off' + event] = () => { delete callbacks[event] }
  }
  const context = vm.createContext({
    ref: (value) => ({ value }), shallowRef: (value) => ({ value }),
    onHide: (fn) => { lifecycle.hide = fn }, onShow: (fn) => { lifecycle.show = fn },
    onUnmounted: (fn) => { lifecycle.unmount = fn },
    setTimeout: (fn) => { timers.set(++timer, fn); return timer }, clearTimeout: (id) => timers.delete(id),
    request: async (options) => {
      requests.push(options)
      return respond ? respond(options, requests.length) : { evaluationId: 'eval-1', status: 'SUCCEEDED', result: { scores: { accuracy: 90 } } }
    },
    uni: {
      getRecorderManager: () => recorder,
      authorize: (options) => options.success(), openSetting: () => {},
      getFileSystemManager: () => ({
        readFile: (options) => options.success({ data: 'test-wav-base64' }),
        unlink: (options) => removed.push(options.filePath),
      }),
    },
  })
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  const module = new vm.SourceTextModule(js, { context })
  await module.link(() => { throw new Error('Unexpected runtime import') })
  await module.evaluate()
  const state = module.namespace.useWordEvaluation('word-1', 'session-1')
  return { state, callbacks, lifecycle, requests, removed, timers,
    get startOptions() { return startOptions }, get stopped() { return stopped } }
}

test('records a four-second WAV, submits once and removes the temporary file', async () => {
  const h = await setup()
  h.state.toggleRecording()
  assert.equal(h.startOptions.format, 'wav')
  assert.equal(h.startOptions.sampleRate, 16000)
  assert.equal(h.startOptions.numberOfChannels, 1)
  assert.equal(h.startOptions.duration, 4000)
  await h.callbacks.Stop({ tempFilePath: '/tmp/recording.wav' })
  assert.equal(h.requests.length, 1)
  assert.equal(h.state.result.value.status, 'SUCCEEDED')
  assert.ok(h.removed.includes('/tmp/recording.wav'))
  assert.equal(h.state.busy.value, false)
})

test('network retry reuses the same recording and idempotency key', async () => {
  const h = await setup({ respond: (_, count) => {
    if (count === 1) throw { statusCode: 0, message: 'timeout' }
    return { evaluationId: 'eval-1', status: 'SUCCEEDED', result: {} }
  } })
  h.state.toggleRecording()
  await h.callbacks.Stop({ tempFilePath: '/tmp/recording.wav' })
  assert.equal(h.state.canRetry.value, true)
  h.state.retry()
  await new Promise(setImmediate)
  assert.equal(h.requests[0].header['Idempotency-Key'], h.requests[1].header['Idempotency-Key'])
  assert.equal(h.requests[0].data.audioBase64, h.requests[1].data.audioBase64)
  assert.equal(h.state.result.value.status, 'SUCCEEDED')
})

test('leaving the page discards a late recording and detaches callbacks', async () => {
  const h = await setup()
  h.state.toggleRecording()
  h.lifecycle.unmount()
  assert.equal(h.stopped, 1)
  await h.callbacks.Stop({ tempFilePath: '/tmp/abandoned.wav' })
  assert.equal(h.requests.length, 0)
  assert.ok(h.removed.includes('/tmp/abandoned.wav'))
  assert.equal(Object.keys(h.callbacks).length, 0)
})

test('interruption never submits partial audio', async () => {
  const h = await setup()
  h.state.toggleRecording()
  h.state.toggleRecording()
  assert.equal(h.state.busy.value, true)
  h.callbacks.InterruptionBegin()
  await h.callbacks.Stop({ tempFilePath: '/tmp/interrupted.wav' })
  assert.equal(h.requests.length, 0)
  assert.ok(h.removed.includes('/tmp/interrupted.wav'))
  assert.equal(h.state.busy.value, false)
})

test('a processing response is polled with GET and polling stops on hide', async () => {
  const h = await setup({ respond: () => ({ evaluationId: 'eval-1', status: 'PROCESSING', result: null }) })
  h.state.toggleRecording()
  await h.callbacks.Stop({ tempFilePath: '/tmp/recording.wav' })
  assert.equal(h.timers.size, 1)
  await [...h.timers.values()][0]()
  assert.equal(h.requests[1].url, '/evaluations/eval-1')
  assert.equal(h.requests[1].method, undefined)
  h.lifecycle.hide()
  assert.equal(h.state.canRetry.value, false)
  assert.equal(h.requests.filter((r) => r.method === 'POST').length, 1)
})

test('browser builds do not access the mini-program recorder', async () => {
  const h = await setup({ miniProgram: false })
  assert.equal(h.state.supported.value, false)
  h.state.toggleRecording()
  assert.equal(h.startOptions, undefined)
  assert.equal(h.requests.length, 0)
})

test('an idle evaluation ignores recording events owned by another page', async () => {
  const h = await setup()
  h.callbacks.Start()
  await h.callbacks.Stop({ tempFilePath: '/tmp/another-page.wav' })
  assert.equal(h.requests.length, 0)
  assert.equal(h.removed.length, 0)
  assert.equal(h.stopped, 0)
  h.lifecycle.hide()
  assert.equal(Object.keys(h.callbacks).length, 0)
  h.lifecycle.show()
  assert.equal(Object.keys(h.callbacks).length, 4)
})
