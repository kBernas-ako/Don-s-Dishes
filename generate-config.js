const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.js');

if (fs.existsSync(configPath)) {
  console.log('config.js already exists — skipping generation.');
  process.exit(0);
}

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('ADMIN_PASSWORD environment variable is not set. Cannot generate config.js.');
  process.exit(1);
}

const content = [
  "// Don's Dishes - Admin Password & Configuration",
  '// Generated at build time on Vercel from the ADMIN_PASSWORD env variable.',
  '',
  'window.APP_CONFIG = {',
  '  DEFAULT_PASSWORD: ' + JSON.stringify(password),
  '};',
  ''
].join('\n');

fs.writeFileSync(configPath, content);
console.log('config.js generated from ADMIN_PASSWORD.');
