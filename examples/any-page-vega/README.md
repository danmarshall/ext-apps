# MCP Any Page Vega-Lite Example

Minimal page-first example for MCP Any Page postMessage transport.

## Run locally

```bash
npm run build
python3 -m http.server 8080
```

Then open:

`http://localhost:8080/examples/any-page-vega/index.html`

The page exposes two MCP tools over `postMessage`:

- `set_spec`
- `get_spec`
