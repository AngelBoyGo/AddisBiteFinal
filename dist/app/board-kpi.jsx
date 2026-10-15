// Board KPI tiles + a reconciliation strip, split out so the arithmetic is visible rather than implied.
// The tiles deliberately overlap — an order can need action AND be awaiting approval — which is why they
// never summed to the lane cards. This states the lane arithmetic explicitly.
function KpiTilesB({filter, setFilter}){
  const app = useApp(); const {counts, available, visible, go} = app;
  const lane = k => visible.filter(o=>o.lane===k).length;
  const overlap = visible.filter(o=>o.lane==='action' && ['awaiting_ref','submitted','mismatch'].includes(o.pay.state)).length;
  const moneyT = visible.filter(o=>o.lane==='delivered' && !o.test).reduce((s,o)=>s+o.total,0);
  const T = [
    {id:'action',   l:'Needs action',     v:counts.action,   tone:'red',   icon:'alert',  s:'orders in the Action lane · oldest first'},
    {id:'new',      l:'Awaiting approval',v:counts.approval, tone:'amber', icon:'clock',  s:visible.filter(o=>o.lane==='new'&&!o.owner).length+' unclaimed · the New lane'},
    {id:'transit',  l:'In transit',       v:counts.transit,  tone:'blue',  icon:'bike',   s:visible.filter(o=>o.lane==='finding').length+' still finding courier'},
    {id:'delivered',l:'Delivered today',  v:counts.delivered,tone:'green', icon:'check',  s:fmtN(moneyT)+' ETB GMV'},
    {id:'float',    l:'Float available',  v:fmtN(available), unit:'ETB',   tone:'brand', icon:'wallet', s:fmtN(app.reserved)+' ETB reserved'},
  ];
  const LANES = [['new','new'],['payments','payments'],['finding','finding'],['transit','transit'],['delivered','delivered'],['action','action'],['closed','closed']];
  const parts = LANES.map(([k,l])=>[l, lane(k)]).filter(([,n])=>n>0);
  return <>
    <div className="kpis">{T.map(t=><button key={t.id} className={cx('kpi', filter===t.id&&'on')} onClick={()=> t.id==='float' ? go('money') : setFilter(filter===t.id?null:t.id)}
      aria-pressed={filter===t.id}>
      <span className="bar" style={{background: t.tone==='brand'?'var(--brand)':'var(--'+t.tone+'-dot)'}}/>
      <div className="l"><Icon n={t.icon} s={14} style={{color: t.tone==='brand'?'var(--brand)':'var(--'+t.tone+'-fg)'}}/>{t.l}</div>
      <div className="v">{t.v}{t.unit && <small>{t.unit}</small>}</div>
      <div className="s">{t.s}</div></button>)}</div>
    <div className="recon" data-tip="The tiles above are not sums of each other — that is why they never added up. This is the lane arithmetic the board is showing.">
      <Icon n="info" s={13}/>
      <span><b>{visible.length} orders on the board</b> = {parts.map(([l,n],i)=><span key={l} style={{display:'contents'}}>{i>0 && <span className="sep"> + </span>}<span className="mono">{n} {l}</span></span>)}</span>
      {overlap>0 && <span className="faint">· {overlap} action-lane orders are payments awaiting verification, so “Needs action” and “Payments to verify” deliberately overlap</span>}
    </div>
  </>;
}
Object.assign(window, { KpiTilesB });
