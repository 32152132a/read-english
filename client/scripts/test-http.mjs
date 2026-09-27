import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

// 执行真实 UTS 请求层，uni 仅作为平台边界替身。
async function setup(handler) {
  const storage = new Map()
  const calls = []
  const loading = []
  const context = vm.createContext({
    setTimeout,
    clearTimeout,
    uni: {
      getStorageSync: (key) => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: (key) => storage.delete(key),
      showToast() {},
      showLoading: () => loading.push('show'),
      hideLoading: () => loading.push('hide'),
      navigateTo: (options) => options.complete?.(),
      request(options) {
        calls.push(options)
        Promise.resolve()
          .then(() => handler(options))
          .then(
            (response) => {
              options.success(response)
            },
            (error) => options.fail(error)
          )
          .finally(() => options.complete())
      },
    },
  })
  const modules = new Map()
  async function load(url) {
    if (modules.has(url.href)) return modules.get(url.href)
    const source = await readFile(url, 'utf8')
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
    const module = new vm.SourceTextModule(code, {
      context,
      identifier: url.href,
      initializeImportMeta: (meta) => {
        meta.env = { VITE_API_BASE_URL: 'http://api.test/api/v1' }
      },
    })
    modules.set(url.href, module)
    await module.link((specifier) => load(new URL(specifier, url)))
    return module
  }
  const http = await load(new URL('../src/services/http.uts', import.meta.url))
  await http.evaluate()
  return { request: http.namespace.request, storage, calls, loading, load }
}

const ok = (data) => ({
  statusCode: 200,
  data: { code: 'OK', message: 'success', data, requestId: 'test' },
})
const expired = () => ({
  statusCode: 401,
  data: { code: 'AUTH_TOKEN_INVALID', message: 'expired', data: null, requestId: 'expired-test' },
})
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('unwraps data and sends bearer, JSON and idempotency headers', async () => {
  const app = await setup(() => ok({ id: 'unit-1' }))
  app.storage.set('token', 'access')
  const result = await app.request({ url: '/home', header: { 'Idempotency-Key': 'once' } })
  assert.equal(result.id, 'unit-1')
  assert.equal(app.calls[0].header.Authorization, 'Bearer access')
  assert.equal(app.calls[0].header['Content-Type'], 'application/json')
  assert.equal(app.calls[0].header['Idempotency-Key'], 'once')
  assert.equal(app.calls[0].url, 'http://api.test/api/v1/home')
})

test('preserves business errors and handles malformed success bodies', async () => {
  const app = await setup(() => ({
    statusCode: 409,
    data: { code: 'FLOW_VERSION_CONFLICT', message: '流程已更新', requestId: 'conflict' },
  }))
  await assert.rejects(app.request({ url: '/learning-flow' }), (error) => {
    assert.equal(error.code, 'FLOW_VERSION_CONFLICT')
    assert.equal(error.message, '流程已更新')
    assert.equal(error.requestId, 'conflict')
    return true
  })
  const malformed = await setup(() => ({ statusCode: 200, data: null }))
  await assert.rejects(malformed.request({ url: '/home' }))
})

test('concurrent expired requests share one refresh and keep POST body and key', async () => {
  const app = await setup(async (options) => {
    if (options.url.endsWith('/auth/refresh')) {
      await delay(20)
      assert.equal(options.header.Authorization, undefined)
      return ok({ accessToken: 'new-access', refreshToken: 'new-refresh' })
    }
    return options.header.Authorization === 'Bearer old-access' ? expired() : ok({ saved: true })
  })
  app.storage.set('token', 'old-access')
  app.storage.set('refresh-token', 'old-refresh')
  const options = {
    url: '/learning-flow/current/complete',
    method: 'POST',
    data: { flowNodeId: 'node-1' },
    header: { 'Idempotency-Key': 'node-1' },
  }
  const results = await Promise.all([app.request(options), app.request({ url: '/home' })])
  assert.equal(results[0].saved, true)
  assert.equal(app.calls.filter((call) => call.url.endsWith('/auth/refresh')).length, 1)
  const posts = app.calls.filter(
    (call) => call.method === 'POST' && !call.url.endsWith('/auth/refresh')
  )
  assert.equal(posts.length, 2)
  assert.equal(posts[1].data.flowNodeId, 'node-1')
  assert.equal(posts[1].header['Idempotency-Key'], 'node-1')
  assert.equal(app.storage.get('refresh-token'), 'new-refresh')
})

test('failed refresh clears both tokens and does not loop', async () => {
  const app = await setup(expired)
  app.storage.set('token', 'old-access')
  app.storage.set('refresh-token', 'old-refresh')
  await assert.rejects(app.request({ url: '/home' }))
  assert.equal(app.calls.length, 2)
  assert.equal(app.storage.size, 0)
})

test('logout revokes the rotated refresh token after access expiry', async () => {
  const app = await setup((options) => {
    if (options.url.endsWith('/auth/refresh'))
      return ok({ accessToken: 'new', refreshToken: 'rotated' })
    return options.header.Authorization === 'Bearer old' ? expired() : ok({})
  })
  app.storage.set('token', 'old')
  app.storage.set('refresh-token', 'original')
  const auth = await app.load(new URL('../src/services/auth.uts', import.meta.url))
  await auth.evaluate()
  await auth.namespace.logout()
  assert.equal(app.calls.at(-1).data.refreshToken, 'rotated')
  assert.equal(app.storage.size, 0)
})

test('global loading stays visible until the last ordinary request completes', async () => {
  const app = await setup(async (options) => {
    await delay(options.url.endsWith('/slow') ? 240 : 180)
    return ok({})
  })
  const fast = app.request({ url: '/fast' })
  const slow = app.request({ url: '/slow' })
  await fast
  assert.deepEqual(app.loading, ['show'])
  await slow
  await delay(0)
  assert.deepEqual(app.loading, ['show', 'hide'])
  await app.request({ url: '/silent', showLoading: false })
  assert.deepEqual(app.loading, ['show', 'hide'])
})
