// Customer sign-up — GPS pinpointing, extracted so every branch is testable without a device.
// The map is a schematic of Addis (percent x/y), so real coordinates are converted into it, then the
// nearest sub-city centroid is read. A landmark stays required: GPS finds an area, never a gate.
window.ABGeo = (function(){
  // The 11 sub-city centroids, in the same x/y space the map uses.
  const CENTROIDS = {
    'Bole':{x:72,y:56}, 'Kirkos':{x:53,y:50}, 'Yeka':{x:67,y:22}, 'Arada':{x:47,y:31}, 'Lideta':{x:38,y:52},
    'Nifas Silk-Lafto':{x:44,y:70}, 'Kolfe Keranio':{x:17,y:46}, 'Gulele':{x:34,y:17}, 'Akaky Kaliti':{x:56,y:88},
    'Addis Ketema':{x:35,y:38}, 'Lemi Kura':{x:88,y:38},
  };
  const NEIGHBORHOOD = {'Bole':'Bole 22','Kirkos':'Kazanchis','Yeka':'Megenagna','Arada':'Piassa','Lideta':'Mexico',
    'Nifas Silk-Lafto':'Sarbet','Kolfe Keranio':'Ayer Tena','Gulele':'Shiro Meda','Akaky Kaliti':'Kality',
    'Addis Ketema':'Merkato','Lemi Kura':'Ayat'};
  // Beyond this the pin is outside Addis and ordering is refused.
  const OUTSIDE = p => p.x < 8 || p.x > 94 || p.y < 6 || p.y > 94;
  function nearestSub(p){
    let best = null, bestD = Infinity;
    Object.entries(CENTROIDS).forEach(([sub, c]) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bestD){ bestD = d; best = sub; } });
    return { sub_city: best, distance: bestD, neighborhood: NEIGHBORHOOD[best] };
  }
  // Convert a device fix into map space + sub-city, in one place, so the screen stays thin.
  function fromCoords(lat, lng){
    const to = window.ABBus && window.ABBus.latlngToXY ? window.ABBus.latlngToXY(lat, lng)
      : { x: (lng - 38.66) / 0.24 * 100, y: (9.08 - lat) / 0.17 * 100 };
    const pos = { x: Math.max(0, Math.min(100, to.x)), y: Math.max(0, Math.min(100, to.y)) };
    const near = nearestSub(pos);
    return { pos, ...near, outside: OUTSIDE(pos) };
  }
  // requestPosition returns a promise so the caller can render asking / ok / denied / unsupported
  // without nesting callbacks. `g` defaults to the real geolocation, so tests can pass a fake.
  function requestPosition(opts, g){
    const geo = g || (typeof navigator !== 'undefined' ? navigator.geolocation : null);
    return new Promise(resolve => {
      if (!geo) return resolve({ state:'unsupported' });
      let settled = false; const done = v => { if (!settled){ settled = true; resolve(v); } };
      const timer = setTimeout(() => done({ state:'timeout' }), (opts && opts.timeout) || 9000);
      geo.getCurrentPosition(
        p => { clearTimeout(timer); done({ state:'ok', accuracy: Math.round((p.coords && p.coords.accuracy) || 0), lat:p.coords.latitude, lng:p.coords.longitude }); },
        e => { clearTimeout(timer); const code = e && e.code; done({ state: code === 1 ? 'denied' : 'unavailable', code }); },
        opts || { enableHighAccuracy:true, timeout:8000, maximumAge:30000 });
    });
  }
  // One copy per state, used by the screen and asserted by the tests.
  const MESSAGE = {
    asking:      { tone:'info',  text:'Finding you…' },
    denied:      { tone:'amber', text:'We could not read your location (permission denied). Tap the map to place your pin instead — or allow location and try again.' },
    unavailable: { tone:'amber', text:'Your location is not available right now. Tap the map to place your pin instead.' },
    timeout:     { tone:'amber', text:'Location took too long. Tap the map to place your pin instead.' },
    unsupported: { tone:'amber', text:'This browser does not give us a location. Tap the map to place your pin.' },
    outside:     { tone:'red',   text:'That location is outside our delivery area. Move the pin into Addis Ababa.' },
    ok:          { tone:'green', text:'Pinpointed from GPS · check the pin and add a landmark.' },
  };
  return { CENTROIDS, NEIGHBORHOOD, OUTSIDE, nearestSub, fromCoords, requestPosition, MESSAGE };
})();
