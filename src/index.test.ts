import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import { openApiToLlmText } from './index';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

describe('openApiToLlmText', () => {
  it('should convert petstore.json to markdown', () => {
    const openApiSpec = JSON.parse(
      readFileSync(join(__dirname, '../examples/openapi/petstore.json'), 'utf-8')
    ) as OpenAPIV3.Document;

    const expectedMarkdown = readFileSync(
      join(__dirname, '../examples/output/petstore.txt'),
      'utf-8'
    );

    const result = openApiToLlmText(openApiSpec);

    expect(result).toBe(expectedMarkdown);
  });

  it('should convert zendesk.yaml to markdown', () => {
    const openApiSpec = parse(
      readFileSync(join(__dirname, '../examples/openapi/zendesk.yaml'), 'utf-8')
    ) as OpenAPIV3.Document | OpenAPIV3_1.Document;

    const expectedMarkdown = readFileSync(
      join(__dirname, '../examples/output/zendesk.txt'),
      'utf-8'
    );

    const result = openApiToLlmText(openApiSpec);

    expect(result).toBe(expectedMarkdown);
  });

  it('should convert petstore-v2.json (Swagger 2.0) to markdown', () => {
    const openApiSpec = JSON.parse(
      readFileSync(join(__dirname, '../examples/openapi/petstore-v2.json'), 'utf-8')
    );

    const expectedMarkdown = readFileSync(
      join(__dirname, '../examples/output/petstore-v2.txt'),
      'utf-8'
    );

    const result = openApiToLlmText(openApiSpec);

    expect(result).toBe(expectedMarkdown);
  });
});
