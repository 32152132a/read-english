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
  const toasts = []
  const navigation = []
  const events = []
  let now = Date.now()
  let route = 'pages/profile/index'
  const context = vm.createContext({
    setTimeout,
    clearTimeout,
    Date: class extends Date {
      static now() {
        return now
      }
    },
    getCurrentPages: () => [{ route }],
    uni: {
      getStorageSync: (key) => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: (key) => storage.delete(key),
      showToast: (options) => {
        toasts.push(options)
        events.push('toast')
      },
      showLoading: () => {
        loading.push('show')
        events.push('loading')
      },
      hideLoading: () => {
        loading.push('hide')
        events.push('hide')
      },
      navigateTo: (options) => {
        navigation.push(options.url)
        options.complete?.()
      },
      reLaunch: (options) => {
        navigation.push(options.url)
        route = options.url.slice(1)
        options.complete?.()
      },
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
          .finally(() => options.complete?.())
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
  return {
    request: http.namespace.request,
    showRequestError: http.namespace.showRequestError,
    storage,
    calls,
    loading,
    load,
    toasts,
    navigation,
    events,
    advanceTime: (ms) => {
      now += ms
    },
  }
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

const failure = (statusCode, message = '操作失败', requestId = 'failure-test') => ({
  statusCode,
  data: { code: 'TEST_FAILURE', message, data: null, requestId },
})

test('404 and server errors notify in place and preserve request details', async () => {
  for (const status of [404, 500, 503]) {
    const app = await setup(() => failure(status, '暂时无法读取', 'request-' + status))
    await assert.rejects(app.request({ url: '/resource' }), (error) => {
      assert.equal(error.statusCode, status)
      assert.equal(error.requestId, 'request-' + status)
      return true
    })
    assert.deepEqual(app.navigation, [])
    assert.equal(app.toasts.length, 1)
    assert.equal(app.toasts[0].title, '暂时无法读取')
  }
})

test('concurrent failures and page catches produce one toast without losing individual errors', async () => {
  const app = await setup(async (options) => {
    await delay(options.url.endsWith('/first') ? 0 : 15)
    return failure(options.url.endsWith('/first') ? 404 : 500, options.url, options.url)
  })
  const results = await Promise.allSettled(
    ['/first', '/second', '/third'].map((url) =>
      app.request({ url }).catch((error) => {
        app.showRequestError(error)
        throw error
      })
    )
  )
  assert.equal(app.toasts.length, 1)
  assert.deepEqual(app.navigation, [])
  assert.equal(new Set(results.map((result) => result.reason.requestId)).size, 3)
  assert.ok(results.every((result) => result.status === 'rejected' && result.reason.handled))
})

test('silent requests reject without toast, including network failures', async () => {
  for (const handler of [
    () => failure(500),
    () => Promise.reject({ errMsg: 'request:fail offline' }),
  ]) {
    const app = await setup(handler)
    let failure
    await app.request({ url: '/home', showError: false }).catch((error) => {
      failure = error
    })
    assert.ok(failure)
    assert.equal(app.toasts.length, 0)
    assert.deepEqual(app.navigation, [])
    app.showRequestError(failure)
    assert.equal(app.toasts.length, 1, 'caller may explicitly display an otherwise silent error')
  }
})

test('errors already handled stay silent, while a later failed retry can notify again', async () => {
  const app = await setup(() => failure(500))
  const first = await app.request({ url: '/save' }).catch((error) => error)
  await assert.rejects(app.request({ url: '/another', showLoading: false }))
  assert.equal(app.toasts.length, 1)
  app.advanceTime(2100)
  app.showRequestError(first)
  assert.equal(app.toasts.length, 1)
  await assert.rejects(app.request({ url: '/save' }))
  assert.equal(app.toasts.length, 2)
})

test('expired login overrides silent errors and redirects once for a concurrent batch', async () => {
  const app = await setup(async (options) => {
    if (options.url.endsWith('/auth/refresh')) await delay(20)
    return expired()
  })
  app.storage.set('token', 'old')
  app.storage.set('refresh-token', 'old-refresh')
  await Promise.allSettled([
    app.request({ url: '/profile', showError: false }),
    app.request({ url: '/stats' }),
  ])
  assert.equal(app.calls.filter((call) => call.url.endsWith('/auth/refresh')).length, 1)
  assert.deepEqual(app.navigation, ['/pages/home/index'])
  assert.equal(app.toasts.length, 1)
  assert.equal(app.toasts[0].title, '登录已过期，请重新登录')
  assert.equal(app.storage.size, 0)
  app.advanceTime(2100)
  await assert.rejects(app.request({ url: '/late-request' }))
  assert.equal(app.toasts.length, 1)
  assert.equal(app.navigation.length, 1)
})

test('public login failure does not clear an existing session or redirect', async () => {
  const app = await setup(() => failure(401, '微信登录失败'))
  app.storage.set('token', 'existing')
  app.storage.set('refresh-token', 'existing-refresh')
  await assert.rejects(app.request({ url: '/auth/wechat/login', auth: false }))
  assert.equal(app.storage.size, 2)
  assert.deepEqual(app.navigation, [])
  assert.equal(app.toasts[0].title, '微信登录失败')
})

test('a refresh network failure preserves credentials and follows the outer error preference', async () => {
  for (const showError of [true, false]) {
    const app = await setup((options) =>
      options.url.endsWith('/auth/refresh')
        ? Promise.reject({ errMsg: 'request:fail timeout' })
        : expired()
    )
    app.storage.set('token', 'old')
    app.storage.set('refresh-token', 'refresh')
    await assert.rejects(app.request({ url: '/home', showError }), (error) => {
      assert.equal(error.message, '请求超时，请稍后重试')
      assert.equal(error.data.errMsg, 'request:fail timeout')
      return true
    })
    assert.equal(app.storage.size, 2)
    assert.deepEqual(app.navigation, [])
    assert.equal(app.toasts.length, showError ? 1 : 0)
  }
})

test('a retried unauthorized request does not refresh endlessly', async () => {
  const app = await setup((options) =>
    options.url.endsWith('/auth/refresh')
      ? ok({ accessToken: 'new', refreshToken: 'new-refresh' })
      : expired()
  )
  app.storage.set('token', 'old')
  app.storage.set('refresh-token', 'refresh')
  await assert.rejects(app.request({ url: '/home' }))
  assert.equal(app.calls.length, 3)
  assert.equal(app.toasts.length, 1)
  assert.equal(app.navigation.length, 1)
})

test('error toast is shown after the last loading overlay closes', async () => {
  const app = await setup(async (options) => {
    await delay(options.url.endsWith('/slow') ? 260 : 180)
    return options.url.endsWith('/slow') ? ok({}) : failure(500)
  })
  const fast = app.request({ url: '/fast' }).catch(() => {})
  const slow = app.request({ url: '/slow' })
  await fast
  assert.equal(app.toasts.length, 0)
  assert.deepEqual(app.loading, ['show'])
  await slow
  assert.deepEqual(app.events, ['loading', 'hide', 'toast'])
})

test('login expiration takes priority over an ordinary error toast', async () => {
  const app = await setup((options) => (options.url.endsWith('/public') ? failure(500) : expired()))
  await assert.rejects(app.request({ url: '/public', auth: false }))
  app.storage.set('token', 'expired')
  await assert.rejects(app.request({ url: '/private' }))
  assert.equal(app.toasts.length, 2)
  assert.equal(app.toasts.at(-1).title, '登录已过期，请重新登录')
  assert.equal(app.navigation.length, 1)
})
