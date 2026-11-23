// String logic. Run with: node --test test/core.test.js
// Editor (DOM) behaviour is covered by test/editor.test.html, opened in Chrome or Edge.
const test = require('node:test');
const assert = require('node:assert/strict');
const { SEP, buildRegex, replaceInString, detectIssueKey } = require('../core.js');

const rep = (text, find, replacement, options = {}) =>
  replaceInString(text, buildRegex(find, options), replacement, !!options.regex);

test('literal replace escapes regex characters and is case-insensitive by default', () => {
  assert.deepEqual(rep('Use V1.0 (BETA) or v1x0 (beta)', 'v1.0 (beta)', 'v2'), { text: 'Use v2 or v1x0 (beta)', count: 1 });
});

test('literal replacement inserts $ patterns verbatim', () => {
  assert.equal(rep('price', 'price', '$1 & $&').text, '$1 & $&');
});

test('match case and whole word', () => {
  assert.deepEqual(rep('API api APIs rAPId API.', 'API', 'X', { caseSensitive: true, wholeWord: true }), { text: 'X api APIs rAPId X.', count: 2 });
});

test('whole word is unicode-aware', () => {
  assert.equal(rep('café cafés écafé', 'café', 'bar', { wholeWord: true }).text, 'bar cafés écafé');
});

test('regex mode expands groups, named groups and $$', () => {
  assert.equal(rep('See ABC-12.', '(?<proj>[A-Z]+)-(\\d+)', '$<proj>_$2 ($$) [$&]', { regex: true, caseSensitive: true }).text, 'See ABC_12 ($) [ABC-12].');
});

test('regex mode with lookarounds', () => {
  assert.deepEqual(rep('@old old', '(?<=@)old', 'new', { regex: true }), { text: '@new old', count: 1 });
});

test('zero-length matches are ignored', () => {
  assert.deepEqual(rep('abxxc', 'x*', '-', { regex: true }), { text: 'ab-c', count: 1 });
});

test('matches never cross a block boundary', () => {
  assert.deepEqual(rep(`end${SEP}start end`, 'end.start', 'X', { regex: true }), { text: `end${SEP}start end`, count: 0 });
});

test('replacement containing the search value does not loop', () => {
  assert.deepEqual(rep('a a', 'a', 'aa'), { text: 'aa aa', count: 2 });
});

test('invalid input', () => {
  assert.throws(() => buildRegex(''), /Enter a value/);
  assert.throws(() => buildRegex('(', { regex: true }), /Invalid regular expression/);
});

test('detectIssueKey', () => {
  assert.equal(detectIssueKey('https://x.atlassian.net/browse/ABC-123'), 'ABC-123');
  assert.equal(detectIssueKey('https://x.atlassian.net/jira/software/projects/ABC/boards/1?selectedIssue=ABC-7'), 'ABC-7');
  assert.equal(detectIssueKey('https://jira.corp.local/browse/PROJ_2-9?focused=1'), 'PROJ_2-9');
  assert.equal(detectIssueKey('https://x.atlassian.net/jira/your-work'), null);
});
