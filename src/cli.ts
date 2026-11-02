#!/usr/bin/env node
/**
 * animeport CLI.
 *
 *   animeport <tool-name> '<json-arguments>'
 *   animeport mcp
 *   animeport --version
 *
 * <tool-name> is any of the 20 MCP tool names, e.g.
 *   animeport search_anime '{"search":"Frieren","perPage":5}'
 *   animeport get_anime '{"id":154587}'
 *   animeport get_user_profile '{"username":"someone"}'
 *
 * ANILIST_TOKEN is optional (Bearer token when set; the read tools
 * work keyless). ANILIST_API_URL optionally overrides the default
 * https://graphql.anilist.co endpoint.
 * Exit codes: 0 success, 1 operation error, 2 usage error.
 */
import { callAnimeportTool, resolveToken, TOOL_NAMES, VERSION } from "./animeport.js";
import type { FetchFn } from "./types.js";

function usage(): never {
  console.error(`Usage:
  animeport <tool-name> '<json-arguments>'
  animeport mcp
  animeport --version
Tools: ${TOOL_NAMES.join(", ")}`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd || !(TOOL_NAMES as readonly string[]).includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) usage();
      args = parsed as Record<string, unknown>;
    } catch {
      usage();
    }
  }
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  try {
    const result = await callAnimeportTool(
      { fetchFn, token: resolveToken(process.env), baseUrl: process.env.ANILIST_API_URL },
      cmd,
      args,
    );
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
