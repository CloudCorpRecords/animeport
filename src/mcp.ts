/**
 * animeport MCP server. Tools: get_genres, get_media_tags, get_studio,
 * search_anime, search_manga, search_character, search_staff,
 * search_studio, search_user, get_anime, get_manga, get_character,
 * get_staff, get_todays_birthday_characters,
 * get_todays_birthday_staff, get_user_anime_list, get_user_manga_list,
 * get_user_profile, get_user_stats, get_recommendations_for_media.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects keys that are not in
 * this tool's public spec ("$schema" and "additionalProperties"), which
 * breaks exact tool-list/schema parity with the spec. This file serves
 * tools/list with the spec's exact input schemas as explicit literals,
 * while zod still validates every tools/call argument set.
 *
 * ANILIST_TOKEN is optional: read tools work keyless, and a missing
 * token is never an error. This is a labelled core subset (20 of 42
 * documented tools); login, write, and thread tools are omitted.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { callAnimeportTool, resolveToken, VERSION } from "./animeport.js";
import type { FetchFn } from "./types.js";

const Empty = z.object({});
const GetStudio = z.object({
  id: z.number().int().optional(),
  name: z.string().optional(),
});
const SearchMedia = z.object({
  search: z.string().optional(),
  page: z.number().int().optional(),
  perPage: z.number().int().optional(),
  genre: z.string().optional(),
  seasonYear: z.number().int().optional(),
});
const SearchByName = z.object({
  search: z.string(),
  page: z.number().int().optional(),
  perPage: z.number().int().optional(),
});
const ById = z.object({ id: z.number().int() });
const UserList = z.object({
  username: z.string(),
  status: z.string().optional(),
});
const ByUsername = z.object({ username: z.string() });
const Recommendations = z.object({
  mediaId: z.number().int(),
  page: z.number().int().optional(),
  perPage: z.number().int().optional(),
});

const INT = { type: "integer" as const };
const STR = { type: "string" as const };

const TOOLS = [
  {
    name: "get_genres",
    description: "Get the list of available genres on AniList.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_media_tags",
    description: "Get the list of available media tags on AniList.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_studio",
    description: "Get details of a studio by AniList ID or name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "integer" as const, description: "AniList studio ID (provide this or name)." },
        name: { type: "string" as const, description: "Studio name to look up (provide this or id)." },
      },
      required: [] as string[],
    },
  },
  {
    name: "search_anime",
    description: "Search for anime by title, genre, or season year.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" as const, description: "Search text to match against titles." },
        page: { type: "integer" as const, description: "Page number of results to return." },
        perPage: { type: "integer" as const, description: "Number of results per page." },
        genre: { type: "string" as const, description: "Genre to filter by, such as Action or Romance." },
        seasonYear: { type: "integer" as const, description: "Season year to filter by, such as 2024." },
      },
      required: [] as string[],
    },
  },
  {
    name: "search_manga",
    description: "Search for manga by title, genre, or season year.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" as const, description: "Search text to match against titles." },
        page: { type: "integer" as const, description: "Page number of results to return." },
        perPage: { type: "integer" as const, description: "Number of results per page." },
        genre: { type: "string" as const, description: "Genre to filter by, such as Action or Romance." },
        seasonYear: { type: "integer" as const, description: "Season year to filter by, such as 2024." },
      },
      required: [] as string[],
    },
  },
  {
    name: "search_character",
    description: "Search for characters by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" as const, description: "Search text to match against names." },
        page: { type: "integer" as const, description: "Page number of results to return." },
        perPage: { type: "integer" as const, description: "Number of results per page." },
      },
      required: ["search"],
    },
  },
  {
    name: "search_staff",
    description: "Search for staff by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" as const, description: "Search text to match against names." },
        page: { type: "integer" as const, description: "Page number of results to return." },
        perPage: { type: "integer" as const, description: "Number of results per page." },
      },
      required: ["search"],
    },
  },
  {
    name: "search_studio",
    description: "Search for studios by name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" as const, description: "Search text to match against names." },
        page: { type: "integer" as const, description: "Page number of results to return." },
        perPage: { type: "integer" as const, description: "Number of results per page." },
      },
      required: ["search"],
    },
  },
  {
    name: "search_user",
    description: "Search for AniList users by username.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" as const, description: "Search text to match against names." },
        page: { type: "integer" as const, description: "Page number of results to return." },
        perPage: { type: "integer" as const, description: "Number of results per page." },
      },
      required: ["search"],
    },
  },
  {
    name: "get_anime",
    description: "Get detailed information about an anime by AniList ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "integer" as const, description: "AniList anime ID." },
      },
      required: ["id"],
    },
  },
  {
    name: "get_manga",
    description: "Get detailed information about a manga by AniList ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "integer" as const, description: "AniList manga ID." },
      },
      required: ["id"],
    },
  },
  {
    name: "get_character",
    description: "Get detailed information about a character by AniList ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "integer" as const, description: "AniList character ID." },
      },
      required: ["id"],
    },
  },
  {
    name: "get_staff",
    description: "Get detailed information about a staff member by AniList ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "integer" as const, description: "AniList staff member ID." },
      },
      required: ["id"],
    },
  },
  {
    name: "get_todays_birthday_characters",
    description: "Get characters whose birthday is today.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_todays_birthday_staff",
    description: "Get staff members whose birthday is today.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_user_anime_list",
    description: "Get a user's anime list, optionally filtered by status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" as const, description: "AniList username." },
        status: { type: "string" as const, description: "List status to filter by, such as CURRENT, COMPLETED, PLANNING, DROPPED, or PAUSED." },
      },
      required: ["username"],
    },
  },
  {
    name: "get_user_manga_list",
    description: "Get a user's manga list, optionally filtered by status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" as const, description: "AniList username." },
        status: { type: "string" as const, description: "List status to filter by, such as CURRENT, COMPLETED, PLANNING, DROPPED, or PAUSED." },
      },
      required: ["username"],
    },
  },
  {
    name: "get_user_profile",
    description: "Get a user's AniList profile.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" as const, description: "AniList username." },
      },
      required: ["username"],
    },
  },
  {
    name: "get_user_stats",
    description: "Get a user's activity statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: { type: "string" as const, description: "AniList username." },
      },
      required: ["username"],
    },
  },
  {
    name: "get_recommendations_for_media",
    description: "Get recommendations for a media entry by its AniList ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        mediaId: { type: "integer" as const, description: "AniList media ID to get recommendations for." },
        page: { type: "integer" as const, description: "Page number of results to return." },
        perPage: { type: "integer" as const, description: "Number of results per page." },
      },
      required: ["mediaId"],
    },
  },
];

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  get_genres: Empty,
  get_media_tags: Empty,
  get_studio: GetStudio,
  search_anime: SearchMedia,
  search_manga: SearchMedia,
  search_character: SearchByName,
  search_staff: SearchByName,
  search_studio: SearchByName,
  search_user: SearchByName,
  get_anime: ById,
  get_manga: ById,
  get_character: ById,
  get_staff: ById,
  get_todays_birthday_characters: Empty,
  get_todays_birthday_staff: Empty,
  get_user_anime_list: UserList,
  get_user_manga_list: UserList,
  get_user_profile: ByUsername,
  get_user_stats: ByUsername,
  get_recommendations_for_media: Recommendations,
};

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "animeport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  try {
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    return textResult(
      await callAnimeportTool(
        {
          fetchFn,
          token: resolveToken(process.env),
          baseUrl: process.env.ANILIST_API_URL,
        },
        name,
        parsed,
      ),
    );
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
