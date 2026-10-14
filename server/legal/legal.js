/* Legal pages (/terms/, /privacy/, /community-guidelines/): document language ru / uk / en.
   Loaded in <head> so the language is chosen before the page renders: ?lang= in the address, then the choice made here
   (vc_legal_lang), then the app language (vc_lang), then the browser. Without JavaScript all three versions are shown. */
(function () {
  var LANGS = ['ru', 'uk', 'en'], root = document.documentElement;
  function norm(v) { v = String(v || '').toLowerCase().split(/[-_]/)[0]; if (v === 'ua') v = 'uk'; return LANGS.indexOf(v) >= 0 ? v : ''; }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function pick() {
    var m = /[?&]lang=([A-Za-z_-]+)/.exec(location.search), v = m && norm(m[1]);
    if (v) return v;
    m = /^#(?:doc-)?(ru|uk|en)(?:-|$)/.exec(location.hash);
    if (m) return m[1];
    v = norm(read('vc_legal_lang')) || norm(read('vc_lang'));
    if (v) return v;
    m = /(?:^|;\s*)vc_lang=([^;]+)/.exec(document.cookie);
    v = m && norm(decodeURIComponent(m[1]));
    if (v) return v;
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var n = String(list[i] || '').toLowerCase().split(/[-_]/)[0];
      if (n === 'uk' || n === 'ru') return n;
      if (n === 'be' || n === 'kk') return 'ru';
    }
    return list[0] ? 'en' : 'ru';
  }
  var lang = pick();
  root.className += (root.className ? ' ' : '') + 'js';
  root.setAttribute('data-lang', lang);
  root.lang = lang;
  function apply(l, remember) {
    lang = l;
    root.setAttribute('data-lang', l);
    root.lang = l;
    var doc = document.getElementById('doc-' + l);
    if (doc && doc.getAttribute('data-title')) document.title = doc.getAttribute('data-title');
    var sel = document.getElementById('legal-lang');
    if (sel && sel.value !== l) sel.value = l;
    if (remember) {
      try { localStorage.setItem('vc_legal_lang', l); } catch (e) {}
      try { var u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState(null, '', u.pathname + u.search); } catch (e) {}
    }
  }
  /* A section link of another language (old #profile-types links, shared URLs) opens the same section of this one. */
  function followHash() {
    var id = decodeURIComponent(location.hash.slice(1)), el = id && document.getElementById(id);
    if (!el || id.indexOf('doc-') === 0) return;
    var keyed = el.closest('[data-key]'), doc = document.getElementById('doc-' + lang);
    if (!keyed || !doc || doc.contains(el)) return;
    var twin = doc.querySelector('[data-key="' + keyed.getAttribute('data-key') + '"]');
    if (twin) twin.scrollIntoView();
  }
  document.addEventListener('DOMContentLoaded', function () {
    var sel = document.getElementById('legal-lang');
    if (sel) sel.addEventListener('change', function () { apply(sel.value, true); window.scrollTo(0, 0); });
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
      var toc = document.querySelectorAll('details.toc');
      for (var i = 0; i < toc.length; i++) toc[i].open = false;
    }
    apply(lang, false);
    followHash();
  });
})();
