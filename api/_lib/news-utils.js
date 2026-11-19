const safeUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
};

function imageCandidates(item = {}) {
  const values = [];
  const add = (value) => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(add);
    if (typeof value === 'string') return values.push(value);
    if (typeof value === 'object') add(value.url || value.href || value.src || value.$?.url || value.$?.href);
  };
  add(item['media:content']);
  add(item.enclosure);
  add(item['media:thumbnail']);
  add(item.image);
  add(item.itunes?.image);
  add(item['itunes:image']);
  for (const field of ['content:encoded', 'content', 'description', 'summary']) {
    const html = typeof item[field] === 'string' ? item[field] : '';
    const matches = html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi) || [];
    for (const match of matches) {
      const src = match.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
      if (src) values.push(src);
    }
  }
  return values.map(safeUrl).filter(Boolean);
}

function upgradeImageUrl(value) {
  const safe = safeUrl(value);
  if (!safe) return null;
  try {
    const url = new URL(safe);
    // The Guardian RSS feed often supplies a 140px thumbnail.
    if (url.hostname === 'i.guim.co.uk' && url.searchParams.has('width')) {
      url.searchParams.set('width', '1200');
      url.searchParams.set('quality', '90');
    }
    return url.toString();
  } catch { return safe; }
}

export function getImageUrl(item) {
  return imageCandidates(item).map(upgradeImageUrl).find(Boolean) || null;
}

export function getCategory(item, fallback = 'world') {
  const text = [item?.title, item?.contentSnippet, item?.summary, item?.content, item?.description]
    .filter(Boolean).join(' ').replace(/<[^>]*>/g, ' ').toLocaleLowerCase();

  const rules = [
    ['politics', /\b(election|president|prime minister|parliament|government|minister|politic|vote|campaign|diplomat|sanction)\b|የምርጫ|ምርጫ|ፕሬዚዳንት|ጠቅላይ ሚኒስትር|ፓርላማ|መንግስት|ፖለቲካ|ዲፕሎማሲ/i],
    ['technology', /\b(technology|tech|artificial intelligence|AI|software|cyber|digital|smartphone|robot)\b|ቴክኖሎጂ|ሰው ሰራሽ አስተውሎት|ዲጂታል/i],
    ['sports', /\b(sport|football|soccer|basketball|tennis|olympic|cricket|league|match|player|team)\b|ስፖርት|እግር ኳስ|ቅርጫት ኳስ|ጨዋታ/i],
    ['business', /\b(business|company|companies|market|trade|retail|industry|startup|corporate)\b|ቢዝነስ|ንግድ|ኩባንያ|ገበያ|ኢንዱስትሪ/i],
    ['economy', /\b(economy|economic|inflation|bank|currency|finance|financial|GDP|jobs|unemployment|interest rate|budget)\b|ኢኮኖሚ|ዋጋ ንረት|ባንክ|ምንዛሬ|ፋይናንስ|በጀት/i],
    ['ethiopia', /\b(ethiopia|ethiopian|addis ababa|amhara|oromia|tigray|somali region|afar)\b|ኢትዮጵያ|ኢትዮጵያዊ|አዲስ አበባ|አማራ|ኦሮሚያ|ትግራይ|ሶማሌ|አፋር/i]
  ];
  for (const [category, pattern] of rules) if (pattern.test(text)) return category;
  return ['ethiopia','world','politics','business','technology','sports','economy'].includes(fallback) ? fallback : 'world';
}
