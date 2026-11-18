// Writes the demo statement to public/sample-statement.csv so people can test the upload flow with a real file.
// Usage: npx vite-node scripts/write-sample.ts
import { writeFileSync } from 'node:fs';
import { generateSampleCsv } from '../src/lib/sample';

writeFileSync('public/sample-statement.csv', generateSampleCsv() + '\n');
console.log('wrote public/sample-statement.csv');
