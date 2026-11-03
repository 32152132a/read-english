import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

async function setup() {
  const source = await readFile(
    new URL('../components/ContentEditor/index.uvue', import.meta.url),
    'utf8'
  )
  const script = source.match(/<script setup lang="uts">([\s\S]*?)<\/script>/)[1]
  const context = vm.createContext({
    ref: (value) => ({ value }),
    defineProps: () => ({ entryId: 'word-entry' }),
    watch: () => {},
  })
  const http = new vm.SyntheticModule(
    ['request', 'showRequestError'],
    function () {
      this.setExport('request', () => {
        throw new Error('Unexpected request')
      })
      this.setExport('showRequestError', () => {})
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
  const code = ts.transpileModule(
    script + '\nexport { populate, assemble, pronunciationForms, form }',
    {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }
  ).outputText
  const module = new vm.SourceTextModule(code, { context })
  await module.link((name) => (name.endsWith('http.uts') ? http : component))
  await module.evaluate()
  return module.namespace
}

function fixture(publicResource) {
  return {
    id: 'entry',
    kind: 'WORD',
    label: 'test',
    version: 1,
    publicResource,
    config: {
      kind: 'WORD',
      word: 'test',
      ipa: '/us/',
      accent: 'US',
      meaning: '测试',
      audio: { url: 'https://example.test/us.mp3' },
      pronunciations: {
        US: { ipa: '/us/', audioUrl: 'https://example.test/us.mp3' },
        GB: { ipa: '/gb/', audioUrl: 'https://example.test/gb.mp3' },
      },
      ipaSegments: [{ text: '/us/', tone: 'muted', bold: false }],
      questions: [],
      parts: [],
      syllables: [],
      commonTips: [],
      specialTips: [],
    },
  }
}

test('editing British audio preserves the separate American pronunciation', async () => {
  const editor = await setup()
  editor.populate(fixture(true))
  editor.pronunciationForms.value[1].audioUrl = 'https://example.test/new-gb.mp3'
  const result = editor.assemble()
  assert.equal(result.pronunciations.GB.audioUrl, 'https://example.test/new-gb.mp3')
  assert.equal(result.pronunciations.US.audioUrl, 'https://example.test/us.mp3')
  assert.equal(result.ipa, '/us/')
})

test('changing the selected IPA updates its display segments together', async () => {
  const editor = await setup()
  editor.populate(fixture(true))
  editor.pronunciationForms.value[0].ipa = '/new/'
  const result = editor.assemble()
  assert.equal(result.pronunciations.US.ipa, '/new/')
  assert.equal(result.ipa, '/new/')
  assert.equal(result.ipaSegments.map((segment) => segment.text).join(''), '/new/')
})

test('a personal teaching edit does not submit changes to shared resource forms', async () => {
  const editor = await setup()
  editor.populate(fixture(false))
  editor.pronunciationForms.value[0].audioUrl = 'https://example.test/other.mp3'
  editor.form.value.meaning = '自己的释义'
  const result = editor.assemble()
  assert.equal(result.pronunciations.US.audioUrl, 'https://example.test/us.mp3')
  assert.equal(result.meaning, '自己的释义')
})

test('audio without its accent IPA is rejected before saving', async () => {
  const editor = await setup()
  editor.populate(fixture(true))
  editor.pronunciationForms.value[1].ipa = ''
  assert.throws(() => editor.assemble(), /对应的 IPA/)
})
