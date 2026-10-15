function OtpBoxes({n=6, value, onChange, cls}){
  const refs = useRef([]);
  return <div className={cx('c-otp', cls)}>{Array.from({length:n}).map((_,i)=><input key={i} ref={el=>refs.current[i]=el} inputMode="numeric" maxLength={1} value={value[i]||''} aria-label={'Digit '+(i+1)}
    onChange={e=>{ const d = e.target.value.replace(/\D/g,'').slice(-1); const a = value.split(''); a[i] = d; const v = a.join('').slice(0,n); onChange(v); if (d && refs.current[i+1]) refs.current[i+1].focus(); }}
    onKeyDown={e=>{ if (e.key==='Backspace' && !value[i] && refs.current[i-1]) refs.current[i-1].focus(); }}/>)}</div>;
}
// ===== Customer: shared bits + Home, Search, Restaurant, Item sheet =====
const hueOf = s => [...(s||'x')].reduce((a,c)=>a+c.charCodeAt(0),0) % 6;
// /handoff/images is ~31 MB of WebP and is not copied into this project by default.
// Copy the folder in and set window.AB_IMAGES_PRESENT = true to use the real photography.
const useImg = p => (window.AB_IMAGES_PRESENT && p) ? 'handoff/' + String(p).replace(/^\//,'') : null;
function Ph({name, h=120, r=0, cap, sample, style, img}){
  return <div className={cx('k-ph','h'+hueOf(name))} style={{height:h, borderRadius:r, ...style}}>{useImg(img) ? <img src={useImg(img)} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} loading="lazy"/> : <span className="l">{(name||'?')[0]}</span>}
    {sample && <span className="k-sample">Sample image</span>}{cap && !useImg(img) && <span className="cap">{cap}</span>}</div>;
}
const useL = () => { const app = useApp(); return (en, am) => app.lang==='am' && am ? am : en; };
// Price level: filled dots, not the word ETB repeated. "ETB ETB ETB ETB" read as a currency amount.
function PriceLevel({n, tier}){ if (n==null) return null;
  return <span className="k-pl" aria-label={`Price level ${n} of 4`} title={`Price level ${n} of 4 — ${['','inexpensive','moderate','pricey','premium'][n]||''}`}>{[1,2,3,4].map(i=><i key={i} className={i<=n?'on':''}/>)}</span>; }
function Spice({n}){ if (!n) return null; return <span className="k-spice" aria-label={`Spice ${n} of 3`} title={`Spice ${n}/3`}>{[1,2,3].map(i=><i key={i} className={i>n?'o':''}/>)}</span>; }
function FastTag(){ return <span className="k-fast">ጾም Fasting</span>; }
function Stars2({v, c}){ return <span className="k-star"><svg width="14" height="14" viewBox="0 0 24 24" fill="var(--amber-dot)"><path d={IP.star}/></svg>{v.toFixed(1)}{c!=null && <span className="muted" style={{fontWeight:500}}>({fmtN(c)})</span>}</span>; }

function RestCard({r, full}){
  const app = useApp(); const L = useL(); const os = app.openState(r); const eta = app.etaMin(r, app.addr); const km = app.kmBetween(r.pos, app.addr.pos); const fee = window.ABBus.feeFor(km);
  return <button className={cx('k-rcard', full&&'full', !os.open&&'closed')} onClick={()=>app.push('rest',{id:r.id})} aria-label={r.name}>
    <div className="hero"><Ph name={r.name} h="100%" img={r.hero_image && !app.s.prefs.lowData ? r.hero_image : null} sample={r.photo_license==='scraped'} cap="store photo"/>
      <div className="badges">{r.is_partner && <span className="k-badge partner">Partner</span>}{r.fasting_friendly && <span className="k-badge fast">ጾም</span>}{!os.open && <span className="k-badge">{os.inactive?'Paused':'Closed'}</span>}</div>
      <div className="logo"><Ph name={r.name} h={38} style={{width:38}} r={8}/></div></div>
    <div className="body">
      <div className="nm">{L(r.name, r.name_am)}{r.branch_label && <span className="k-branch">· {r.branch_label}</span>}</div>{r.name_am && app.lang!=='am' && <div className="am">{r.name_am}</div>}
      <div className="meta">{r.rating!=null ? <Stars2 v={r.rating} c={r.rating_count}/> : <span className="k-norate"><Ic n="star" s={13}/>Not rated yet</span>}<span className="k-dot">·</span><PriceLevel n={r.price_level}/><span className="k-dot">·</span><span className="ellip">{(r.cuisines||[]).slice(0,2).map(c=>(KC().CATEGORIES.cuisines.find(x=>x.id===c)||{en:c}).en).join(', ')||r.sub_city}</span></div>
      <div className="meta">{os.open ? <><Ic n="clock" s={13}/><b style={{color:'var(--text)'}}>{eta}–{eta+10} min</b><span className="k-dot">·</span><span>{fee!=null?fee+" ETB delivery":'Outside area'}</span><span className="k-dot">·</span><span>{r.neighborhood||r.sub_city} · {km.toFixed(1)} km</span></>
        : <span style={{color: os.inactive?'var(--text-2)':'var(--amber-fg)',fontWeight:650}}>{os.label}{!os.inactive && ' — Schedule order'}</span>}</div>
    </div></button>;
}

// ---------------- HOME ----------------
const QUICK_CHIPS = [['open','Open now','clock'],['fasting','ጾም Fasting'],['near','Near me','pin'],['u300','Under 300 ETB'],['coffee','Coffee'],['juice','Juice'],['traditional','Traditional'],['fast_food','Fast food'],['pizza','Pizza'],['bakery','Bakery'],['hotel','Hotel']];
function applyChip(list, chip, app){
  if (!chip) return list; const os = r => app.openState(r).open;
  if (chip==='open') return list.filter(os); if (chip==='fasting') return list.filter(r=>r.fasting_friendly); if (chip==='near') return [...list].sort((a,b)=>app.kmBetween(a.pos,app.addr.pos)-app.kmBetween(b.pos,app.addr.pos)).slice(0,8);
  if (chip==='u300') return list.filter(r=>(r.avg_item_price_etb||999)<=300); return list.filter(r=>r.cuisines.includes(chip));
}
function indexCount(s, sub){ const f = s.data.index[sub]; const n = f && (f.count != null ? f.count : (Array.isArray(f) ? f.length : (f.rows||[]).length)); return n || KC().INDEX_COUNTS[sub] || 0; }
function HomeK(){
  const app = useApp(); const L = useL(); const {s} = app; const [chip, setChip] = useState(null); const [sub, setSub] = useState(null); const [pull, setPull] = useState(false);
  const all = s.data.restaurants; const st = app.tw.pageState;
  const subList = sub ? all.filter(r=>r.sub_city===sub) : all;
  const filtered = applyChip(subList, chip, app);
  const past = [...new Map(s.orders.filter(o=>o.status==='delivered' && !o.test && app.R(o.restaurantId)).map(o=>[o.restaurantId,o])).values()];
  const pinnedFirst = list => [...list].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0) || (b.is_partner?1:0)-(a.is_partner?1:0));
  const near = pinnedFirst([...subList].filter(r=>r.is_active).sort((a,b)=>(app.openState(b).open-app.openState(a).open) || app.kmBetween(a.pos,app.addr.pos)-app.kmBetween(b.pos,app.addr.pos)));
  const ok = r => !!app.R(r.id);
  const rails = [
    ['Popular near you', near.filter(ok).slice(0,8)],
    ['Fasting favorites', subList.filter(r=>r.fasting_friendly && ok(r)).sort((a,b)=>(b.rating_count||0)-(a.rating_count||0)).slice(0,8)],
    ['Partner restaurants', pinnedFirst(subList.filter(r=>ok(r) && r.is_partner)).slice(0,10), 'Addis Bites Partner — faster confirmation'],
    ['Coffee & juice', subList.filter(r=>ok(r) && r.cuisines.some(c=>['coffee','juice'].includes(c))).slice(0,8)],
    ['New on Addis Bites', subList.filter(r=>ok(r) && r.is_new).slice(0,8)],
  ];
  const hour = new Date(app.now).getUTCHours();
  // Greeting in the chosen language (the toggle previously left these strings in English).
  const greet = hour<12 ? L('Good morning','እንደምን አደሩ') : hour<18 ? L('Good afternoon','እንደምን ዋሉ') : L('Good evening','እንደምን አመሹ');
  const reorder = o => { const r = app.Rs(o.restaurantId); const items = (app.allItems(o.restaurantId).length ? app.allItems(o.restaurantId) : (app.dishIndex(o.restaurantId)||[]));
    const lines = o.lines.map(l=>{ const it = items.find(i=>i.id===l.itemId); if (!it || it.price_etb == null || it.available === false) return null;
      return {...l, name:it.name, name_am:it.name_am, base:it.price_etb, unit:it.price_etb, key:l.itemId+'|'+(l.options||[]).join(',')+'|'}; }).filter(Boolean);
    if (!lines.length){ app.toast(`Nothing from your ${r.name} order is available right now`, {tone:'bad'}); return; }
    app.up(n=>{ n.cart = {restaurantId:o.restaurantId, lines}; n.tab='cart'; n.stack=[]; });
    app.toast(o.lines.length>lines.length ? `${lines.length} items added · ${o.lines.length-lines.length} unavailable` : `Basket from ${r.name} added · check and go`); };
  if (st==='loading') return <div className="c-main"><div className="c-pad c-col" style={{gap:14}}><Skel h={52} r={14}/><div className="c-row">{[0,1,2,3].map(i=><Skel key={i} w={90} h={40} r={20}/>)}</div>{[0,1].map(i=><div key={i} className="c-card c-col" style={{gap:10,padding:0,overflow:'hidden'}}><Skel h={130} r={0}/><div className="c-pad c-col" style={{gap:8}}><Skel w="50%" h={16}/><Skel w="70%" h={12}/></div></div>)}</div></div>;
  return <div className="c-main"><div className="c-pad c-col" style={{gap:16}}>
    {s.data.menuGap > 0 && !s.data.menuGapHidden && <div className="c-alert amber"><div className="ttl"><Ic n="info" s={16}/>This package has {s.data.orderable} of {s.data.catalogSize} menus</div>
      <div className="body">The catalogue lists a menu for {s.data.menuGap} more venues, but those menu files were not included in this prototype package, so they are shown as <b>Not orderable yet</b>. Copy <span className="mono">handoff/data/top200/menus/</span> into the project and they open automatically.</div>
      <button className="link" onClick={()=>app.up(n=>{ n.data = {...n.data, menuGapHidden:true}; })}>Hide this</button></div>}
    {pull && <div className="muted" style={{textAlign:'center',fontSize:13}}><Ic n="refresh" s={14} className="c-sync" style={{verticalAlign:-2}}/> Refreshing…</div>}
    <div className="c-row"><div style={{flex:1}}><div className="muted" style={{fontSize:14}}>{greet}, {KC().USER.first}</div><h1 className="c-h1" style={{fontSize:24}}>{L('What are you craving?','ምን ይፈልጋሉ?')}</h1></div>
      <button className="c-iconbtn" aria-label="Refresh" onClick={()=>{ setPull(true); setTimeout(()=>setPull(false),1000); }}><Ic n="refresh" s={20}/></button></div>
    <button className="k-search" onClick={()=>app.setTab('search')}><Ic n="search" s={20}/>{L('Search restaurants or dishes — e.g. kitfo, shiro, burger','ምግብ ቤቶችን ወይም ምግቦችን ይፈልጉ — ለምሳሌ ክትፎ፣ ሽሮ፣ በርገር')}</button>
    <div className="k-chips">{QUICK_CHIPS.map(([k,l,ic])=><button key={k} className={cx('k-chip', k==='fasting'&&'fast', chip===k&&'on')} onClick={()=>setChip(chip===k?null:k)} aria-pressed={chip===k}>{ic && <Ic n={ic} s={15}/>}{l}</button>)}</div>
    <div><div className="c-lbl" style={{marginBottom:6}}>Sub-city</div><div className="k-subrow"><button className={cx('k-sub', !sub&&'on')} onClick={()=>setSub(null)}>All Addis</button>{KC().SUBS.map(x=><button key={x} className={cx('k-sub', sub===x&&'on')} onClick={()=>{ setSub(x); app.loadSub(x); }}>{L(x, KC().SUB_AM[x])}</button>)}</div>
      {sub && <div className="muted" style={{fontSize:12.5,marginTop:6}}>{s.data.loadingSub===sub ? <><Ic n="refresh" s={12} className="c-sync" style={{verticalAlign:-2}}/> Loading {sub}…</> : <>{subList.length} with full menus · +{fmtN(indexCount(s, sub))} more in {sub} (index only)</>}</div>}</div>
    {chip ? <div className="c-col" style={{gap:12}}><div className="k-sec"><h2>{QUICK_CHIPS.find(c=>c[0]===chip)[1]}{sub?` · ${sub}`:''}</h2><span className="muted">{filtered.length}</span></div>
      {filtered.length===0 ? <CState icon="search" title="No restaurants match" body={`Try removing “${QUICK_CHIPS.find(c=>c[0]===chip)[1]}”.`} action={<CBtn onClick={()=>setChip(null)}>Remove filter</CBtn>}/> : filtered.map(r=><RestCard key={r.id} r={r} full/>)}</div>
    : <>
      {past.length>0 && <div><div className="k-sec"><h2>Order again</h2><button onClick={()=>app.setTab('orders')}>History</button></div>
        <div className="k-rail">{past.map(o=>{ const r = app.Rs(o.restaurantId); return <div key={o.code} className="c-card" style={{width:250,padding:12,display:'flex',gap:10,alignItems:'center'}}>
          <Ph name={r.name} h={56} style={{width:56,flexShrink:0}} r={12}/><div style={{flex:1,minWidth:0}}><b className="ellip" style={{display:'block'}}>{r.name}</b><div className="muted ellip" style={{fontSize:12.5}}>{o.lines.map(l=>`${l.qty}× ${l.name}`).join(', ')}</div><div className="mono b" style={{fontSize:13}}>{fmtETB(o.total)}</div></div>
          <CBtn sm kind="primary" onClick={()=>reorder(o)} disabled={!app.openState(r).open && 'Closed now'}>Reorder</CBtn></div>; })}</div></div>}
      <button className="k-promo" onClick={()=>app.push('rest',{id:'r_000201'})}><div style={{flex:1,position:'relative',zIndex:1}}><div style={{fontWeight:800,fontSize:17}}>Free delivery from Kategna</div><div style={{fontSize:13.5,opacity:.9,marginTop:2}}>Tonight until 21:00 · code <span className="code">KATEGNA</span></div></div><Ic n="chevR" s={22}/></button>
      {rails.map(([t, list, sub2])=> list.length ? <div key={t}><div className="k-sec"><h2>{t}</h2><button onClick={()=>app.setTab('search')}>See all</button></div>{sub2 && <div className="muted" style={{fontSize:13,marginTop:-6,marginBottom:8}}>{sub2}</div>}<div className="k-rail">{list.map(r=><RestCard key={r.id} r={r}/>)}</div></div> : null)}
      {st==='empty' && <CState icon="store" title="No restaurants deliver here yet" body="We’re expanding across Addis. Try another address."/>}
    </>}
    <div className="faint" style={{fontSize:12,textAlign:'center'}}>{s.data.source==='package' ? `Data package · ${s.data.restaurants.length} restaurants` : `Sample data · ${s.data.restaurants.length} restaurants · drop the real package in /handoff/data`}</div>
    <div style={{height:64}}/>
  </div></div>;
}

// ---------------- SEARCH ----------------
function SearchK(){
  const app = useApp(); const L = useL(); const {s} = app; const [q, setQ] = useState(''); const [tab, setTab] = useState('rest'); const [sort, setSort] = useState('rec'); const [filt, setFilt] = useState(false); const [map, setMap] = useState(false);
  const [F, setF] = useState({subs:[], cuisines:[], price:[], r4:false, open:false, fasting:false, partner:false, maxMin:0});
  const [capN, setCapN] = useState(36);
  const ql = q.trim().toLowerCase();
  const qlItems = ql ? (app.searchItems(q)||[]) : null;
  const itemsOf = rid => { const cached = app.allItems(rid); if (cached.length) return cached; const idx = app.dishIndex(rid); return idx || cached; };
  const matchR = r => !ql || [r.name, r.name_am, r.neighborhood, r.sub_city, ...r.cuisines].some(x=>x && x.toLowerCase().includes(ql)) || (qlItems ? qlItems.some(x=>x.rid===r.id) || itemsOf(r.id).some(i=>i.name.toLowerCase().includes(ql) || (i.name_am||'').includes(q.trim())) : itemsOf(r.id).some(i=>i.name.toLowerCase().includes(ql) || (i.name_am||'').includes(q.trim())));
  let rs = s.data.restaurants.filter(matchR).filter(r=>(!F.subs.length||F.subs.includes(r.sub_city)) && (!F.cuisines.length||r.cuisines.some(c=>F.cuisines.includes(c))) && (!F.price.length||F.price.includes(r.price_level)) && (!F.r4||r.rating>=4) && (!F.open||app.openState(r).open) && (!F.fasting||r.fasting_friendly) && (!F.partner||r.is_partner) && (!F.maxMin || app.etaMin(r,app.addr)<=F.maxMin));
  const sorts = {rec:(a,b)=>(app.openState(b).open-app.openState(a).open)||(b.rating||0)*Math.log((b.rating_count||1)+1)-(a.rating||0)*Math.log((a.rating_count||1)+1), near:(a,b)=>app.kmBetween(a.pos,app.addr.pos)-app.kmBetween(b.pos,app.addr.pos), fast:(a,b)=>app.etaMin(a,app.addr)-app.etaMin(b,app.addr), rating:(a,b)=>b.rating-a.rating, price:(a,b)=>a.price_level-b.price_level};
  rs = [...rs].sort(sorts[sort]);
  // Dish results come from the catalog-wide index, so they are right before any menu has been fetched.
  const dishes = ql ? (() => { const idx = app.searchItems(q);
    if (idx && idx.length) return idx.map(x=>({i:x.item, r:app.Rs(x.rid)})).filter(x=>!F.fasting || x.i.fasting).slice(0,40);
    return s.data.restaurants.flatMap(r=>itemsOf(r.id).filter(i=>i.name.toLowerCase().includes(ql) || (i.name_am||'').includes(q.trim()) || (i.description||'').toLowerCase().includes(ql)).map(i=>({i, r}))).filter(x=>!F.fasting || x.i.fasting).slice(0,40); })() : [];
  const active = Object.entries(F).filter(([k,v])=>Array.isArray(v)?v.length:v).length;
  const chipsOff = [F.open&&['open','Open now'], F.fasting&&['fasting','Fasting only'], F.partner&&['partner','Partner'], F.r4&&['r4','Rating 4+']].filter(Boolean);
  return <><div className="c-pad c-col" style={{gap:10,paddingBottom:8,flexShrink:0}}>
    <div className="k-search" style={{cursor:'auto'}}><Ic n="search" s={20}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} onInput={e=>setQ(e.target.value)} placeholder="Kitfo, ሽሮ, burger, Sarem…" aria-label="Search" autoComplete="off" autoCorrect="off" spellCheck={false}/>{q && <button className="c-iconbtn" style={{width:32,height:32}} onClick={()=>setQ('')} aria-label="Clear"><Ic n="x" s={16}/></button>}</div>
    <div className="c-row" style={{gap:6}}><div className="c-seg" style={{flex:1}}><button className={tab==='rest'?'on':''} onClick={()=>setTab('rest')}>Restaurants {ql?`· ${rs.length}`:''}</button><button className={tab==='dish'?'on':''} onClick={()=>setTab('dish')}>Dishes {ql?`· ${dishes.length}`:''}</button></div>
      <CBtn sm icon="filter" onClick={()=>setFilt(true)}>{active?`Filters · ${active}`:'Filters'}</CBtn><button className="c-iconbtn" aria-label={map?'List view':'Map view'} onClick={()=>setMap(!map)} style={{border:'1.5px solid var(--border-2)'}}><Ic n={map?'menu':'pin'} s={20}/></button></div>
    {tab==='rest' && <div className="k-chips">{[['rec','Recommended'],['near','Nearest'],['fast','Fastest'],['rating','Rating'],['price','Price low→high']].map(([k,l])=><button key={k} className={cx('k-chip', sort===k&&'on')} style={{height:34,fontSize:13}} onClick={()=>setSort(k)}>{l}</button>)}</div>}
  </div>
  <div className="c-main"><div className="c-pad c-col" style={{gap:12,paddingTop:4}}>
    {!ql && !active && <div><div className="c-lbl">Recent</div><div className="c-row" style={{flexWrap:'wrap',gap:6}}>{s.recent.map(r=><button key={r} className="k-chip" onClick={()=>setQ(r)}><Ic n="history" s={14}/>{r}</button>)}</div>
      <div className="c-lbl" style={{marginTop:14}}>Popular in Addis</div><div className="c-row" style={{flexWrap:'wrap',gap:6}}>{['kitfo','shiro','beyaynetu','burger','pizza','macchiato','ክትፎ','juice'].map(r=><button key={r} className="k-chip" onClick={()=>setQ(r)}><Ic n="flame" s={14}/>{r}</button>)}</div></div>}
    {map && tab==='rest' ? <CityMap height={420} zones pins={[{...app.addr.pos, color:'var(--blue-dot)', label:'You', big:true}, ...rs.slice(0,40).map(r=>({...r.pos, id:r.id, color: app.openState(r).open?'var(--brand)':'#9AA0A6', sq:true, tip:`${r.name} · ${r.rating}★`}))]} onPin={p=>app.push('rest',{id:p.id})} legend={[['var(--brand)','Open',true],['#9AA0A6','Closed',true],['var(--blue-dot)','You']]}/> :
    tab==='rest' ? (rs.length ? <>{rs.slice(0,capN).map(r=><RestCard key={r.id} r={r} full/>)}{rs.length>capN && <CBtn full icon="chevD" onClick={()=>setCapN(capN+36)}>Show {Math.min(36, rs.length-capN)} more · {rs.length} match in total</CBtn>}</> : <CState icon="search" title="No restaurants match" body={chipsOff.length?`Try removing “${chipsOff[0][1]}”.`:'Try a different word — or search in Amharic.'} action={chipsOff.length ? <CBtn onClick={()=>setF(f=>({...f, [chipsOff[0][0]]:false}))}>Remove “{chipsOff[0][1]}”</CBtn> : null}/>)
    : (!ql ? <CState icon="search" title="Search for a dish" body="Type kitfo, shiro, ፒዛ…"/> : dishes.length ? dishes.map(({i,r})=><div key={i.id} className="c-card c-row" style={{cursor:'pointer',padding:10}} onClick={()=>{ app.push('rest',{id:r.id}); setTimeout(()=>app.openSheet({type:'item', rid:r.id, iid:i.id}),60); }}>
        <Ph name={i.name} h={64} style={{width:64,flexShrink:0}} r={12} img={i.image} sample={i.photo_license==='scraped'}/><div style={{flex:1,minWidth:0}}><b>{L(i.name,i.name_am)}</b><div className="muted" style={{fontSize:13}}>{r.name} · {r.neighborhood}</div><div className="c-row" style={{gap:6,marginTop:2}}><span className="mono b">{i.price_etb!=null?fmtETB(i.price_etb):'Price on request'}</span>{i.fasting && <FastTag/>}</div></div></div>)
      : <CState icon="search" title={`No dishes for “${q}”`} body="Check spelling or try fewer words."/>)}
    <div style={{height:64}}/></div></div>
  {filt && <Sheet title="Filters" onClose={()=>setFilt(false)} tall footer={<div className="c-row"><CBtn onClick={()=>setF({subs:[], cuisines:[], price:[], r4:false, open:false, fasting:false, partner:false, maxMin:0})}>Clear all</CBtn><div style={{flex:1}}><BigBtn onClick={()=>setFilt(false)}>Show {rs.length} restaurants</BigBtn></div></div>}>
    <div className="c-lbl">Sub-city</div><div className="c-row" style={{flexWrap:'wrap',gap:6,marginBottom:14}}>{KC().SUBS.map(x=><button key={x} className={cx('k-chip', F.subs.includes(x)&&'on')} onClick={()=>setF(f=>({...f, subs: f.subs.includes(x)?f.subs.filter(y=>y!==x):[...f.subs,x]}))}>{x}</button>)}</div>
    <div className="c-lbl">Cuisine</div><div className="c-row" style={{flexWrap:'wrap',gap:6,marginBottom:14}}>{KC().CATEGORIES.cuisines.map(c=><button key={c.id} className={cx('k-chip', F.cuisines.includes(c.id)&&'on')} onClick={()=>setF(f=>({...f, cuisines: f.cuisines.includes(c.id)?f.cuisines.filter(y=>y!==c.id):[...f.cuisines,c.id]}))}>{L(c.en,c.am)}</button>)}</div>
    <div className="c-lbl">Price level</div><div className="c-row" style={{gap:6,marginBottom:14}}>{[1,2,3,4].map(p=><button key={p} className={cx('k-chip', F.price.includes(p)&&'on')} onClick={()=>setF(f=>({...f, price: f.price.includes(p)?f.price.filter(y=>y!==p):[...f.price,p]}))}>{'ETB '.repeat(p).trim()}</button>)}</div>
    <div className="c-lbl">Delivery time</div><div className="c-row" style={{gap:6,marginBottom:14}}>{[[0,'Any'],[30,'≤ 30 min'],[45,'≤ 45 min']].map(([v,l])=><button key={v} className={cx('k-chip', F.maxMin===v&&'on')} onClick={()=>setF(f=>({...f, maxMin:v}))}>{l}</button>)}</div>
    {[['open','Open now'],['fasting','ጾም Fasting only'],['partner','Partner only'],['r4','Rating 4+']].map(([k,l])=><div key={k} className="c-row" style={{minHeight:56,borderBottom:'1px solid var(--border)'}}><b style={{flex:1}}>{l}</b><button className={cx('switch', F[k]&&'on')} style={{transform:'scale(1.35)',marginRight:6}} role="switch" aria-checked={F[k]} aria-label={l} onClick={()=>setF(f=>({...f, [k]:!f[k]}))}/></div>)}
  </Sheet>}</>;
}

// ---------------- RESTAURANT ----------------
function RestaurantK({id}){
  const app = useApp(); const L = useL(); const r = app.Rs(id); const [fastOnly, setFastOnly] = useState(false); const [q, setQ] = useState(''); const [cat, setCat] = useState(null); const [hours, setHours] = useState(false); const scRef = useRef();
  useEffect(()=>{ app.loadMenu(id); },[id]);
  if (!app.R(id)) return <><Header title="Menu unavailable" onBack={app.pop}/><CState icon="store" title="This menu isn’t available right now" body="The restaurant may have paused its menu. Try another nearby." action={<CBtn kind="primary" onClick={()=>app.setTab('home')}>Browse restaurants</CBtn>}/></>;
  const os = app.openState(r); const m = app.menuOf(id); const eta = app.etaMin(r, app.addr); const fav = app.s.favorites.restaurants.includes(id);
  const rKm = app.kmBetween(r.pos, app.addr.pos); const rFee = window.ABBus.feeFor(rKm); const rTier = window.ABBus.tierFor(rKm);
  const cats = (m?.categories||[]).map(c=>({...c, items:c.items.filter(i=>(!fastOnly||i.fasting) && (!q || i.name.toLowerCase().includes(q.toLowerCase()) || (i.name_am||'').includes(q)))})).filter(c=>c.items.length);
  const inCart = app.s.cart.restaurantId===id ? app.cartCount : 0;
  const today = ['sun','mon','tue','wed','thu','fri','sat'][new Date(app.now).getUTCDay()];
  const jump = cid => { setCat(cid); const el = scRef.current?.querySelector(`[data-cat="${cid}"]`); if (el && scRef.current) scRef.current.scrollTop = el.offsetTop - 56; };
  const onScroll = () => { const sc = scRef.current; if (!sc) return; let cur = null; sc.querySelectorAll('[data-cat]').forEach(el=>{ if (el.offsetTop - 70 <= sc.scrollTop) cur = el.dataset.cat; }); if (cur!==cat) setCat(cur); };
  return <><div className="c-main" ref={scRef} onScroll={onScroll}>
    <div className="k-hero"><Ph name={r.name} h="100%" img={r.hero_image} sample={r.photo_license==='scraped'} cap="store hero image"/>
      <button className="back" onClick={app.pop} aria-label="Back"><Ic n="chevL" s={24} w={2.2}/></button>
      <button className="back fav" onClick={()=>app.toggleFav('restaurants', id)} aria-label={fav?'Remove favorite':'Add favorite'} style={{color:fav?'var(--red-dot)':undefined}}><svg width="22" height="22" viewBox="0 0 24 24" fill={fav?'currentColor':'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg></button></div>
    <div className="k-rhead"><div className="logo"><Ph name={r.name} h={54} style={{width:54}} r={12}/></div>
      <div className="c-row" style={{marginTop:8,alignItems:'flex-start'}}><div style={{flex:1}}><h1 className="c-h1" style={{fontSize:24}}>{L(r.name, r.name_am)}</h1>{r.name_am && app.lang!=='am' && <div className="muted">{r.name_am}</div>}</div>
        <CBtn sm icon="call" onClick={()=>app.toast(`Calling ${r.name} via Addis Bites relay · +251 9•• ••• ${r.phone.slice(-3)}`)}>Call</CBtn></div>
      <div className="c-row" style={{flexWrap:'wrap',gap:6,marginTop:6}}>{r.is_partner && <Pill tone="green" icon="check">Partner · faster confirmation</Pill>}{r.fasting_friendly && <span className="k-fast" style={{height:22}}>ጾም Fasting-friendly</span>}<Pill tone={os.tone}>{os.label}</Pill></div>
      <div className="muted" style={{fontSize:14,marginTop:8,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}><Stars2 v={r.rating} c={r.rating_count}/>·<PriceLevel n={r.price_level}/>·<span>{r.cuisines.map(c=>(KC().CATEGORIES.cuisines.find(x=>x.id===c)||{en:c}).en).join(', ')}</span></div>
      <div className="c-grid2" style={{marginTop:12}}><div className="c-card" style={{padding:10}}><div className="muted" style={{fontSize:12}}>Delivery</div><b className="mono">{eta}–{eta+10} min</b></div><div className="c-card" style={{padding:10}}><div className="muted" style={{fontSize:12}}>Delivery fee</div><b className="mono">{rFee==null?"Outside area":rFee+" ETB"}</b> <span className="faint" style={{fontSize:12}}>+20 service</span>{rTier && <div className="faint" style={{fontSize:11.5}}>tier ≤ {rTier} km</div>}</div></div>
      <button className="c-card" style={{marginTop:8,width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'var(--font)',color:'var(--text)',padding:10}} onClick={()=>setHours(!hours)}>
        <div className="c-row"><Ic n="pin" s={16}/><div style={{flex:1}}><b>{r.neighborhood}, {r.sub_city}</b><div className="muted" style={{fontSize:13}}>{r.landmark} · {app.kmBetween(r.pos,app.addr.pos).toFixed(1)} km</div></div><Ic n={hours?'up':'chevD'} s={18}/></div>
        {hours && <div style={{marginTop:8}}><CityMap height={120} zones={false} pins={[{...r.pos, color:'var(--text)', sq:true, label:r.name},{...app.addr.pos, color:'var(--blue-dot)', label:'You'}]}/>
          {r.is_24h ? <div className="c-kv"><span>Every day</span><b>24 hours</b></div> : (r.hours||[]).length===0 ? <div className="k-hours-unknown"><Ic n="info" s={13}/>Opening hours not available — call to confirm</div> : r.hours.map(h=><div key={h.day} className="c-kv" style={{fontWeight:h.day===today?750:400}}><span style={{textTransform:'capitalize'}}>{h.day}{h.day===today?' · today':''}</span><span className="mono">{h.open}–{h.close}{h.overnight?' (+1)':''}</span></div>)}</div>}
      </button>
    </div>
    <div className="c-pad c-col" style={{gap:8,paddingBottom:8}}>
      {!r.is_active && <div className="c-alert amber"><div className="ttl"><Ic n="info" s={18}/>Not accepting orders right now</div><div className="body">This restaurant has paused delivery. You can still browse the menu.</div></div>}
      {r.is_active && !os.open && <div className="c-alert amber"><div className="ttl"><Ic n="clock" s={18}/>{os.label}</div><div className="body">You can add items and schedule your order for when they open.</div></div>}
    </div>
    {!r.has_menu ? <CState icon="receipt" title="Ordering not open yet" body={`We don’t have ${L(r.name, r.name_am)}’s menu or prices online yet, so you can’t order from here. Call them, or pick another place nearby.`} action={<div className="c-row"><CBtn icon="call" onClick={()=>app.toast('Calling via relay')}>Call</CBtn><CBtn kind="primary" onClick={()=>app.setTab('home')}>See others</CBtn></div>}/> :
    !m && app.s.data.menuFailed && app.s.data.menuFailed[id] ? <CState icon="info" title="This menu isn’t in the package" body={`${L(r.name, r.name_am)}’s menu is in the catalogue, but the menu file was not included in this prototype package, so nothing can be ordered here yet.`} action={<div className="c-row"><CBtn icon="call" onClick={()=>app.toast('Calling via relay')}>Call</CBtn><CBtn kind="primary" onClick={()=>app.setTab('home')}>See others</CBtn></div>}/> :
    !m ? <CSkel/> : <>
      <div className="k-cattabs">{(m.categories||[]).map(c=><button key={c.id} className={(cat||m.categories[0].id)===c.id?'on':''} onClick={()=>jump(c.id)}>{L(c.name, c.name_am)}</button>)}</div>
      <div className="c-pad c-col" style={{gap:8,paddingBottom:4}}>
        <div className="c-row" style={{gap:8}}><div className="k-search" style={{height:44,flex:1}}><Ic n="search" s={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search menu" aria-label="Search menu"/></div>
          <button className={cx('k-chip fast', fastOnly&&'on')} onClick={()=>setFastOnly(!fastOnly)} aria-pressed={fastOnly}>ጾም only</button></div>
        <div className="faint" style={{fontSize:12.5}}><Ic n="info" s={12} style={{verticalAlign:-1}}/> {app.s.data.source==='sample' ? <b>Sample menu — the catalogue file was not included, so these prices are not real.</b> : <>Prices may vary{m.price_scraped_at && !isNaN(Date.parse(m.price_scraped_at)) ? <> · last updated {fmtTime(Date.parse(m.price_scraped_at+'T00:00:00Z'),{dateOnly:true})}</> : <> · update date not recorded</>}</>}</div></div>
      {cats.length===0 && <CState icon="search" title="Nothing matches" body={fastOnly?'No fasting items here. Turn off “ጾም only”.':'Try another word.'}/>}
      {cats.map(c=><div key={c.id} data-cat={c.id}><div style={{padding:'16px 16px 6px',fontWeight:750,fontSize:17}}>{L(c.name, c.name_am)} <span className="faint" style={{fontWeight:500,fontSize:14}}>{c.items.length}</span></div>
        {c.items.map(i=><MenuItemRow key={i.id} r={r} i={i}/>)}</div>)}
    </>}
    <div style={{height:120}}/>
  </div>
  {inCart>0 && <div className="c-dock" style={{background:'transparent',borderTop:0,position:'absolute',left:0,right:0,bottom:0,zIndex:20}}><button className="k-cartbar" onClick={()=>{ app.setTab('cart'); }}><span className="n">{inCart}</span><span style={{flex:1,textAlign:'left'}}>View cart</span><span className="mono">{fmtETB(app.cartTotal)}</span></button></div>}</>;
}
function MenuItemRow({r, i}){
  const app = useApp(); const L = useL(); const noPrice = i.price_etb==null; const off = !i.available || noPrice;
  const inCart = app.s.cart.restaurantId===r.id ? app.s.cart.lines.filter(l=>l.itemId===i.id).reduce((x,l)=>x+l.qty,0) : 0;
  return <div className={cx('k-item', off&&'off')} onClick={()=>!off && app.openSheet({type:'item', rid:r.id, iid:i.id})} role="button" aria-disabled={off}>
    <div className="tx"><div className="nm">{inCart>0 && <span className="mono" style={{color:'var(--brand-fg)'}}>{inCart}× </span>}{L(i.name, i.name_am)}</div>{i.name_am && app.lang!=='am' && <div className="muted" style={{fontSize:13}}>{i.name_am}</div>}
      <div className="ds">{i.description}</div>
      <div className="c-row" style={{gap:6,flexWrap:'wrap',marginTop:2}}><span className="pr">{noPrice?'Price on request':fmtETB(i.price_etb)}</span>{i.fasting && <FastTag/>}<Spice n={i.spice_level}/>{i.popular && <Pill tone="amber" dot={false} icon="flame">Popular</Pill>}</div>
      {!i.available && <span style={{fontSize:13,fontWeight:700,color:'var(--red-fg)'}}>Sold out today</span>}{noPrice && i.available && <span style={{fontSize:13,color:'var(--text-2)'}}>Call the restaurant to order this</span>}</div>
    <div className="ph"><Ph name={i.name} h={104} r={14} img={i.image} sample={i.photo_license==='scraped'} cap={i.image?'':'dish photo'}/>{!off && <span className="k-add"><Ic n="plus" s={20} w={2.6}/></span>}</div>
  </div>;
}

// ---------------- ITEM SHEET ----------------
function ItemSheet({rid, iid, preset}){
  const app = useApp(); const L = useL(); const r = app.R(rid); const i = app.findItem(rid, iid); const [qty, setQty] = useState(1); const [note, setNote] = useState('');
  const [sel, setSel] = useState(()=>{ const s = {}; (i?.options||[]).forEach((g,gi)=>{ s[gi] = []; if (preset){ const ci = g.choices.findIndex(c=>c.name===preset); if (ci>=0) s[gi] = [ci]; } }); return s; });
  // If the menu is still loading, or the item is not in it, the sheet used to render NOTHING — so a tap
  // on an unloaded menu looked like a dead click. Ask for the menu and always render something.
  useEffect(()=>{ if (!i && rid) app.loadMenu(rid); },[rid, iid]);
  if (!i) return <Sheet title="Loading…" onClose={app.closeSheet}>
    <div className="c-col" style={{gap:10,alignItems:'center',padding:'24px 0'}}>
      <Ic n="refresh" s={26} className="c-sync"/>
      <b>{app.menuOf(rid) ? 'That dish is no longer on this menu' : 'Fetching the menu…'}</b>
      <div className="muted" style={{fontSize:13.5,textAlign:'center',maxWidth:280}}>{app.menuOf(rid)
        ? 'The restaurant may have changed it. Close this and pick another dish.'
        : 'This restaurant\u2019s menu is loading for the first time.'}</div>
      <CBtn onClick={app.closeSheet}>Close</CBtn>
    </div></Sheet>;
  const os = app.openState(r);
  const opts = (i.options||[]).flatMap((g,gi)=>sel[gi].map(ci=>g.choices[ci]));
  const missing = (i.options||[]).find((g,gi)=>g.required && !sel[gi].length);
  const unit = i.price_etb + opts.reduce((x,o)=>x+o.price_delta_etb,0);
  const pick = (gi, ci) => setSel(s=>{ const g = i.options[gi]; const cur = s[gi]; if ((g.max||1)===1) return {...s, [gi]:[ci]}; return {...s, [gi]: cur.includes(ci) ? cur.filter(x=>x!==ci) : cur.length>=g.max ? cur : [...cur, ci]}; });
  const reason = !r.is_active ? 'Restaurant is not accepting orders' : missing ? `Choose ${missing.group.toLowerCase()} first` : null;
  return <Sheet title="" onClose={app.closeSheet} tall footer={<div className="c-row" style={{gap:10,alignItems:'flex-start'}}><div className="k-step"><button onClick={()=>setQty(Math.max(1,qty-1))} aria-label="Less">−</button><span>{qty}</span><button onClick={()=>setQty(qty+1)} aria-label="More">+</button></div>
    <div style={{flex:1}}><BigBtn disabled={reason} onClick={()=>{ if (app.addToCart(rid, i, qty, opts, note.trim())) app.closeSheet(); }}>{`Add ${qty} · ${fmtN(unit*qty)} ETB`}</BigBtn></div></div>}>
    <div style={{margin:'-8px -16px 12px',position:'relative'}}><Ph name={i.name} h={220} img={i.image} sample={i.photo_license==='scraped'} cap="dish photo"/></div>
    <h2 className="c-h1">{L(i.name, i.name_am)}</h2>{i.name_am && app.lang!=='am' && <div className="muted">{i.name_am}</div>}
    <div className="c-row" style={{gap:6,margin:'8px 0',flexWrap:'wrap'}}><span className="mono b" style={{fontSize:18}}>{fmtETB(i.price_etb)}</span>{i.fasting && <FastTag/>}<Spice n={i.spice_level}/>{i.tags.filter(t=>t!=='vegan').map(t=><Pill key={t} tone="slate" dot={false}>{t}</Pill>)}</div>
    <p className="muted" style={{margin:'0 0 12px',fontSize:15}}>{i.description}</p>
    {!os.open && r.is_active && <div className="c-alert amber" style={{marginBottom:12}}><div className="body">{os.label}. You can add it and schedule at checkout.</div></div>}
    {(i.options||[]).map((g,gi)=><div key={gi} style={{marginBottom:14}}><div className="c-row"><b style={{flex:1,fontSize:16}}>{L(g.group, g.group_am)}</b>{g.required ? <Pill tone={sel[gi].length?'green':'amber'} dot={false}>{sel[gi].length?'✓ Chosen':'Required'}</Pill> : <span className="muted" style={{fontSize:13}}>Optional · up to {g.max}</span>}</div>
      {g.choices.map((c,ci)=>{ const on = sel[gi].includes(ci); return <div key={ci} className={cx('k-opt', on&&'on')} onClick={()=>pick(gi,ci)} role={(g.max||1)===1?'radio':'checkbox'} aria-checked={on}><span className={cx('r', (g.max||1)>1&&'sq')}>{on && <Ic n="check" s={14} w={3}/>}</span><span style={{flex:1}}>{c.name}</span><span className="mono muted">{c.price_delta_etb?`+${c.price_delta_etb} ETB`:''}</span></div>; })}</div>)}
    <div className="c-col" style={{gap:6}}><b>Special instructions</b><textarea className="c-input" style={{height:80,padding:12,fontSize:15,resize:'none'}} value={note} onChange={e=>setNote(e.target.value)} placeholder="Less spicy, extra injera…"/></div>
  </Sheet>;
}

Object.assign(window, { OtpBoxes, Ph, useL, PriceLevel, Spice, FastTag, Stars2, RestCard, HomeK, SearchK, RestaurantK, ItemSheet });
