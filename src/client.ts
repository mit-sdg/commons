import {
  createHttpClient,
  type Client as EngineClient,
  type HttpClientOptions,
} from "@mit-sdg/sync-engine/client";
import type { CommonsWire as GeneratedCommonsWire, CommonsWireHttp } from "../generated/wire.ts";

export type CommonsWire = GeneratedCommonsWire;
export type CommonsBrowserWire = CommonsWireHttp;

export type CommonsClient = EngineClient<CommonsBrowserWire>;

export function createCommonsClient(options: HttpClientOptions = {}): CommonsClient {
  return createHttpClient<CommonsBrowserWire>({
    credentials: "include",
    ...options,
  });
}
