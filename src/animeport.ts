/**
 * animeport core: a read-only client for the AniList GraphQL API.
 *
 * Clean-room reconstruction from the public README tool list of
 * yuna0x0/anilist-mcp. Each tool sends exactly one GraphQL query by
 * POST to https://graphql.anilist.co with a JSON body of
 * { query, variables }. The GraphQL `data` payload is returned as-is.
 * If the response carries a GraphQL `errors` array, the first error's
 * message is thrown. ANILIST_TOKEN is optional: when set it is sent
 * as a Bearer token; when absent the request goes out keyless, which
 * AniList accepts for these read tools. All HTTP goes through an
 * injected FetchFn so the request shaping is fully testable offline.
 * Field selections are fresh, sensible reconstructions — the README
 * documents tool names and purposes, not GraphQL field selections.
 */
import type { CallDeps, GraphQLRequest } from "./types.js";

export const VERSION = "0.1.0";

export const TOKEN_ENV = "ANILIST_TOKEN";
export const API_URL_ENV = "ANILIST_API_URL";
export const DEFAULT_BASE_URL = "https://graphql.anilist.co";

export const TOOL_NAMES = [
  "get_genres",
  "get_media_tags",
  "get_studio",
  "search_anime",
  "search_manga",
  "search_character",
  "search_staff",
  "search_studio",
  "search_user",
  "get_anime",
  "get_manga",
  "get_character",
  "get_staff",
  "get_todays_birthday_characters",
  "get_todays_birthday_staff",
  "get_user_anime_list",
  "get_user_manga_list",
  "get_user_profile",
  "get_user_stats",
  "get_recommendations_for_media",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/** Read the optional token out of an environment map (never an error). */
export function resolveToken(
  env: Record<string, string | undefined>,
): string | undefined {
  const raw = typeof env[TOKEN_ENV] === "string" ? env[TOKEN_ENV].trim() : "";
  return raw ? raw : undefined;
}

export function resolveBaseUrl(
  explicit?: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = (explicit ?? env[API_URL_ENV] ?? DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

function optString(args: Record<string, unknown>, field: string): string | undefined {
  const v = args[field];
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !v.trim()) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function reqString(args: Record<string, unknown>, field: string): string {
  const v = optString(args, field);
  if (v === undefined) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function optInt(args: Record<string, unknown>, field: string): number | undefined {
  const v = args[field];
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return v;
}

function reqInt(args: Record<string, unknown>, field: string): number {
  const v = optInt(args, field);
  if (v === undefined) throw new Error(`${field} must be a positive integer`);
  return v;
}

function paging(args: Record<string, unknown>, variables: Record<string, unknown>): void {
  const page = optInt(args, "page");
  const perPage = optInt(args, "perPage");
  if (page !== undefined) variables.page = page;
  if (perPage !== undefined) variables.perPage = perPage;
}

const MEDIA_FIELDS = `id title { romaji english native } format status description averageScore genres coverImage { large } bannerImage siteUrl`;
const PAGE_INFO = `pageInfo { total currentPage lastPage hasNextPage perPage }`;

/** Build the single GraphQL request for one tool; validates args first. */
export function buildRequest(tool: string, args: Record<string, unknown>): GraphQLRequest {
  const a = args ?? {};
  switch (tool) {
    case "get_genres":
      return { query: `query { GenreCollection }`, variables: {} };
    case "get_media_tags":
      return {
        query: `query { MediaTagCollection { id name description category isAdult } }`,
        variables: {},
      };
    case "get_studio": {
      const id = optInt(a, "id");
      const name = optString(a, "name");
      if (id === undefined && name === undefined) {
        throw new Error("get_studio requires at least one of id or name");
      }
      const variables: Record<string, unknown> = {};
      if (id !== undefined) variables.id = id;
      if (name !== undefined) variables.search = name;
      return {
        query: `query ($id: Int, $search: String) { Studio(id: $id, search: $search) { id name isAnimationStudio favourites siteUrl media { nodes { ${MEDIA_FIELDS} } } } }`,
        variables,
      };
    }
    case "search_anime":
    case "search_manga": {
      const isAnime = tool === "search_anime";
      const variables: Record<string, unknown> = {};
      paging(a, variables);
      const search = optString(a, "search");
      const genre = optString(a, "genre");
      const seasonYear = optInt(a, "seasonYear");
      if (search !== undefined) variables.search = search;
      if (genre !== undefined) variables.genre = genre;
      if (seasonYear !== undefined) variables.seasonYear = seasonYear;
      const extra = isAnime
        ? "episodes season seasonYear duration"
        : "chapters volumes";
      return {
        query: `query ($page: Int, $perPage: Int, $search: String, $genre: String, $seasonYear: Int) { Page(page: $page, perPage: $perPage) { ${PAGE_INFO} media(search: $search, type: ${isAnime ? "ANIME" : "MANGA"}, genre: $genre, seasonYear: $seasonYear) { ${MEDIA_FIELDS} ${extra} } } }`,
        variables,
      };
    }
    case "search_character":
    case "search_staff":
    case "search_studio":
    case "search_user": {
      const variables: Record<string, unknown> = { search: reqString(a, "search") };
      paging(a, variables);
      if (tool === "search_character") {
        return {
          query: `query ($page: Int, $perPage: Int, $search: String) { Page(page: $page, perPage: $perPage) { ${PAGE_INFO} characters(search: $search) { id name { full native } image { large } gender dateOfBirth { year month day } favourites } } }`,
          variables,
        };
      }
      if (tool === "search_staff") {
        return {
          query: `query ($page: Int, $perPage: Int, $search: String) { Page(page: $page, perPage: $perPage) { ${PAGE_INFO} staff(search: $search) { id name { full native } image { large } languageV2 primaryOccupations favourites } } }`,
          variables,
        };
      }
      if (tool === "search_studio") {
        return {
          query: `query ($page: Int, $perPage: Int, $search: String) { Page(page: $page, perPage: $perPage) { ${PAGE_INFO} studios(search: $search) { id name isAnimationStudio favourites } } }`,
          variables,
        };
      }
      return {
        query: `query ($page: Int, $perPage: Int, $search: String) { Page(page: $page, perPage: $perPage) { ${PAGE_INFO} users(search: $search) { id name avatar { large } siteUrl } } }`,
        variables,
      };
    }
    case "get_anime":
    case "get_manga": {
      const isAnime = tool === "get_anime";
      const extra = isAnime
        ? "episodes season seasonYear duration studios { nodes { id name } }"
        : "chapters volumes";
      return {
        query: `query ($id: Int) { Media(id: $id, type: ${isAnime ? "ANIME" : "MANGA"}) { ${MEDIA_FIELDS} ${extra} meanScore popularity favourites startDate { year month day } endDate { year month day } characters { nodes { id name { full } } } staff { nodes { id name { full } } } } }`,
        variables: { id: reqInt(a, "id") },
      };
    }
    case "get_character":
      return {
        query: `query ($id: Int) { Character(id: $id) { id name { full native alternative } image { large } description gender dateOfBirth { year month day } bloodType age favourites siteUrl media { nodes { ${MEDIA_FIELDS} } } } }`,
        variables: { id: reqInt(a, "id") },
      };
    case "get_staff":
      return {
        query: `query ($id: Int) { Staff(id: $id) { id name { full native alternative } image { large } description languageV2 primaryOccupations gender dateOfBirth { year month day } yearsActive favourites siteUrl characters { nodes { id name { full } } } staffMedia { nodes { ${MEDIA_FIELDS} } } } }`,
        variables: { id: reqInt(a, "id") },
      };
    case "get_todays_birthday_characters":
      return {
        query: `query { Page { ${PAGE_INFO} characters(isBirthday: true) { id name { full native } image { large } dateOfBirth { year month day } favourites } } }`,
        variables: {},
      };
    case "get_todays_birthday_staff":
      return {
        query: `query { Page { ${PAGE_INFO} staff(isBirthday: true) { id name { full native } image { large } dateOfBirth { year month day } favourites } } }`,
        variables: {},
      };
    case "get_user_anime_list":
    case "get_user_manga_list": {
      const isAnime = tool === "get_user_anime_list";
      const variables: Record<string, unknown> = { username: reqString(a, "username") };
      const status = optString(a, "status");
      if (status !== undefined) variables.status = status;
      return {
        query: `query ($username: String, $status: MediaListStatus) { MediaListCollection(userName: $username, type: ${isAnime ? "ANIME" : "MANGA"}, status: $status) { lists { name status entries { id status score progress progressVolumes updatedAt media { ${MEDIA_FIELDS} } } } } }`,
        variables,
      };
    }
    case "get_user_profile":
      return {
        query: `query ($username: String) { User(name: $username) { id name avatar { large } bannerImage about options { titleLanguage } siteUrl createdAt } }`,
        variables: { username: reqString(a, "username") },
      };
    case "get_user_stats":
      return {
        query: `query ($username: String) { User(name: $username) { id name statistics { anime { count meanScore standardDeviation minutesWatched episodesWatched } manga { count meanScore standardDeviation chaptersRead volumesRead } } } }`,
        variables: { username: reqString(a, "username") },
      };
    case "get_recommendations_for_media": {
      const variables: Record<string, unknown> = { mediaId: reqInt(a, "mediaId") };
      paging(a, variables);
      return {
        query: `query ($page: Int, $perPage: Int, $mediaId: Int) { Page(page: $page, perPage: $perPage) { ${PAGE_INFO} recommendations(mediaId: $mediaId) { id rating userRating media { ${MEDIA_FIELDS} } mediaRecommendation { ${MEDIA_FIELDS} } user { id name } } } }`,
        variables,
      };
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

/** Generic entry point used by the MCP server and the CLI. */
export async function callAnimeportTool(
  deps: CallDeps,
  tool: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const request = buildRequest(tool, args ?? {});
  const url = resolveBaseUrl(deps.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = typeof deps.token === "string" ? deps.token.trim() : "";
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await deps.fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });
  } catch (err) {
    throw new Error(
      `AniList API request to ${url} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const bodyText = await response.text();
  let parsed: unknown;
  try {
    parsed = bodyText.trim() ? (JSON.parse(bodyText) as unknown) : undefined;
  } catch {
    parsed = undefined;
  }
  if (parsed && typeof parsed === "object") {
    const errors = (parsed as { errors?: unknown }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const first = errors[0] as { message?: unknown };
      throw new Error(
        typeof first?.message === "string" ? first.message : "AniList GraphQL error",
      );
    }
    if (response.ok) {
      return (parsed as { data?: unknown }).data ?? parsed;
    }
  }
  if (!response.ok) {
    const excerpt = bodyText.trim().slice(0, 500);
    throw new Error(
      `AniList API error ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${excerpt ? `: ${excerpt}` : ""}`,
    );
  }
  return parsed ?? bodyText;
}
