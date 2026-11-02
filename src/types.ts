/**
 * animeport types.
 *
 * Every tool takes a small JSON argument object (an AniList ID, a
 * search string, paging options, or a username) and returns the
 * `data` payload of the AniList GraphQL response. An AniList token is
 * optional: it is read from the environment by the caller and passed
 * in explicitly so tests never depend on ambient state.
 */

export interface SearchMediaArgs {
  search?: string;
  page?: number;
  perPage?: number;
  genre?: string;
  seasonYear?: number;
}

export interface SearchByNameArgs {
  search: string;
  page?: number;
  perPage?: number;
}

export interface GetStudioArgs {
  id?: number;
  name?: string;
}

export interface IdArgs {
  id: number;
}

export interface UserListArgs {
  username: string;
  status?: string;
}

export interface UsernameArgs {
  username: string;
}

export interface RecommendationsArgs {
  mediaId: number;
  page?: number;
  perPage?: number;
}

export type ToolArgs = Record<string, unknown>;

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface CallDeps {
  fetchFn: FetchFn;
  token?: string;
  baseUrl?: string;
}

export interface GraphQLRequest {
  query: string;
  variables: Record<string, unknown>;
}
