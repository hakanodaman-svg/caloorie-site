// Caloorie landing build script
// Kullanım:  node build.js
// src/template.html + src/locales/*.json  →  public/<dil>/index.html
// Yeni dil eklemek için: src/locales/<kod>.json dosyası ekle, script'i tekrar çalıştır.

const fs = require("fs");
const path = require("path");

// ---- AYARLAR -------------------------------------------------------------
const SITE_URL = "https://caloorie.com";
// TODO: uygulamanın gerçek paket adı ile değiştir (Play Console'daki applicationId)
const PLAY_URL = "https://play.google.com/store/apps/details?id=PAKET_ADI";
const DEFAULT_LANG = "en";
// Gizlilik / kullanım şartları sayfaları henüz bu sitede yok.
// Şimdilik mevcut İngilizce sayfaların adresleri; legal sayfalar eklenince
// "/{lang}/privacy/" ve "/{lang}/terms/" olarak değişecek.
const PRIVACY_URL = "#"; // TODO
const TERMS_URL = "#";   // TODO
// --------------------------------------------------------------------------

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "public");

const template = fs.readFileSync(path.join(SRC, "template.html"), "utf8");
const localeDir = path.join(SRC, "locales");
const langs = fs.readdirSync(localeDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""))
  .sort();

const load = (lang) => JSON.parse(fs.readFileSync(path.join(localeDir, `${lang}.json`), "utf8"));
const base = load(DEFAULT_LANG);
const baseKeys = Object.keys(base);

const stripTags = (s) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const attr = (s) => stripTags(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

const hreflangLinks = [
  ...langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/">`),
  `<link rel="alternate" hreflang="x-default" href="${SITE_URL}/${DEFAULT_LANG}/">`,
].join("\n");

let problems = 0;

for (const lang of langs) {
  const strings = load(lang);

  // Eksik / fazla anahtar kontrolü (uygulamadaki 242-anahtar kontrolünün aynısı)
  const missing = baseKeys.filter((k) => !(k in strings));
  const extra = Object.keys(strings).filter((k) => !(k in base));
  if (missing.length) { console.warn(`⚠ ${lang}: eksik anahtarlar (İngilizce kullanılacak): ${missing.join(", ")}`); problems++; }
  if (extra.length) { console.warn(`⚠ ${lang}: en.json'da olmayan anahtarlar: ${extra.join(", ")}`); problems++; }

  const t = { ...base, ...strings };
  // Ekran görüntüleri: src/img/<dil>/<ad>.webp varsa o, yoksa İngilizcesi
  const img = (name) => fs.existsSync(path.join(SRC, "img", lang, `${name}.webp`))
    ? `/assets/img/${lang}/${name}.webp` : `/assets/img/${DEFAULT_LANG}/${name}.webp`;
  const vals = {
    imgResult: img("result"),
    imgNova: img("nova"),
    imgScan: img("scan"),
    imgWeight: img("weight"),
    imgReport: img("report"),
    ...t,
    lang,
    siteUrl: SITE_URL,
    playUrl: PLAY_URL,
    privacyUrl: PRIVACY_URL,
    termsUrl: TERMS_URL,
    year: String(new Date().getFullYear()),
    metaTitle: attr(t.metaTitle),
    metaDescription: attr(t.metaDescription),
    hreflangLinks,
    languageOptions: langs
      .map((l) => `          <option value="${l}"${l === lang ? " selected" : ""}>${l.toUpperCase()} - ${load(l)._languageName}</option>`)
      .join("\n"),
  };

  const html = template.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (key in vals) return vals[key];
    console.error(`✖ ${lang}: şablonda bilinmeyen anahtar {{${key}}}`);
    problems++;
    return m;
  });

  const dir = path.join(OUT, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  console.log(`✔ public/${lang}/index.html`);
}

// ---- Hukuki sayfalar -----------------------------------------------------
// src/legal/<dil>/<sayfa>.html  →  public/<dil>/<sayfa>/index.html
// Bir dilde sayfa yoksa İngilizcesi kullanılır.
// Varsayılan dil ayrıca kökte de üretilir (ör. /deleteaccount/) — Play Console'a
// kayıtlı eski adresler bozulmasın diye.
const legalTemplate = fs.readFileSync(path.join(SRC, "legal-template.html"), "utf8");
const legalDir = path.join(SRC, "legal");
const slugs = fs.readdirSync(path.join(legalDir, DEFAULT_LANG))
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(".html", ""));

const meta = (html, name) => (html.match(new RegExp(`<!--\\s*${name}:\\s*(.*?)\\s*-->`)) || [])[1] || "";

for (const slug of slugs) {
  const slugHreflang = [
    ...langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/${slug}/">`),
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}/${DEFAULT_LANG}/${slug}/">`,
  ].join("\n");

  for (const lang of langs) {
    const own = path.join(legalDir, lang, `${slug}.html`);
    const file = fs.existsSync(own) ? own : path.join(legalDir, DEFAULT_LANG, `${slug}.html`);
    if (file !== own) console.warn(`⚠ ${lang}: ${slug} çevirisi yok, İngilizce kullanıldı`);
    const content = fs.readFileSync(file, "utf8");
    const t = { ...base, ...load(lang) };
    const vals = {
      ...t,
      lang,
      slug,
      year: String(new Date().getFullYear()),
      privacyUrl: PRIVACY_URL,
      termsUrl: TERMS_URL,
      pageTitle: attr(meta(content, "title")),
      pageDescription: attr(meta(content, "description")),
      canonical: `${SITE_URL}/${lang}/${slug}/`,
      hreflangLinks: slugHreflang,
      languageOptions: langs
        .map((l) => `          <option value="${l}"${l === lang ? " selected" : ""}>${l.toUpperCase()} - ${load(l)._languageName}</option>`)
        .join("\n"),
      content: content.replace(/<!--[\s\S]*?-->\s*/g, ""),
    };
    const html = legalTemplate.replace(/\{\{(\w+)\}\}/g, (m, key) => {
      if (key in vals) return vals[key];
      console.error(`✖ ${lang}/${slug}: bilinmeyen anahtar {{${key}}}`);
      problems++;
      return m;
    });
    const dir = path.join(OUT, lang, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    if (lang === DEFAULT_LANG) {
      const rootDir = path.join(OUT, slug);
      fs.mkdirSync(rootDir, { recursive: true });
      fs.writeFileSync(path.join(rootDir, "index.html"), html);
    }
  }
  console.log(`✔ ${slug}: ${langs.length} dil + /${slug}/`);
}

// Ortak dosyalar (CSS vb.)
fs.cpSync(path.join(SRC, "assets"), path.join(OUT, "assets"), { recursive: true });
fs.cpSync(path.join(SRC, "img"), path.join(OUT, "assets", "img"), { recursive: true });

// Kök sayfa: tarayıcı diline göre doğru dile yönlendirir
const rootHtml = `<!doctype html>
<html lang="${DEFAULT_LANG}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Caloorie</title>
<link rel="canonical" href="${SITE_URL}/${DEFAULT_LANG}/">
${hreflangLinks}
<script>
(function(){
  var langs=${JSON.stringify(langs)};
  var prefs=(navigator.languages||[navigator.language||""]).map(function(l){return l.toLowerCase();});
  var pick="${DEFAULT_LANG}";
  for(var i=0;i<prefs.length;i++){
    var full=prefs[i], short=full.split("-")[0];
    if(langs.indexOf(full)>-1){pick=full;break;}
    if(langs.indexOf(short)>-1){pick=short;break;}
  }
  location.replace("/"+pick+"/");
})();
</script>
</head><body><noscript><a href="/${DEFAULT_LANG}/">Caloorie</a></noscript></body></html>
`;
fs.writeFileSync(path.join(OUT, "index.html"), rootHtml);
console.log("✔ public/index.html (dil yönlendirmesi)");

console.log(problems ? `\nBitti, ${problems} uyarı var.` : `\nBitti: ${langs.length} dil, uyarı yok.`);
