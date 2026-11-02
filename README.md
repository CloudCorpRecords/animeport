# animeport

animeport answers questions about anime and manga using AniList: what
a series is about and how it scored, who made it, which characters and
staff share a birthday today, what a given user is watching or
reading, and what fans of one title tend to recommend next. Every
answer comes from AniList's public GraphQL API.

This package is a clean-room rebuild, and a **labelled core subset**:
it covers 20 of the 42 tools documented for the original AniList MCP
server. The omitted tools are listed under "Scope" below.

## How it talks to the service

Each tool sends exactly one GraphQL query by POST to the AniList API
and returns the response's `data` payload:

```bash
# Optional: raises rate limits / unlocks authenticated reads on AniList.
export ANILIST_TOKEN="your token"
# Optional override (default: https://graphql.anilist.co)
export ANILIST_API_URL="https://graphql.anilist.co"
```

The token is genuinely optional. With no token set, requests go out
keyless, which AniList accepts for these read tools — nothing fails
just because `ANILIST_TOKEN` is missing. When AniList answers with a
GraphQL `errors` array, the call fails with the first error's
message; an upstream HTTP error is reported with its status and a
body excerpt.

**Field-selection note:** the original project's README documents the
tools and their purposes, not the GraphQL field selections. The
queries here are fresh, sensible reconstructions chosen for each
tool's stated purpose, not copies of the original's queries.

## Install

```bash
npx @reneturcios/animeport search_anime '{"search":"Frieren"}'
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/animeport
```

The container defaults to the MCP server. Pass CLI arguments to use
it as a CLI instead.

## CLI

The CLI mirrors the tools: one subcommand per tool, taking its
arguments as a single JSON object.

```bash
animeport get_genres '{}'
animeport search_anime '{"search":"Frieren","perPage":5}'
animeport get_anime '{"id":154587}'
animeport get_todays_birthday_characters '{}'
animeport get_user_anime_list '{"username":"someone","status":"CURRENT"}'
animeport get_recommendations_for_media '{"mediaId":154587}'
animeport --version
```

Exit codes: `0` on success, `1` on an API or validation error (the
error names the problem), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/animeport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "animeport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/animeport", "mcp"],
      "env": { "ANILIST_TOKEN": "your token (optional)" }
    }
  }
}
```

### Tools

| Tool | Input | What it does |
| --- | --- | --- |
| `get_genres` | — | Get the list of available genres on AniList. |
| `get_media_tags` | — | Get the list of available media tags on AniList. |
| `get_studio` | `id` and/or `name` (at least one, validated locally) | Get details of a studio by AniList ID or name. |
| `search_anime` | `search`, `page`, `perPage`, `genre`, `seasonYear` (all optional) | Search for anime by title, genre, or season year. |
| `search_manga` | `search`, `page`, `perPage`, `genre`, `seasonYear` (all optional) | Search for manga by title, genre, or season year. |
| `search_character` | `search` (required), `page`, `perPage` | Search for characters by name. |
| `search_staff` | `search` (required), `page`, `perPage` | Search for staff by name. |
| `search_studio` | `search` (required), `page`, `perPage` | Search for studios by name. |
| `search_user` | `search` (required), `page`, `perPage` | Search for AniList users by username. |
| `get_anime` | `id` (required) | Get detailed information about an anime by AniList ID. |
| `get_manga` | `id` (required) | Get detailed information about a manga by AniList ID. |
| `get_character` | `id` (required) | Get detailed information about a character by AniList ID. |
| `get_staff` | `id` (required) | Get detailed information about a staff member by AniList ID. |
| `get_todays_birthday_characters` | — | Get characters whose birthday is today. |
| `get_todays_birthday_staff` | — | Get staff members whose birthday is today. |
| `get_user_anime_list` | `username` (required), `status` | Get a user's anime list, optionally filtered by status. |
| `get_user_manga_list` | `username` (required), `status` | Get a user's manga list, optionally filtered by status. |
| `get_user_profile` | `username` (required) | Get a user's AniList profile. |
| `get_user_stats` | `username` (required) | Get a user's activity statistics. |
| `get_recommendations_for_media` | `mediaId` (required), `page`, `perPage` | Get recommendations for a media entry by its AniList ID. |

## Scope

Omitted from this core subset: `get_site_statistics`, `get_activity`,
`get_user_activity`, `post_message_activity`, `post_text_activity`,
`delete_activity`, `add_list_entry`, `remove_list_entry`,
`update_list_entry`, `favourite_anime`, `favourite_manga`,
`favourite_character`, `favourite_staff`, `favourite_studio`,
`get_recommendation`, `get_thread`, `get_thread_comments`,
`delete_thread`, `get_full_user_info`, `get_authorized_user`,
`follow_user`, and `update_user`. The omitted set is deliberately the
login, write, favourite, and thread surface; animeport is read-only
by design. The catalogue data itself is AniList's; this package
reproduces the tool surface and the request/response handling, not
AniList's database.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, fake fetch only, no network
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
