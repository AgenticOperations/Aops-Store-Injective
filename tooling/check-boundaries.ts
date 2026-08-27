#!/usr/bin/env bun
import { dirname, join } from 'node:path'
/**
 * Forbidden-edge check — `docs/architecture/00-repo-architecture-and-agent-conventions.md` §6.4.
 *
 * The doc is explicit: "Each is a lint rule, not a paragraph. A violation fails the build."
 * This file is that. It reads every workspace manifest for its declared `ring`, then checks
 * BOTH declared dependencies AND actual import statements in source — because an undeclared
 * import is still an import.
 *
 *   strategies (agents repo)  X->  scoring · evidence · listings · discovery   [cross-repo, see §4]
 *   evidence                  X->  scoring                                     [§6.2 re-derivability]
 *   apps/watch                X->  custody · settlement                        [§5.1 powerless watcher]
 *   design-system             X->  any service package
 *   any package               X->  any app
 *   Ring N                    X->  Ring > N
 */
import { Glob } from 'bun'

type Ring = 0 | 1 | 2 | 3 | 'shared' | 'app'
interface Manifest {
  name: string
  ring: Ring
  dir: string
  deps: string[]
}

const SHARED = new Set([
  '@repo/design-system',
  '@repo/observability',
  '@repo/utils',
  '@repo/typescript-config',
])

const manifests: Manifest[] = []
for await (const file of new Glob('{packages,apps}/*/package.json').scan('.')) {
  const json = await Bun.file(file).json()
  manifests.push({
    name: json.name,
    ring: json.ring,
    dir: dirname(file),
    deps: Object.keys({ ...json.dependencies, ...json.peerDependencies }),
  })
}
const byName = new Map(manifests.map((m) => [m.name, m]))

const violations: string[] = []
const fail = (from: string, to: string, rule: string, where: string) =>
  violations.push(`  ${from}  X->  ${to}\n      rule: ${rule}\n      at:   ${where}`)

function checkEdge(from: Manifest, to: string, where: string) {
  const target = byName.get(to)
  if (!target) return // external dependency, not our concern

  // any package X-> any app
  if (from.ring !== 'app' && target.ring === 'app')
    return fail(from.name, to, 'no package may import an app (§3.3)', where)

  // design-system X-> any service package
  if (from.name === '@repo/design-system' && !SHARED.has(to))
    return fail(from.name, to, 'design-system may not import a service package (§6.4)', where)

  // evidence X-> scoring
  if (from.name === '@repo/evidence' && to === '@repo/scoring')
    return fail(
      from.name,
      to,
      'evidence may not import scoring — this is what keeps every score re-derivable (§6.2)',
      where,
    )

  // apps/watch X-> custody | settlement
  if (from.name === '@app/watch' && (to === '@repo/custody' || to === '@repo/settlement'))
    return fail(
      from.name,
      to,
      'the watcher detects and enqueues; it has no path to Ring 3 (§5.1)',
      where,
    )

  // Ring N X-> Ring > N
  if (typeof from.ring === 'number' && typeof target.ring === 'number' && target.ring > from.ring)
    return fail(from.name, to, `ring ${from.ring} may not import ring ${target.ring} (§3.3)`, where)
}

// 1. declared dependencies
for (const m of manifests) for (const d of m.deps) checkEdge(m, d, `${m.dir}/package.json`)

// 2. actual import statements
const IMPORT_RE = /from\s+['"](@(?:repo|app)\/[a-z-]+)(?:\/[^'"]*)?['"]/g
for (const m of manifests) {
  for await (const rel of new Glob('**/*.ts').scan({ cwd: m.dir })) {
    const src = await Bun.file(join(m.dir, rel)).text()
    for (const match of src.matchAll(IMPORT_RE)) {
      const target = match[1]
      if (target) checkEdge(m, target, `${m.dir}/${rel}`)
    }
  }
}

if (violations.length > 0) {
  console.error(`\nForbidden edges (00 §6.4) — ${violations.length} violation(s):\n`)
  console.error(violations.join('\n\n'))
  console.error('\nThese are architectural invariants, not style. Fix the import, not the rule.\n')
  process.exit(1)
}
console.info(`Boundaries OK — ${manifests.length} workspaces, 0 forbidden edges.`)
