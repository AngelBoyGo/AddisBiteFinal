// Addis Bites Courier — mock data (EAT wall-clock stored as UTC ms). Shares restaurants/menu/sub-cities with data.js (console).
(function(){
const D = (d, h, m) => Date.UTC(2026, 9, d, h, m, 0);
const BASE = D(12, 18, 42); // Mon 12 Oct 2026 · 18:42 EAT
const MENU = window.AB.MENU;
const it = (name, qty=1) => ({name, qty, price: MENU[name]});
const R = id => window.AB.RESTAURANTS.find(r=>r.id===id);

const COURIER = {
  id:'c9', name:'Dawit Bekele', first:'Dawit', courierId:'CR-0417', phone:'+251 912 448 345', last3:'345',
  vehicle:'Motorbike', plate:'AA 3-B12345', model:'Bajaj Boxer 150', rating:4.8, ratings:212, accept:86, ontime:93, completed:1184,
  joined:'Jun 2024', capOrders:5, capEtb:2000, newCourier:false, telebirr:'+251 9•• ••• 345', limit:2000, color:'#0E7C86', zones:['Bole','Kirkos','Nifas Silk-Lafto','Lideta','Arada'], maxKm:6,
};

const DOCS = [
  {id:'id', name:'National ID', status:'approved', exp:'Exp. Mar 2031'},
  {id:'lic', name:'Driving licence', status:'approved', exp:'Expires Sat 17 Oct 2026', warn:'Expires in 5 days'},
  {id:'reg', name:'Vehicle registration (Libre)', status:'pending', exp:'Uploaded Sun 11 Oct · 21:04'},
  {id:'ins', name:'Third-party insurance', status:'rejected', exp:'Uploaded Sat 10 Oct · 10:12', reason:'Photo is blurry — policy number not readable'},
];

// earning parts: pay (base), dist, peak, tip, comp, ded {amt, why}
function job(o){
  const items = o.items; const subtotal = items.reduce((s,i)=>s+i.qty*i.price,0);
  const e = {pay:0, dist:0, peak:0, tip:0, comp:0, ded:0, dedWhy:null, ...o.earn};
  const earning = e.pay + e.dist + e.peak + e.tip + e.comp - e.ded;
  return {delivery:70, service:30, discount:0, ...o, subtotal, total: subtotal+100, earn:e, earning, rest:R(o.restaurantId)};
}

// history: Sat 10, Sun 11, Mon 12 (today). Times are delivered/closed time.
const HISTORY = [
  // ---- Mon 12 Oct (today) ----
  job({code:'AB-1RT6', restaurantId:'r3', sub:'Bole', landmark:'Behind Bole Medhanialem', items:[it('Mango-Avocado Juice',2)], pay:'telebirr_online', status:'Delivered', at:D(12,12,14), started:D(12,11,49), km:2.1, earn:{pay:70, dist:10}, proof:'code', cust:'Hanna'}),
  job({code:'AB-4KQ1', restaurantId:'r1', sub:'Nifas Silk-Lafto', landmark:'Opposite Sarbet Total station', items:[it('Tomato Fitfit'),it('Shiro Tegabino')], pay:'cod', cash:1030, status:'Delivered', at:D(12,12,52), started:D(12,12,24), km:2.4, earn:{pay:70, dist:10, peak:15}, proof:'code', cust:'Yared'}),
  job({code:'AB-7XN3', restaurantId:'r4', sub:'Bole', landmark:'Near Edna Mall', items:[it('Special Kitfo'),it('Mango-Avocado Juice')], pay:'cbe_tx', status:'Delivered', at:D(12,13,31), started:D(12,13,6), km:1.2, earn:{pay:70, peak:15}, proof:'photo', cust:'Mahlet'}),
  job({code:'AB-6WM8', restaurantId:'r2', sub:'Lideta', landmark:'Mexico square, Wabi Shebelle building', items:[it('Beyaynetu',2)], pay:'cod', cash:940, status:'Delivered', at:D(12,14,20), started:D(12,13,44), km:4.6, earn:{pay:70, dist:25, peak:15}, proof:'code', cust:'Abel'}),
  job({code:'AB-3JS0', restaurantId:'r7', sub:'Arada', landmark:'Piassa, near Taitu Hotel', items:[it('Tomoca Macchiato',2),it('Coffee Beans 250g')], pay:'telebirr_online', status:'Delivered', at:D(12,15,48), started:D(12,15,30), km:0.9, earn:{pay:70}, proof:'signature', cust:'Ruth'}),
  job({code:'AB-9PT2', restaurantId:'r3', sub:'Kirkos', landmark:'Kazanchis, green apartment block B', items:[it('Mango-Avocado Juice',2),it('Tomato Fitfit')], pay:'cod', cash:1010, status:'Delivered', at:D(12,17,25), started:D(12,16,58), km:2.8, earn:{pay:70, dist:10, tip:15}, proof:'code', cust:'Eden'}),
  job({code:'AB-2B9B', restaurantId:'r1', sub:'Kirkos', landmark:'Kazanchis, behind Intercontinental', items:[it('Tomato Fitfit'),it('Shiro Tegabino')], pay:'cod', cash:1030, status:'Delivered', at:D(12,18,20), started:D(12,17,54), km:4.2, earn:{pay:70, dist:20, peak:15}, proof:'code', cust:'Selamawit', isDemoJob:true}),
  // ---- Sun 11 Oct ----
  job({code:'AB-8LC2', restaurantId:'r6', sub:'Bole', landmark:'Opposite Friendship City Center', items:[it('Special Kitfo'),it('Beyaynetu')], pay:'cod', cash:1470, status:'Delivered', at:D(11,19,5), started:D(11,18,31), km:1.8, earn:{pay:70, dist:15, peak:15}, proof:'code', cust:'Kidus'}),
  job({code:'AB-5NB7', restaurantId:'r5', sub:'Yeka', landmark:'Megenagna, behind Zefmesh mall', items:[it('Shiro Tegabino'),it('Mango-Avocado Juice')], pay:'cod', cash:0, status:'No-show', at:D(11,20,12), started:D(11,19,30), km:5.1, earn:{comp:50}, note:'Customer unreachable for 5 min · food returned to The Chill Spot · 50 ETB compensation', cust:'Lidya'}),
  job({code:'AB-3GH9', restaurantId:'r4', sub:'Bole', landmark:'Next to Kaldi\'s Coffee, Atlas', items:[it('Beyaynetu'),it('Mango-Avocado Juice')], pay:'telebirr_online', status:'Delivered', at:D(11,20,51), started:D(11,20,30), km:1.0, earn:{pay:70, dist:10, tip:20}, proof:'photo', cust:'Tsion'}),
  job({code:'AB-6DF4', restaurantId:'r2', sub:'Nifas Silk-Lafto', landmark:'Lafto, near Ayat condominium 14', items:[it('Beyaynetu'),it('Shiro Tegabino')], pay:'cod', cash:0, status:'Cancelled', at:D(11,21,18), started:D(11,21,2), km:0, earn:{}, note:'Cancelled by dispatch · Tigist — restaurant closed before pickup. No food collected.', cust:'Dagim'}),
  job({code:'AB-1VW3', restaurantId:'r1', sub:'Kirkos', landmark:'Near Meskel Square, Kirkos mall', items:[it('Special Kitfo')], pay:'cod', cash:1050, status:'Delivered', at:D(11,21,57), started:D(11,21,30), km:2.6, earn:{pay:70, dist:10, peak:15}, proof:'code', cust:'Rediet'}),
  job({code:'AB-0QS8', restaurantId:'r3', sub:'Bole', landmark:'Behind Edna Mall, blue gate', items:[it('Mango-Avocado Juice')], pay:'telebirr_online', status:'Delivered', at:D(11,22,24), started:D(11,22,8), km:0.8, earn:{pay:70}, proof:'code', cust:'Nahom'}),
  job({code:'AB-7RE5', restaurantId:'r7', sub:'Arada', landmark:'Arat Kilo, behind the university gate', items:[it('Tomoca Macchiato',3)], pay:'cod', cash:370, status:'Delivered', at:D(11,23,2), started:D(11,22,45), km:1.5, earn:{pay:70}, proof:'signature', cust:'Meklit'}),
  // ---- Sat 10 Oct ----
  job({code:'AB-TS07', restaurantId:'r3', sub:'Bole', landmark:'Addis Bites office (test)', items:[it('Mango-Avocado Juice')], pay:'telebirr_online', status:'Delivered', test:true, at:D(10,11,20), started:D(10,11,5), km:0.4, earn:{}, note:'TEST order — no real earnings', proof:'code', cust:'Test Account QA'}),
  job({code:'AB-2PL6', restaurantId:'r1', sub:'Lideta', landmark:'Lideta church, 2nd lane right', items:[it('Tomato Fitfit'),it('Shiro Tegabino')], pay:'cod', cash:1030, status:'Delivered', at:D(10,12,40), started:D(10,12,12), km:3.0, earn:{pay:70, dist:10, peak:15}, proof:'code', cust:'Amanuel'}),
  job({code:'AB-5YU1', restaurantId:'r6', sub:'Bole', landmark:'Near Bole Medhanialem church, 3rd floor', items:[it('Special Kitfo',2)], pay:'cbe_tx', status:'Delivered', at:D(10,13,25), started:D(10,13,2), km:1.1, earn:{pay:70, tip:30}, proof:'photo', cust:'Ephrem'}),
  job({code:'AB-8MK3', restaurantId:'r5', sub:'Bole', landmark:'Opposite Friendship City Center', items:[it('Tibs (Beef)')], pay:'cod', cash:880, status:'Delivered', at:D(10,19,48), started:D(10,19,2), km:2.2, earn:{pay:70, dist:10, peak:15, ded:20, dedWhy:'Late delivery (+18 min over ETA)'}, proof:'code', cust:'Martha'}),
  job({code:'AB-4TB9', restaurantId:'r2', sub:'Kirkos', landmark:'Kazanchis, behind Intercontinental', items:[it('Beyaynetu')], pay:'telebirr_online', status:'Delivered', at:D(10,20,30), started:D(10,20,9), km:2.0, earn:{pay:70, dist:5}, proof:'code', cust:'Biniyam'}),
  job({code:'AB-9ZC0', restaurantId:'r4', sub:'Yeka', landmark:'CMC road, near Total station', items:[it('Special Kitfo')], pay:'cod', cash:1050, status:'Returned', at:D(10,21,40), started:D(10,20,58), km:5.3, earn:{pay:70, dist:25, peak:15}, proof:'code', note:'Delivered after customer called back; earlier marked returned then re-delivered', cust:'Saron'}),
];
// fix: AB-9ZC0 is a delivered job (keep "Returned" off to avoid confusion)
HISTORY[HISTORY.length-1].status = 'Delivered'; delete HISTORY[HISTORY.length-1].note;

// Daily totals for older days (no per-job detail kept in app beyond 3 days)
const OLDER_DAYS = [
  {d:1, earn:540, jobs:6}, {d:2, earn:600, jobs:7}, {d:3, earn:0, jobs:0}, {d:4, earn:710, jobs:8}, {d:5, earn:480, jobs:5},
  {d:6, earn:520, jobs:6}, {d:7, earn:610, jobs:7}, {d:8, earn:0, jobs:0}, {d:9, earn:705, jobs:8},
];

// Cash ledger (running balance computed in store)
const CASH = [
  {at:D(10,9,0), kind:'open', text:'Opening balance · Sat 10 Oct', amt:0},
  ...HISTORY.filter(j=>j.pay==='cod' && j.cash>0 && j.at<D(11,0,0)).map(j=>({at:j.at, kind:'cod', code:j.code, text:`COD collected · ${j.code}`, amt:j.cash})),
  {at:D(10,22,30), kind:'deposit', method:'office', text:'Deposit · handed to Bole office', ref:'OFC-10-2231', amt:-2960, status:'verified', by:'Kaleb (Finance)'},
  ...HISTORY.filter(j=>j.pay==='cod' && j.cash>0 && j.at>D(11,0,0) && j.at<D(12,0,0)).map(j=>({at:j.at, kind:'cod', code:j.code, text:`COD collected · ${j.code}`, amt:j.cash})),
  {at:D(11,23,40), kind:'deposit', method:'office', text:'Deposit · handed to Bole office', ref:'OFC-11-2340', amt:-2700, status:'verified', by:'Kaleb (Finance)'},
  {at:D(11,23,41), kind:'note', text:'Carried over to Mon 12 Oct', amt:0},
  ...HISTORY.filter(j=>j.pay==='cod' && j.cash>0 && j.at>D(12,0,0)).map(j=>({at:j.at, kind:'cod', code:j.code, text:`COD collected · ${j.code}`, amt:j.cash})),
  {at:D(12,15,10), kind:'deposit', method:'telebirr', text:'Deposit · Telebirr transfer to Addis Bites', ref:'CJ86TQ4LXA', amt:-1000, status:'verified', by:'Kaleb (Finance)'},
].sort((a,b)=>a.at-b.at);

const PAYOUTS = [
  {id:'PO-C-0417-42', period:'Tue 6 – Mon 12 Oct', at:D(13,9,0), status:'scheduled', note:'Accruing — closes Mon 12 Oct · 23:59', days:[6,7,8,9,10,11,12]},
  {id:'PO-C-0417-41', period:'Tue 29 Sep – Mon 5 Oct', at:D(6,9,2), status:'paid', amount:3180, ref:'TB-PAY-81K2Q', days:[29,30,1,2,3,4,5]},
  {id:'PO-C-0417-40', period:'Tue 22 – Mon 28 Sep', at:Date.UTC(2026,8,29,9,0), status:'failed', amount:2960, reason:'Telebirr account name did not match ID — fixed and re-sent', retried:'PO-C-0417-40R'},
  {id:'PO-C-0417-40R', period:'Tue 22 – Mon 28 Sep (re-sent)', at:Date.UTC(2026,8,30,11,15), status:'paid', amount:2960, ref:'TB-PAY-77M0D'},
  {id:'PO-C-0417-39', period:'Tue 15 – Mon 21 Sep', at:Date.UTC(2026,8,22,9,1), status:'paid', amount:3050, ref:'TB-PAY-70A9S'},
];

const DEPOSIT_POINTS = [
  {id:'dp1', name:'Addis Bites office — Bole', where:'Atlas, next to Kaldi\'s Coffee, 2nd floor', hours:'08:00–22:00', open:true, km:1.4, sub:'Bole', method:'office'},
  {id:'dp2', name:'Supervisor Tigist — Kazanchis hub', where:'Behind Intercontinental, blue container', hours:'17:00–23:00', open:true, km:2.2, sub:'Kirkos', method:'supervisor'},
  {id:'dp3', name:'Sarbet hub', where:'Opposite Sarbet Total station', hours:'10:00–18:00', open:false, km:3.1, sub:'Nifas Silk-Lafto', method:'office'},
  {id:'dp4', name:'Telebirr (any phone)', where:'Send to merchant 0911 000 777 · Addis Bites PLC', hours:'24 hours', open:true, km:0, sub:null, method:'telebirr'},
];

const DISPATCH_THREAD = [
  {who:'in', by:'Tigist', text:'Good afternoon Dawit. Busy evening in Bole — stay near Edna Mall if you can.', at:D(12,16,30)},
  {who:'out', text:'OK 👍', at:D(12,16,31), status:'read'},
  {who:'in', by:'Abebe', text:'Reminder: your licence expires Sat 17 Oct. Upload the new one in Profile.', at:D(12,17,58)},
  {who:'out', text:'Will do tomorrow', at:D(12,18,1), status:'read'},
];

// Offers queue
const OFFERS = {
  demo: {code:'AB-2B9B', restaurantId:'r1', sub:'Kirkos', landmark:'Kazanchis, behind Intercontinental', address:'Kirkos sub-city, Woreda 02, House 113', items:[it('Tomato Fitfit'),it('Shiro Tegabino')], pay:'cod',
    toRest:1.0, km:4.2, mins:22, earn:{pay:70, dist:20, peak:15}, bag:'2 items · small bag', care:null, cust:'Selamawit', custLast3:'101', notes:'Green gate next to the pharmacy, 2nd floor. Please no onions on the fitfit.', code4:'4821', restPos:null},
  prepaid: {code:'AB-H4N6', restaurantId:'r4', sub:'Bole', landmark:'Next to Kaldi\'s Coffee, Atlas', address:'Bole sub-city, Woreda 03, House 165', items:[it('Special Kitfo'),it('Mango-Avocado Juice')], pay:'telebirr_online',
    toRest:0.8, km:1.7, mins:14, earn:{pay:70, peak:15}, bag:'2 items · small bag', care:'Juice — keep upright', cust:'Bezawit', custLast3:'507', notes:'Blue gate, 2nd floor. Call when outside.', code4:'3307'},
  stack: {code:'AB-L6P4', restaurantId:'r4', sub:'Bole', landmark:'Behind Edna Mall, blue gate', address:'Bole sub-city, Woreda 03, House 250', items:[it('Beyaynetu'),it('Mango-Avocado Juice')], pay:'telebirr_online',
    toRest:0, km:1.1, mins:9, earn:{pay:70}, bag:'2 items · same restaurant', care:'Juice — keep upright', cust:'Natnael', custLast3:'619', notes:'Ask the guard for Natnael, apartment 4B.', code4:'9150', stacked:true},
  coffee: {code:'AB-E5T9', restaurantId:'r7', sub:'Arada', landmark:'Piassa, near Taitu Hotel', address:'Arada sub-city, Woreda 08, House 77', items:[it('Tomoca Macchiato',4)], pay:'cbe_tx',
    toRest:2.6, km:3.4, mins:19, earn:{pay:70, dist:10, peak:15}, bag:'4 items · cup holder', care:'Hot drinks — keep upright', cust:'Ruth', custLast3:'571', notes:'Office building, ground floor reception.', code4:'6612'},
};

const QUICK = {
  customer:[
    {en:'I\'m on my way', am:'በመንገድ ላይ ነኝ'},
    {en:'I\'m 5 minutes away', am:'5 ደቂቃ ቀርቶኛል'},
    {en:'I\'m outside', am:'ውጭ ደርሻለሁ'},
    {en:'I can\'t find the address, please share a landmark', am:'አድራሻውን ማግኘት አልቻልኩም፤ እባክዎ ምልክት ይንገሩኝ'},
  ],
  restaurant:[
    {en:'I\'m here for order {code}', am:'ለትዕዛዝ {code} መጥቻለሁ'},
    {en:'How many minutes until it\'s ready?', am:'ለመዘጋጀት ስንት ደቂቃ ይቀራል?'},
    {en:'I\'m 3 minutes away', am:'3 ደቂቃ ቀርቶኛል'},
  ],
  dispatch:[
    {en:'OK, understood', am:'እሺ፣ ገባኝ'},
    {en:'Please call me', am:'እባክዎ ይደውሉልኝ'},
    {en:'Restaurant is slow, waiting', am:'ምግብ ቤቱ ዘግይቷል፤ እየጠበቅሁ ነው'},
    {en:'Customer not answering', am:'ደንበኛው አይመልስም'},
  ],
};

const DISPATCHERS = {Abebe:'Abebe (Dispatch)', Tigist:'Tigist (Dispatch)'};

window.CB = { BASE, D, COURIER, DOCS, HISTORY, OLDER_DAYS, CASH, PAYOUTS, DEPOSIT_POINTS, DISPATCH_THREAD, OFFERS, QUICK, DISPATCHERS, job };
})();
