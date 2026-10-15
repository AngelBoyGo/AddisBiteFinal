// Addis Bites — mock data. All timestamps are EAT wall-clock milliseconds (treated as UTC internally).
(function(){
const BASE = Date.UTC(2026, 9, 12, 1, 6, 0); // Mon 12 Oct 2026 · 01:06 EAT
const M = 60000;
const ago = (min) => BASE - Math.round(min * M);

const SUBCITIES = {
  'Gulele':{x:34,y:17}, 'Yeka':{x:67,y:22}, 'Arada':{x:47,y:31}, 'Addis Ketema':{x:35,y:38},
  'Kolfe Keranio':{x:17,y:46}, 'Lideta':{x:38,y:52}, 'Kirkos':{x:53,y:50}, 'Bole':{x:72,y:56},
  'Lemi Kura':{x:88,y:38}, 'Nifas Silk-Lafto':{x:44,y:70}, 'Akaky Kaliti':{x:56,y:88}
};

const OPERATORS = [
  {id:'me', name:'Liya Mekonnen', short:'Liya', role:'Dispatcher', color:'#0F7A4A', initials:'LM'},
  {id:'op2', name:'Abebe Tadesse', short:'Abebe', role:'Dispatcher', color:'#2E6BE6', initials:'AT'},
  {id:'op3', name:'Bethlehem Asfaw', short:'Bethlehem', role:'Dispatcher', color:'#B5478F', initials:'BA'},
  {id:'op4', name:'Kaleb Worku', short:'Kaleb', role:'Finance', color:'#C27A0E', initials:'KW'},
  {id:'op5', name:'Ruth Alemayehu', short:'Ruth', role:'Admin', color:'#5B5FC7', initials:'RA'},
];

const RESTAURANTS = [
  {id:'r1', name:'Kategna', area:'Sarbet', sub:'Nifas Silk-Lafto', pos:{x:40,y:62}, open:true, prep:18, today:7, reject:3.1, payout:4320, phone:'118', hours:'08:00–23:30', contact:'Mesfin (manager)'},
  {id:'r2', name:'Delmela', area:'Sarbet', sub:'Nifas Silk-Lafto', pos:{x:43,y:64}, open:true, prep:22, today:5, reject:6.8, payout:2790, phone:'204', hours:'10:00–02:00', contact:'Rahel (owner)'},
  {id:'r3', name:'Sarem Juice', area:'Bole', sub:'Bole', pos:{x:70,y:52}, open:true, prep:9, today:9, reject:1.2, payout:1980, phone:'331', hours:'07:00–01:00', contact:'Sara (manager)'},
  {id:'r4', name:'Konark Hotel', area:'Bole', sub:'Bole', pos:{x:74,y:58}, open:true, prep:26, today:4, reject:4.4, payout:3150, phone:'447', hours:'24 hours', contact:'Front desk'},
  {id:'r5', name:'The Chill Spot', area:'Bole', sub:'Bole', pos:{x:68,y:60}, open:true, prep:15, today:6, reject:11.5, payout:1640, phone:'562', hours:'11:00–03:00', contact:'Nahom (owner)'},
  {id:'r6', name:'Yod Abyssinia', area:'Bole', sub:'Bole', pos:{x:76,y:53}, open:true, prep:31, today:3, reject:2.0, payout:5880, phone:'679', hours:'12:00–00:30', contact:'Tesfaye (F&B)'},
  {id:'r7', name:'Tomoca Coffee', area:'Piassa', sub:'Arada', pos:{x:46,y:29}, open:false, prep:7, today:5, reject:0.8, payout:910, phone:'783', hours:'06:30–21:00', contact:'Hirut (shift lead)'},
];

const MENU = {
  'Tomato Fitfit':550, 'Shiro Tegabino':380, 'Special Kitfo':950, 'Mango-Avocado Juice':180, 'Beyaynetu':420,
  'Tomoca Macchiato':90, 'Coffee Beans 250g':650, 'Firfir':320, 'Tibs (Beef)':780, 'Fresh Avocado Juice':160
};
const RMENU = {
  r1:['Special Kitfo','Tomato Fitfit','Beyaynetu','Shiro Tegabino','Firfir'],
  r2:['Beyaynetu','Shiro Tegabino','Tibs (Beef)','Tomato Fitfit'],
  r3:['Mango-Avocado Juice','Fresh Avocado Juice','Tomato Fitfit'],
  r4:['Special Kitfo','Tibs (Beef)','Beyaynetu','Mango-Avocado Juice'],
  r5:['Tibs (Beef)','Shiro Tegabino','Mango-Avocado Juice','Firfir'],
  r6:['Special Kitfo','Beyaynetu','Tibs (Beef)','Shiro Tegabino'],
  r7:['Tomoca Macchiato','Coffee Beans 250g'],
};
const OUT_OF_STOCK = {r5:['Tibs (Beef)'], r2:['Tomato Fitfit']};

const COURIERS = [
  {id:'c1', name:'Abebe Girma', status:'busy', pos:{x:70,y:55}, vehicle:'Motorbike · AA 3-B48120', rating:4.8, accept:92, today:9, cash:2640, limit:2000, seen:0.3, phone:'412', color:'#2E6BE6', joined:'Mar 2025'},
  {id:'c2', name:'Tigist Haile', status:'busy', pos:{x:38,y:58}, vehicle:'Motorbike · AA 2-A11873', rating:4.9, accept:96, today:7, cash:0, limit:2000, seen:0.1, phone:'523', color:'#B5478F', joined:'Nov 2024'},
  {id:'c3', name:'Dawit Mengistu', status:'busy', pos:{x:74,y:50}, vehicle:'Bicycle', rating:4.6, accept:81, today:5, cash:480, limit:1500, seen:0.2, phone:'634', color:'#C27A0E', joined:'Jan 2026'},
  {id:'c4', name:'Hana Tesfaye', status:'busy', pos:{x:37,y:51}, vehicle:'Motorbike · AA 3-C90214', rating:4.7, accept:88, today:6, cash:1010, limit:2000, seen:0.5, phone:'745', color:'#0F7A4A', joined:'Jul 2025'},
  {id:'c5', name:'Yonas Alemu', status:'offline', pos:{x:73,y:57}, vehicle:'Motorbike · AA 2-B33567', rating:4.1, accept:64, today:2, cash:350, limit:2000, seen:58, phone:'856', color:'#5B5FC7', joined:'May 2026'},
  {id:'c6', name:'Meron Girma', status:'busy', pos:{x:43,y:66}, vehicle:'Motorbike · AA 3-A72045', rating:4.9, accept:94, today:8, cash:740, limit:2000, seen:0.1, phone:'967', color:'#D9480F', joined:'Feb 2025'},
  {id:'c7', name:'Samuel Bekele', status:'online', pos:{x:50,y:36}, vehicle:'Motorbike · AA 2-C50981', rating:4.5, accept:85, today:4, cash:0, limit:2000, seen:0.4, phone:'178', color:'#0E7C86', joined:'Sep 2025'},
  {id:'c8', name:'Selam Wondimu', status:'online', pos:{x:60,y:47}, vehicle:'Motorbike · AA 3-B66310', rating:4.8, accept:90, today:6, cash:1150, limit:2000, seen:0.2, phone:'289', color:'#8A3FB8', joined:'Dec 2024'},
];

// helper to build items
const it = (name, qty=1) => ({name, qty, price: MENU[name]});

const O = [];
let seq = 0;
function order(o){
  seq++;
  const d = {
    id: 'ord_' + (0x8f2a10 + seq * 7919).toString(16),
    discount: 0, delivery: 70, service: 30, owner: null, claimExpired: false, courierId: null,
    attempts: [], test: false, hold: 0, threads: {customer:[], courier:[], restaurant:[]}, events: [],
    refRequested: false, ...o,
  };
  d.placedAt = ago(o.age);
  d.subtotal = d.items.reduce((s,i)=>s+i.qty*i.price,0);
  d.linesTotal = d.subtotal + d.delivery + d.service - d.discount;
  if (d.total == null) d.total = d.linesTotal;
  O.push(d);
  return d;
}

const CUST = [
  ['Selamawit Bekele','101'],['Henok Tadesse','224'],['Mahlet Girma','318'],['Yared Alemu','452'],['Bezawit Haile','507'],
  ['Natnael Kebede','619'],['Eden Mulugeta','733'],['Robel Assefa','846'],['Saron Desta','905'],['Kidus Worku','127'],
  ['Hiwot Lemma','238'],['Abel Negash','349'],['Feven Tesfaye','461'],['Biniyam Yilma','572'],['Lidya Shiferaw','683'],
  ['Mikiyas Abebe','794'],['Tsion Getachew','815'],['Dagim Fikru','926'],['Rediet Amare','137'],['Nahom Berhanu','248'],
  ['Meklit Solomon','359'],['Amanuel Hailu','460'],['Ruth Kassa','571'],['Ephrem Gebre','682'],['Martha Wolde','793'],
  ['Test Account QA','000'],['Test Account Ops','001'],['Test Account Dev','002']
];
const LANDMARKS = {
  'Bole':['Behind Edna Mall, blue gate','Near Bole Medhanialem church, 3rd floor','Opposite Friendship City Center','Next to Kaldi\'s Coffee, Atlas'],
  'Kirkos':['Kazanchis, behind Intercontinental','Near Meskel Square, Kirkos mall','Kazanchis, green apartment block B'],
  'Yeka':['Megenagna, behind Zefmesh mall','CMC road, near Total station','Kotebe, after the bridge'],
  'Arada':['Piassa, near Taitu Hotel','Arat Kilo, behind the university gate'],
  'Lideta':['Mexico square, Wabi Shebelle building','Lideta church, 2nd lane right'],
  'Nifas Silk-Lafto':['Sarbet, Canada embassy road','Lafto, near Ayat condominium 14','Gofa camp, block 22'],
  'Kolfe Keranio':['Ayer Tena, near the mosque','Kolfe, Tor Hailoch roundabout'],
  'Gulele':['Shiro Meda, near the market','Entoto road, Kidane Mihret'],
  'Addis Ketema':['Merkato, Anwar mosque side'],
  'Akaky Kaliti':['Kality, near the bus depot'],
  'Lemi Kura':['Ayat, CMC condominium 7']
};
let ci = 0;
function cust(sub, li=0){
  const [name, last] = CUST[ci++ % CUST.length];
  const lm = (LANDMARKS[sub]||['—'])[li % (LANDMARKS[sub]||['—']).length];
  return {name, last3:last, full:`+251 9${(11+ci*7)%89+10} ${String(200+ci*37).slice(0,3)} ${last}`, sub, landmark:lm,
    address: `${sub} sub-city, Woreda ${String((ci*3)%14+1).padStart(2,'0')}, House ${100+ci*13}`};
}

// ---------- NEW / Awaiting approval ----------
order({code:'AB-2B9B', lane:'new', status:'Awaiting approval', age:4, restaurantId:'r1', customer:cust('Kirkos'), dist:3.2,
  items:[it('Tomato Fitfit'),it('Shiro Tegabino')], pay:{method:'cod', state:'cash_due'}});
order({code:'AB-K7M2', lane:'new', status:'Awaiting payment', age:23, restaurantId:'r3', customer:cust('Bole',1), dist:1.3,
  items:[it('Mango-Avocado Juice',2),it('Tomato Fitfit')], owner:'me', refRequested:true,
  pay:{method:'telebirr_tx', state:'awaiting_ref', ev:{sender:'Henok T.', senderOk:true, ref:null, amount:null, screenshot:true}}});
order({code:'AB-P3X8', lane:'new', status:'Payment submitted', age:12, restaurantId:'r6', customer:cust('Bole',2), dist:2.1,
  items:[it('Special Kitfo'),it('Beyaynetu')], owner:'me',
  pay:{method:'cbe_tx', state:'submitted', ev:{sender:'Mahlet Girma', senderOk:true, ref:'FT26285Q8LKX', amount:1470, screenshot:true}}});
order({code:'AB-9FQ1', lane:'new', status:'Awaiting approval', age:7, restaurantId:'r2', customer:cust('Nifas Silk-Lafto',1), dist:2.6,
  items:[it('Beyaynetu'),it('Shiro Tegabino')], owner:'me', pay:{method:'cod', state:'cash_due'}});
order({code:'AB-H4N6', lane:'new', status:'Awaiting approval', age:2, restaurantId:'r4', customer:cust('Bole',3), dist:0.9,
  items:[it('Special Kitfo'),it('Mango-Avocado Juice')], pay:{method:'telebirr_online', state:'paid'}});
order({code:'AB-W2R5', lane:'new', status:'Awaiting approval', age:38, restaurantId:'r7', customer:cust('Arada'), dist:1.7,
  items:[it('Coffee Beans 250g'),it('Tomoca Macchiato',2)], owner:'op2', claimExpired:true, pay:{method:'cod', state:'cash_due'}});
order({code:'AB-TS01', lane:'new', status:'Awaiting approval', age:16, restaurantId:'r5', customer:cust('Bole'), dist:1.1, test:true,
  items:[it('Shiro Tegabino')], pay:{method:'cod', state:'cash_due'}});

// ---------- ACTION REQUIRED ----------
ci = 9;
order({code:'AB-7Q4D', lane:'action', status:'No courier found', reason:'no_courier', age:6600, restaurantId:'r1', customer:cust('Kolfe Keranio'), dist:4.8,
  items:[it('Tomato Fitfit')], pay:{method:'cod', state:'cash_due'}, hold:550,
  attempts:[{c:'c7',r:'timeout',at:6598},{c:'c2',r:'declined',at:6596,why:'Too far'},{c:'c5',r:'timeout',at:6594},{c:'c3',r:'declined',at:6592,why:'Bicycle — distance'},{c:'c8',r:'timeout',at:6590}]});
order({code:'AB-X0B2', lane:'action', status:'No transfer reference', reason:'payment_missing', age:1862, restaurantId:'r3', customer:cust('Yeka'), dist:3.9,
  items:[it('Fresh Avocado Juice',2),it('Mango-Avocado Juice')], refRequested:true,
  pay:{method:'telebirr_tx', state:'awaiting_ref', ev:{sender:null, senderOk:false, ref:null, amount:null, screenshot:false}}});
order({code:'AB-M8C3', lane:'action', status:'Courier no-show', reason:'courier_noshow', age:52, restaurantId:'r6', customer:cust('Bole',1), dist:1.6,
  items:[it('Special Kitfo'),it('Shiro Tegabino')], owner:'me', courierId:'c5', pay:{method:'cod', state:'cash_due'},
  attempts:[{c:'c5',r:'accepted',at:44,why:'Did not arrive at restaurant (ETA was 00:30)'}]});
order({code:'AB-R6V9', lane:'action', status:'Payment mismatch', reason:'payment_mismatch', age:34, restaurantId:'r4', customer:cust('Bole',2), dist:1.2,
  items:[it('Special Kitfo'),it('Beyaynetu')], owner:'op3',
  pay:{method:'telebirr_tx', state:'mismatch', ev:{sender:'Bezawit H.', senderOk:true, ref:'CJ84KD72PQ', amount:1400, screenshot:true}}});
order({code:'AB-C2L7', lane:'action', status:'Customer unreachable', reason:'unreachable', age:138, restaurantId:'r2', customer:cust('Lideta'), dist:2.2,
  items:[it('Beyaynetu',2),it('Shiro Tegabino')], owner:'me', courierId:'c4', pay:{method:'cod', state:'cash_due'},
  attempts:[{c:'c4',r:'accepted',at:120}]});
order({code:'AB-Z5E4', lane:'action', status:'Restaurant rejected', reason:'restaurant_rejected', age:27, restaurantId:'r5', customer:cust('Yeka',1), dist:5.4,
  items:[it('Tibs (Beef)'),it('Mango-Avocado Juice')], total:1110, pay:{method:'telebirr_online', state:'paid'}});
order({code:'AB-F9J3', lane:'action', status:'Food not delivered', reason:'not_delivered', age:220, restaurantId:'r3', customer:cust('Bole',3), dist:1.4,
  items:[it('Mango-Avocado Juice'),it('Tomato Fitfit')], owner:'me', courierId:'c1',
  pay:{method:'cbe_tx', state:'verified', ev:{sender:'Robel Assefa', senderOk:true, ref:'FT26284M1ZQA', amount:830, screenshot:true}},
  attempts:[{c:'c1',r:'accepted',at:205}]});
order({code:'AB-D1K8', lane:'action', status:'No courier found', reason:'no_courier', age:14, restaurantId:'r7', customer:cust('Gulele'), dist:2.9,
  items:[it('Tomoca Macchiato',3),it('Coffee Beans 250g')], pay:{method:'telebirr_online', state:'paid'},
  attempts:[{c:'c7',r:'declined',at:12,why:'Already carrying an order'},{c:'c8',r:'timeout',at:8}]});

// ---------- FINDING COURIER ----------
order({code:'AB-L6P4', lane:'finding', status:'Finding courier', age:6, restaurantId:'r4', customer:cust('Bole',0), dist:1.0,
  items:[it('Beyaynetu'),it('Mango-Avocado Juice')], owner:'me', pay:{method:'telebirr_online', state:'paid'},
  attempts:[{c:'c3',r:'declined',at:5,why:'Bicycle — hill route'},{c:'c2',r:'timeout',at:3},{c:'c7',r:'offered',at:1}]});
order({code:'AB-N3S7', lane:'finding', status:'Finding courier', age:11, restaurantId:'r1', customer:cust('Kirkos',1), dist:2.4,
  items:[it('Special Kitfo')], owner:'op2', pay:{method:'cbe_tx', state:'verified', ev:{sender:'Tsion Getachew', senderOk:true, ref:'FT26285A7HJD', amount:1050, screenshot:true}},
  attempts:[{c:'c8',r:'offered',at:2}]});
order({code:'AB-TS02', lane:'finding', status:'Finding courier', age:9, restaurantId:'r3', customer:cust('Bole'), dist:0.7, test:true,
  items:[it('Fresh Avocado Juice')], pay:{method:'telebirr_online', state:'paid'}});

// ---------- AT RESTAURANT / PICKED UP ----------
order({code:'AB-G7H2', lane:'transit', status:'At restaurant', age:19, restaurantId:'r1', customer:cust('Kolfe Keranio',1), dist:3.6,
  items:[it('Special Kitfo')], owner:'me', courierId:'c2', pay:{method:'cod', state:'cash_due'}, attempts:[{c:'c2',r:'accepted',at:16}]});
order({code:'AB-V4B6', lane:'transit', status:'Picked up', age:31, restaurantId:'r6', customer:cust('Bole',2), dist:1.8,
  items:[it('Beyaynetu'),it('Special Kitfo')], owner:'op3', courierId:'c3', pay:{method:'telebirr_online', state:'paid'}, attempts:[{c:'c3',r:'accepted',at:25}]});
order({code:'AB-Q8U1', lane:'transit', status:'Picked up', age:24, restaurantId:'r2', customer:cust('Nifas Silk-Lafto',2), dist:1.5,
  items:[it('Tibs (Beef)'),it('Shiro Tegabino')], owner:'me', courierId:'c6', pay:{method:'cod', state:'cash_due'}, attempts:[{c:'c6',r:'accepted',at:20}]});
order({code:'AB-E5T9', lane:'transit', status:'At restaurant', age:15, restaurantId:'r7', customer:cust('Arada',1), dist:0.8,
  items:[it('Tomoca Macchiato',4)], owner:'op2', courierId:'c7', pay:{method:'cbe_tx', state:'verified', ev:{sender:'Ruth Kassa', senderOk:true, ref:'FT26285C2WRT', amount:460, screenshot:true}}, attempts:[{c:'c7',r:'accepted',at:11}]});

// ---------- DELIVERED ----------
order({code:'AB-A3F7', lane:'delivered', status:'Delivered', age:130, deliveredAgo:92, restaurantId:'r5', customer:cust('Bole',1), dist:1.2,
  items:[it('Tibs (Beef)'),it('Mango-Avocado Juice'),it('Firfir')], owner:'me', courierId:'c8', pay:{method:'cod', state:'collected'}, attempts:[{c:'c8',r:'accepted',at:124}]});
order({code:'AB-U2W8', lane:'delivered', status:'Delivered', age:190, deliveredAgo:151, restaurantId:'r4', customer:cust('Bole',3), dist:0.9,
  items:[it('Special Kitfo')], owner:'op2', courierId:'c1', pay:{method:'telebirr_online', state:'paid'}, attempts:[{c:'c1',r:'accepted',at:184}]});
order({code:'AB-Y6D4', lane:'delivered', status:'Delivered', age:260, deliveredAgo:221, restaurantId:'r3', customer:cust('Kirkos'), dist:2.0,
  items:[it('Mango-Avocado Juice',3)], owner:'me', courierId:'c6', pay:{method:'cod', state:'settled'}, attempts:[{c:'c6',r:'accepted',at:254}]});
order({code:'AB-TS03', lane:'delivered', status:'Delivered', age:300, deliveredAgo:270, restaurantId:'r5', customer:cust('Bole'), dist:0.6, test:true,
  items:[it('Firfir')], courierId:'c7', pay:{method:'telebirr_online', state:'paid'}});

// ---------- CLOSED / REFUNDED ----------
order({code:'AB-B9K5', lane:'closed', status:'Refunded', age:310, restaurantId:'r7', customer:cust('Arada'), dist:1.9,
  items:[it('Coffee Beans 250g',2)], owner:'op3', pay:{method:'telebirr_online', state:'refunded'}, closeNote:'Restaurant closed early — full refund 1,400 ETB'});
order({code:'AB-J1N4', lane:'closed', status:'Cancelled', age:420, restaurantId:'r2', customer:cust('Lideta',1), dist:2.3,
  items:[it('Beyaynetu')], owner:'me', pay:{method:'cod', state:'void'}, closeNote:'Customer cancelled before pickup'});

// ---------- Messages ----------
const T = (who, text, min, extra={}) => ({who, text, at: ago(min), read: true, ...extra});
const byCode = c => O.find(o=>o.code===c);
byCode('AB-K7M2').threads.customer = [
  T('sys','Order placed · Telebirr transfer selected',23),
  T('out','Selam! Please send 1,010 ETB to Telebirr 0911 000 777 (Addis Bites) and reply with the transaction ID.',22,{by:'me',status:'read'}),
  T('in','Ok I sent it. Here is the screenshot',14,{attach:true}),
  T('out','Thank you! The screenshot does not show the transaction ID. Could you send the 10-character ID from the Telebirr SMS?',11,{by:'me',status:'read'}),
  T('in','one minute pls, looking for the sms',3,{read:false}),
];
byCode('AB-C2L7').threads.customer = [
  T('out','Your courier Hana is at the gate. Please come down or call her.',18,{by:'me',status:'delivered'}),
  T('out','We have tried calling 3 times. Please reply so we can deliver your food.',9,{by:'me',status:'delivered'}),
];
byCode('AB-C2L7').threads.courier = [
  T('in','I am at the gate. Customer is not answering. Guard says Woreda 03 not 01.',21),
  T('out','Please wait 5 more minutes, we are calling.',19,{by:'me',status:'read'}),
  T('in','Waiting. Battery 12%.',6,{read:false}),
];
byCode('AB-M8C3').threads.courier = [
  T('out','Yonas, are you on the way to Yod Abyssinia?',40,{by:'me',status:'delivered'}),
  T('out','Please confirm in 2 minutes or we will reassign.',33,{by:'me',status:'delivered'}),
];
byCode('AB-M8C3').threads.restaurant = [
  T('in','Food is ready since 00:25. Nobody came. Is someone coming?',29,{read:false}),
];
byCode('AB-M8C3').threads.customer = [
  T('in','Where is my food?? It says 25 minutes',8,{read:false}),
];
byCode('AB-F9J3').threads.customer = [
  T('in','The app says delivered but I never got anything. I was home the whole time.',96),
  T('out','I am very sorry. We are checking with the courier now.',93,{by:'me',status:'read'}),
  T('in','It has been an hour. I want my money back.',41,{read:false}),
];
byCode('AB-F9J3').threads.courier = [
  T('out','Abebe, customer says not received. Where did you hand over AB-F9J3?',92,{by:'me',status:'read'}),
  T('in','Gave to guard at the gate, he said he will take it up.',88),
];
byCode('AB-Z5E4').threads.restaurant = [
  T('in','Tibs is finished for tonight. Also juice price is now 200 not 180.',24,{read:false}),
];
byCode('AB-R6V9').threads.customer = [
  T('in','I sent 1400 because that is what my friend said it costs',20),
  T('out','The order total is 1,500 ETB. Please send the remaining 100 ETB to complete.',17,{by:'op3',status:'read'}),
];
byCode('AB-G7H2').threads.courier = [
  T('in','At Kategna. They say 5 more minutes.',4),
];
byCode('AB-2B9B').threads.customer = [
  T('in','Please no onions on the fitfit 🙏',3,{read:false}),
];
byCode('AB-Q8U1').threads.customer = [
  T('out','Your food is on the way with Meron. ETA 01:15.',6,{by:'me',status:'read'}),
  T('in','Thank you!',5),
];
byCode('AB-P3X8').threads.customer = [
  T('in','I paid with CBE, screenshot attached',11,{attach:true}),
];

// ---------- Timeline events ----------
const ownerName = id => (OPERATORS.find(o=>o.id===id)||{}).short;
O.forEach(o=>{
  const ev = [];
  ev.push({at:o.placedAt, actor:'Customer', kind:'event', text:`Placed order · ${o.items.length} item${o.items.length>1?'s':''} · ${o.total.toLocaleString('en-US')} ETB`});
  if (o.owner) ev.push({at:o.placedAt + Math.min(2, o.age*.1)*M, actor:`${ownerName(o.owner)} (Dispatcher)`, kind:'event', text:'Claimed order'});
  if (o.claimExpired) ev.push({at:o.placedAt + 15*M, actor:'System', kind:'warn', text:'Claim expired after 15 min without action'});
  if (o.pay.state==='verified') ev.push({at:o.placedAt + 3*M, actor:`${ownerName(o.owner)||'Abebe'} (Dispatcher)`, kind:'money', text:`Verified ${o.pay.method==='cbe_tx'?'CBE':'Telebirr'} transfer ${o.pay.ev.ref} · ${o.pay.ev.amount.toLocaleString('en-US')} ETB`});
  if (o.pay.method==='cod' && ['finding','transit','delivered','action'].includes(o.lane) && o.lane!=='new')
    ev.push({at:o.placedAt + 3*M, actor:`${ownerName(o.owner)||'Abebe'} (Dispatcher)`, kind:'event', text:'Approved COD'});
  if (o.hold) ev.push({at:o.placedAt + 3*M, actor:'System', kind:'money', text:`Hold reserved ${o.hold.toLocaleString('en-US')} ETB from operator float (restaurant guarantee)`});
  o.attempts.forEach(a=>{
    const c = COURIERS.find(x=>x.id===a.c);
    ev.push({at:BASE - a.at*M, actor:'Dispatch', kind: a.r==='accepted'?'event':(a.r==='offered'?'info':'warn'),
      text: a.r==='accepted'?`${c.name} accepted`: a.r==='offered'?`Offered to ${c.name} · waiting 60s`: a.r==='declined'?`${c.name} declined${a.why?' — '+a.why:''}`:`${c.name} did not respond (timed out 60s)`});
  });
  if (o.reason==='no_courier' && o.age>1000) ev.push({at:o.placedAt + 13*M, actor:'System', kind:'bad', text:'No courier accepted within 10 minutes · dispatch stopped'});
  if (o.reason==='courier_noshow') ev.push({at:BASE - 22*M, actor:'System', kind:'bad', text:'Courier no-show: not at restaurant 15 min after ETA'});
  if (o.reason==='unreachable') ev.push({at:BASE - 21*M, actor:'Hana Tesfaye (Courier)', kind:'bad', text:'Marked customer unreachable at drop-off'});
  if (o.reason==='restaurant_rejected') ev.push({at:BASE - 24*M, actor:'The Chill Spot (Restaurant)', kind:'bad', text:'Rejected order — "Tibs (Beef)" out of stock; price change on juice'});
  if (o.reason==='not_delivered') ev.push({at:BASE - 104*M, actor:'Abebe Girma (Courier)', kind:'event', text:'Marked delivered (handed to guard)'},{at:BASE - 96*M, actor:'Customer', kind:'bad', text:'Reported food not received'});
  if (o.pay.state==='mismatch') ev.push({at:BASE - 22*M, actor:'Bethlehem (Dispatcher)', kind:'bad', text:'Amount mismatch: received 1,400 ETB, expected 1,500 ETB'});
  if (o.lane==='transit' && o.status==='Picked up') ev.push({at:BASE - (o.age-14)*M, actor:'Courier', kind:'event', text:'Picked up from restaurant · cash paid to restaurant'});
  if (o.lane==='delivered') ev.push({at:BASE - o.deliveredAgo*M, actor:'Courier', kind:'good', text: o.pay.method==='cod'?`Delivered · collected ${o.total.toLocaleString('en-US')} ETB cash`:'Delivered'});
  if (o.pay.state==='settled') ev.push({at:BASE - (o.deliveredAgo-40)*M, actor:'Kaleb (Finance)', kind:'money', text:`COD settled ${o.total.toLocaleString('en-US')} ETB from courier`});
  if (o.lane==='closed') ev.push({at:BASE - (o.age-25)*M, actor:`${ownerName(o.owner)} (Dispatcher)`, kind: o.status==='Refunded'?'money':'event', text:o.closeNote});
  o.events = ev.sort((a,b)=>a.at-b.at);
});

// ---------- Money ----------
const FLOAT = { wallet: 5000 };
const CUSTODY = [
  {courierId:'c1', code:'AB-5RT2', amount:1240, at:ago(380)},{courierId:'c1', code:'AB-8KP0', amount:880, at:ago(290)},{courierId:'c1', code:'AB-3MD6', amount:520, at:ago(212)},
  {courierId:'c3', code:'AB-6WQ3', amount:480, at:ago(170)},
  {courierId:'c4', code:'AB-2HF9', amount:1010, at:ago(240)},
  {courierId:'c5', code:'AB-9LC1', amount:350, at:ago(700)},
  {courierId:'c6', code:'AB-4NB8', amount:740, at:ago(150)},
  {courierId:'c8', code:'AB-A3F7', amount:1150, at:ago(92)},
];
const PAYOUTS = [
  {id:'po_1042', type:'restaurant', name:'Yod Abyssinia', amount:5880, status:'scheduled', at:Date.UTC(2026,9,12,9,0), period:'Sun 11 Oct'},
  {id:'po_1041', type:'restaurant', name:'Kategna', amount:4320, status:'scheduled', at:Date.UTC(2026,9,12,9,0), period:'Sun 11 Oct'},
  {id:'po_1040', type:'restaurant', name:'Konark Hotel', amount:3150, status:'scheduled', at:Date.UTC(2026,9,12,9,0), period:'Sun 11 Oct'},
  {id:'po_1039', type:'restaurant', name:'Delmela', amount:2790, status:'scheduled', at:Date.UTC(2026,9,12,9,0), period:'Sun 11 Oct'},
  {id:'po_1038', type:'restaurant', name:'Sarem Juice', amount:1980, status:'scheduled', at:Date.UTC(2026,9,12,9,0), period:'Sun 11 Oct'},
  {id:'po_1037', type:'restaurant', name:'The Chill Spot', amount:1640, status:'on_hold', at:Date.UTC(2026,9,12,9,0), period:'Sun 11 Oct', note:'Rejection rate above 10% — review'},
  {id:'po_1036', type:'restaurant', name:'Tomoca Coffee', amount:910, status:'scheduled', at:Date.UTC(2026,9,12,9,0), period:'Sun 11 Oct'},
  {id:'po_2210', type:'courier', name:'Tigist Haile', amount:1260, status:'scheduled', at:Date.UTC(2026,9,12,12,0), period:'Week 41'},
  {id:'po_2209', type:'courier', name:'Meron Girma', amount:1440, status:'scheduled', at:Date.UTC(2026,9,12,12,0), period:'Week 41'},
  {id:'po_2208', type:'courier', name:'Abebe Girma', amount:1620, status:'on_hold', at:Date.UTC(2026,9,12,12,0), period:'Week 41', note:'Cash custody above limit'},
  {id:'po_2207', type:'courier', name:'Selam Wondimu', amount:1080, status:'scheduled', at:Date.UTC(2026,9,12,12,0), period:'Week 41'},
  {id:'po_2206', type:'courier', name:'Hana Tesfaye', amount:1130, status:'scheduled', at:Date.UTC(2026,9,12,12,0), period:'Week 41'},
  {id:'po_1035', type:'restaurant', name:'Yod Abyssinia', amount:6210, status:'paid', at:Date.UTC(2026,9,11,9,2), period:'Sat 10 Oct'},
  {id:'po_1034', type:'restaurant', name:'Kategna', amount:3980, status:'paid', at:Date.UTC(2026,9,11,9,2), period:'Sat 10 Oct'},
  {id:'po_2205', type:'courier', name:'Dawit Mengistu', amount:740, status:'failed', at:Date.UTC(2026,9,11,12,0), period:'Week 40', note:'Telebirr account name mismatch'},
  {id:'po_2204', type:'courier', name:'Samuel Bekele', amount:920, status:'paid', at:Date.UTC(2026,9,11,12,1), period:'Week 40'},
];
const LEDGER = [
  {at:Date.UTC(2026,9,11,18,0), type:'topup', desc:'Float top-up from Addis Bites treasury', amount:+5000, ref:'TRF-77102', by:'Kaleb (Finance)'},
  {at:ago(6597), type:'hold', desc:'Hold reserved · AB-7Q4D restaurant guarantee', amount:-550, ref:'AB-7Q4D', by:'System', isPast:true},
  {at:ago(380), type:'cod_in', desc:'COD collected by Abebe Girma · AB-5RT2', amount:1240, ref:'AB-5RT2', by:'Courier', custody:true},
  {at:ago(290), type:'cod_in', desc:'COD collected by Abebe Girma · AB-8KP0', amount:880, ref:'AB-8KP0', by:'Courier', custody:true},
  {at:ago(260), type:'cod_settle', desc:'COD settled by Meron Girma · AB-Y6D4', amount:640, ref:'AB-Y6D4', by:'Kaleb (Finance)'},
  {at:ago(240), type:'cod_in', desc:'COD collected by Hana Tesfaye · AB-2HF9', amount:1010, ref:'AB-2HF9', by:'Courier', custody:true},
  {at:ago(212), type:'cod_in', desc:'COD collected by Abebe Girma · AB-3MD6', amount:520, ref:'AB-3MD6', by:'Courier', custody:true},
  {at:ago(250), type:'refund', desc:'Refund to customer · AB-B9K5 (Telebirr)', amount:-1400, ref:'AB-B9K5', by:'Bethlehem (Dispatcher)', ext:true},
  {at:ago(170), type:'cod_in', desc:'COD collected by Dawit Mengistu · AB-6WQ3', amount:480, ref:'AB-6WQ3', by:'Courier', custody:true},
  {at:ago(150), type:'cod_in', desc:'COD collected by Meron Girma · AB-4NB8', amount:740, ref:'AB-4NB8', by:'Courier', custody:true},
  {at:ago(130), type:'hold', desc:'Hold reserved · AB-A3F7', amount:-1210, ref:'AB-A3F7', by:'System'},
  {at:ago(112), type:'release', desc:'Hold released at pickup · AB-A3F7', amount:+1210, ref:'AB-A3F7', by:'System'},
  {at:ago(92), type:'cod_in', desc:'COD collected by Selam Wondimu · AB-A3F7', amount:1150, ref:'AB-A3F7', by:'Courier', custody:true},
  {at:ago(19), type:'hold', desc:'Hold reserved · AB-G7H2', amount:-950, ref:'AB-G7H2', by:'System'},
  {at:ago(17), type:'release', desc:'Hold released · courier Tigist paid restaurant at counter', amount:+950, ref:'AB-G7H2', by:'System'},
  {at:ago(24), type:'hold', desc:'Hold reserved · AB-Q8U1', amount:-1160, ref:'AB-Q8U1', by:'System'},
  {at:ago(10), type:'release', desc:'Hold released at pickup · AB-Q8U1', amount:+1160, ref:'AB-Q8U1', by:'System'},
].sort((a,b)=>b.at-a.at);

// ---------- Audit ----------
const AUDIT = [
  {at:ago(2), actor:'System', action:'order.created', entity:'AB-H4N6', before:'—', after:'Awaiting approval', ip:'—', device:'—'},
  {at:ago(5), actor:'Liya Mekonnen', action:'dispatch.offer', entity:'AB-L6P4', before:'Tigist Haile (timed out)', after:'Samuel Bekele', ip:'10.20.4.18', device:'Chrome · Windows'},
  {at:ago(9), actor:'Liya Mekonnen', action:'message.sent', entity:'AB-C2L7', before:'—', after:'Customer · "We have tried calling 3 times…"', ip:'10.20.4.18', device:'Chrome · Windows'},
  {at:ago(17), actor:'Bethlehem Asfaw', action:'message.sent', entity:'AB-R6V9', before:'—', after:'Customer · "remaining 100 ETB"', ip:'10.20.4.22', device:'Firefox · Ubuntu'},
  {at:ago(19), actor:'Liya Mekonnen', action:'phone.reveal', entity:'AB-C2L7 · customer', before:'masked', after:'revealed', ip:'10.20.4.18', device:'Chrome · Windows'},
  {at:ago(22), actor:'Bethlehem Asfaw', action:'payment.flag_mismatch', entity:'AB-R6V9', before:'Submitted', after:'Mismatch (1,400 / 1,500 ETB)', ip:'10.20.4.22', device:'Firefox · Ubuntu'},
  {at:ago(23), actor:'Liya Mekonnen', action:'order.claim', entity:'AB-K7M2', before:'Unclaimed', after:'Liya Mekonnen', ip:'10.20.4.18', device:'Chrome · Windows'},
  {at:ago(44), actor:'Liya Mekonnen', action:'courier.assign_manual', entity:'AB-M8C3', before:'—', after:'Yonas Alemu', ip:'10.20.4.18', device:'Chrome · Windows'},
  {at:ago(63), actor:'Abebe Tadesse', action:'order.claim_expired', entity:'AB-W2R5', before:'Abebe Tadesse', after:'Unclaimed', ip:'—', device:'System'},
  {at:ago(112), actor:'System', action:'hold.release', entity:'AB-A3F7', before:'1,210 ETB held', after:'0 ETB', ip:'—', device:'—'},
  {at:ago(250), actor:'Bethlehem Asfaw', action:'order.refund', entity:'AB-B9K5', before:'Paid 1,400 ETB', after:'Refunded 1,400 ETB', ip:'10.20.4.22', device:'Firefox · Ubuntu'},
  {at:ago(260), actor:'Kaleb Worku', action:'cod.settle', entity:'Meron Girma', before:'640 ETB custody', after:'0 ETB', ip:'10.20.5.3', device:'Safari · macOS'},
  {at:ago(400), actor:'Ruth Alemayehu', action:'restaurant.close', entity:'Tomoca Coffee', before:'Open', after:'Closed', ip:'10.20.5.9', device:'Chrome · macOS'},
  {at:ago(420), actor:'Liya Mekonnen', action:'order.cancel', entity:'AB-J1N4', before:'Awaiting approval', after:'Cancelled · customer request', ip:'10.20.4.18', device:'Chrome · Windows'},
  {at:Date.UTC(2026,9,11,18,0), actor:'Kaleb Worku', action:'float.topup', entity:'Operator float', before:'0 ETB', after:'5,000 ETB', ip:'10.20.5.3', device:'Safari · macOS'},
  {at:ago(192), actor:'Liya Mekonnen', action:'session.sign_in', entity:'Liya Mekonnen', before:'—', after:'Shift started', ip:'10.20.4.18', device:'Chrome · Windows'},
  {at:ago(6597), actor:'System', action:'hold.reserve', entity:'AB-7Q4D', before:'0 ETB', after:'550 ETB held', ip:'—', device:'—'},
];

const NOTIFS = [
  {id:'n1', kind:'new', title:'New order AB-H4N6', body:'Konark Hotel → Bole · 1,230 ETB · Telebirr online', at:ago(2), unread:true, code:'AB-H4N6'},
  {id:'n2', kind:'msg', title:'Customer message · AB-K7M2', body:'"one minute pls, looking for the sms"', at:ago(3), unread:true, code:'AB-K7M2'},
  {id:'n3', kind:'msg', title:'Courier message · AB-C2L7', body:'Hana: "Waiting. Battery 12%."', at:ago(6), unread:true, code:'AB-C2L7'},
  {id:'n4', kind:'pay', title:'Payment submitted · AB-P3X8', body:'CBE transfer 1,470 ETB · ref FT26285Q8LKX', at:ago(11), unread:false, code:'AB-P3X8'},
  {id:'n5', kind:'noshow', title:'Courier no-show · AB-M8C3', body:'Yonas Alemu not at Yod Abyssinia 15 min after ETA', at:ago(22), unread:false, code:'AB-M8C3'},
  {id:'n6', kind:'hold', title:'Stale hold · AB-7Q4D', body:'550 ETB held for 110h on an order with no courier', at:ago(30), unread:false, code:'AB-7Q4D'},
];

const QUICK = [
  {id:'q1', en:'Hi! Your order is confirmed and we are finding a courier now.', am:'ሰላም! ትዕዛዝዎ ተረጋግጧል፤ አሁን ተላላኪ እየፈለግን ነው።', to:'customer'},
  {id:'q2', en:'Please send the 10-character transaction ID from your Telebirr SMS so we can verify your payment.', am:'ክፍያዎን ለማረጋገጥ እባክዎ ከቴሌብር መልእክት ያለውን ባለ 10 ፊደል የግብይት መለያ ይላኩ።', to:'customer'},
  {id:'q3', en:'Your courier is at the gate. Please come down or call them.', am:'ተላላኪዎ በበሩ ላይ ነው። እባክዎ ይውረዱ ወይም ይደውሉላቸው።', to:'customer'},
  {id:'q4', en:'Sorry for the delay — your food is on the way.', am:'ስለዘገየን ይቅርታ — ምግብዎ በመንገድ ላይ ነው።', to:'customer'},
  {id:'q5', en:'Please confirm you are on the way to the restaurant.', am:'እባክዎ ወደ ምግብ ቤቱ እየሄዱ መሆኑን ያረጋግጡ።', to:'courier'},
  {id:'q6', en:'Wait 5 more minutes at the drop-off, we are calling the customer.', am:'እባክዎ 5 ደቂቃ ተጨማሪ ይጠብቁ፤ ደንበኛውን እየደወልን ነው።', to:'courier'},
  {id:'q7', en:'Is the order ready? The courier will arrive in about 5 minutes.', am:'ትዕዛዙ ዝግጁ ነው? ተላላኪው በ5 ደቂቃ ውስጥ ይደርሳል።', to:'restaurant'},
  {id:'q8', en:'Please mark the item as out of stock in your tablet so new orders skip it.', am:'አዳዲስ ትዕዛዞች እንዳይቀበሉት እባክዎ ዕቃውን "አልቋል" ብለው ያመልክቱ።', to:'restaurant'},
];

// pool of incoming orders for live simulation
const INCOMING = [
  {code:'AB-8VX3', restaurantId:'r3', sub:'Bole', items:[['Mango-Avocado Juice',2],['Beyaynetu',1]], pay:{method:'cod', state:'cash_due'}, dist:1.1, cname:'Yonatan Fisseha', last3:'312'},
  {code:'AB-5JC7', restaurantId:'r6', sub:'Kirkos', items:[['Special Kitfo',1]], pay:{method:'telebirr_tx', state:'submitted', ev:{sender:'Sosina Abate', senderOk:true, ref:'CJ85LQ09XT', amount:1050, screenshot:true}}, dist:2.7, cname:'Sosina Abate', last3:'588'},
  {code:'AB-3RP9', restaurantId:'r1', sub:'Lideta', items:[['Shiro Tegabino',2]], pay:{method:'telebirr_online', state:'paid'}, dist:2.0, cname:'Kirubel Tsegaye', last3:'744'},
];

window.AB = { BASE, M, SUBCITIES, OPERATORS, RESTAURANTS, MENU, RMENU, OUT_OF_STOCK, COURIERS, ORDERS:O, FLOAT, CUSTODY, PAYOUTS, LEDGER, AUDIT, NOTIFS, QUICK, INCOMING };
})();

// ESM bridge: the app modules read window.AB for mock data.
const AB = window.AB;
export default AB;
export { AB };
