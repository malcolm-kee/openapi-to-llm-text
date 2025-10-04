# openapi-to-llm-text

Convert OpenAPI specifications to LLM-optimized text.

## Overview

This library transforms OpenAPI specifications (OpenAPI 2.0, 3.0, and 3.1) into a concise, structured text format optimized for Large Language Model (LLM) consumption. It extracts API endpoints, schemas, security configurations, and other relevant information into an easy-to-parse text format.

## Installation

```bash
npm install openapi-to-llm-text
```

## Usage

```typescript
import { openApiToLlmText } from 'openapi-to-llm-text';
import { readFileSync } from 'fs';

// Load your OpenAPI spec
const openApiSpec = JSON.parse(readFileSync('path/to/openapi.json', 'utf-8'));

// Convert to text
const text = openApiToLlmText(openApiSpec);

console.log(text);
```

For YAML files:

```typescript
import { openApiToLlmText } from 'openapi-to-llm-text';
import { readFileSync } from 'fs';
import { parse } from 'yaml';

const openApiSpec = parse(readFileSync('path/to/openapi.yaml', 'utf-8'));
const text = openApiToLlmText(openApiSpec);
```

## Output Format

The generated text includes:

- **API Information**: Title, version, description, and base URL
- **Endpoints**: All HTTP methods with summaries, parameters, request bodies, and responses
- **Schemas**: Data models with property types and requirements
- **Security**: Authentication schemes (OAuth2, API Key, HTTP Bearer, etc.)

### Example Output

```
API: Swagger Petstore - OpenAPI 3.0 v1.0.27
Description: This is a sample Pet Store Server...

Base URL: /api/v3

ENDPOINTS:

GET /pet/{petId}
  Summary: Find pet by ID
  Parameters:
    - petId (path, integer (required)): ID of pet to return
  Responses:
    200: Successful operation
      Content: application/json
      Schema: Pet

SCHEMAS:

Pet:
  - id: integer (format: int64)
  - name: string (required)
  - status: string

SECURITY:
- API Key authentication (header: api_key)
```

## Features

- ✅ Supports OpenAPI 3.0 and 3.1
- ✅ Handles references, compositions (allOf, oneOf, anyOf)
- ✅ Extracts schema properties with required fields
- ✅ Formats arrays and nested objects
- ✅ Includes all HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
- ✅ Captures security schemes

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Watch tests
pnpm test:watch
```

## License

MIT
