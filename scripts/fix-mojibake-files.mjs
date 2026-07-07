#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const MAX_PASSES = 5
const DRY_RUN = process.argv.includes('--dry-run')

const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.vercel',
  'scripts',
])

const SKIP_PATHS = new Set([
  'BataMart-Code.html',
  'fix-encoding.mjs',
  'scripts/fix-mojibake-files.mjs',
])

const TARGET_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.json',
  '.md',
  '.toml',
  '.yml',
  '.yaml',
  '.html',
])

const SUSPECT_RE = /[ÃÂâðï][^\s]/u
const SUSPECT_GLOBAL_RE = /[ÃÂâðï][^\s]/gu
const CP1252_BYTE_MAP = new Map([
  ['€', 0x80],
  ['‚', 0x82],
  ['ƒ', 0x83],
  ['„', 0x84],
  ['…', 0x85],
  ['†', 0x86],
  ['‡', 0x87],
  ['ˆ', 0x88],
  ['‰', 0x89],
  ['Š', 0x8a],
  ['‹', 0x8b],
  ['Œ', 0x8c],
  ['Ž', 0x8e],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
  ['˜', 0x98],
  ['™', 0x99],
  ['š', 0x9a],
  ['›', 0x9b],
  ['œ', 0x9c],
  ['ž', 0x9e],
  ['Ÿ', 0x9f],
])

function score(value) {
  const matches = value.match(SUSPECT_GLOBAL_RE)
  return matches ? matches.length : 0
}

function isSuspect(value) {
  return typeof value === 'string' && SUSPECT_RE.test(value)
}

function encodeLatin1Safe(value) {
  const bytes = []

  for (const char of value) {
    const code = char.codePointAt(0)
    if (code <= 0xff) {
      bytes.push(code)
      continue
    }

    const mapped = CP1252_BYTE_MAP.get(char)
    if (mapped !== undefined) {
      bytes.push(mapped)
      continue
    }

    return null
  }

  return Buffer.from(bytes)
}

function decodeRepeatedly(input) {
  let current = input
  const iterations = []
  let currentScore = score(current)

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    if (!isSuspect(current)) break

    const encoded = encodeLatin1Safe(current)
    if (!encoded) break

    const next = encoded.toString('utf8')
    const nextScore = score(next)
    iterations.push({ pass, value: next, score: nextScore })

    if (next === current) break
    if (nextScore >= currentScore) break

    current = next
    currentScore = nextScore
  }

  return { value: current, iterations }
}

function formatPreview(value) {
  return JSON.stringify(value)
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.git')) continue
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
      continue
    }

    const relPath = path.relative(ROOT, fullPath).split(path.sep).join('/')
    if (SKIP_PATHS.has(relPath)) continue
    if (!TARGET_EXTS.has(path.extname(entry.name).toLowerCase())) continue

    files.push(fullPath)
  }

  return files
}

async function fixFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  if (!isSuspect(raw)) return { changed: false, lines: 0 }

  const hasCRLF = raw.includes('\r\n')
  const newline = hasCRLF ? '\r\n' : '\n'
  const lines = raw.split(/\r?\n/)
  let changed = false
  let changedLines = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!isSuspect(line)) continue

    const before = line
    const beforeScore = score(before)
    const { value: after, iterations } = decodeRepeatedly(before)
    const afterScore = score(after)

    if (after === before) continue
    if (afterScore > beforeScore) continue

    changed = true
    changedLines += 1

    console.log(`\nFILE: ${path.relative(ROOT, filePath)}`)
    console.log(`LINE: ${i + 1}`)
    console.log(`before: ${formatPreview(before)}`)
    for (const step of iterations) {
      console.log(`pass ${step.pass}: ${formatPreview(step.value)}`)
    }
    console.log(`after : ${formatPreview(after)}`)

    lines[i] = after
  }

  if (changed && !DRY_RUN) {
    await fs.writeFile(filePath, lines.join(newline), 'utf8')
  }

  return { changed, lines: changedLines }
}

async function main() {
  const files = await walk(ROOT)
  const touched = []
  let totalLines = 0

  for (const file of files) {
    const result = await fixFile(file)
    if (result.changed) {
      touched.push(file)
      totalLines += result.lines
    }
  }

  console.log('\n--- SUMMARY ---')
  console.log(DRY_RUN ? 'Mode: dry-run' : 'Mode: write')
  console.log(`Files changed: ${touched.length}`)
  console.log(`Lines changed: ${totalLines}`)
  touched.forEach((file) => console.log(path.relative(ROOT, file)))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
