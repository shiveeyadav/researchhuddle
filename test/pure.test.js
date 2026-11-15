const test = require('node:test');
const assert = require('node:assert/strict');
const { charCount, normaliseDoi, doiUrl, normaliseLink, normaliseEmail } = require('../lib/validate');
const { isValidTag, extractTags, splitTags } = require('../lib/tags');
const { isValidOrcid, normaliseOrcid } = require('../lib/orcid-id');

test('charCount counts code points like Postgres char_length', () => {
  assert.equal(charCount('héllo'), 5);
  assert.equal(charCount('🧪🧬'), 2);
  assert.equal(charCount(null), 0);
});

test('normaliseDoi accepts common forms and rejects junk', () => {
  assert.equal(normaliseDoi('10.1234/abc.def'), '10.1234/abc.def');
  assert.equal(normaliseDoi('doi: 10.1234/abc'), '10.1234/abc');
  assert.equal(normaliseDoi('https://doi.org/10.1234/abc'), '10.1234/abc');
  assert.equal(normaliseDoi('https://dx.doi.org/10.1234/a%2Fb'), '10.1234/a/b');
  assert.equal(normaliseDoi('11.1234/abc'), null);
  assert.equal(normaliseDoi('10.12/abc'), null);
  assert.equal(normaliseDoi('10.1234/%zz'), '10.1234/%zz');
  assert.equal(normaliseDoi(''), null);
  assert.equal(doiUrl('10.1/a#b?c'), 'https://doi.org/10.1/a%23b%3Fc');
});

test('normaliseLink only allows http(s)', () => {
  assert.equal(normaliseLink('https://example.com/x'), 'https://example.com/x');
  assert.equal(normaliseLink('javascript:alert(1)'), null);
  assert.equal(normaliseLink('example.com'), null);
  assert.equal(normaliseLink('https://' + 'a'.repeat(600)), null);
});

test('normaliseEmail: null when empty, undefined when invalid', () => {
  assert.equal(normaliseEmail(' A@B.CO '), 'a@b.co');
  assert.equal(normaliseEmail(''), null);
  assert.equal(normaliseEmail('a@b'), undefined);
  assert.equal(normaliseEmail('<a@b.co>'), undefined);
});

test('tags: validation, extraction and splitting', () => {
  assert.equal(isValidTag('genomics'), true);
  assert.equal(isValidTag('Genomics'), false);
  assert.equal(isValidTag('x'), false);
  assert.deepEqual(extractTags('New #Genomics paper, see #genomics and #ai_ml. Not a#tag or &#39;'), ['genomics', 'ai_ml']);
  assert.equal(extractTags('#aa #bb #cc', 2).length, 2);
  assert.deepEqual(splitTags('hi #ai!'), [
    { type: 'text', value: 'hi ' },
    { type: 'tag', value: '#ai', tag: 'ai' },
    { type: 'text', value: '!' },
  ]);
});

test('ORCID iD checksum and normalisation', () => {
  assert.equal(isValidOrcid('0000-0002-1825-0097'), true); // ORCID's documented example
  assert.equal(isValidOrcid('0000-0002-1694-233X'), true);
  assert.equal(isValidOrcid('0000-0002-1825-0098'), false);
  assert.equal(isValidOrcid('0000000218250097'), false);
  assert.equal(normaliseOrcid(' 0000-0002-1694-233x '), '0000-0002-1694-233X');
  assert.equal(normaliseOrcid('https://orcid.org/0000-0002-1825-0097'), '0000-0002-1825-0097');
  assert.equal(normaliseOrcid('orcid.org/0000-0002-1825-0097/'), '0000-0002-1825-0097');
  assert.equal(isValidOrcid(normaliseOrcid('https://www.orcid.org/0000-0002-1825-0097')), true);
});
