// Research fields offered in the composer. Each is also stored as a tag.
const FIELDS = [
  ['astronomy', 'Astronomy & Astrophysics'],
  ['biology', 'Biology'],
  ['chemistry', 'Chemistry'],
  ['computer-science', 'Computer Science'],
  ['earth-sciences', 'Earth & Environmental Sciences'],
  ['ecology', 'Ecology & Evolution'],
  ['economics', 'Economics'],
  ['education', 'Education'],
  ['engineering', 'Engineering'],
  ['humanities', 'Humanities'],
  ['materials-science', 'Materials Science'],
  ['mathematics', 'Mathematics'],
  ['medicine', 'Medicine & Health'],
  ['neuroscience', 'Neuroscience'],
  ['physics', 'Physics'],
  ['psychology', 'Psychology'],
  ['public-health', 'Public Health'],
  ['social-sciences', 'Social Sciences'],
  ['statistics', 'Statistics & Data Science'],
];

const FIELD_LABELS = Object.fromEntries(FIELDS);

function isField(slug) {
  return Object.prototype.hasOwnProperty.call(FIELD_LABELS, slug);
}

module.exports = { FIELDS, FIELD_LABELS, isField };
