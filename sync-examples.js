#!/usr/bin/env node

const { readFileSync, writeFileSync } = require('node:fs');
const { parse } = require('yaml');

console.log('\nGenerating example outputs...');

// Load the built module
const { openApiToLlmText } = require('./dist/index.js');

// Example files to process
const examples = [
  {
    input: 'examples/openapi/petstore.json',
    output: 'examples/output/petstore.txt',
    parser: JSON.parse,
  },
  {
    input: 'examples/openapi/petstore-v2.json',
    output: 'examples/output/petstore-v2.txt',
    parser: JSON.parse,
  },
  {
    input: 'examples/openapi/zendesk.yaml',
    output: 'examples/output/zendesk.txt',
    parser: parse,
  },
];

// Process each example
for (const example of examples) {
  console.log(`Processing ${example.input}...`);

  const inputContent = readFileSync(example.input, 'utf-8');
  const spec = example.parser(inputContent);
  const result = openApiToLlmText(spec);

  writeFileSync(example.output, result);
  console.log(`  ✓ Generated ${example.output}`);
}

console.log('\n✨ All examples synchronized!');
