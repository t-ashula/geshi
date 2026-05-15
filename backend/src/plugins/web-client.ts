import type {
  GetWebClientInput,
  PluginLogger,
  PluginWebClient,
} from "./types.js";
import { WebClient } from "./types.js";

export function getWebClient(
  input: GetWebClientInput,
  _logger: PluginLogger,
): Promise<PluginWebClient> {
  return Promise.resolve(WebClient.create(input));
}

export async function fetchWithBrowser(
  request: Request,
  _logger: PluginLogger,
): Promise<Response> {
  return WebClient.create({ kind: "browser" }).fetch(request);
}
