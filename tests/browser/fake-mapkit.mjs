/* MapKit JS 假掉：攔 cdn.apple-mapkit.com，送一份只記錄呼叫的 mapkit。
 * 真的 MapKit JS 要一把開發者帳號簽的 JWT，測試裡沒有、也不該有。 */
const FAKE = `
window.__mk = { inits: [], maps: [] };
window.mapkit = {
  init: function (o) { __mk.inits.push(o); o.authorizationCallback(function (t) { __mk.token = t; }); },
  Coordinate: function (lat, lng) { this.latitude = lat; this.longitude = lng; },
  Map: function (el) { this.el = el; this.items = []; __mk.maps.push(this); el.setAttribute('data-fake-map', '1'); },
  MarkerAnnotation: function (c, o) { Object.assign(this, o); this.coordinate = c; this.listeners = {}; },
  Annotation: function (c, factory, o) { Object.assign(this, o); this.coordinate = c; this.el = factory(c, o); this.listeners = {}; },
  CoordinateSpan: function (lat, lng) { this.latitudeDelta = lat; this.longitudeDelta = lng; },
  CoordinateRegion: function (c, s) { this.center = c; this.span = s; },
  Style: function (o) { Object.assign(this, o); },
  PolylineOverlay: function (points, o) { this.points = points; Object.assign(this, o); }
};
mapkit.Map.prototype.showItems = function (a) { this.items = a; };
mapkit.Map.prototype.removeAnnotations = function (a) { this.items = (this.items || []).filter(function (x) { return a.indexOf(x) < 0; }); };
mapkit.Map.prototype.addEventListener = function (t, f) { (this.handlers = this.handlers || {})[t] = f; };
/* 假的投影：把 (26.5, 127.6) 放在地圖框的左上角，每度 2000px。 */
mapkit.Map.prototype.convertCoordinateToPointOnPage = function (c) {
  var r = this.el.getBoundingClientRect();
  return { x: r.left + (c.longitude - 127.6) * 2000, y: r.top + (26.5 - c.latitude) * 2000 };
};
mapkit.Map.prototype.convertPointOnPageToCoordinate = function (p) {
  var r = this.el.getBoundingClientRect();
  return new mapkit.Coordinate(26.5 - (p.y - r.top) / 2000, 127.6 + (p.x - r.left) / 2000);
};
mapkit.Map.prototype.addAnnotations = function (a) { this.items = (this.items || []).concat(a); };
mapkit.Map.prototype.addOverlays = function (o) { this.overlays = (this.overlays || []).concat(o); };
mapkit.Map.prototype.setRegionAnimated = function (r) { this.region = r; };
mapkit.Map.prototype.destroy = function () { this.destroyed = true; };
mapkit.MarkerAnnotation.prototype.addEventListener = function (t, f) { this.listeners[t] = f; };
function live() { return __mk.maps.filter(function (m) { return !m.destroyed; }).pop(); }
__mk.current = function () {
  var m = live();
  return m ? m.items.filter(function (a) { return !a.el; }).map(function (a) { return { glyph: a.glyphText, title: a.title, lat: a.coordinate.latitude, lng: a.coordinate.longitude, color: a.color }; }) : null;
};
__mk.lines = function () {
  var m = live();
  return (m && m.overlays || []).map(function (o) { return { points: o.points.map(function (c) { return [c.latitude, c.longitude]; }), dashed: !!(o.style.lineDash && o.style.lineDash.length), width: o.style.lineWidth, color: o.style.strokeColor, opacity: o.style.strokeOpacity }; });
};
__mk.labels = function () {
  var m = live();
  return (m && m.items || []).filter(function (a) { return a.el && a.el.className === 'map-leg'; }).map(function (a) { return { text: a.el.textContent, lat: a.coordinate.latitude, lng: a.coordinate.longitude }; });
};
__mk.chevrons = function () {
  var m = live();
  return (m && m.items || []).filter(function (a) { return a.el && a.el.className === 'map-chev'; }).map(function (a) {
    var p = m.convertCoordinateToPointOnPage(a.coordinate);
    return { x: p.x, y: p.y, turn: a.el.firstChild.style.transform };
  });
};
__mk.region = function () {
  var m = live(), r = m && m.region;   /* 地圖還沒掛上去：null，讓 expect.poll 繼續等（拋錯的話它不會重試） */
  return r ? { lat: r.center.latitude, lng: r.center.longitude, dLat: r.span.latitudeDelta } : null;
};
__mk.select = function (i) { live().items.filter(function (a) { return !a.el; })[i].listeners.select(); };
`;

export async function fakeMapKit(page) {
  const requests = [];
  await page.route('https://cdn.apple-mapkit.com/**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE });
  });
  return { requests };
}
