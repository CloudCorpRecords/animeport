import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRequest,
  callAnimeportTool,
  resolveBaseUrl,
  resolveToken,
  VERSION,
} from "../src/animeport.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

function fakeFetch(
  body: string,
  opts: { ok?: boolean; status?: number; statusText?: string } = {},
  capture?: { url?: string; init?: unknown },
): FetchFn {
  return async (url, init) => {
    if (capture) {
      capture.url = url;
      capture.init = init;
    }
    const response: HttpResponse = {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      statusText: opts.statusText ?? "",
      headers: { get: () => null },
      text: async () => body,
    };
    return response;
  };
}

const deps = (fetchFn: FetchFn) => ({ fetchFn });

describe("version, base url, and optional token", () => {
  it("exposes version and resolves defaults", () => {
    assert.equal(VERSION, "0.1.0");
    assert.equal(resolveBaseUrl(undefined, {}), "https://graphql.anilist.co");
    assert.equal(resolveBaseUrl("https://example.test/", {}), "https://example.test");
  });

  it("treats a missing token as undefined, never an error", () => {
    assert.equal(resolveToken({}), undefined);
    assert.equal(resolveToken({ ANILIST_TOKEN: "  " }), undefined);
    assert.equal(resolveToken({ ANILIST_TOKEN: " tok " }), "tok");
  });
});

describe("request shaping", () => {
  it("POSTs one GraphQL query keyless by default and returns data", async () => {
    const capture: { url?: string; init?: unknown } = {};
    const result = await callAnimeportTool(
      deps(fakeFetch('{"data":{"GenreCollection":["Action","Drama"]}}', {}, capture)),
      "get_genres",
      {},
    );
    assert.deepEqual(result, { GenreCollection: ["Action", "Drama"] });
    assert.equal(capture.url, "https://graphql.anilist.co");
    const init = capture.init as {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers.Authorization, undefined);
    const body = JSON.parse(init.body) as { query: string; variables: unknown };
    assert.match(body.query, /GenreCollection/);
    assert.deepEqual(body.variables, {});
  });

  it("sends the Bearer token only when one is set", async () => {
    const capture: { url?: string; init?: unknown } = {};
    await callAnimeportTool(
      { fetchFn: fakeFetch('{"data":{}}', {}, capture), token: "secret-token" },
      "get_media_tags",
      {},
    );
    const init = capture.init as { headers: Record<string, string> };
    assert.equal(init.headers.Authorization, "Bearer secret-token");
  });

  it("search_anime shapes a Page/media query with its variables", async () => {
    const req = buildRequest("search_anime", {
      search: "Frieren",
      page: 2,
      perPage: 5,
      genre: "Fantasy",
      seasonYear: 2023,
    });
    assert.match(req.query, /type: ANIME/);
    assert.match(req.query, /media\(search: \$search/);
    assert.deepEqual(req.variables, {
      page: 2,
      perPage: 5,
      search: "Frieren",
      genre: "Fantasy",
      seasonYear: 2023,
    });
    const manga = buildRequest("search_manga", {});
    assert.match(manga.query, /type: MANGA/);
    assert.deepEqual(manga.variables, {});
  });

  it("get_studio maps name to the search variable", () => {
    assert.deepEqual(buildRequest("get_studio", { name: "Kyoto Animation" }).variables, {
      search: "Kyoto Animation",
    });
    assert.deepEqual(buildRequest("get_studio", { id: 2 }).variables, { id: 2 });
    assert.throws(() => buildRequest("get_studio", {}), /at least one of id or name/);
  });

  it("birthday tools query isBirthday pages", () => {
    assert.match(buildRequest("get_todays_birthday_characters", {}).query, /characters\(isBirthday: true\)/);
    assert.match(buildRequest("get_todays_birthday_staff", {}).query, /staff\(isBirthday: true\)/);
  });

  it("user list, profile, stats, and recommendations shape correctly", () => {
    const list = buildRequest("get_user_anime_list", { username: "someone", status: "CURRENT" });
    assert.match(list.query, /MediaListCollection\(userName: \$username, type: ANIME/);
    assert.deepEqual(list.variables, { username: "someone", status: "CURRENT" });
    assert.match(buildRequest("get_user_manga_list", { username: "someone" }).query, /type: MANGA/);
    assert.match(buildRequest("get_user_profile", { username: "someone" }).query, /User\(name: \$username\)/);
    assert.match(buildRequest("get_user_stats", { username: "someone" }).query, /statistics/);
    const recs = buildRequest("get_recommendations_for_media", { mediaId: 1, page: 1 });
    assert.deepEqual(recs.variables, { mediaId: 1, page: 1 });
    assert.match(recs.query, /recommendations\(mediaId: \$mediaId\)/);
  });
});

describe("GraphQL error handling", () => {
  it("throws the first GraphQL error message", async () => {
    await assert.rejects(
      callAnimeportTool(
        deps(fakeFetch('{"errors":[{"message":"Not Found."},{"message":"Other"}]}')),
        "get_anime",
        { id: 999999 },
      ),
      /Not Found\./,
    );
  });

  it("surfaces upstream HTTP errors with status and excerpt", async () => {
    await assert.rejects(
      callAnimeportTool(
        deps(fakeFetch("gateway exploded", { ok: false, status: 502, statusText: "Bad Gateway" })),
        "get_genres",
        {},
      ),
      /502.*gateway exploded/,
    );
  });

  it("wraps fetch failures with the endpoint in the message", async () => {
    const fetchFn: FetchFn = async () => {
      throw new Error("fetch failed");
    };
    await assert.rejects(callAnimeportTool({ fetchFn }, "get_genres", {}), /AniList API request.*fetch failed/);
  });
});

describe("local validation", () => {
  it("rejects missing or malformed required arguments", () => {
    assert.throws(() => buildRequest("get_anime", {}), /id must be a positive integer/);
    assert.throws(() => buildRequest("get_anime", { id: 0 }), /id must be a positive integer/);
    assert.throws(() => buildRequest("get_anime", { id: 1.5 }), /id must be a positive integer/);
    assert.throws(() => buildRequest("search_character", {}), /search must be a non-empty string/);
    assert.throws(() => buildRequest("get_user_profile", { username: " " }), /username must be/);
    assert.throws(() => buildRequest("get_recommendations_for_media", {}), /mediaId must be/);
    assert.throws(() => buildRequest("search_anime", { page: 0 }), /page must be a positive integer/);
    assert.throws(() => buildRequest("unknown_tool", {}), /Unknown tool/);
  });
});
