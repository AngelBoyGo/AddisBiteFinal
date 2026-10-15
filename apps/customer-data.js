// Addis Bites Customer — built-in sample in the /handoff/data schema (top200 restaurants + menus).
// At startup k-store tries to load the real package from ./handoff/data/... and falls back to this.
(function(){
const D = (d,h,m) => Date.UTC(2026, 9, d, h, m, 0);
const BASE = D(12, 18, 42); // shared clock with Courier + Console: Mon 12 Oct 2026 · 18:42 EAT
const XY = (x,y) => window.ABBus.xyToLatLng(x,y);
const SUBS = ['Bole','Kirkos','Yeka','Arada','Lideta','Nifas Silk-Lafto','Kolfe Keranio','Gulele','Akaky Kaliti','Addis Ketema','Lemi Kura'];
const SUB_AM = {'Bole':'ቦሌ','Kirkos':'ቂርቆስ','Yeka':'የካ','Arada':'አራዳ','Lideta':'ልደታ','Nifas Silk-Lafto':'ንፋስ ስልክ ላፍቶ','Kolfe Keranio':'ኮልፌ ቀራኒዮ','Gulele':'ጉለሌ','Akaky Kaliti':'አቃቂ ቃሊቲ','Addis Ketema':'አዲስ ከተማ','Lemi Kura':'ለሚ ኩራ'};

const CATEGORIES = {
  cuisines: [
    {id:'traditional', en:'Traditional', am:'ባህላዊ'}, {id:'ethiopian', en:'Ethiopian', am:'ኢትዮጵያዊ'}, {id:'coffee', en:'Coffee', am:'ቡና'}, {id:'juice', en:'Juice', am:'ጭማቂ'},
    {id:'fast_food', en:'Fast food', am:'ፈጣን ምግብ'}, {id:'pizza', en:'Pizza', am:'ፒዛ'}, {id:'bakery', en:'Bakery', am:'ዳቦ ቤት'}, {id:'hotel', en:'Hotel', am:'ሆቴል'},
    {id:'grill', en:'Grill', am:'ጥብስ'}, {id:'cafe', en:'Café', am:'ካፌ'}, {id:'international', en:'International', am:null},
  ],
  menu: {mains:{en:'Mains', am:'ዋና ምግቦች'}, fasting:{en:'Fasting dishes', am:'የጾም ምግቦች'}, drinks:{en:'Drinks', am:'መጠጦች'}, coffee:{en:'Coffee', am:'ቡና'}, sides:{en:'Sides', am:'ተጨማሪዎች'}, juice:{en:'Juices', am:'ጭማቂዎች'}, burgers:{en:'Burgers & sandwiches', am:null}, pizza:{en:'Pizza', am:'ፒዛ'}, bakery:{en:'Bakery', am:'ዳቦና ኬክ'}, breakfast:{en:'Breakfast', am:'ቁርስ'}},
};

// ---------- item templates ----------
const COOK = [{group:'Cooking', group_am:'አበሳሰል', required:true, max:1, choices:[{name:'Tere (raw)', price_delta_etb:0},{name:'Leb leb (rare)', price_delta_etb:0},{name:'Yebesele (cooked)', price_delta_etb:20}]}];
const TIBS = [{group:'Style', group_am:null, required:true, max:1, choices:[{name:'Derek (dry)', price_delta_etb:0},{name:'Lebleb (juicy)', price_delta_etb:0},{name:'Shekla (clay pot)', price_delta_etb:60}]}];
const INJ = [{group:'Extra', required:false, max:3, choices:[{name:'Extra injera', price_delta_etb:25},{name:'Ayib (cottage cheese)', price_delta_etb:40},{name:'Extra awaze', price_delta_etb:10}]}];
const BURG = [{group:'Add-ons', required:false, max:3, choices:[{name:'Extra cheese', price_delta_etb:40},{name:'Egg', price_delta_etb:30},{name:'Jalapeño', price_delta_etb:20}]}];
const SIZE = [{group:'Size', required:true, max:1, choices:[{name:'Regular', price_delta_etb:0},{name:'Large', price_delta_etb:60}]}];
const T = {
  kitfo:   {name:'Special Kitfo', name_am:'ልዩ ክትፎ', cat:'mains', description:'Minced beef with mitmita and kibbeh, served with ayib and gomen', price:950, tags:['beef','spicy'], fasting:false, spice:2, options:COOK, popular:true},
  fitfit:  {name:'Tomato Fitfit', name_am:'ቲማቲም ፍትፍት', cat:'fasting', description:'Injera tossed with fresh tomato, onion and green chilli', price:550, tags:['vegan'], fasting:true, spice:1, popular:true},
  shiro:   {name:'Shiro Tegabino', name_am:'ሽሮ ተጋቢኖ', cat:'fasting', description:'Thick chickpea stew bubbling in a clay pot, with injera', price:380, tags:['vegan'], fasting:true, spice:1, options:INJ, popular:true},
  beyay:   {name:'Beyaynetu', name_am:'በያይነቱ', cat:'fasting', description:'Fasting platter: misir, kik, gomen, shiro and salad on injera', price:420, tags:['vegan','platter'], fasting:true, spice:1, popular:true},
  tibs:    {name:'Tibs (Beef)', name_am:'ጥብስ', cat:'mains', description:'Sautéed beef cubes with onion, rosemary and jalapeño', price:780, tags:['beef'], fasting:false, spice:2, options:TIBS},
  firfir:  {name:'Firfir', name_am:'ፍርፍር', cat:'breakfast', description:'Shredded injera in berbere sauce with butter', price:320, tags:[], fasting:false, spice:2},
  doro:    {name:'Doro Wat', name_am:'ዶሮ ወጥ', cat:'mains', description:'Slow-cooked chicken in berbere with boiled egg', price:890, tags:['chicken','spicy'], fasting:false, spice:3},
  gomen:   {name:'Gomen', name_am:'ጎመን', cat:'fasting', description:'Collard greens with garlic and ginger', price:260, tags:['vegan'], fasting:true, spice:0},
  misir:   {name:'Misir Wat', name_am:'ምስር ወጥ', cat:'fasting', description:'Red lentils in berbere sauce', price:300, tags:['vegan'], fasting:true, spice:2},
  injera:  {name:'Injera (extra)', name_am:'እንጀራ', cat:'sides', description:'One extra roll of teff injera', price:25, tags:[], fasting:true, spice:0},
  mango:   {name:'Mango-Avocado Juice', name_am:null, cat:'juice', description:'Layered fresh mango and avocado, no sugar added', price:180, tags:['fresh'], fasting:true, spice:0, popular:true},
  avo:     {name:'Fresh Avocado Juice', name_am:'የአቮካዶ ጭማቂ', cat:'juice', description:'Thick avocado juice with a squeeze of lime', price:160, tags:['fresh'], fasting:true, spice:0},
  spris:   {name:'Spris', name_am:'ስፕሪስ', cat:'juice', description:'Avocado, mango and papaya layers', price:150, tags:['fresh'], fasting:true, spice:0, options:SIZE},
  papaya:  {name:'Papaya Juice', name_am:null, cat:'juice', description:'Fresh papaya with lime', price:140, tags:['fresh'], fasting:true, spice:0},
  fsalad:  {name:'Fruit Salad', name_am:null, cat:'juice', description:'Seasonal fruit, honey on the side', price:220, tags:[], fasting:true, spice:0},
  fetira:  {name:'Fetira', name_am:'ፈጢራ', cat:'breakfast', description:'Flaky layered bread with egg and honey', price:260, tags:[], fasting:false, spice:0},
  macch:   {name:'Tomoca Macchiato', name_am:null, cat:'coffee', description:'Double-shot macchiato, Tomoca house roast', price:90, tags:['hot'], fasting:false, spice:0, popular:true},
  buna:    {name:'Jebena Buna', name_am:'የጀበና ቡና', cat:'coffee', description:'Traditional clay-pot coffee, served with popcorn', price:60, tags:['hot'], fasting:true, spice:0},
  beans:   {name:'Coffee Beans 250g', name_am:null, cat:'coffee', description:'Freshly roasted Yirgacheffe beans, whole', price:650, tags:[], fasting:true, spice:0},
  crois:   {name:'Croissant', name_am:null, cat:'bakery', description:'Butter croissant, baked this morning', price:120, tags:[], fasting:false, spice:0},
  cake:    {name:'Chocolate Cake Slice', name_am:null, cat:'bakery', description:'Rich chocolate sponge', price:180, tags:[], fasting:false, spice:0},
  burger:  {name:'Classic Beef Burger', name_am:null, cat:'burgers', description:'Beef patty, tomato, onion, house sauce, fries', price:450, tags:['beef'], fasting:false, spice:0, options:BURG, popular:true},
  chburg:  {name:'Chicken Burger', name_am:null, cat:'burgers', description:'Crispy chicken, lettuce, garlic mayo, fries', price:420, tags:['chicken'], fasting:false, spice:0, options:BURG},
  club:    {name:'Club Sandwich', name_am:null, cat:'burgers', description:'Chicken, egg, tomato, toasted bread, fries', price:380, tags:[], fasting:false, spice:0},
  fries:   {name:'French Fries', name_am:'ድንች ጥብስ', cat:'sides', description:'Crispy fries with ketchup', price:150, tags:['vegan'], fasting:true, spice:0},
  shawar:  {name:'Beef Shawarma', name_am:null, cat:'burgers', description:'Wrap with beef, garlic sauce and pickles', price:320, tags:['beef'], fasting:false, spice:1},
  soda:    {name:'Soft Drink', name_am:'ለስላሳ', cat:'drinks', description:'Coca-Cola, Fanta or Sprite (330 ml)', price:50, tags:[], fasting:true, spice:0},
  water:   {name:'Water 1L', name_am:'ውሃ', cat:'drinks', description:'Bottled water', price:35, tags:[], fasting:true, spice:0},
  marg:    {name:'Margherita Pizza', name_am:null, cat:'pizza', description:'Tomato, mozzarella, basil', price:520, tags:[], fasting:false, spice:0, options:SIZE, popular:true},
  meatpz:  {name:'Beef Special Pizza', name_am:null, cat:'pizza', description:'Minced beef, peppers, onion, mozzarella', price:650, tags:['beef'], fasting:false, spice:1, options:SIZE},
  vegpz:   {name:'Fasting Veggie Pizza', name_am:'የጾም ፒዛ', cat:'pizza', description:'Tomato, vegetables and olives — no cheese', price:480, tags:['vegan'], fasting:true, spice:0, options:SIZE},
  tunapz:  {name:'Tuna Pizza', name_am:null, cat:'pizza', description:'Tuna, onion, olives, mozzarella', price:600, tags:['fish'], fasting:false, spice:0},
  fish:    {name:'Grilled Lake Fish', name_am:'የተጠበሰ ዓሳ', cat:'fasting', description:'Whole tilapia from Lake Ziway, grilled, with rice or injera', price:980, tags:['fish'], fasting:true, spice:1},
  pasta:   {name:'Pasta Bolognese', name_am:null, cat:'mains', description:'Spaghetti with beef ragù', price:520, tags:['beef'], fasting:false, spice:0},
  bread:   {name:'Dabo (round loaf)', name_am:'ዳቦ', cat:'bakery', description:'Traditional spiced round bread', price:90, tags:[], fasting:true, spice:0},
  donut:   {name:'Donut', name_am:null, cat:'bakery', description:'Sugar-glazed', price:70, tags:[], fasting:false, spice:0},
  bdcake:  {name:'Birthday Cake (1 kg)', name_am:null, cat:'bakery', description:'Order 3 hours ahead. Message for writing', price:null, tags:[], fasting:false, spice:0},
  momo:    {name:'Beef Momo (8 pcs)', name_am:null, cat:'mains', description:'Steamed dumplings with chilli dip', price:360, tags:['beef'], fasting:false, spice:1},
  sushi:   {name:'Salmon Maki (8 pcs)', name_am:null, cat:'mains', description:'Imported salmon, rice, nori', price:1450, tags:['fish'], fasting:true, spice:0},
};
const MENUS = {
  traditional:['kitfo','fitfit','shiro','beyay','tibs','doro','misir','gomen','firfir','injera','soda','water'],
  cafe:['macch','buna','crois','cake','fetira','avo','water'],
  juice:['mango','avo','spris','papaya','fsalad','fetira','fitfit'],
  fast_food:['burger','chburg','club','shawar','fries','soda','water'],
  pizza:['marg','meatpz','vegpz','tunapz','fries','soda'],
  bakery:['bread','crois','donut','cake','bdcake','buna'],
  hotel:['kitfo','tibs','fish','pasta','club','beyay','mango','soda'],
  grill:['tibs','kitfo','doro','fries','soda','water'],
  international:['momo','sushi','pasta','fries','soda'],
};

// ---------- restaurants ----------
// [id, legacy_console_id, name, name_am, sub_city, neighborhood, landmark, x, y, cuisines, template, price_level, rating, count, partner, fasting, hours, extra]
const H = () => ['mon','tue','wed','thu','fri','sat','sun'].map(d=>({day:d, open:'11:00', close:'21:00'}));
const RAW = [
  ['r_000201','r1','Kategna','ቃተኛ','Nifas Silk-Lafto','Sarbet','Opposite Sarbet Total station',40,62,['traditional','ethiopian'],'traditional',2,4.6,812,true,true,H('08:00','23:30'),{only:['kitfo','fitfit','beyay','shiro','firfir','doro','gomen','injera','soda']}],
  ['r_000202','r2','Delmela','ደልመላ','Nifas Silk-Lafto','Sarbet','Canada embassy road, next to the pharmacy',43,64,['traditional','grill'],'traditional',2,4.4,530,true,true,H('10:00','02:00',true),{only:['beyay','shiro','tibs','fitfit','misir','soda'], soldout:['fitfit']}],
  ['r_000203','r3','Sarem Juice','ሳረም ጁስ','Bole','Atlas','Behind Edna Mall',70,52,['juice','cafe'],'juice',1,4.7,1204,true,true,H('07:00','01:00',true),{only:['mango','avo','spris','papaya','fsalad','fitfit']}],
  ['r_000204','r4','Konark Hotel','ኮናርክ ሆቴል','Bole','Bole Medhanialem','Behind Bole Medhanialem church',74,58,['hotel','international'],'hotel',3,4.3,402,true,false,H(),{only:['kitfo','tibs','beyay','mango','club','pasta','fish']}],
  ['r_000205','r5','The Chill Spot','ዘ ቺል ስፖት','Bole','Bole Atlas','Opposite Friendship City Center',68,60,['fast_food','grill'],'fast_food',2,3.9,288,false,false,H('11:00','03:00',true),{only:['tibs','shiro','mango','firfir','burger','fries','soda'], soldout:['tibs'], photo_license:'scraped'}],
  ['r_000206','r6','Yod Abyssinia','ዮድ አቢሲኒያ','Bole','Bole Rwanda','Next to Kaldi\'s Coffee, Bole Rd',76,53,['traditional','hotel'],'traditional',4,4.8,1630,true,true,H('12:00','00:30',true),{only:['kitfo','beyay','tibs','shiro','doro','misir','injera']}],
  ['r_000207','r7','Tomoca Coffee','ቶሞካ ቡና','Arada','Piassa','Piassa, Churchill Ave near Taitu Hotel',46,29,['coffee','cafe'],'cafe',1,4.9,2210,true,true,H('06:30','21:00'),{only:['macch','buna','beans','crois','cake']}],
  ['r_s01',null,'Gojo Kitchen','ጎጆ ኩሽና','Bole','Gerji','Gerji, behind Unity University',80,50,['traditional'],'traditional',1,4.5,640,true,true,H('08:00','22:00'),{}],
  ['r_s02',null,'Sheger Burger','ሸገር በርገር','Bole','Bole 22','22 Mazoria, Golagul building',66,47,['fast_food'],'fast_food',2,4.2,910,false,false,H('10:00','23:00'),{}],
  ['r_s03',null,'Kazanchis Pizza House',null,'Kirkos','Kazanchis','Behind Intercontinental Hotel',55,46,['pizza','international'],'pizza',2,4.1,377,false,true,H('11:00','23:00'),{}],
  ['r_s04',null,'Mesob Kitchen','መሶብ ኩሽና','Kirkos','Meskel Square','Near Meskel Square, Kirkos mall',52,52,['traditional','ethiopian'],'traditional',2,4.4,505,true,true,H('07:30','22:30'),{}],
  ['r_s05',null,'Summit Bakery','ሰሚት ዳቦ ቤት','Yeka','Summit','Summit condominium gate 2',86,40,['bakery','cafe'],'bakery',1,4.3,198,false,true,H('06:00','20:00'),{}],
  ['r_s06',null,'Megenagna Shawarma',null,'Yeka','Megenagna','Behind Zefmesh mall',67,30,['fast_food'],'fast_food',1,4.0,622,false,false,H('10:00','00:00'),{}],
  ['r_s07',null,'CMC Grill House',null,'Yeka','CMC','CMC road, near Total station',78,26,['grill','traditional'],'grill',3,4.2,144,false,false,H('12:00','23:00'),{}],
  ['r_s08',null,'Piassa Pastry','ፒያሳ ኬክ ቤት','Arada','Piassa','Opposite Cinema Ethiopia',45,31,['bakery','cafe'],'bakery',1,4.6,870,true,true,H('06:30','21:30'),{}],
  ['r_s09',null,'Arat Kilo Burger',null,'Arada','Arat Kilo','Behind the university gate',52,25,['fast_food'],'fast_food',1,4.1,301,false,false,H('10:00','22:00'),{}],
  ['r_s10',null,'Lideta Shiro Bet','ልደታ ሽሮ ቤት','Lideta','Lideta','Lideta church, 2nd lane right',38,50,['traditional'],'traditional',1,4.7,1012,false,true,H('09:00','21:00'),{only:['shiro','beyay','misir','gomen','fitfit','injera','soda']}],
  ['r_s11',null,'Mexico Chicken & Grill',null,'Lideta','Mexico','Mexico square, Wabi Shebelle building',41,47,['grill','fast_food'],'grill',2,3.8,166,false,false,H('11:00','23:00'),{}],
  ['r_s12',null,'Merkato Beyaynetu','መርካቶ በያይነቱ','Addis Ketema','Merkato','Anwar mosque side',33,36,['traditional'],'traditional',1,4.5,433,false,true,H('07:00','20:00'),{}],
  ['r_s13',null,'Ayat Family Restaurant','አያት ቤተሰብ','Lemi Kura','Ayat','Ayat, CMC condominium 7',90,33,['traditional','pizza'],'traditional',2,4.0,96,false,true,H('09:00','22:00'),{}],
  ['r_s14',null,'Lebu Fast Food',null,'Nifas Silk-Lafto','Lebu','Lebu, Varnero building',34,75,['fast_food'],'fast_food',1,3.9,74,false,false,H('10:00','22:00'),{has_menu:false}],
  ['r_s15',null,'Gulele Garden Café','ጉለሌ ጋርደን','Gulele','Shiro Meda','Shiro Meda, near the market',34,17,['cafe','coffee'],'cafe',1,4.4,151,false,true,H('07:00','20:00'),{}],
  ['r_s16',null,'Kality Kitfo','ቃሊቲ ክትፎ','Akaky Kaliti','Kality','Kality, near the bus depot',56,88,['traditional','grill'],'grill',2,4.2,88,false,false,H('10:00','22:00'),{}],
  ['r_s17',null,'Kolfe Tej Bet','ኮልፌ ጠጅ ቤት','Kolfe Keranio','Ayer Tena','Ayer Tena, near the mosque',17,46,['traditional'],'traditional',1,4.1,120,false,true,H('11:00','23:00'),{is_active:false}],
  ['r_s18',null,'Atlas Sushi Bar',null,'Bole','Atlas','Atlas, opposite Kaldi\'s Coffee',71,54,['international'],'international',4,4.5,212,true,true,H('12:00','23:00'),{}],
  ['r_s19',null,'Abol Buna','አቦል ቡና','Kirkos','Kazanchis','Kazanchis, green apartment block B',56,48,['coffee','cafe'],'cafe',1,4.6,690,false,true,H('06:00','22:00'),{}],
  ['r_s20',null,'Fasika Juice','ፋሲካ ጁስ','Kirkos','Bambis','Bambis, next to the supermarket',58,44,['juice'],'juice',1,4.3,260,false,true,H('07:00','22:00'),{}],
  ['r_s21',null,'Entoto View Restaurant','እንጦጦ ቪው','Gulele','Entoto','Entoto road, Kidane Mihret',40,10,['traditional','grill'],'traditional',3,4.4,130,false,true,H('09:00','17:30'),{}],
  ['r_s22',null,'Sarbet Pizza Corner',null,'Nifas Silk-Lafto','Sarbet','Sarbet, behind Adot Cinema',42,60,['pizza'],'pizza',2,4.0,219,false,true,H('11:00','23:30'),{}],
  ['r_s23',null,'Bole Morning Bakery',null,'Bole','Bole Michael','Bole Michael, behind the church',78,62,['bakery'],'bakery',1,4.2,175,false,false,H('05:30','12:00'),{}],
];

function priceVar(p, seed){ if (p==null) return null; const f = 1 + (((seed*37)%21)-10)/100; return Math.max(20, Math.round(p*f/10)*10); }
const RESTAURANTS = [], MENU_FILES = {};
RAW.forEach((r, idx) => {
  const [id, legacy, name, name_am, sub, nb, landmark, x, y, cuisines, tpl, pl, rating, rc, partner, fast, hours, ex] = r;
  const ll = XY(x, y);
  const keys = ex.only || MENUS[tpl];
  const shared = !!legacy;
  const items = keys.map((k, i) => { const t = T[k];
    return {id:`i_${id.slice(2)}_${String(i+1).padStart(2,'0')}`, restaurant_id:id, category:CATEGORIES.menu[t.cat].en, category_am:CATEGORIES.menu[t.cat].am, cat_key:t.cat,
      name:t.name, name_am:t.name_am, description:t.description, price_etb: shared ? t.price : priceVar(t.price, idx*7+i), image:null, photo_license: ex.photo_license || 'unknown',
      tags:t.tags, fasting:t.fasting, fasting_inferred: !t.name_am, spice_level:t.spice, popular:!!t.popular, available: !(ex.soldout||[]).includes(k), options:t.options||[], price_scraped_at:'2026-10-01'}; });
  const cats = []; items.forEach(it => { let c = cats.find(c=>c.key===it.cat_key); if (!c){ c = {id:'c_'+String(cats.length+1).padStart(2,'0'), key:it.cat_key, name:it.category, name_am:it.category_am, sort:cats.length+1, items:[]}; cats.push(c); } c.items.push(it); });
  const hasMenu = ex.has_menu !== false;
  if (hasMenu) MENU_FILES[id] = {restaurant_id:id, currency:'ETB', price_scraped_at:'2026-10-01', categories:cats};
  const prices = items.map(i=>i.price_etb).filter(Boolean);
  RESTAURANTS.push({
    id, legacy_id:legacy, name, name_am, slug:name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+nb.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
    rank: idx+1, pinned: shared, sub_city:sub, sub_city_am:SUB_AM[sub], neighborhood:nb, address:`${nb}, ${sub} sub-city`, landmark, lat:ll.lat, lng:ll.lng, pos:{x,y},
    phone:'+25191160'+String(1000+idx*37).slice(-4), hours, is_24h:false, cuisines, tags:[], price_level:pl,
    avg_item_price_etb: prices.length ? Math.round(prices.reduce((a,b)=>a+b,0)/prices.length) : null, avg_prep_minutes: [18,22,9,26,15,31,7][idx] || 20,
    rating, rating_count:rc, fasting_friendly:fast, is_partner:partner, is_active: ex.is_active !== false,
    accepts:['cod','telebirr_tx','cbe_tx','telebirr_online'], hero_image:null, logo_image:null, photo_license: ex.photo_license || 'unknown',
    menu_file: hasMenu ? `top200/menus/${id}.json` : null, menu_item_count: hasMenu ? items.length : 0, has_menu:hasMenu, menu_complete: hasMenu,
    is_new: idx>=26, source:'sample', scraped_at:'2026-10-01',
  });
});

// lightweight index of the "other ~2,800" — only counts shown in UI, a few rows per sub-city to demo lazy load
const INDEX_COUNTS = {'Bole':612,'Kirkos':341,'Yeka':398,'Arada':226,'Lideta':187,'Nifas Silk-Lafto':355,'Kolfe Keranio':204,'Gulele':151,'Akaky Kaliti':129,'Addis Ketema':168,'Lemi Kura':229};

const USER = {
  name:'Meklit Haile', first:'Meklit', phone:'+251 912 330 214', last3:'214', email:null, credit:50, referral:'MEKLIT50',
  addresses:[
    {id:'a1', label:'Home', sub_city:'Bole', neighborhood:'Atlas', landmark:'Near Edna Mall', details:'Blue gate, 2nd floor, apartment 4', notes:'Call when outside', pos:{x:71,y:53}, default:true, gatePhoto:false},
    {id:'a2', label:'Work', sub_city:'Nifas Silk-Lafto', neighborhood:'Sarbet', landmark:'Opposite Sarbet Total station', details:'Wegagen building, 5th floor, reception', notes:'', pos:{x:41,y:61}, default:false, gatePhoto:false},
  ],
  favorites:{restaurants:['r_000201','r_000207'], items:['i_000123_01']},
  defaultPay:'cod', telebirr:'+251 9•• ••• 214',
};

const it = (rid, key, qty=1, opts=[]) => { const m = MENU_FILES[rid]; const all = m.categories.flatMap(c=>c.items); const t = T[key]; const item = all.find(i=>i.name===t.name);
  const delta = opts.reduce((s,o)=>s+o.price_delta_etb,0); return {itemId:item.id, name:item.name, name_am:item.name_am, qty, unit:item.price_etb + delta, base:item.price_etb, options:opts.map(o=>o.name), note:''}; };
const ord = o => { const sub = o.lines.reduce((s,l)=>s+l.qty*l.unit,0); return {delivery:70, service:30, discount:0, tip:0, timeline:[], stamps:{placed:o.placedAt, delivered:o.deliveredAt}, ...o, subtotal:sub, total: sub + 100 - (o.discount||0)}; };

const PAST_ORDERS = [
  ord({code:'AB-K7Q2', restaurantId:'r_000203', lines:[it('r_000203','mango',2), it('r_000203','fitfit')], pay:'telebirr_tx', payState:'verified', ref:'CJ84LM20QX', status:'delivered', placedAt:D(10,13,2), deliveredAt:D(10,13,38), courier:'Tigist Haile', addressId:'a1', rated:null, timeline:[[D(10,13,2),'Order placed'],[D(10,13,4),'Payment sent · reference CJ84LM20QX'],[D(10,13,8),'Payment verified by Addis Bites'],[D(10,13,15),'Courier Tigist picked up'],[D(10,13,38),'Delivered']]}),
  ord({code:'AB-T0M9', restaurantId:'r_000207', lines:[it('r_000207','macch',3), it('r_000207','crois',2)], pay:'telebirr_online', payState:'paid', status:'delivered', placedAt:D(11,8,40), deliveredAt:D(11,9,5), courier:'Samuel Bekele', addressId:'a2', rated:{food:5, courier:5, tags:['Hot food','Fast']}, tip:20, timeline:[[D(11,8,40),'Order placed · paid with Telebirr'],[D(11,8,52),'Courier Samuel picked up'],[D(11,9,5),'Delivered'],[D(11,9,20),'You rated 5★ · tipped 20 ETB']]}),
  ord({code:'AB-C5S1', restaurantId:'r_000205', lines:[it('r_000205','tibs',1,[TIBS[0].choices[1]]), it('r_000205','fries')], pay:'telebirr_online', payState:'refunded', status:'cancelled', cancelReason:'Restaurant couldn’t accept your order (item sold out)', refund:{amount:1030, method:'Telebirr', ref:'TB-RF-55102', status:'Sent', at:D(11,20,40)}, placedAt:D(11,20,2), addressId:'a1', timeline:[[D(11,20,2),'Order placed · paid with Telebirr'],[D(11,20,9),'The Chill Spot couldn’t accept — Tibs sold out'],[D(11,20,12),'Refund requested · 1,030 ETB'],[D(11,20,40),'Refund sent to Telebirr · TB-RF-55102']]}),
  ord({code:'AB-D2L8', restaurantId:'r_000202', lines:[it('r_000202','beyay',2), it('r_000202','shiro')], pay:'cbe_tx', payState:'verified', ref:'FT26284QW71B', status:'delivered', placedAt:D(9,19,10), deliveredAt:D(9,20,22), courier:'Meron Girma', addressId:'a1', rated:{food:4, courier:5, tags:['Friendly']},
    timeline:[[D(9,19,10),'Order placed'],[D(9,19,13),'Receipt uploaded · FT26284QW7'],[D(9,19,21),'Payment rejected — amount on receipt was 1,220, order is 1,320 ETB'],[D(9,19,26),'Receipt resubmitted · FT26284QW71B'],[D(9,19,30),'Payment verified'],[D(9,19,52),'Courier Meron picked up'],[D(9,20,22),'Delivered']]}),
  ord({code:'AB-TS09', restaurantId:'r_000203', lines:[it('r_000203','avo')], pay:'telebirr_online', payState:'paid', status:'delivered', test:true, placedAt:D(8,11,0), deliveredAt:D(8,11,20), courier:'Samuel Bekele', addressId:'a1', timeline:[[D(8,11,0),'TEST order placed'],[D(8,11,20),'Delivered']]}),
];

// Active order seeded for standalone demo (matches Console + Courier story)
const ACTIVE_SEED = ord({code:'AB-2B9B', restaurantId:'r_000201', lines:[it('r_000201','fitfit'), it('r_000201','kitfo',1,[COOK[0].choices[1]])], pay:'cod', payState:'cash_due', payWith:2000, code4:'4827',
  status:'on_way', placedAt:D(12,18,9), addressId:'a1', courier:window.ABBus.COURIER_DAWIT, eta:12, seeded:true});

const FAQ = [
  ['Payments','How do I pay by Telebirr transfer?','After you place the order, send the exact total to merchant 0911 000 777 (Addis Bites PLC), then type the 10-character transaction ID from the SMS. We check it in under 5 minutes.'],
  ['Payments','Can I pay cash?','Yes. Choose Cash on delivery. Tell us what note you will pay with and the courier brings change.'],
  ['Delivery','How long does delivery take?','Usually 30–45 minutes: restaurant prep time plus the ride. You can see live progress on the tracking screen.'],
  ['Fasting','How do I find fasting food?','Tap the ጾም Fasting chip on Home or turn on “Fasting only” inside a restaurant. Items are marked with a green ጾም tag.'],
  ['Refunds','When do I get my refund?','Online payments are refunded to Telebirr within 1–3 hours. Transfers are refunded within 1 business day. You can follow each refund in Orders → Refunds.'],
];

window.CK = { BASE, D, SUBS, SUB_AM, CATEGORIES, RESTAURANTS, MENU_FILES, INDEX_COUNTS, USER, PAST_ORDERS, ACTIVE_SEED, FAQ, T, COOK };
})();
