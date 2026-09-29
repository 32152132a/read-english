import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

async function setup(web = true, voices = [{ lang: 'en-US' }]) {
  let source = await readFile(new URL('../src/services/pronunciation.uts', import.meta.url), 'utf8')
  source = source
    .replace(/\/\/ #ifdef WEB([\s\S]*?)\/\/ #endif/g, (_, body) => (web ? body : ''))
    .replace(/\/\/ #ifndef WEB([\s\S]*?)\/\/ #endif/g, (_, body) => (web ? '' : body))
  const timers = new Map(),
    listeners = new Map(),
    audio = [],
    spoken = []
  let timerId = 0,
    cancels = 0
  const synth = {
    getVoices: () => voices,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    speak: (item) => spoken.push(item),
    cancel: () => {
      cancels++
    },
  }
  const context = vm.createContext({
    window: { speechSynthesis: synth },
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text
      }
    },
    setTimeout: (fn, ms) => {
      timers.set(++timerId, { fn, ms })
      return timerId
    },
    clearTimeout: (id) => timers.delete(id),
    uni: {
      createInnerAudioContext: () => {
        const callbacks = {}
        const player = {
          paused: true,
          callbacks,
          destroyed: false,
          onPlay: (fn) => (callbacks.play = fn),
          onWaiting: (fn) => (callbacks.waiting = fn),
          onCanplay: (fn) => (callbacks.canplay = fn),
          onEnded: (fn) => (callbacks.ended = fn),
          onError: (fn) => (callbacks.error = fn),
          play() {
            this.paused = false
          },
          destroy() {
            this.destroyed = true
          },
        }
        audio.push(player)
        return player
      },
    },
  })
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
  const module = new vm.SourceTextModule(js, { context })
  await module.link(() => {
    throw new Error('Unexpected import')
  })
  await module.evaluate()
  function play(src = '', word = 'computer') {
    const states = [],
      errors = []
    let ended = 0
    const stop = module.namespace.playPronunciation(
      src,
      word,
      (s) => states.push(s),
      () => ended++,
      (e) => errors.push(e)
    )
    return {
      states,
      errors,
      stop,
      get ended() {
        return ended
      },
    }
  }
  return {
    play,
    audio,
    spoken,
    voices,
    listeners,
    timers,
    synth,
    context,
    api: module.namespace,
    get cancels() {
      return cancels
    },
    expire(ms) {
      for (const timer of [...timers.values()]) if (timer.ms === ms) timer.fn()
    },
  }
}

test('phoneme audio is played without synthesizing speech', async () => {
  const h = await setup(),
    p = h.play('/word.mp3', '')
  assert.equal(h.spoken.length, 0)
  assert.equal(h.audio[0].src, '/word.mp3')
  h.audio[0].callbacks.play()
  assert.equal(p.states.at(-1), 'playing')
  h.audio[0].callbacks.error()
  assert.equal(p.errors.length, 1)
  assert.equal(p.states.at(-1), 'idle')
  assert.equal(h.spoken.length, 0)
  assert.ok(h.audio[0].destroyed)
})
test('missing audio speaks the word using US voice and cleans up on completion', async () => {
  const h = await setup(true, [{ lang: 'zh-CN' }, { lang: 'en-GB' }, { lang: 'en-US' }]),
    p = h.play()
  assert.equal(h.spoken[0].voice.lang, 'en-US')
  assert.equal(h.spoken[0].text, 'computer')
  h.spoken[0].onstart()
  assert.equal(p.states.at(-1), 'playing')
  h.spoken[0].onend()
  assert.equal(p.ended, 1)
  assert.equal(p.states.at(-1), 'idle')
  assert.equal(h.timers.size, 0)
})
test('IPA, empty input and non-Web requests never synthesize speech', async () => {
  for (const word of ['', '/ɪ/', 'p', 'teacher']) {
    const h = await setup(false),
      p = h.play('', word)
    assert.equal(h.spoken.length, 0)
    assert.equal(p.errors.length, 1)
  }
  const h = await setup()
  h.play('', '/ɪ/')
  assert.equal(h.spoken.length, 0)
  assert.equal(h.api.usesSystemSpeech('', 'computer'), true)
  assert.equal(h.api.usesSystemSpeech('/word.mp3', 'computer'), true)
})
test('voices may load asynchronously; missing US voice times out without switching accent', async () => {
  const h = await setup(true, []),
    p = h.play()
  h.voices.push({ lang: 'en_US' })
  h.listeners.get('voiceschanged')()
  assert.equal(h.spoken.length, 1)
  p.stop()
  assert.equal(h.listeners.size, 0)
  const other = await setup(true, [{ lang: 'en-GB' }]),
    q = other.play()
  other.expire(2000)
  assert.equal(other.spoken.length, 0)
  assert.equal(q.errors.length, 1)
  assert.equal(other.timers.size, 0)
})
test('switching playback cancels previous owner; stale cleanup cannot cancel new playback', async () => {
  const h = await setup(),
    first = h.play(),
    oldEnd = h.spoken[0].onend,
    second = h.play('', 'teacher')
  assert.equal(first.states.at(-1), 'idle')
  assert.equal(h.cancels, 1)
  first.stop()
  oldEnd()
  assert.equal(h.cancels, 1)
  assert.equal(first.ended, 0)
  second.stop()
  assert.equal(h.cancels, 2)
})
test('cancelling before voices arrive removes listener; speech error permits retry', async () => {
  const h = await setup(true, []),
    p = h.play()
  p.stop()
  assert.equal(h.listeners.size, 0)
  assert.equal(h.timers.size, 0)
  const other = await setup(),
    q = other.play()
  other.spoken[0].onerror()
  assert.equal(q.errors.length, 1)
  assert.equal(q.states.at(-1), 'idle')
  other.play()
  assert.equal(other.spoken.length, 2)
})
test('unsupported browsers and missing lifecycle callbacks fail without stuck state', async () => {
  const h = await setup()
  h.context.window.speechSynthesis = undefined
  const p = h.play()
  assert.equal(p.errors.length, 1)
  assert.equal(p.states.at(-1), 'idle')
  const other = await setup(),
    q = other.play()
  other.expire(30000)
  assert.equal(q.errors.length, 1)
  assert.equal(q.states.at(-1), 'idle')
})

test('words prefer browser speech even with a recording; unavailable voice uses recording', async () => {
  const h = await setup()
  h.play('/word.mp3')
  assert.equal(h.spoken.length, 1)
  assert.equal(h.audio.length, 0)
  const fallback = await setup(true, [])
  const result = fallback.play('/word.mp3')
  fallback.expire(2000)
  assert.equal(fallback.audio[0].src, '/word.mp3')
  assert.equal(fallback.listeners.size, 0)
  fallback.audio[0].callbacks.ended()
  assert.equal(result.ended, 1)
  assert.equal(fallback.timers.size, 0)
})
