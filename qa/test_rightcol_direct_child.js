// Regression guard: .kcm-right-col (and .kcm-left-col, .kcm-center-col) must
// be DIRECT children of #kcmTwoColRow. A previously-shipped bug had an
// unclosed <div> inside .kcm-center-col swallow .kcm-right-col as a
// descendant instead of a grid sibling, which silently defeated the
// grid-template-columns 3-column layout no matter what the CSS said.
// This test parses the real file with jsdom (an actual HTML5 parser, so it
// reproduces browser auto-closing/nesting behavior) and asserts the DOM
// structure directly, rather than only counting div tag balance.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const filePath = path.join(__dirname, '..', 'music-theory-pro.html');
const html = fs.readFileSync(filePath, 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;

const row = doc.getElementById('kcmTwoColRow');
if (!row) throw new Error('FAIL -- #kcmTwoColRow not found');

const directChildClasses = Array.from(row.children).map(c => c.className);
const expected = ['kcm-left-col', 'kcm-center-col', 'kcm-right-col'];

for (const cls of expected) {
  if (!directChildClasses.includes(cls)) {
    throw new Error(`FAIL -- .${cls} is not a direct child of #kcmTwoColRow (found children: ${JSON.stringify(directChildClasses)})`);
  }
}

const rightCol = doc.querySelector('.kcm-right-col');
if (!rightCol) throw new Error('FAIL -- .kcm-right-col not found in document at all');
if (!rightCol.parentElement || rightCol.parentElement.id !== 'kcmTwoColRow') {
  throw new Error(`FAIL -- .kcm-right-col parent is ${rightCol.parentElement ? (rightCol.parentElement.id || rightCol.parentElement.className) : 'null'}, expected #kcmTwoColRow`);
}

const centerCol = doc.querySelector('.kcm-center-col');
if (!centerCol) throw new Error('FAIL -- .kcm-center-col not found');
if (centerCol.querySelector('.kcm-right-col')) {
  throw new Error('FAIL -- .kcm-right-col is nested INSIDE .kcm-center-col (this is the exact bug class this test guards against)');
}

console.log('PASS -- .kcm-left-col, .kcm-center-col, .kcm-right-col are all direct children of #kcmTwoColRow; .kcm-right-col is not nested inside .kcm-center-col.');
