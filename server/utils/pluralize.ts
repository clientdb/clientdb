type PluralInterpolation = string | number | [string, string] | [string];

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function pluralize(
  strings: TemplateStringsArray,
  ...interpolations: Array<PluralInterpolation>
) {
  const numberInterpolations = interpolations.filter(
    (interpolation): interpolation is number =>
      typeof interpolation === "number"
  );

  assert(
    numberInterpolations.length === 1,
    `There must be exactly one number interpolation in plural. Have ${numberInterpolations.length}`
  );

  const [count] = numberInterpolations;
  const results: string[] = [];

  for (const [index, part] of strings.entries()) {
    results.push(part);

    const interpolation: PluralInterpolation | null =
      interpolations[index] ?? null;

    if (typeof interpolation === "number") {
      results.push(`${interpolation}`);
    }

    if (typeof interpolation === "string") {
      results.push(interpolation);
    }

    if (Array.isArray(interpolation)) {
      if (interpolation.length === 1) {
        results.push(getPlural(interpolation[0], count));
      } else {
        const [singular, plural] = interpolation;

        results.push(count === 1 ? singular : plural);
      }
    }
  }

  return results.join("");
}

const pluralRules: { [key: string]: string } = {
  "(quiz)$": "$1zes",
  "^(ox)$": "$1en",
  "([m|l])ouse$": "$1ice",
  "(matr|vert|ind)ix|ex$": "$1ices",
  "(x|ch|ss|sh)$": "$1es",
  "([^aeiouy]|qu)y$": "$1ies",
  "(hive)$": "$1s",
  "(?:([^f])fe|([lr])f)$": "$1$2ves",
  "(shea|lea|loa|thie)f$": "$1ves",
  sis$: "ses",
  "([ti])um$": "$1a",
  "(tomat|potat|ech|her|vet)o$": "$1oes",
  "(bu)s$": "$1ses",
  "(alias)$": "$1es",
  "(octop)us$": "$1i",
  "(ax|test)is$": "$1es",
  "(us)$": "$1es",
  "([^s]+)$": "$1s",
};
const irregularRules: { [key: string]: string } = {
  move: "moves",
  foot: "feet",
  goose: "geese",
  sex: "sexes",
  child: "children",
  man: "men",
  tooth: "teeth",
  person: "people",
  it: "them",
  is: "are",
};
const uncountable: string[] = [
  "sheep",
  "fish",
  "deer",
  "moose",
  "series",
  "species",
  "money",
  "rice",
  "information",
  "equipment",
  "bison",
  "cod",
  "offspring",
  "pike",
  "salmon",
  "shrimp",
  "swine",
  "trout",
  "aircraft",
  "hovercraft",
  "spacecraft",
  "sugar",
  "tuna",
  "you",
  "wood",
];

export function getPlural(word: string, amount?: number): string {
  if (amount !== undefined && amount === 1) {
    return word;
  }

  // save some time in the case that singular and plural are the same
  if (uncountable.indexOf(word.toLowerCase()) >= 0) {
    return word;
  }
  // check for irregular forms
  for (const w in irregularRules) {
    const pattern = new RegExp(`${w}$`, "i");
    const replace = irregularRules[w];
    if (pattern.test(word)) {
      return word.replace(pattern, replace);
    }
  }
  // check for matches using regular expressions
  for (const reg in pluralRules) {
    const pattern = new RegExp(reg, "i");
    if (pattern.test(word)) {
      return word.replace(pattern, pluralRules[reg]);
    }
  }
  return word;
}
