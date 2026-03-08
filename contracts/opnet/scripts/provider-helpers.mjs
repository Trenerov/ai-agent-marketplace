import { JSONRpcProvider } from "opnet";
import { ProxyAgent, fetch as undiciFetch } from "undici";

export function createRpcProvider({ url, network }) {
  const provider = new JSONRpcProvider({ url, network });
  const proxyUrl =
    process.env.OPNET_HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    "";

  if (!proxyUrl) {
    return provider;
  }

  const dispatcher = new ProxyAgent(proxyUrl);

  provider._fetcherWithCleanup = {
    fetch: (input, init) => undiciFetch(input, { ...init, dispatcher }),
    close: async () => {
      await dispatcher.close();
    },
  };

  return provider;
}
