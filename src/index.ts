import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

type OpenAPIDocument = OpenAPIV2.Document | OpenAPIV3.Document | OpenAPIV3_1.Document;
type SchemaObject = OpenAPIV2.SchemaObject | OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject;
type ReferenceObject =
  | OpenAPIV2.ReferenceObject
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3_1.ReferenceObject;
type ParameterObject =
  | OpenAPIV2.ParameterObject
  | OpenAPIV3.ParameterObject
  | OpenAPIV3_1.ParameterObject;
type RequestBodyObject = OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject;

function isSwagger2(openApi: any): openApi is OpenAPIV2.Document {
  return 'swagger' in openApi && openApi.swagger === '2.0';
}

export const openApiToLlmText = (openApi: OpenAPIDocument): string => {
  const sections: string[] = [];

  if (isSwagger2(openApi)) {
    // Swagger 2.0
    const baseUrl =
      openApi.host && openApi.basePath
        ? `${openApi.schemes?.[0] || 'https'}://${openApi.host}${openApi.basePath}`
        : undefined;
    sections.push(...formatHeader(openApi.info, baseUrl ? [{ url: baseUrl }] : undefined));
    sections.push(...formatEndpoints(openApi.paths || {}, openApi));

    if (openApi.definitions) {
      sections.push(...formatSchemas(openApi.definitions));
    }

    if (openApi.securityDefinitions) {
      sections.push(...formatSecurity(openApi.securityDefinitions));
    }
  } else {
    // OpenAPI 3.x
    sections.push(...formatHeader(openApi.info, openApi.servers));
    sections.push(...formatEndpoints(openApi.paths || {}, openApi));

    if (openApi.components?.schemas) {
      sections.push(...formatSchemas(openApi.components.schemas));
    }

    if (openApi.components?.securitySchemes) {
      sections.push(...formatSecurity(openApi.components.securitySchemes));
    }
  }

  return sections.join('\n');
};

function formatHeader(
  info: OpenAPIV2.InfoObject | OpenAPIV3.InfoObject | OpenAPIV3_1.InfoObject,
  servers?: Array<{ url: string; description?: string }>
): string[] {
  const sections: string[] = [];

  sections.push(`API: ${info.title} v${info.version}`);

  if (info.description) {
    sections.push(`Description: ${info.description}`);
  }

  if (servers && servers.length > 0) {
    const primaryServer = servers[0];
    sections.push(`\nBase URL: ${primaryServer.url}`);

    if (servers.length > 1) {
      sections.push('Additional URLs:');
      for (let i = 1; i < servers.length; i++) {
        const server = servers[i];
        const description = server.description ? ` (${server.description})` : '';
        sections.push(`  - ${server.url}${description}`);
      }
    }
  }

  return sections;
}

function formatEndpoints(paths: OpenAPIDocument['paths'], openApi: OpenAPIDocument): string[] {
  const sections: string[] = ['\nENDPOINTS:\n'];
  const pathEntries = Object.entries(paths || {});

  for (const [path, pathItem] of pathEntries) {
    if (!pathItem) continue;

    const allPossibleMethods = [
      'get',
      'put',
      'post',
      'delete',
      'options',
      'head',
      'patch',
      'trace',
    ] as const;
    const pathItemKeys = Object.keys(pathItem);
    const methods = pathItemKeys.filter((key) =>
      allPossibleMethods.includes(key as any)
    ) as (typeof allPossibleMethods)[number][];

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      sections.push(...formatOperation(method, path, operation, openApi));
    }
  }

  return sections;
}

function formatOperation(
  method: string,
  path: string,
  operation: any,
  openApi: OpenAPIDocument
): string[] {
  const sections: string[] = [];

  sections.push(`${method.toUpperCase()} ${path}`);

  if (operation.summary) {
    sections.push(`  Summary: ${operation.summary}`);
  }

  if (operation.parameters && operation.parameters.length > 0) {
    sections.push(...formatParameters(operation.parameters, openApi));
  }

  // OpenAPI 3.x has requestBody
  if (operation.requestBody) {
    sections.push(...formatRequestBody(operation.requestBody as RequestBodyObject));
  }

  if (operation.responses) {
    sections.push(...formatResponses(operation.responses));
  }

  sections.push('');

  return sections;
}

function resolveParameterRef(ref: string, openApi: OpenAPIDocument): any {
  // $ref format: #/components/parameters/paramName
  const parts = ref.split('/');
  const paramName = parts[parts.length - 1];

  if (!isSwagger2(openApi)) {
    // OpenAPI 3.x
    const openApi3 = openApi as OpenAPIV3.Document | OpenAPIV3_1.Document;
    return openApi3.components?.parameters?.[paramName];
  } else {
    // Swagger 2.0 has parameters at the top level
    return (openApi as any).parameters?.[paramName];
  }
}

function formatParameters(
  parameters: Array<ParameterObject | ReferenceObject>,
  openApi: OpenAPIDocument
): string[] {
  const sections: string[] = [];
  const paramLines: string[] = [];

  for (const param of parameters) {
    const p = param as any;

    // Resolve $ref parameters
    let resolvedParam = p;
    if ('$ref' in p) {
      resolvedParam = resolveParameterRef(p.$ref, openApi);
      if (!resolvedParam) {
        continue; // Skip if we can't resolve the reference
      }
    }

    const required = resolvedParam.required ? 'required' : 'optional';

    // Swagger 2.0 has type directly on parameter, OpenAPI 3.x has schema
    let type: string;
    if (resolvedParam.schema) {
      type = resolveSchemaType(resolvedParam.schema, { context: 'parameter' });
    } else if (resolvedParam.type) {
      // Swagger 2.0 parameter
      if (resolvedParam.type === 'array') {
        type = 'array';
      } else if (resolvedParam.type === 'file') {
        type = 'file';
      } else {
        type = resolvedParam.type;
        // Handle enum for Swagger 2.0 parameters
        if (resolvedParam.enum && Array.isArray(resolvedParam.enum)) {
          const enumValues = resolvedParam.enum.join(', ');
          type += ` [${enumValues}]`;
        }
      }
    } else {
      type = 'unknown';
    }

    const description = resolvedParam.description || 'No description';
    paramLines.push(
      `    - ${resolvedParam.name || 'undefined'} (${
        resolvedParam.in || 'undefined'
      }, ${type} (${required})): ${description}`
    );
  }

  // Only include Parameters section if there are actual parameters to show
  if (paramLines.length > 0) {
    sections.push('  Parameters:');
    sections.push(...paramLines);
  }

  return sections;
}

function formatRequestBody(requestBody: RequestBodyObject): string[] {
  const sections: string[] = ['  Request Body:'];

  if (requestBody.content) {
    for (const [contentType, mediaType] of Object.entries(requestBody.content)) {
      sections.push(`    Content: ${contentType}`);
      const schemaType = resolveSchemaType(mediaType.schema, { context: 'requestBody' });
      sections.push(`    Schema: ${schemaType}`);
    }
  }

  return sections;
}

function formatResponses(responses: any): string[] {
  const sections: string[] = ['  Responses:'];

  for (const [statusCode, response] of Object.entries(responses)) {
    const resp = response as any;
    sections.push(`    ${statusCode}: ${resp.description || 'No description'}`);

    // OpenAPI 3.x uses content
    if (resp.content) {
      for (const [contentType, mediaType] of Object.entries(resp.content)) {
        sections.push(`      Content: ${contentType}`);
        const schemaType = resolveSchemaType((mediaType as any).schema, { context: 'response' });
        sections.push(`      Schema: ${schemaType}`);
      }
    }
    // Swagger 2.0 uses schema directly
    else if (resp.schema) {
      const schemaType = resolveSchemaType(resp.schema, { context: 'response' });
      sections.push(`      Schema: ${schemaType}`);
    }
  }

  return sections;
}

function formatSchemas(schemas: { [key: string]: SchemaObject | ReferenceObject }): string[] {
  const sections: string[] = ['SCHEMAS:', '> * = required\n'];

  for (const [schemaName, schema] of Object.entries(schemas)) {
    const schemaObj = schema as SchemaObject;

    // Track virtual schemas generated for this parent
    const virtualSchemasForParent: { [key: string]: SchemaObject } = {};
    const result = formatSchema(schemaObj, '  ', schemaName, virtualSchemasForParent);

    // Append type to schema name
    sections.push(`${schemaName}: ${result.type}`);
    sections.push(...result.lines);
    sections.push('');

    // Add virtual schemas immediately after parent
    for (const [virtualName, virtualSchema] of Object.entries(virtualSchemasForParent)) {
      const virtualResult = formatSchema(virtualSchema, '  ', virtualName, {});
      sections.push(`${virtualName}: ${virtualResult.type}`);
      sections.push(...virtualResult.lines);
      sections.push('');
    }
  }

  return sections;
}

function formatSecurity(securitySchemes: any): string[] {
  const sections: string[] = ['SECURITY:'];

  for (const [, scheme] of Object.entries(securitySchemes)) {
    const schemeObj = scheme as any;

    if (schemeObj.type === 'oauth2') {
      sections.push('- OAuth2 authentication');
    } else if (schemeObj.type === 'apiKey') {
      sections.push(`- API Key authentication (${schemeObj.in}: ${schemeObj.name})`);
    } else if (schemeObj.type === 'http') {
      if (schemeObj.scheme === 'bearer') {
        sections.push('- HTTP bearer authentication');
      } else if (schemeObj.scheme === 'basic') {
        sections.push('- HTTP basic authentication');
      } else {
        sections.push(`- HTTP ${schemeObj.scheme} authentication`);
      }
    } else if (schemeObj.type === 'openIdConnect') {
      sections.push('- OpenID Connect authentication');
    } else if (schemeObj.type === 'basic') {
      // Swagger 2.0 basic auth
      sections.push('- HTTP basic authentication');
    }
  }
  sections.push('');

  return sections;
}

type SchemaTypeContext = 'parameter' | 'requestBody' | 'response';

interface ResolveSchemaTypeOptions {
  context: SchemaTypeContext;
  includeFormat?: boolean;
  includeProperties?: boolean;
  limitProperties?: number;
}

function resolveSchemaType(schema: any, options: ResolveSchemaTypeOptions): string {
  const {
    context,
    includeFormat = context === 'response',
    includeProperties = true,
    limitProperties = context === 'requestBody' ? 3 : undefined,
  } = options;
  const unknownValue = context === 'parameter' ? 'unknown' : 'Unknown';

  if (!schema) return unknownValue;

  // Handle $ref
  if ('$ref' in schema) {
    const ref = schema.$ref as string;
    return ref.split('/').pop() || unknownValue;
  }

  const schemaObj = schema as SchemaObject;

  // Handle composition keywords
  if (schemaObj.allOf) {
    if (context === 'requestBody') {
      const schemas = schemaObj.allOf
        .map((s: any) => {
          if (s.$ref) return s.$ref.split('/').pop();
          if (s.type === 'object' && s.properties) {
            const props = Object.keys(s.properties);
            return props.length <= 3
              ? `{${props.join(', ')}}`
              : `{${props.slice(0, 3).join(', ')}, ...}`;
          }
          return s.type || 'inline';
        })
        .join(', ');
      return `allOf: [${schemas}]`;
    }
    return unknownValue;
  }

  if (schemaObj.oneOf) {
    if (context === 'requestBody') {
      const schemas = schemaObj.oneOf
        .map((s: any) => {
          if (s.$ref) return s.$ref.split('/').pop();
          if (s.type === 'object' && s.properties) {
            const props = Object.keys(s.properties);
            return props.length <= 3
              ? `{${props.join(', ')}}`
              : `{${props.slice(0, 3).join(', ')}, ...}`;
          }
          return s.type || 'inline';
        })
        .join(', ');
      return `oneOf: [${schemas}]`;
    }
    return unknownValue;
  }

  if (schemaObj.anyOf) {
    if (context === 'requestBody') {
      const schemas = schemaObj.anyOf
        .map((s: any) => {
          if (s.$ref) return s.$ref.split('/').pop();
          if (s.type === 'object' && s.properties) {
            const props = Object.keys(s.properties);
            return props.length <= 3
              ? `{${props.join(', ')}}`
              : `{${props.slice(0, 3).join(', ')}, ...}`;
          }
          return s.type || 'inline';
        })
        .join(', ');
      return `anyOf: [${schemas}]`;
    }
    return unknownValue;
  }

  // Handle arrays
  if (schemaObj.type === 'array') {
    if (context === 'parameter') {
      return 'array';
    }

    const items = (schemaObj as any).items;
    if (!items) return 'array';

    if ('$ref' in items) {
      const ref = items.$ref as string;
      return `Array of ${ref.split('/').pop() || unknownValue}`;
    }

    if (items.type === 'object') {
      return 'Array of object';
    }

    const itemType = resolveSchemaType(items, options);
    return `Array of ${itemType}`;
  }

  // Handle objects
  if (schemaObj.type === 'object') {
    if (includeProperties && schemaObj.properties && Object.keys(schemaObj.properties).length > 0) {
      const propKeys = Object.keys(schemaObj.properties);
      const propNames =
        limitProperties && propKeys.length > limitProperties
          ? propKeys.slice(0, limitProperties).join(', ') + '...'
          : propKeys.join(', ');
      return `Object (${propNames})`;
    }
    return 'object';
  }

  // Handle primitives with optional format and enum
  if (schemaObj.type === 'string' || schemaObj.type === 'integer' || schemaObj.type === 'number') {
    let typeStr = schemaObj.type;

    if ((schemaObj as any).enum && Array.isArray((schemaObj as any).enum)) {
      const enumValues = (schemaObj as any).enum.join(', ');
      typeStr += ` [${enumValues}]`;
    } else if (includeFormat && schemaObj.format) {
      typeStr += ` (format: ${schemaObj.format})`;
    }

    return typeStr;
  }

  // Handle other types
  if (schemaObj.type && typeof schemaObj.type === 'string') {
    return schemaObj.type;
  }

  return unknownValue;
}

function formatSchema(
  schema: SchemaObject,
  indent: string,
  parentSchemaName?: string,
  virtualSchemasRegistry?: { [key: string]: SchemaObject }
): { type: string; lines: string[] } {
  const lines: string[] = [];

  if (schema.allOf) {
    let inlineCounter = 1;
    const schemas = schema.allOf
      .map((s: any) => {
        if (s.$ref) return s.$ref.split('/').pop();
        if (s.type === 'object' && s.properties) {
          // Create virtual schema
          const virtualName = `<${parentSchemaName}__inline__${inlineCounter++}>`;
          if (virtualSchemasRegistry) {
            virtualSchemasRegistry[virtualName] = s;
          }
          return virtualName;
        }
        return s.type || 'inline';
      })
      .join(', ');
    return { type: `allOf [${schemas}]`, lines };
  }

  if (schema.oneOf) {
    let inlineCounter = 1;
    const schemas = schema.oneOf
      .map((s: any) => {
        if (s.$ref) return s.$ref.split('/').pop();
        if (s.type === 'object' && s.properties) {
          // Create virtual schema
          const virtualName = `<${parentSchemaName}__inline__${inlineCounter++}>`;
          if (virtualSchemasRegistry) {
            virtualSchemasRegistry[virtualName] = s;
          }
          return virtualName;
        }
        return s.type || 'inline';
      })
      .join(', ');
    return { type: `oneOf [${schemas}]`, lines };
  }

  if (schema.anyOf) {
    let inlineCounter = 1;
    const schemas = schema.anyOf
      .map((s: any) => {
        if (s.$ref) return s.$ref.split('/').pop();
        if (s.type === 'object' && s.properties) {
          // Create virtual schema
          const virtualName = `<${parentSchemaName}__inline__${inlineCounter++}>`;
          if (virtualSchemasRegistry) {
            virtualSchemasRegistry[virtualName] = s;
          }
          return virtualName;
        }
        return s.type || 'inline';
      })
      .join(', ');
    return { type: `anyOf [${schemas}]`, lines };
  }

  if (schema.type === 'array') {
    const items = (schema as any).items;
    if (items && typeof items === 'object') {
      if ('$ref' in items) {
        const ref = items.$ref as string;
        lines.push(`${indent}items: ${ref.split('/').pop() || 'unknown'}`);
      } else if (items.type === 'object') {
        lines.push(`${indent}items: object`);
      } else {
        const itemType = resolveSchemaType(items, { context: 'response' });
        lines.push(`${indent}items: ${itemType}`);
      }
    }
    return { type: 'array', lines };
  }

  if (schema.properties) {
    const required = schema.required || [];

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as SchemaObject | ReferenceObject;
      const isRequired = required.includes(propName);
      const requiredMarker = isRequired ? '*' : '';

      let typeStr = '';
      if ('$ref' in prop) {
        typeStr = 'object';
      } else if (prop.allOf) {
        const schemas = prop.allOf.map((s: any) => {
          if (s.$ref) return s.$ref.split('/').pop();
          return s.type || 'inline';
        });
        // If single schema and it's a $ref, just use the ref name
        if (schemas.length === 1 && '$ref' in prop.allOf[0]) {
          typeStr = schemas[0];
        } else {
          typeStr = `allOf [${schemas.join(', ')}]`;
        }
      } else if (prop.oneOf) {
        const schemas = prop.oneOf.map((s: any) => {
          if (s.$ref) return s.$ref.split('/').pop();
          return s.type || 'inline';
        });
        // If single schema and it's a $ref, just use the ref name
        if (schemas.length === 1 && '$ref' in prop.oneOf[0]) {
          typeStr = schemas[0];
        } else {
          typeStr = `oneOf [${schemas.join(', ')}]`;
        }
      } else if (prop.anyOf) {
        const schemas = prop.anyOf.map((s: any) => {
          if (s.$ref) return s.$ref.split('/').pop();
          return s.type || 'inline';
        });
        // If single schema and it's a $ref, just use the ref name
        if (schemas.length === 1 && '$ref' in prop.anyOf[0]) {
          typeStr = schemas[0];
        } else {
          typeStr = `anyOf [${schemas.join(', ')}]`;
        }
      } else if (prop.type === 'array') {
        typeStr = 'array';
      } else if (prop.type === 'object') {
        typeStr = 'object';
      } else if (
        prop.type === 'string' ||
        prop.type === 'integer' ||
        prop.type === 'number' ||
        prop.type === 'boolean'
      ) {
        typeStr = prop.type;
        if ((prop as any).enum && Array.isArray((prop as any).enum)) {
          const enumValues = (prop as any).enum.join(', ');
          typeStr += ` [${enumValues}]`;
        } else if (prop.format) {
          typeStr += ` (format: ${prop.format})`;
        }
      } else if (prop.type && typeof prop.type === 'string') {
        typeStr = prop.type;
      } else if (prop.properties) {
        typeStr = 'object';
      } else {
        typeStr = 'unknown';
      }

      lines.push(`${indent}- ${propName}${requiredMarker}: ${typeStr}`);
    }
    return { type: 'object', lines };
  }

  // Handle primitive types
  if (
    schema.type === 'string' ||
    schema.type === 'integer' ||
    schema.type === 'number' ||
    schema.type === 'boolean'
  ) {
    let typeStr = schema.type;
    if ((schema as any).enum && Array.isArray((schema as any).enum)) {
      const enumValues = (schema as any).enum.join(', ');
      typeStr += ` [${enumValues}]`;
    } else if (schema.format) {
      typeStr += ` (format: ${schema.format})`;
    }
    return { type: typeStr, lines };
  }

  // Handle other types
  if (schema.type && typeof schema.type === 'string') {
    return { type: schema.type, lines };
  }

  return { type: 'unknown', lines };
}
