// Addis Bites — catalog hygiene layer (item 6).
// Runs after the package loads and before a venue is mapped into an app, so every screen sees the same
// cleaned record. Rules, all auditable:
//   * neighbourhood → sub-city: the catalogue leaves `neighborhood` empty for 112 of 206 venues and puts
//     places like Summit, CMC, Piyassa and 4 Kilo in the free-text field. `handoff/data/subcities.json`
//     is the authority; where it is silent, the venue's name and landmark are read.
//   * chain branches ("BGS Chicken", "Pizza Hut ×4") keep their own row — they are different branches at
//     different coordinates — but get a distinguishing label so a list can tell them apart.
//   * a venue with no menu and no price (7 of them, per the handoff's own quality report) says so,
//     instead of rendering a blank price.
window.ABCatalog = (function(){
  const SUBS = ['Bole','Kirkos','Yeka','Arada','Lideta','Nifas Silk-Lafto','Kolfe Keranio','Gulele','Akaky Kaliti','Addis Ketema','Lemi Kura'];
  // Neighbourhoods the catalogue writes in free text, per handoff/data/subcities.json.
  const NB2SUB = {
    summit:'Lemi Kura', cmc:'Lemi Kura', ayat:'Lemi Kura', 'summit branch':'Lemi Kura', 'summit fiyel bet':'Lemi Kura', 'summit safari':'Lemi Kura', wulna:'Lemi Kura', tafo:'Lemi Kura',
    piyassa:'Arada', piassa:'Arada', '4 kilo':'Arada', '4kilo':'Arada', '4 killo':'Arada', '4killo':'Arada', '4 kilo tourist':'Arada', '5killo':'Arada', '5kilo':'Arada', '6:kilo':'Arada',
    churchill:'Arada', 'thaytu hotel':'Arada', menen:'Arada', abuware:'Arada',
    bambis:'Kirkos', kazanchis:'Kirkos', kasanchis:'Kirkos', dembel:'Kirkos', olympia:'Kirkos', flamingo:'Kirkos', legehar:'Kirkos', ras:'Kirkos', 'meskel flower':'Kirkos',
    'bole medhanialem':'Bole', atlas:'Bole', gerji:'Bole', 'bole japan':'Bole', 'bole michael':'Bole', 'bole skylight':'Bole', 'bole total':'Bole', friendship:'Bole', hayahulet:'Bole', bulbula:'Bole', rawanda:'Bole',
    sarbet:'Nifas Silk-Lafto', lebu:'Nifas Silk-Lafto', gofa:'Nifas Silk-Lafto', jemo:'Nifas Silk-Lafto', mekanisa:'Nifas Silk-Lafto', lafto:'Nifas Silk-Lafto', 'ayer tena':'Nifas Silk-Lafto',
    bethel:'Kolfe Keranio', betel:'Kolfe Keranio', 'tor hailoch':'Kolfe Keranio',
    megenagna:'Yeka', balderas:'Yeka', kotebe:'Yeka',
    lideta:'Lideta', abinet:'Lideta', mexico:'Lideta',
    'shiro meda':'Gulele', entoto:'Gulele',
    merkato:'Addis Ketema',
    kality:'Akaky Kaliti', kaliti:'Akaky Kaliti',
  };
  // Words read out of the name or landmark when the venue names no area at all.
  const AREA_WORDS = ['Summit','CMC','Ayat','Piassa','Piyassa','Churchill','Kazanchis','Kasanchis','Meskel Flower','Megenagna','Balderas','Bambis','Dembel','Olympia','Flamingo','Legehar','Atlas','Gerji','Bole Medhanialem','Bole Michael','Bole Japan','Bole Skylight','Friendship','Hayahulet','Bulbula','Sarbet','Lebu','Jemo','Gofa','Mekanisa','Lafto','Bethel','Betel','Tor Hailoch','Ayer Tena','Lideta','Abinet','Mexico','Shiro Meda','Entoto','Merkato','Kality','4 Kilo','4Kilo','5 Kilo','5Kilo','6 Kilo','Wollo Sefer','Welo Sefer','Bisrate Gebriel','Kotebe'];
  // Landmarks that identify a sub-city on their own.
  const LANDMARK_RULES = [
    [/summit|cmc|ayat/i,'Lemi Kura'],
    [/piyassa|piassa|churchill|arada|4\s?kilo|5\s?kilo|6\s?kilo|thaytu|menen|abuware/i,'Arada'],
    [/kazanchis|kasanchis|meskel|olympia|bambis|dembel|flamingo|legehar/i,'Kirkos'],
    [/bole|atlas|gerji|hayahulet|friendship|bulbula|bulbula/i,'Bole'],
    [/sarbet|lebu|jemo|gofa|mekanisa|lafto|ayer tena|bisrate/i,'Nifas Silk-Lafto'],
    [/bethel|betel|tor hailoch|kolfe/i,'Kolfe Keranio'],
    [/megenagna|balderas|kotebe|yeka/i,'Yeka'],
    [/lideta|abinet/i,'Lideta'],
    [/shiro meda|entoto|gulele/i,'Gulele'],
    [/merkato|addis ketema/i,'Addis Ketema'],
    [/kality/i,'Akaky Kaliti'],
  ];
  const norm = s => String(s||'').toLowerCase().trim();
  // The chain key used by both the grouping and the branch label, so the two always agree.
  const chainKey = s => norm(s).replace(/[^a-z0-9]/g,'');
  function rx(w){ return new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'i'); }
  // Where a venue is: the catalog's own neighborhood, else a word read from the name/landmark.
  function areaLabel(r){
    if (r.neighborhood) return r.neighborhood;
    const hay = String(r.name||'') + ' ' + String(r.landmark||'') + ' ' + String(r.address||'');
    for (const w of AREA_WORDS) if (rx(w).test(hay)) return w;
    return null;
  }
  // Resolve a sub-city: the catalog's value when it is one of the 11, else the neighbourhood map,
  // else the landmark rules, else the index file the row came from.
  function subCityOf(r, fallback){
    if (SUBS.includes(r.sub_city)) return {sub_city: r.sub_city, source:'catalog'};
    const nb = norm(r.neighborhood);
    if (nb && NB2SUB[nb]) return {sub_city: NB2SUB[nb], source:'neighborhood'};
    const hay = String(r.name||'') + ' ' + String(r.landmark||'') + ' ' + String(r.address||'');
    for (const [re, sub] of LANDMARK_RULES) if (re.test(hay)) return {sub_city: sub, source:'landmark'};
    if (fallback && SUBS.includes(fallback)) return {sub_city: fallback, source:'index'};
    return {sub_city:'Bole', source:'default'};
  }
  // A chain branch keeps its own row; the label is what tells two of them apart.
  function branchLabel(r, all, fallbackSub){
    const base = chainKey(r.name);
    const siblings = all.filter(x=>{ const k = chainKey(x.name); return k===base || k.startsWith(base) || base.startsWith(k); });
    if (siblings.length < 2) return null;
    // Three fallbacks deep: the venue's own neighbourhood, then an area read from its name, then the
    // sub-city it resolved to. A few branches name nothing at all (r_000004 "Chao Fan Fried Rice").
    const nb = r.neighborhood || areaLabel(r) || fallbackSub;
    const clash = siblings.some(x=>x!==r && (x.neighborhood || areaLabel(x) || fallbackSub)===nb);
    if (clash) return r.landmark || r.address || nb;
    return nb;
  }
  // No menu and no price: say so, rather than render a blank or a zero.
  const priceKnown = r => r.avg_item_price_etb != null && r.avg_item_price_etb > 0;
  const menuKnown = r => r.menu_file != null;
  function clean(r, all, opts){
    const rows = all || [r]; opts = opts || {};
    const s = subCityOf(r, opts.fallbackSub);
    // menu_known answers "can this venue be ordered from in THIS package?" — the catalog's menu_file
    // field alone is not the answer: the handoff should ship 199 menu files, and a package that ships
    // fewer (this one ships 2) must not advertise menus it cannot open.
    const served = opts.menuServed ? opts.menuServed(r) : menuKnown(r);
    const noMenu = !served;
    const missingMenuFile = menuKnown(r) && !served;
    return Object.assign({}, r, {
      sub_city: s.sub_city, sub_city_source: s.source, sub_city_inferred: s.source !== 'catalog',
      area_label: areaLabel(r) || s.sub_city,
      area_source: r.neighborhood ? 'neighborhood' : (areaLabel(r) ? 'name/landmark' : 'sub-city'),
      branch_label: branchLabel(r, rows, s.sub_city),
      price_known: priceKnown(r) && served,
      menu_known: !noMenu,
      has_menu: !noMenu,
      menu_missing_from_package: missingMenuFile,
      not_orderable_reason: !noMenu ? null : (missingMenuFile
        ? 'The catalog has a menu for this venue, but the menu file is not part of this package'
        : 'No menu in the catalog'),
      avg_item_price_etb: priceKnown(r) ? r.avg_item_price_etb : null,
      price_display: priceKnown(r) && served ? null : (noMenu ? 'Not orderable yet' : 'Price on request'),
      image_state: r.hero_image ? (r.photo_license === 'owned' ? 'owned' : 'sample') : 'none',
    });
  }
  function cleanAll(rows, opts){ return rows.map(r=>clean(r, rows, opts)); }
  // Group a list so a chain can be shown once (e.g. "BGS Chicken · 4 branches").
  function groupChains(rows){
    const g = {};
    rows.forEach(r=>{ const k = chainKey(r.name); (g[k] = g[k] || []).push(r); });
    return Object.entries(g).filter(e=>e[1].length>1).map(e=>({key:e[0], name:e[1][0].name, branches:e[1].length, ids:e[1].map(x=>x.id), rows:e[1]}));
  }
  return {SUBS, NB2SUB, subCityOf, clean, cleanAll, groupChains, norm, chainKey, areaLabel, priceKnown, menuKnown};
})();
