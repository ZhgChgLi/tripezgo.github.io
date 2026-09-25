/* MapKit JS 假掉：攔 cdn.apple-mapkit.com，送一份只記錄呼叫的 mapkit。
 * 真的 MapKit JS 要一把開發者帳號簽的 JWT，測試裡沒有、也不該有。 */
const FAKE = `
window.__mk = { inits: [], maps: [] };
window.mapkit = {
  init: function (o) { __mk.inits.push(o); o.authorizationCallback(function (t) { __mk.token = t; }); },
  Coordinate: function (lat, lng) { this.latitude = lat; this.longitude = lng; },
  Map: function (el) { this.el = el; this.items = []; __mk.maps.push(this); el.setAttribute('data-fake-map', '1'); },
  MarkerAnnotation: function (c, o) { Object.assign(this, o); this.coordinate = c; this.listeners = {}; }
};
mapkit.Map.prototype.showItems = function (a) { this.items = a; };
mapkit.Map.prototype.destroy = function () { this.destroyed = true; };
mapkit.MarkerAnnotation.prototype.addEventListener = function (t, f) { this.listeners[t] = f; };
function live() { return __mk.maps.filter(function (m) { return !m.destroyed; }).pop(); }
__mk.current = function () {
  var m = live();
  return m ? m.items.map(function (a) { return { glyph: a.glyphText, title: a.title, lat: a.coordinate.latitude, lng: a.coordinate.longitude, color: a.color }; }) : null;
};
__mk.select = function (i) { live().items[i].listeners.select(); };
`;

export async function fakeMapKit(page) {
  const requests = [];
  await page.route('https://cdn.apple-mapkit.com/**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE });
  });
  return { requests };
}
