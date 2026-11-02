# animeport — Build Report

Tranche #101+ Batch 2, MCP Rebuild 1000 program. Clean-room rebuild
of yuna0x0/anilist-mcp (rank 32, 92 stars), built from the README
"Available Tools" spec retrieved 2026-10-26/27. **Labelled core
subset: 20 of the 42 documented tools.** Local build only — nothing
pushed or published.

Identity: repo `animeport`, npm `@reneturcios/animeport`, MCP name
`io.github.CloudCorpRecords/animeport`, version `0.1.0`.
Build dir: `~/workspace/mcp-rebuild-100/builds/animeport/`

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `animeport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Anime, manga, characters, and staff
  from AniList: search, profiles, lists, and birthdays." = **89 chars**
  (≤100 ✓); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/animeport:0.1.0` carries **no** `version`
  field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/animeport"`
- `tsconfig.json` (318 bytes, fleet-identical), `.gitignore`,
  `package-lock.json` (see Lockfile), `LICENSE` (MIT, Copyright (c)
  2026 Rene Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (one subcommand per tool taking a JSON
  argument object, plus `mcp` and `--version`; unknown command exits
  2), `src/mcp.ts`, `src/types.ts`, `src/animeport.ts` (core,
  `VERSION = "0.1.0"`)
- `test/animeport.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (mechanics copied from textgraph; image/server name changed to animeport)

## Fixture first

`~/workspace/mcp-rebuild-100/harness/fixtures/anilist-mcp-tools-original.json`
was written before the build, with `_source` labelled as a core
subset: "docs-derived core subset (20 of the 42 tools in the
yuna0x0/anilist-mcp README Available Tools list, retrieved
2026-10-26)" plus the full omitted-tools list and the note that
parameter schemas are documented-parameter reconstructions, not
hand-probed. Parity is against this subset only.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit schema
  literals exactly as in the fixture (NOT `McpServer` + zod), so
  `tools/list` matches the spec exactly; zod still validates every
  `tools/call` argument set.
- Core (`src/animeport.ts`): every tool sends exactly one GraphQL
  query via an injectable `FetchFn` as a POST JSON body of
  `{query, variables}` to `https://graphql.anilist.co`
  (`ANILIST_API_URL` optionally overrides it), and returns the
  response's GraphQL `data` payload.
- `ANILIST_TOKEN` is optional: when set it is sent as
  `Authorization: Bearer <token>`; when absent the request goes out
  keyless and no error is raised — AniList accepts these read tools
  keyless.
- A GraphQL `errors` array throws its first message; an upstream
  HTTP error becomes an error carrying the status and a body excerpt
  (≤500 chars); a transport failure is wrapped with the endpoint.
- Local validation: positive-integer IDs/paging, non-empty
  `search`/`username` where required, and `get_studio` requires at
  least one of `id`/`name`. All covered by tests.

## Verification (exact outputs, all run in the foreground)

### 1. Build
```
$ ./node_modules/.bin/tsc; echo tsc_exit=$?
tsc_exit=0
```

### 2. Tests (fake-fetch only, no live AniList call)
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
tests 12 / pass 12 / fail 0
```
Covers: version/base-URL resolution, optional-token behaviour (absent
→ undefined, never an error), keyless POST shaping (URL, JSON
`{query, variables}` body, no Authorization header), Bearer header
when a token is set, search/get_studio/birthday/user-list/
recommendations query+variable shaping, first-GraphQL-error throwing,
upstream 502 with excerpt, fetch-failure wrapping, and required-arg
validation.

CLI honest checks (exactly what was run and seen):
```
$ node dist/cli.js --version
0.1.0            (exit 0)
$ node dist/cli.js not-a-command
Usage: ...       (exit 2)
```
No live `tools/call` was attempted: a real call would need network
access to graphql.anilist.co, which this build does not claim. The
no-network path is covered instead by the fake-fetch test that makes
the injected fetch throw `fetch failed` and asserts the wrapped
error message.

### 3. Parity
```
$ python3 ~/workspace/mcp-rebuild-100/harness/parity.py \
    --original ~/workspace/mcp-rebuild-100/harness/fixtures/anilist-mcp-tools-original.json \
    --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/animeport/dist/cli.js mcp" \
    --out ~/workspace/mcp-rebuild-100/builds/animeport/parity-out
verdict=PASS parity_pct=100.0 original_tools=20 rebuild_tools=20 missing=[] extra=[] schema_diffs=[]
(exit 0)
```

## Lockfile status

**Clean lockfile (Route 3), verified.** `package.json` alone was
copied into a fresh `/tmp/animeport-lock/` (no `node_modules` there)
and `npm install --package-lock-only --ignore-scripts --offline`
produced a `package-lock.json` that parses, has
`name == "@reneturcios/animeport"`, lockfileVersion 3, and 128 package
entries; that verified file was placed in the build dir. No
copied-lockfile fallback was used. `node_modules` in the build dir is
a `cp -a` copy from clockport (local build only, gitignored).

## Gaps

- **GraphQL field selections are reconstructions — the main gap.**
  The README documents tool names and purposes, not wire schemas or
  field selections; each query's fields (and the `isBirthday: true`
  paging shape for the birthday tools) are fresh, sensible choices
  for the tool's stated purpose, not hand-probed against the live
  API. Live upstream behaviour is unproven: **no live AniList call
  was made** in this build.
- **Token-gated surface omitted by subset design:** the login,
  write, favourite, and thread tools (22 of 42) are out of the core
  subset — animeport is read-only. Full omitted list is in the
  fixture `_source` and the README "Scope" section.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.

## Blockers

None for the local build. Nothing pushed or published;
SCOREBOARD/NAMES were not edited.
