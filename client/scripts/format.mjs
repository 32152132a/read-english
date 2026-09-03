import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import prettier from 'prettier'

const ignoredDirectories = new Set(['node_modules', 'unpackage', 'dist', '.git', '.hbuilderx'])
const parsers = new Map([
  ['.html', 'html'],
  ['.json', 'json'],
  ['.mjs', 'babel'],
  ['.scss', 'scss'],
  ['.uts', 'typescript'],
  ['.uvue', 'vue'],
])

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue

    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await collectFiles(path)))
    else if (parsers.has(extname(entry.name))) files.push(path)
  }

  return files
}

const config = (await prettier.resolveConfig(join(process.cwd(), 'placeholder.uts'))) ?? {}
const files = await collectFiles(process.cwd())

for (const file of files) {
  const extension = extname(file)
  const source = await readFile(file, 'utf8')
  const parsableSource =
    extension === '.uvue' ? source.replaceAll('lang="uts"', 'lang="ts"') : source
  const formatted = await prettier.format(parsableSource, {
    ...config,
    filepath: file,
    parser: parsers.get(extension),
  })
  const result = extension === '.uvue' ? formatted.replaceAll('lang="ts"', 'lang="uts"') : formatted

  if (result !== source) await writeFile(file, result)
}

console.log(`Formatted ${files.length} files.`)
