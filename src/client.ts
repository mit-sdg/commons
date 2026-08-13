import type { Client as EngineClient } from "@mit-sdg/sync-engine/client";
import {
  createHttpClient,
  type HttpClientError,
  type HttpClientOptions,
} from "@mit-sdg/sync-engine-http/client";
import type { CommonsWire as GeneratedCommonsWire, CommonsWireHttp } from "../generated/wire.ts";

export type CommonsWire = GeneratedCommonsWire;
export type CommonsBrowserWire = CommonsWireHttp;

export type CommonsClient = EngineClient<CommonsBrowserWire, HttpClientError>;

export function createCommonsClient(options: HttpClientOptions = {}): CommonsClient {
  return createHttpClient<CommonsBrowserWire>({
    credentials: "include",
    ...options,
  });
}
