# Changelog

## 0.1.0 (2026-10-26)

- Initial release. Labelled core subset (20 tools) of the AniList MCP tool list.
- CLI: one subcommand per MCP tool (same name as the tool), each taking
  its arguments as a JSON object on the command line, plus `--version`.
- MCP server (`animeport mcp`, stdio) with 20 read tools:
  `get_genres`, `get_media_tags`, `get_studio`, `search_anime`,
  `search_manga`, `search_character`, `search_staff`, `search_studio`,
  `search_user`, `get_anime`, `get_manga`, `get_character`, `get_staff`,
  `get_todays_birthday_characters`, `get_todays_birthday_staff`,
  `get_user_anime_list`, `get_user_manga_list`, `get_user_profile`,
  `get_user_stats`, and `get_recommendations_for_media`.
- All tools send one GraphQL query per call to the AniList API;
  `ANILIST_TOKEN` is optional (Bearer token when set, keyless reads
  otherwise), and a GraphQL `errors` array surfaces its first message.
