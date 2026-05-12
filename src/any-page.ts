export type AnyPageJsonRpcId = string | number | null;

export interface AnyPageTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown> | unknown;
}

export interface RegisterAnyPageToolsOptions {
  allowOrigin?: (origin: string, event: MessageEvent) => boolean;
}

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: AnyPageJsonRpcId;
  method: string;
  params?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Register page capabilities as MCP tools over `window.postMessage`.
 *
 * Returns an unsubscribe function that removes the message listener.
 */
export function registerAnyPageTools(
  tools: readonly AnyPageTool[],
  options: RegisterAnyPageToolsOptions = {},
): () => void {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const listedTools = tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));

  const listener = async (event: MessageEvent) => {
    if (options.allowOrigin && !options.allowOrigin(event.origin, event)) {
      return;
    }
    if (!isObject(event.data) || event.data.jsonrpc !== "2.0") {
      return;
    }

    const request = event.data as JsonRpcRequest;
    if (!("id" in request)) {
      return;
    }

    const source = event.source;
    if (!source || typeof source.postMessage !== "function") {
      return;
    }

    const respond = (body: { result?: unknown; error?: unknown }) => {
      (source as WindowProxy).postMessage(
        { jsonrpc: "2.0", id: request.id, ...body },
        "*",
      );
    };

    if (request.method === "tools/list") {
      respond({ result: { tools: listedTools } });
      return;
    }

    if (request.method === "tools/call") {
      if (
        !isObject(request.params) ||
        typeof request.params.name !== "string"
      ) {
        respond({ error: { code: -32602, message: "Invalid params" } });
        return;
      }

      const tool = byName.get(request.params.name);
      if (!tool) {
        respond({ error: { code: -32602, message: "Unknown tool" } });
        return;
      }

      try {
        const args =
          isObject(request.params) && "arguments" in request.params
            ? request.params.arguments
            : {};
        respond({ result: await tool.handler(args) });
      } catch (error) {
        respond({
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Internal error",
          },
        });
      }
      return;
    }

    respond({ error: { code: -32601, message: "Method not found" } });
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
