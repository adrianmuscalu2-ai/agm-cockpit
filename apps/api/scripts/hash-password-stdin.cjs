'use strict';
const bcrypt = require('bcryptjs');
let value = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { value += chunk; });
process.stdin.on('end', async () => {
  try { process.stdout.write(await bcrypt.hash(value, 12)); }
  finally { value = ''; }
});
