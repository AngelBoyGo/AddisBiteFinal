// Addis Bites — seed data for the shared store (runs once, when localStorage has no ab_store_v2).
// Mock people match the existing apps: customer Meklit Haile, courier Dawit Bekele, dispatchers
// Liya / Abebe / Tigist, finance Kaleb, admin Ruth, 8 couriers + Dawit, one pending application.
window.ABSeed = function(API, h){
  // `staffHash` is used below for operator credentials. It was missing from this destructure, so the
  // seed threw "staffHash is not defined" and aborted at the first operator — which left the shared
  // store empty in every app while each app's own local mock data kept it looking healthy.
  const {ins, post, uid, iso, now, ensureConv, staffHash} = h;
  const T = now(); const min = m => iso(T - m*60000);
  const user = (name, phone, roles, extra={}) => { const u = ins('users', {id: uid('usr'), phone, phone_verified_at: min(90000), name, preferred_language: extra.lang||'en', status: extra.status||'active', is_test: !!extra.test, last_login_at: min(5)});
    roles.forEach(r=>ins('user_roles', {user_id:u.id, role:r, granted_by: r==='customer'||r==='courier'?'self':'usr_admin', granted_at: min(90000)})); return u; };

  // ---------- operators (invite-only) ----------
  const ops = {};
  // Staff sign in with a USERNAME + PASSWORD (no OTP). Placeholder passwords must be changed on first
  // sign-in — `must_change_password` forces it, and the audit log records the change.
  [['Yordanos Kelali','+251911100001','admin','yordanos','ChangeMe-YK-2026!',true],
   ['Ishmael Avery','+251911100002','admin','ishmael','ChangeMe-IA-2026!',true],
   ['Abebe Tadesse','+251911100202','dispatcher','dispatcher1','ChangeMe-D1-2026!',true],
   ['Tigist Alemu','+251911100303','dispatcher','dispatcher2','ChangeMe-D2-2026!',true],
   ['Kaleb Worku','+251911100404','finance','kaleb','ChangeMe-KW-2026!',true],
   ['Liya Mekonnen','+251911100101','dispatcher','liya','ChangeMe-LM-2026!',false],
   ['Ruth Alemayehu','+251911100505','dispatcher','ruth','ChangeMe-RA-2026!',true]]
    .forEach(([n,p,r,un,pw,force])=>{ const u = user(n,p,[r]);
      ins('operator_profiles', {id: uid('opr'), user_id:u.id, display_name:n.split(' ')[0], role:r, username:un,
        password_hash: staffHash(pw), password_forced: !!force, must_change_password: !!force,
        failed_attempts: 0, locked_until: null, last_login_at: null, shift_started_at: min(192)});
      ops[n.split(' ')[0]] = u; });

  // ---------- customers ----------
  const custs = {};
  const mkCust = (name, phone, addr, extra={}) => { const u = user(name, phone, ['customer'], extra);
    const cp = ins('customer_profiles', {id: uid('cus'), user_id:u.id, email:null, default_address_id:null, referral_code:name.split(' ')[0].toUpperCase()+'50', referred_by:null});
    const a = ins('addresses', {id: uid('adr'), customer_id:cp.id, label:'Home', lat:addr.lat, lng:addr.lng, sub_city:addr.sub, neighborhood:addr.nb, landmark:addr.lm, building:addr.b||null, floor:null, gate_notes:addr.g||null, gate_photo_url:null, is_default:true});
    cp.default_address_id = a.id; custs[name.split(' ')[0]] = {u, cp, a}; return custs[name.split(' ')[0]]; };
  mkCust('Meklit Haile', '+251912330214', {lat:8.9958, lng:38.7872, sub:'Bole', nb:'Atlas', lm:'Near Edna Mall', b:'Blue gate, 2nd floor, apt 4', g:'Call when outside'});
  ins('addresses', {id: uid('adr'), customer_id:custs.Meklit.cp.id, label:'Work', lat:8.9946, lng:38.7469, sub_city:'Nifas Silk-Lafto', neighborhood:'Sarbet', landmark:'Opposite Sarbet Total station', building:'Wegagen building, 5th floor', floor:'5', gate_notes:null, gate_photo_url:null, is_default:false});
  [['Henok Tadesse','+251911224224','Kirkos','Kazanchis','Behind Intercontinental'],['Selamawit Bekele','+251911101101','Kirkos','Kazanchis','Green gate next to the pharmacy'],['Yared Alemu','+251911452452','Yeka','Megenagna','Behind Zefmesh mall'],
   ['Bezawit Haile','+251911507507','Bole','Bole Medhanialem','Behind Bole Medhanialem church'],['Abel Negash','+251911349349','Lideta','Mexico','Mexico square, Wabi Shebelle building'],['Rediet Amare','+251911137137','Arada','Piassa','Near Taitu Hotel'],
   ['Kidus Worku','+251911127127','Nifas Silk-Lafto','Sarbet','Canada embassy road'],['Test Account QA','+251900000000','Bole','Atlas','Addis Bites office (test)']]
    .forEach(([n,p,s,nb,lm],i)=>mkCust(n,p,{lat:9.0, lng:38.76, sub:s, nb, lm}, {test: n.startsWith('Test')}));

  // ---------- couriers ----------
  const cours = {};
  const mkCour = (name, phone, vehicle, plate, status, online, extra={}) => { const u = user(name, phone, ['courier']);
    const cp = ins('courier_profiles', {id: uid('cou'), user_id:u.id, courier_code: extra.code || 'CR-'+String(410+Object.keys(cours).length).padStart(4,'0'), vehicle_type:vehicle, plate_number:plate, telebirr_payout_number:phone,
      onboarding_status:status, rejection_reason:null, approved_by: status==='approved'?ops.Ruth.id:null, approved_at: status==='approved'?min(60000):null, cash_limit_etb:3000, rating_avg: extra.rating||null, rating_count: extra.rc||0,
      acceptance_rate: extra.acc||null, on_time_rate: extra.ot||null, preferred_sub_cities: extra.zones||[], max_offer_distance_km:6, online_status:online, last_location: online!=='offline' ? {lat:8.996, lng:38.786, at: min(1)} : null});
    const docTypes = vehicle==='motorbike' ? ['photo','national_id','driving_license','vehicle_registration'] : ['photo','national_id'];
    docTypes.forEach(t=>ins('courier_documents', {id: uid('doc'), courier_id:cp.id, type:t, file_url:'upload://seed', expires_on: t==='driving_license' ? (extra.licExpDays!=null ? iso(T+extra.licExpDays*86400000) : iso(T+400*86400000)) : null,
      status: status==='approved' ? 'approved' : 'pending', reviewed_by: status==='approved'?ops.Ruth.id:null, review_note:null}));
    cours[name.split(' ')[0]] = {u, cp}; return cours[name.split(' ')[0]]; };
  mkCour('Dawit Bekele', '+251912448345', 'motorbike', 'AA 3-B12345', 'approved', 'online', {code:'CR-0417', rating:4.8, rc:212, acc:86, ot:93, zones:['Bole','Kirkos','Nifas Silk-Lafto'], licExpDays:5});
  [['Abebe Girma','+251912412412','motorbike','AA 3-B48120','busy',4.8],['Tigist Haile','+251912523523','motorbike','AA 2-A11873','busy',4.9],['Dawit Mengistu','+251912634634','bicycle',null,'busy',4.6],
   ['Hana Tesfaye','+251912745745','motorbike','AA 3-C90214','busy',4.7],['Yonas Alemu','+251912856856','motorbike','AA 2-B33567','offline',4.1],['Meron Girma','+251912967967','motorbike','AA 3-A72045','busy',4.9],
   ['Samuel Bekele','+251912178178','motorbike','AA 2-C50981','online',4.5],['Selam Wondimu','+251912289289','motorbike','AA 3-B66310','online',4.8]]
    .forEach(([n,p,v,pl,on,r])=>mkCour(n,p,v,pl,'approved',on,{rating:r, rc:80+Math.floor(r*20), acc:85, ot:90}));
  // one pending application (spec 10)
  const app = mkCour('Mulugeta Assefa', '+251913555777', 'motorbike', 'AA 3-C40871', 'submitted', 'offline');
  // Driver onboarding is an ADMIN queue now — dispatch no longer handles approvals.
  ensureConv(null, 'courier_application', [{user_id:app.u.id, role:'courier'}, {queue:'admin', role:'admin'}]).courier_id = app.cp.id;

  // ---------- restaurant ops (7 shared venues; real ids from the data package) ----------
  const R = [['r_000201','Kategna',18,true],['r_000202','Delmela',22,true],['r_000203','Sarem Juice',9,true],['r_000204','Konark Hotel',26,true],['r_000205','The Chill Spot',15,false],['r_000206','Yod Abyssinia',31,true],['r_000207','Tomoca Coffee',7,true]];
  R.forEach(([id,name,prep,partner])=>ins('restaurant_ops', {restaurant_id:id, name, accepting_orders:true, busy_until:null, avg_prep_minutes:prep, is_partner:partner, contact_relay_number:'+251 11 667 0'+id.slice(-3)}));

  // ---------- quick replies (en + am) ----------
  [['cus_on_way','customer',"I'm at the gate",'በሩ ላይ ነኝ'],['cus_call','customer','Please call me','እባክዎ ይደውሉልኝ'],['cus_down','customer',"I'm coming down",'እየወረድኩ ነው'],['cus_guard','customer','Leave it with the guard','ለጥበቃው ይስጡት'],
   ['cou_way','courier',"I'm on my way",'በመንገድ ላይ ነኝ'],['cou_outside','courier',"I'm outside",'ውጭ ደርሻለሁ'],['cou_landmark','courier',"I can't find the address, please share a landmark",'አድራሻውን ማግኘት አልቻልኩም'],
   ['dis_ok','dispatch','OK, we are on it','እሺ፣ እየተከታተልን ነው'],['dis_wait','dispatch','Please wait 5 more minutes','እባክዎ 5 ደቂቃ ይጠብቁ']]
    .forEach(([key,audience,en,am],i)=>ins('quick_reply_templates', {key, audience, text_en:en, text_am:am, sort:i}));

  // ---------- money: operator float opening balance ----------
  post([['operator_float', 5000, 0], ['treasury', 0, 5000]], {ref_type:'topup', memo:'Float top-up from Addis Bites treasury'});

  // ---------- ~25 orders across every status ----------
  const fee = km => window.ABBus.feeFor(km); const items = {
    fitfit:['Tomato Fitfit','ቲማቲም ፍትፍት',550], kitfo:['Special Kitfo','ልዩ ክትፎ',950], shiro:['Shiro Tegabino','ሽሮ ተጋቢኖ',380], beyay:['Beyaynetu','በያይነቱ',420],
    mango:['Mango-Avocado Juice',null,180], macch:['Tomoca Macchiato',null,90], tibs:['Tibs (Beef)','ጥብስ',780] };
  let n = 0;
  const order = ({c='Meklit', r='r_000201', lines, pay='cod', status, km=2.4, ageMin=20, courier=null, payWith=null, test=false, code, claimedBy=null, payStatus, evidence}) => {
    const cu = custs[c]; const restName = R.find(x=>x[0]===r)[1];
    const its = lines.map(([k,q,opt])=>{ const [nm,am,p] = items[k]; return {name_snapshot:nm + (opt?` (${opt})`:''), name_am_snapshot:am, unit_price_etb:p, quantity:q, options_snapshot: opt?[{name:opt, price_delta_etb:0}]:[], line_total_etb:p*q}; });
    const sub = its.reduce((s,i)=>s+i.line_total_etb,0); const f = fee(km); const total = sub + f + 20;
    const autoCode = 'AB-'+['2B9B','K7M2','P3X8','9FQ1','H4N6','W2R5','7Q4D','X0B2','M8C3','R6V9','C2L7','Z5E4','F9J3','D1K8','L6P4','N3S7','G7H2','V4B6','Q8U1','E5T9','A3F7','U2W8','Y6D4','B9K5','J1N4','TS01','TS02','TS03'][n++]; const o = ins('orders', {id: uid('ord'), code: code || (autoCode==='AB-2B9B' ? 'AB-K7M2' : autoCode),
      customer_id:cu.cp.id, restaurant_id:r, restaurant_name_snapshot:restName, address_snapshot:{label:cu.a.label, sub_city:cu.a.sub_city, neighborhood:cu.a.neighborhood, landmark:cu.a.landmark, building:cu.a.building, lat:cu.a.lat, lng:cu.a.lng, notes:cu.a.gate_notes},
      delivery_instructions:cu.a.gate_notes||'', scheduled_for:null, status, claimed_by_operator_id: claimedBy ? ops[claimedBy].id : null, claim_expires_at: claimedBy ? iso(T+10*60000) : null, courier_id: courier ? cours[courier].cp.id : null,
      payment_method:pay, payment_status: payStatus || (pay==='cod' ? (status==='delivered'||status==='closed'?'collected':'cash_due') : pay==='telebirr_online' ? 'paid' : 'pending'), cod_pay_with_etb:payWith,
      subtotal_etb:sub, delivery_fee_etb:f, service_fee_etb:20, discount_etb:0, tip_etb:0, total_etb:total, km, delivery_code_hash:null, delivery_code_plain_for_customer: code==='AB-2B9B' ? '4827' : String(1000+((n*37)%9000)),
      cancel_reason: status==='cancelled' ? 'Customer requested' : null, is_test:test, placed_at:min(ageMin), delivered_at: ['delivered','closed'].includes(status)?min(ageMin-30):null, closed_at: status==='closed'?min(ageMin-40):null});
    o.created_at = min(ageMin);
    its.forEach(i=>ins('order_items', {id: uid('oit'), order_id:o.id, item_id:'i_seed', special_instructions:'', ...i}));
    ins('payments', {id: uid('pay'), order_id:o.id, method:pay, amount_etb:total, status: pay==='telebirr_online' ? 'verified' : evidence ? 'submitted' : (o.payment_status==='paid'?'verified':'pending'),
      reference: evidence?evidence.ref:null, sender_name: evidence?evidence.sender:null, evidence_url: evidence?'evidence://seed':null, submitted_amount_etb: evidence?evidence.amount:null, verified_by:null, rejection_reason:null, verified_at:null, is_test:test});
    if (evidence) ins('payment_evidence_checks', {payment_id: DB_last('payments').id, amount_matches: evidence.amount===total, reference_present:!!evidence.ref, sender_present:!!evidence.sender});
    // timeline: rebuild the path that would have led here
    const path = {placed:['placed'], awaiting_payment:['placed','awaiting_payment'], payment_rejected:['placed','awaiting_payment','payment_rejected'], confirmed:['placed','confirmed'],
      finding_courier:['placed','confirmed','finding_courier'], no_courier:['placed','confirmed','finding_courier','no_courier'], courier_assigned:['placed','confirmed','finding_courier','courier_assigned'],
      at_restaurant:['placed','confirmed','finding_courier','courier_assigned','at_restaurant'], picked_up:['placed','confirmed','finding_courier','courier_assigned','at_restaurant','picked_up'],
      at_customer:['placed','confirmed','finding_courier','courier_assigned','at_restaurant','picked_up','at_customer'], delivered:['placed','confirmed','finding_courier','courier_assigned','at_restaurant','picked_up','at_customer','delivered'],
      customer_no_show:['placed','confirmed','finding_courier','courier_assigned','at_restaurant','picked_up','at_customer','customer_no_show'], issue_reported:['placed','confirmed','finding_courier','courier_assigned','at_restaurant','issue_reported'],
      cancelled:['placed','cancelled'], returned:['placed','confirmed','finding_courier','courier_assigned','at_restaurant','picked_up','at_customer','customer_no_show','returned'], closed:['placed','confirmed','finding_courier','courier_assigned','at_restaurant','picked_up','at_customer','delivered','closed']}[status];
    path.forEach((s,i)=>ins('order_events', {id: uid('oev'), order_id:o.id, from_status: i?path[i-1]:null, to_status:s, actor_user_id:null, actor_role: i===0?'customer':s==='confirmed'?'dispatcher':['at_restaurant','picked_up','at_customer','delivered'].includes(s)?'courier':'system', reason:null, meta:{seed:true}, at: min(ageMin - i*Math.max(1, Math.floor(ageMin/Math.max(1,path.length))))}));
    ensureConv(o.id, 'customer_support', [{user_id:cu.u.id, role:'customer'}, {queue:'support', role:'support'}]);
    ensureConv(o.id, 'courier_dispatch', [{queue:'dispatch', role:'dispatcher'}]);
    if (courier) { const cp = cours[courier].cp; ins('courier_assignments', {id: uid('asg'), order_id:o.id, courier_id:cp.id, assigned_by:'system', assigned_at:min(ageMin-6), unassigned_at:null, reason:null});
      ensureConv(o.id, 'customer_courier', [{user_id:cu.u.id, role:'customer'}, {user_id:cp.user_id, role:'courier'}]); }
    // money that would have happened along the way
    const holdActive = pay==='cod' && ['finding_courier','no_courier','courier_assigned','at_restaurant'].includes(status);
    if (holdActive){ const hId = uid('hold'); ins('float_holds', {id:hId, order_id:o.id, amount_etb:sub, reason:'restaurant guarantee', status:'active', released_at:null, released_by:null, created_at: min(Math.max(ageMin-3,1)), flagged: ageMin>120});
      post([['float_reserved', sub, 0], ['operator_float', 0, sub]], {order_id:o.id, ref_type:'hold', ref_id:hId, memo:'Hold reserved', is_test:test}); }
    if (pay==='telebirr_online' || o.payment_status==='paid') post([['customer_payments_in', total, 0], ['order_receivable:'+o.id, 0, total]], {order_id:o.id, ref_type:'payment', memo:'Paid', is_test:test});
    if (['delivered','closed'].includes(status) && courier){ const cp = cours[courier].cp;
      if (pay==='cod'){ post([['courier_cash:'+cp.id, total, 0], ['order_receivable:'+o.id, 0, total]], {order_id:o.id, ref_type:'cod_collect', memo:'COD collected', is_test:test});
        ins('cod_collections', {id: uid('cod'), order_id:o.id, courier_id:cp.id, expected_etb:total, collected_etb:total, pay_with_etb:payWith, change_given_etb:payWith?payWith-total:0, mismatch_reason:null}); }
      const pay2 = window.ABBus.courierPayFor(km)||70; ins('earnings', {id: uid('ern'), courier_id:cp.id, order_id:o.id, type:'delivery', amount_etb:pay2, reason:'Delivery', is_test:test});
      post([['platform_revenue', pay2, 0], ['courier_earnings:'+cp.id, 0, pay2]], {order_id:o.id, ref_type:'earning', memo:'Delivery pay', is_test:test}); }
    return o; };
  const DB_last = t => window.__abSeedDB[t][window.__abSeedDB[t].length-1];

  // Meklit's active order — the story all three apps tell (Kategna, 1,600 ETB food+fees, paying with 2,000)
  order({code:'AB-2B9B', lines:[['fitfit',1],['kitfo',1,'Leb leb (rare)']], status:'picked_up', km:4.2, ageMin:33, courier:'Dawit', payWith:2000, claimedBy:'Liya'});
  order({c:'Henok', r:'r_000203', lines:[['mango',2],['fitfit',1]], pay:'telebirr_transfer', status:'awaiting_payment', km:1.3, ageMin:23, claimedBy:'Liya', evidence:{ref:'CJ84KD72PQ', sender:'Henok T.', amount:1010}});
  order({c:'Bezawit', r:'r_000206', lines:[['kitfo',1],['beyay',1]], pay:'cbe_transfer', status:'awaiting_payment', km:2.1, ageMin:12, claimedBy:'Liya', evidence:{ref:'FT26285Q8LKX', sender:'Bezawit Haile', amount:1400}});
  order({c:'Kidus', r:'r_000202', lines:[['beyay',1],['shiro',1]], status:'placed', km:2.6, ageMin:7});
  order({c:'Bezawit', r:'r_000204', lines:[['kitfo',1],['mango',1]], pay:'telebirr_online', status:'placed', km:0.9, ageMin:2});
  order({c:'Rediet', r:'r_000207', lines:[['macch',4]], status:'placed', km:1.7, ageMin:38, claimedBy:'Abebe'});
  order({c:'Abel', r:'r_000201', lines:[['fitfit',1]], status:'no_courier', km:4.8, ageMin:6600});
  order({c:'Yared', r:'r_000203', lines:[['mango',3]], pay:'telebirr_transfer', status:'payment_rejected', km:3.9, ageMin:1862});
  order({c:'Bezawit', r:'r_000206', lines:[['kitfo',1],['shiro',1]], status:'issue_reported', km:1.6, ageMin:52, courier:'Yonas', claimedBy:'Liya'});
  order({c:'Henok', r:'r_000204', lines:[['kitfo',1],['beyay',1]], pay:'telebirr_transfer', status:'payment_rejected', km:1.2, ageMin:34, claimedBy:'Tigist'});
  order({c:'Abel', r:'r_000202', lines:[['beyay',2],['shiro',1]], status:'customer_no_show', km:2.2, ageMin:138, courier:'Hana', claimedBy:'Liya'});
  order({c:'Yared', r:'r_000205', lines:[['tibs',1],['mango',1]], pay:'telebirr_online', status:'issue_reported', km:5.4, ageMin:27});
  order({c:'Meklit', r:'r_000203', lines:[['mango',1],['fitfit',1]], pay:'cbe_transfer', status:'issue_reported', km:1.4, ageMin:220, courier:'Abebe', claimedBy:'Liya', payStatus:'paid'});
  order({c:'Rediet', r:'r_000207', lines:[['macch',3]], pay:'telebirr_online', status:'finding_courier', km:2.9, ageMin:14});
  order({c:'Meklit', r:'r_000204', lines:[['beyay',1],['mango',1]], pay:'telebirr_online', status:'finding_courier', km:1.0, ageMin:6, claimedBy:'Liya'});
  order({c:'Selamawit', r:'r_000201', lines:[['kitfo',1]], pay:'cbe_transfer', status:'finding_courier', km:2.4, ageMin:11, claimedBy:'Abebe', payStatus:'paid'});
  order({c:'Abel', r:'r_000201', lines:[['kitfo',1]], status:'at_restaurant', km:3.6, ageMin:19, courier:'Tigist', claimedBy:'Liya'});
  order({c:'Bezawit', r:'r_000206', lines:[['beyay',1],['kitfo',1]], pay:'telebirr_online', status:'picked_up', km:1.8, ageMin:31, courier:'Dawit', claimedBy:'Tigist'});
  order({c:'Kidus', r:'r_000202', lines:[['tibs',1],['shiro',1]], status:'at_customer', km:1.5, ageMin:24, courier:'Meron', claimedBy:'Liya'});
  order({c:'Rediet', r:'r_000207', lines:[['macch',4]], pay:'cbe_transfer', status:'courier_assigned', km:0.8, ageMin:15, courier:'Samuel', claimedBy:'Abebe', payStatus:'paid'});
  order({c:'Bezawit', r:'r_000205', lines:[['tibs',1],['mango',1]], status:'delivered', km:1.2, ageMin:130, courier:'Selam', claimedBy:'Liya'});
  order({c:'Meklit', r:'r_000204', lines:[['kitfo',1]], pay:'telebirr_online', status:'delivered', km:0.9, ageMin:190, courier:'Abebe', claimedBy:'Abebe'});
  order({c:'Selamawit', r:'r_000203', lines:[['mango',3]], status:'closed', km:2.0, ageMin:260, courier:'Meron', claimedBy:'Liya'});
  order({c:'Rediet', r:'r_000207', lines:[['macch',2]], pay:'telebirr_online', status:'cancelled', km:1.9, ageMin:310, claimedBy:'Tigist'});
  order({c:'Abel', r:'r_000202', lines:[['beyay',1]], status:'returned', km:2.3, ageMin:420, courier:'Hana', claimedBy:'Liya'});
  // 3 TEST orders — excluded from money totals and reports
  order({c:'Test', r:'r_000205', lines:[['shiro',1]], status:'placed', km:1.1, ageMin:16, test:true});
  order({c:'Test', r:'r_000203', lines:[['mango',1]], pay:'telebirr_online', status:'finding_courier', km:0.7, ageMin:9, test:true});
  order({c:'Test', r:'r_000205', lines:[['shiro',1]], pay:'telebirr_online', status:'delivered', km:0.6, ageMin:300, test:true, courier:'Samuel'});

  // ---------- a little conversation history on Meklit's live order ----------
  const AB2 = window.__abSeedDB.orders.find(o=>o.code==='AB-2B9B');
  const cc = window.__abSeedDB.conversations.find(c=>c.order_id===AB2.id && c.type==='customer_courier');
  ins('messages', {id: uid('msg'), conversation_id:cc.id, sender_user_id:cours.Dawit.u.id, sender_role:'courier', kind:'quick_reply', body:"I'm on my way", body_lang:'en', quick_reply_key:'cou_way', client_temp_id:null, created_at:min(6)});
  ins('messages', {id: uid('msg'), conversation_id:cc.id, sender_user_id:custs.Meklit.u.id, sender_role:'customer', kind:'text', body:'Thank you! Blue gate, 2nd floor.', body_lang:'en', created_at:min(5)});
  cc.last_message_at = min(5);
  // courier → dispatch message left unanswered for 8 minutes (spec: >5 min turns red in console)
  const cd = window.__abSeedDB.conversations.find(c=>c.order_id===AB2.id && c.type==='courier_dispatch');
  ins('messages', {id: uid('msg'), conversation_id:cd.id, sender_user_id:cours.Dawit.u.id, sender_role:'courier', kind:'text', body:'Traffic at Meskel Square — about 5 minutes late.', body_lang:'en', created_at:min(8)});
  cd.last_message_at = min(8);
  // ---------- audit opening rows ----------
  ins('audit_log', {id: uid('aud'), actor_user_id:ops.Kaleb.id, actor_role:'finance', action:'float.topup', entity:'operator_float', before:'0 ETB', after:'5000 ETB', at:min(252), ip:'10.20.5.3', device:'Safari · macOS'});
  ins('audit_log', {id: uid('aud'), actor_user_id:null, actor_role:'system', action:'store.seed', entity:'ab_store_v2', before:null, after:'seeded', at:iso(T), ip:'—', device:'prototype'});
};
