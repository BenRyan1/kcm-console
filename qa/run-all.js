// Runs every test_*.js in this folder in sequence, plus the JS-syntax and
// CSS-validity checks that used to be done ad hoc before every commit.
// Usage: cd qa && npm install (once) && node run-all.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const htmlPath = path.join(repoRoot, 'music-theory-pro.html');
let failures = 0;

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

// 1) JS syntax check on the concatenated inline <script> blocks.
section('JS syntax check');
try {
  const { JSDOM } = require('jsdom');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const scripts = Array.from(doc.querySelectorAll('script')).filter(s => !s.src && s.type !== 'application/ld+json');
  const combined = scripts.map(s => s.textContent).join(';\n');
  const tmpFile = path.join(require('os').tmpdir(), 'kcm_qa_combined_check.js');
  fs.writeFileSync(tmpFile, combined);
  execSync(`node --check ${JSON.stringify(tmpFile)}`, { stdio: 'inherit' });
  console.log('JS syntax OK (' + scripts.length + ' inline script blocks, ' + combined.length + ' chars).');
} catch (e) {
  console.log('FAIL: JS syntax check —', e.message);
  failures++;
}

// 2) CSS validity check on every <style> block.
section('CSS validity check');
try {
  const { JSDOM } = require('jsdom');
  const csstree = require('css-tree');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const styles = Array.from(doc.querySelectorAll('style'));
  let cssErrors = 0;
  styles.forEach((s, i) => {
    csstree.parse(s.textContent, {
      onParseError: (err) => { cssErrors++; console.log(`style[${i}]`, err.formattedMessage || err.message); }
    });
  });
  if (cssErrors > 0) { failures++; console.log('FAIL: ' + cssErrors + ' CSS parse errors.'); }
  else console.log('CSS valid (' + styles.length + ' <style> blocks, 0 errors).');
} catch (e) {
  console.log('FAIL: CSS validity check —', e.message);
  failures++;
}

// 3) Whole-file <div> tag balance.
section('HTML div-tag balance check');
try {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const opens = (html.match(/<div\b/g) || []).length;
  const closes = (html.match(/<\/div>/g) || []).length;
  if (opens !== closes) { failures++; console.log(`FAIL: ${opens} div opens vs ${closes} div closes.`); }
  else console.log(`div tags balanced (${opens} opens, ${closes} closes).`);
} catch (e) {
  console.log('FAIL: div balance check —', e.message);
  failures++;
}

// 4) Every test_*.js file in this folder, run as a child process so one
//    test's thrown error/exit code can't take down the rest of the suite.
section('Individual test files');
const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test_') && f.endsWith('.js'))
  .sort();

testFiles.forEach(f => {
  process.stdout.write(f + ' ... ');
  try {
    const out = execSync(`node ${JSON.stringify(path.join(__dirname, f))}`, { encoding: 'utf8', timeout: 20000 });
    if (/^PASS/m.test(out)) {
      console.log('PASS');
    } else {
      console.log('UNKNOWN OUTPUT (no PASS/FAIL line found):');
      console.log(out.trim());
      failures++;
    }
  } catch (e) {
    console.log('FAIL');
    console.log((e.stdout || '') + (e.stderr || e.message));
    failures++;
  }
});

section('Summary');
if (failures > 0) {
  console.log(failures + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('All checks passed (' + testFiles.length + ' test files + JS/CSS/HTML checks).');
  process.exit(0);
}
