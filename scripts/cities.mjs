// Cities Minerva covers, matched against posting locations.
export const CITIES = {
  nyc: { name: "New York", re: /\b(new york|nyc|manhattan|brooklyn|queens|bronx|staten island|long island city|jersey city|hoboken)\b/i },
  sf: { name: "San Francisco Bay Area", re: /\b(san francisco|sf\b|bay area|oakland|berkeley|emeryville|palo alto|menlo park|mountain view|sunnyvale|san mateo|redwood city|san jose|santa clara|south san francisco|foster city|burlingame)\b/i },
  boston: { name: "Boston", re: /\b(boston|cambridge, ma|somerville)\b/i },
  seattle: { name: "Seattle", re: /\b(seattle|bellevue|redmond|kirkland)\b/i },
  austin: { name: "Austin", re: /\baustin\b/i },
  la: { name: "Los Angeles", re: /\b(los angeles|santa monica|culver city|venice, ca|playa vista|pasadena|irvine)\b/i },
  chicago: { name: "Chicago", re: /\bchicago\b/i },
  dc: { name: "Washington, DC", re: /\b(washington,? d\.?c\.?|arlington, va|bethesda|reston|mclean)\b/i },
  denver: { name: "Denver / Boulder", re: /\b(denver|boulder)\b/i },
  miami: { name: "Miami", re: /\b(miami|fort lauderdale)\b/i },
};
export const REMOTE_RE = /\bremote\b|\banywhere\b|work from home|telecommute/i;
export const CITY_RE_ALL = new RegExp(Object.values(CITIES).map(c => c.re.source).join("|"), "i");
