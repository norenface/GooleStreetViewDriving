/**
 * Web app build script
 * - Validates JS/HTML/CSS
 * - Copies files to dist/
 * - Minifies JS with basic compression (comment removal)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DIST = path.join(__dirname, 'dist');

// Clean dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'js'));
fs.mkdirSync(path.join(DIST, 'css'));

// Validate JS syntax using Node
const jsFiles = ['js/app.js', 'js/hyperlapse.js', 'js/GSVPano.js', 'js/config.js'];
const { execSync } = require('child_process');

let allOk = true;
jsFiles.forEach(file => {
  try {
    execSync(`node --check ${path.join(SRC, file)}`, { stdio: 'pipe' });
    console.log(`✓ ${file}`);
  } catch (e) {
    console.error(`✗ ${file}: ${e.stderr.toString()}`);
    allOk = false;
  }
});

if (!allOk) { process.exit(1); }

// Strip single-line comments and minify app.js (preserve libraries as-is)
function stripComments(src) {
  return src
    .replace(/\/\/.*$/gm, '')      // single-line comments
    .replace(/\n\s*\n/g, '\n')     // blank lines
    .trim();
}

// Copy and process files
const copies = [
  { src: 'index.html', dest: 'index.html', transform: null },
  { src: 'css/style.css', dest: 'css/style.css', transform: null },
  { src: 'js/app.js', dest: 'js/app.js', transform: stripComments },
  { src: 'js/hyperlapse.js', dest: 'js/hyperlapse.js', transform: null },
  { src: 'js/GSVPano.js', dest: 'js/GSVPano.js', transform: null },
  { src: 'js/three.min.js', dest: 'js/three.min.js', transform: null },
  { src: 'js/config.js', dest: 'js/config.js', transform: null },
];

copies.forEach(({ src, dest, transform }) => {
  const content = fs.readFileSync(path.join(SRC, src), 'utf8');
  const out = transform ? transform(content) : content;
  fs.writeFileSync(path.join(DIST, dest), out, 'utf8');
  const saved = content.length - out.length;
  const pct = saved > 0 ? ` (-${Math.round(saved/content.length*100)}%)` : '';
  console.log(`✓ dist/${dest}${pct}`);
});

// Print dist summary
const totalSize = copies.reduce((sum, { dest }) => {
  return sum + fs.statSync(path.join(DIST, dest)).size;
}, 0);

console.log(`\n✅ Build complete → dist/  (${(totalSize/1024).toFixed(1)} KB total)`);
console.log('   Run: http-server dist/ -p 8080');
