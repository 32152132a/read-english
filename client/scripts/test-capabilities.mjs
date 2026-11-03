import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

async function setup(request) {
  let token = 'first-user'
  const context = vm.createContext({
    ref: (value) => ({ __ref: true, value }),
    computed: (getter) => ({
      __ref: true,
      get value() {
        return getter()
      },
    }),
  })
  const pinia = new vm.SyntheticModule(
    ['defineStore'],
    function () {
      this.setExport('defineStore', (_, initialize) => {
        let store
        return () =>
          (store ??= new Proxy(initialize(), {
            get: (target, key) => (target[key]?.__ref ? target[key].value : target[key]),
          }))
      })
    },
    { context }
  )
  const http = new vm.SyntheticModule(
    ['request'],
    function () {
      this.setExport('request', request)
    },
    { context }
  )
  const credentials = new vm.SyntheticModule(
    ['getToken'],
    function () {
      this.setExport('getToken', () => token)
    },
    { context }
  )
  const source = await readFile(new URL('../src/stores/capabilities.uts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = new vm.SourceTextModule(code, { context })
  await module.link((name) => {
    if (name === 'pinia') return pinia
    if (name.endsWith('/http.uts')) return http
    if (name.endsWith('/token.uts')) return credentials
    throw new Error('Unexpected import: ' + name)
  })
  await module.evaluate()
  return {
    store: module.namespace.useCapabilitiesStore(),
    setToken: (next) => {
      token = next
    },
  }
}

test('capabilities share an in-flight request and cache the result for the current login', async () => {
  let finish,
    count = 0
  const { store } = await setup(() => {
    count++
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  assert.equal(store.phonemeAudioEnabled, false)
  const first = store.load(),
    second = store.load()
  assert.equal(count, 1)
  finish({ phonemeAudioEnabled: true, phonemeListeningEnabled: false })
  await Promise.all([first, second])
  await store.load()
  assert.equal(count, 1)
  assert.equal(store.phonemeAudioEnabled, true)
  assert.equal(store.phonemeListeningEnabled, false)
})

test('failed configuration requests keep audio hidden and permit a later retry', async () => {
  let count = 0
  const { store } = await setup(async () => {
    if (++count === 1) throw new Error('offline')
    return { phonemeAudioEnabled: true, phonemeListeningEnabled: true }
  })
  assert.equal(await store.load(), null)
  assert.equal(store.phonemeAudioEnabled, false)
  await store.load()
  assert.equal(count, 2)
  assert.equal(store.phonemeListeningEnabled, true)
})

test('responses from a previous login cannot overwrite the new global configuration', async () => {
  const completions = []
  const { store, setToken } = await setup(() => new Promise((resolve) => completions.push(resolve)))
  const old = store.load()
  setToken('second-user')
  const current = store.load()
  completions[1]({ userId: 'second', phonemeAudioEnabled: false, phonemeListeningEnabled: false })
  await current
  completions[0]({ userId: 'first', phonemeAudioEnabled: true, phonemeListeningEnabled: true })
  await old
  assert.equal(store.value.userId, 'second')
  assert.equal(store.phonemeAudioEnabled, false)
  setToken('')
  await store.load()
  assert.equal(store.value, null)
})
