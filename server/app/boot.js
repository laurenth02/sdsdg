/* VibeCheck boot helper — deferred, runs BEFORE app.js (script order matters:
 * window._vcBootTimeout must be armed before app.js clears it on successful boot).
 * Extracted verbatim from the inline <script> at the end of app/index.php (SEC-001),
 * except: localized strings now come from the <script type="application/json"
 * id="vc-boot-copy"> data block (CSP-exempt), and the reload button uses
 * addEventListener instead of an inline onclick attribute. */
(function () {
  'use strict';

  var BC = {};
  try {
    var copyEl = document.getElementById('vc-boot-copy');
    if (copyEl) BC = JSON.parse(copyEl.textContent || '{}');
  } catch (e) { BC = {}; }
  function t(key, fallback) {
    return (typeof BC[key] === 'string' && BC[key]) ? BC[key] : fallback;
  }

  // Fallback: if app.js doesn't boot within 8s, show error + debug link
  window._vcBootTimeout = setTimeout(function () {
    var bs = document.getElementById('boot-screen');
    if (bs && bs.style.display !== 'none') {
      bs.innerHTML = '<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:12px">⚠</div><h2 style="font-size:18px;color:#ff6b85;margin-bottom:8px">'
        + t('load_failed', 'Не удалось загрузить')
        + '</h2><p style="font-size:13px;color:#8e87a0;margin-bottom:16px">'
        + t('check_console', 'Проверьте соединение и попробуйте снова')
        + '</p><p style="font-size:13px;color:#8e87a0;margin-bottom:16px">'
        + t('error_code', 'Код ошибки')
        + ': <b id="vc-boot-code">…</b></p><button id="vc-boot-reload" type="button" style="padding:10px 20px;border:0;border-radius:12px;background:linear-gradient(135deg,#ff3d68,#ff7a59);color:#fff;font-weight:700;cursor:pointer">'
        + t('reload', 'Обновить')
        + '</button> <button id="vc-boot-help" type="button" style="padding:10px 20px;border:1px solid rgba(255,255,255,.25);border-radius:12px;background:transparent;color:#fff;font-weight:700;cursor:pointer;margin-left:8px">'
        + t('help', 'Помощь')
        + '</button></div>';
      var bcc = document.getElementById('vc-boot-code');
      if (bcc) bcc.textContent = 'VC-BOOT-' + Date.now().toString(36).toUpperCase().slice(-6);
      var br = document.getElementById('vc-boot-reload');
      if (br) br.addEventListener('click', function () { location.reload(); });
      var bh = document.getElementById('vc-boot-help');
      if (bh) bh.addEventListener('click', function () { try { location.href = (location.pathname === '/' ? '/' : '/app/') + '#/settings'; } catch (e) {} });
    }
  }, 8000);

  // Register Service Worker. Updates wait until the user accepts, avoiding a
  // mixed old/new UI while a form or chat composer is open.
  if ('serviceWorker' in navigator) {
    var vcHadController = !!navigator.serviceWorker.controller;
    var vcUpdateRequested = false;
    var vcReloadingForUpdate = false;
    var vcLastUpdateCheck = 0;

    /* Updates stay unobtrusive: a waiting worker activates after every open
       VibeCheck tab is closed, so no prompt interrupts a chat or form. */
    function vcShowUpdate(reg) { return !!(reg && reg.waiting); }

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (vcReloadingForUpdate || (!vcHadController && !vcUpdateRequested)) return;
      vcReloadingForUpdate = true;
      window.location.reload();
    });

    window.addEventListener('load', function () {
      /* Hosts that serve the shell at "/" (Caddy rewrite + Service-Worker-Allowed: /) need a root scope. */
      navigator.serviceWorker.register('/app/sw.js', { scope: window.location.pathname === '/' ? '/' : '/app/', updateViaCache: 'none' })
        .then(function (reg) {
          if (reg.waiting) vcShowUpdate(reg);
          reg.addEventListener('updatefound', function () {
            var nw = reg.installing;
            if (nw) nw.addEventListener('statechange', function () {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                vcShowUpdate(reg);
              }
            });
          });

          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState !== 'visible') return;
            var now = Date.now();
            if (now - vcLastUpdateCheck < 60 * 60 * 1000) return;
            vcLastUpdateCheck = now;
            reg.update().catch(function () {});
          });
        })
        .catch(function (e) { console.warn('SW registration failed:', e); });
    });
  }
  // Push subscription change — re-subscribe
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function (ev) {
      if (ev.data && ev.data.type === 'pushsubscriptionchange') {
        window.dispatchEvent(new CustomEvent('push-subscription-change'));
      }
      if (ev.data && ev.data.type === 'navigate' && ev.data.url) {
        try {
          var target = new URL(ev.data.url, window.location.origin);
          var isShell = target.pathname === '/' || target.pathname === '/app/' || target.pathname === '/app/index.php';
          if (target.origin === window.location.origin && (target.pathname.indexOf('/app/') === 0 || target.pathname === '/')) {
            // Root-mode shell: stay on "/" — switch the hash in place, or open "/" with the push parameters (no /app/ redirect).
            if (window.location.pathname === '/' && isShell) {
              if (!target.search && target.hash) window.location.hash = target.hash;
              else window.location.href = '/' + target.search + target.hash;
            } else window.location.href = target.href;
          }
        } catch (e) {}
      }
    });
  }
  // beforeinstallprompt — capture for later use
  window._vcInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window._vcInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });
  window.addEventListener('appinstalled', function () {
    window._vcInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
})();
