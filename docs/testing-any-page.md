---
title: Testing MCP Any Page
group: Getting Started
description: Practical ways to test page-native MCP tools over postMessage, including Playwright MCP workflows.
---

# Testing MCP Any Page

MCP Any Page lets an existing web page expose `tools/list` and `tools/call`
over `window.postMessage`.

This guide focuses on practical testing workflows.

## Recommended: test with Playwright MCP

If you already use an agent with Playwright MCP (for example Copilot CLI or
Claude Code + Playwright MCP), this is the fastest way to validate Any Page
behavior end-to-end:

1. Open the target page in a real browser session through Playwright.
2. Send `tools/list` by posting JSON-RPC to the page window.
3. Assert that the response contains your expected tool definitions.
4. Send `tools/call` with representative arguments.
5. Assert the tool result and visible page state updates.

Because the agent is driving the browser, it can also validate UI outcomes in
the same run (DOM assertions/screenshots) after each tool call.

## Quick manual check in browser DevTools

For fast local checks, run this in the page console:

```js
const request = (payload) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 3000);
    const onMessage = (event) => {
      const data = event.data;
      if (
        data?.id === payload.id &&
        (Object.prototype.hasOwnProperty.call(data, "result") ||
          Object.prototype.hasOwnProperty.call(data, "error"))
      ) {
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(data);
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage(payload, "*");
  });

await request({ jsonrpc: "2.0", id: "1", method: "tools/list", params: {} });
await request({
  jsonrpc: "2.0",
  id: "2",
  method: "tools/call",
  params: { name: "get_spec", arguments: {} },
});
```

## Native browser + sidecar/extension pattern

Any setup that can hold a page window reference and call `postMessage` works:

- Browser extension tool panels
- Sidecar chat UIs integrated with the current tab
- Same-page injected scripts

The transport requirement is simple: send JSON-RPC request objects to the page
window and correlate async responses by `id`.

## Example target in this repo

Use the worked example here:

- `examples/any-page-vega/index.html`

It exposes `set_spec` and `get_spec` and is useful as a known-good fixture for
Playwright MCP or manual DevTools testing.
