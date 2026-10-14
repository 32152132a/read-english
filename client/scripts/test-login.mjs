import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// 执行登录组件的实际交互逻辑，微信认证仅在平台边界替换。
async function setup(login) {
  const navigation = []
  const context = vm.createContext({
    ref: (value) => ({ value }),
    uni: { reLaunch: ({ url }) => navigation.push(url) },
  })
  const source = await readFile(
    new URL('../components/LoginScreen/index.uvue', import.meta.url),
    'utf8'
  )
  const script = source.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1]
  const code = ts.transpileModule(
    script + '\nexport { agreed, loggingIn, error, signIn, changeAgreement }',
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
  ).outputText
  const auth = new vm.SyntheticModule(
    ['login'],
    function () {
      this.setExport('login', login)
    },
    { context }
  )
  const screen = new vm.SourceTextModule(code, { context })
  await screen.link(() => auth)
  await screen.evaluate()
  return { ...screen.namespace, navigation }
}

test('login waits for consent and only redirects after authentication completes', async () => {
  let attempts = 0
  const screen = await setup(async () => {
    attempts += 1
  })
  await screen.signIn()
  assert.equal(attempts, 0)
  assert.deepEqual(screen.navigation, [])
  assert.equal(screen.error.value, '请先阅读并同意登录说明')
  screen.changeAgreement({ detail: { value: ['agree'] } })
  assert.equal(screen.error.value, '')
  await screen.signIn()
  assert.equal(attempts, 1)
  assert.deepEqual(screen.navigation, ['/pages/home/index'])
  assert.equal(screen.loggingIn.value, false)
})

test('repeated taps during login send only one authentication request', async () => {
  let complete
  let attempts = 0
  const screen = await setup(() => {
    attempts += 1
    return new Promise((resolve) => {
      complete = resolve
    })
  })
  screen.agreed.value = true
  const pending = screen.signIn()
  await screen.signIn()
  assert.equal(attempts, 1)
  assert.equal(screen.loggingIn.value, true)
  assert.deepEqual(screen.navigation, [])
  complete()
  await pending
  assert.deepEqual(screen.navigation, ['/pages/home/index'])
})

test('failed login stays on screen and can be retried without a stale error', async () => {
  let attempts = 0
  const screen = await setup(async () => {
    if (attempts++ === 0) throw new Error('微信登录失败，请重试')
  })
  screen.agreed.value = true
  await screen.signIn()
  assert.equal(screen.error.value, '微信登录失败，请重试')
  assert.equal(screen.loggingIn.value, false)
  assert.deepEqual(screen.navigation, [])
  await screen.signIn()
  assert.equal(screen.error.value, '')
  assert.deepEqual(screen.navigation, ['/pages/home/index'])
})

test('login entry skips authentication when a saved token is available', async () => {
  let savedToken = ''
  let onShow
  const navigation = []
  const context = vm.createContext({
    onShow: (callback) => {
      onShow = callback
    },
    uni: { reLaunch: ({ url }) => navigation.push(url) },
  })
  const source = await readFile(new URL('../pages/login/index.uvue', import.meta.url), 'utf8')
  const script = source.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1]
  const token = new vm.SyntheticModule(
    ['getToken'],
    function () {
      this.setExport('getToken', () => savedToken)
    },
    { context }
  )
  const component = new vm.SyntheticModule(
    ['default'],
    function () {
      this.setExport('default', {})
    },
    { context }
  )
  const entry = new vm.SourceTextModule(script, { context })
  await entry.link((specifier) => (specifier.endsWith('.uvue') ? component : token))
  await entry.evaluate()
  onShow()
  assert.deepEqual(navigation, [])
  savedToken = 'existing-token'
  onShow()
  assert.deepEqual(navigation, ['/pages/home/index'])
})
