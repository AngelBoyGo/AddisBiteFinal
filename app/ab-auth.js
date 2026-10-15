// Addis Bites — sign-up / onboarding wiring for the two mobile apps, through the shared API only.
// Each helper returns {ok, data|error} so screens can show the API's English + Amharic message.
(function(){
  const A = () => window.ABApi;
  const phone9 = raw => '+251' + String(raw||'').replace(/\D/g,'').replace(/^0/,'').slice(0,9);
  const SESSION = {customer:null, courier:null};
  const store = () => { try { return JSON.parse(localStorage.getItem('ab_session') || '{}'); } catch(e){ return {}; } };
  const save = s => localStorage.setItem('ab_session', JSON.stringify({...store(), ...s}));
  const AUTH = {
    session: SESSION,
    phone9,
    requestOtp(phone, purpose){ return A().call('POST /auth/otp/request', {phone: phone9(phone), purpose}, {role:'guest', device:'app'}); },
    verifyOtp(phone, code, role){ const r = A().call('POST /auth/otp/verify', {phone: phone9(phone), code, role}, {role:'guest', device:'app'});
      if (r.ok){ SESSION[role] = r.data; save({[role]: r.data}); } return r; },
    // Customer sign-up: name + language + the address they typed (a landmark is required by the API).
    customerSignup({user_id, name, language, address}){ const r = A().call('POST /customers/signup', {user_id, name, language, address}, {role:'customer', user_id, device:'app'});
      if (r.ok) save({customerProfile:{customer_id:r.data.customer_id, address_id:r.data.address_id}}); return r; },
    customerId(){ return SESSION.customer && SESSION.customer.user_id; },
    saveAddress(address){ const s = store(); const cid = (s.customerProfile||{}).customer_id; if (!cid) return {ok:false, error:{code:'no_customer', message_en:'Finish sign-up first'}};
      return A().call('POST /addresses', {...address, customer_id:cid, is_default:true}, {role:'customer', user_id:this.customerId(), device:'app'}); },
    // Courier sign-up, step by step.
    courierSignup({user_id, name, language, vehicle_type, plate_number, telebirr_payout_number}){ const r = A().call('POST /couriers/signup', {user_id, name, language, vehicle_type, plate_number, telebirr_payout_number}, {role:'courier', user_id, device:'app'});
      if (r.ok) save({courierProfile:{courier_id:r.data.courier_id}}); return r; },
    courierId(){ const s = store(); return SESSION.courier && (s.courierProfile||{}).courier_id; },
    uploadDocument(type, expires_on){ const cid = this.courierId(); if (!cid) return {ok:false, error:{code:'no_courier', message_en:'Finish step 2 first'}};
      return A().call('POST /couriers/documents', {courier_id:cid, type, expires_on:expires_on||null}, {role:'courier', user_id:SESSION.courier.user_id, device:'app'}); },
    submit(){ const cid = this.courierId(); return A().call('POST /couriers/submit', {courier_id:cid}, {role:'courier', user_id:SESSION.courier.user_id, device:'app'}); },
    setOnline(online_status, location){ const cid = this.courierId(); if (!cid) return {ok:false, error:{code:'no_courier', message_en:'No courier profile'}};
      return A().call('PATCH /couriers/me', {courier_id:cid, online_status, location}, {role:'courier', user_id:SESSION.courier.user_id, device:'app'}); },
    // Read the onboarding status straight from the store (console approvals land here).
    status(){ const cid = this.courierId(); if (!cid) return null; const db = A().db; const cp = db.courier_profiles.find(c=>c.id===cid); if (!cp) return null;
      return {...cp, docs: db.courier_documents.filter(d=>d.courier_id===cid && !d.deleted_at), messages: db.messages.filter(m=>{ const c = db.conversations.find(x=>x.id===m.conversation_id); return c && c.type==='courier_application' && c.courier_id===cid; })}; },
    DOC_TYPE: {'Your photo':'photo', 'National ID':'national_id', 'Driving licence':'driving_license', 'Vehicle registration':'vehicle_registration'},
  };
  window.ABAuth = AUTH;
})();
