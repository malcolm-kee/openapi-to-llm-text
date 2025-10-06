# AGENTS.md

This file provides guidance to all coding agents (Claude Code, Cursor, Codex, Copilot etc) when working with code in this repository.

## Overview

This library converts OpenAPI specifications (v2.0, 3.0, 3.1) to LLM-optimized text format. The core transformation logic is in [src/index.ts](src/index.ts), which extracts endpoints, schemas, security configurations, and formats them into structured text.

## Development Workflow

After making changes, use `pnpm test` to check the outputs. Test failure may not necessarily indicates a bug, it could also means the example outputs are outdated, which you can update using `pnpm sync-examples` command.

Before conclude the edit, run `pnpm build` to make sure the source code can be built successfully.

## Commands

- Use `pnpm` instead of `npm` or `yarn`.

### Development

- **Build**: `pnpm build` - Compiles TypeScript to CommonJS and ESM formats using tsup
- **Test**: `pnpm test` - Runs all tests using vitest
- **Watch tests**: `pnpm test:watch` - Runs tests in watch mode
- **Sync examples**: `pnpm sync-examples` - Regenerates example outputs (builds first, then processes all OpenAPI examples)

### Running Single Test

```bash
pnpm test -- -t "test name pattern"
```

## Architecture

### Core Transformation Pipeline

The main export `openApiToLlmText()` follows this flow:

1. **Version Detection**: Detects Swagger 2.0 vs OpenAPI 3.x using `isSwagger2()`
2. **Header Formatting**: Extracts API metadata (title, version, base URLs)
3. **Endpoint Processing**: Iterates all paths and HTTP methods, formatting:
   - Parameters (with $ref resolution)
   - Request bodies (OpenAPI 3.x only)
   - Responses with content types and schemas
4. **Schema Formatting**: Extracts component schemas with type details and required fields
5. **Security Formatting**: Documents authentication schemes

### Key Type Handling

- **Schema Resolution** (`resolveSchemaType()`): Handles $ref, allOf/oneOf/anyOf compositions, arrays, and primitives. Behavior varies by context (parameter/requestBody/response)
- **Parameter Resolution** (`resolveParameterRef()`): Resolves $ref parameters from different locations in Swagger 2.0 vs OpenAPI 3.x
- **Format Variations**: Response schemas include format info; request body schemas show limited properties (max 3); parameter schemas are minimal

### Example System

The `sync-examples.js` script:
1. Builds the source
2. Loads example OpenAPI specs from `examples/openapi/`
3. Generates text outputs to `examples/output/`
4. Tests verify outputs match expected results

This ensures consistency between code changes and documented examples.
