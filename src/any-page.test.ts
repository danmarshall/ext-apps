import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { registerAnyPageTools } from "./any-page";

type MessageListener = (event: MessageEvent) => void;

function createFakeWindow() {
  const listeners = new Set<MessageListener>();
  return {
    addEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.add(listener);
    },
    removeEventListener(type: string, listener: MessageListener) {
      if (type === "message") listeners.delete(listener);
    },
    dispatch(event: MessageEvent) {
      listeners.forEach((listener) => listener(event));
    },
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("registerAnyPageTools", () => {
  let fakeWindow: ReturnType<typeof createFakeWindow>;

  beforeEach(() => {
    fakeWindow = createFakeWindow();
    (globalThis as { window?: unknown }).window = fakeWindow;
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("responds to tools/list with registered tool metadata", async () => {
    const postMessage = mock(() => {});
    registerAnyPageTools([
      {
        name: "get_spec",
        description: "Get current spec",
        inputSchema: { type: "object", properties: {} },
        handler: () => ({ content: [] }),
      },
    ]);

    fakeWindow.dispatch({
      data: { jsonrpc: "2.0", id: "1", method: "tools/list", params: {} },
      origin: "https://agent.example",
      source: { postMessage },
    } as unknown as MessageEvent);
    await flush();

    expect(postMessage).toHaveBeenCalledWith(
      {
        jsonrpc: "2.0",
        id: "1",
        result: {
          tools: [
            {
              name: "get_spec",
              description: "Get current spec",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      },
      "https://agent.example",
    );
  });

  it("responds to tools/call and awaits async handlers", async () => {
    const postMessage = mock(() => {});
    registerAnyPageTools([
      {
        name: "set_spec",
        description: "Set spec",
        inputSchema: {
          type: "object",
          properties: { spec: { type: "object" } },
        },
        handler: async (args) => ({
          content: [
            {
              type: "text",
              text: `Received ${JSON.stringify(args)}`,
            },
          ],
        }),
      },
    ]);

    fakeWindow.dispatch({
      data: {
        jsonrpc: "2.0",
        id: "2",
        method: "tools/call",
        params: { name: "set_spec", arguments: { spec: { mark: "bar" } } },
      },
      origin: "https://agent.example",
      source: { postMessage },
    } as unknown as MessageEvent);
    await flush();

    expect(postMessage).toHaveBeenCalledWith(
      {
        jsonrpc: "2.0",
        id: "2",
        result: {
          content: [
            {
              type: "text",
              text: 'Received {"spec":{"mark":"bar"}}',
            },
          ],
        },
      },
      "https://agent.example",
    );
  });

  it("returns JSON-RPC errors for invalid params and unknown methods", async () => {
    const postMessage = mock(() => {});
    registerAnyPageTools([
      {
        name: "get_spec",
        inputSchema: { type: "object", properties: {} },
        handler: () => ({ content: [] }),
      },
    ]);

    fakeWindow.dispatch({
      data: { jsonrpc: "2.0", id: "3", method: "tools/call", params: {} },
      origin: "https://agent.example",
      source: { postMessage },
    } as unknown as MessageEvent);

    fakeWindow.dispatch({
      data: { jsonrpc: "2.0", id: "4", method: "unknown/method", params: {} },
      origin: "https://agent.example",
      source: { postMessage },
    } as unknown as MessageEvent);
    await flush();

    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      {
        jsonrpc: "2.0",
        id: "3",
        error: { code: -32602, message: "Invalid params" },
      },
      "https://agent.example",
    );
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      {
        jsonrpc: "2.0",
        id: "4",
        error: { code: -32601, message: "Method not found" },
      },
      "https://agent.example",
    );
  });

  it("supports optional origin filtering", async () => {
    const postMessage = mock(() => {});
    registerAnyPageTools(
      [
        {
          name: "get_spec",
          inputSchema: { type: "object", properties: {} },
          handler: () => ({ content: [] }),
        },
      ],
      { allowOrigin: (origin) => origin === "https://allowed.example" },
    );

    fakeWindow.dispatch({
      data: { jsonrpc: "2.0", id: "5", method: "tools/list", params: {} },
      origin: "https://blocked.example",
      source: { postMessage },
    } as unknown as MessageEvent);
    await flush();

    expect(postMessage).not.toHaveBeenCalled();
  });
});
