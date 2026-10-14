/* VibeCheck PWA — app.js (V2 SPA, from approved prototype vibecheck_final_v2)
// CSRF TOKEN MANAGEMENT (Added 2026-10-02)
var csrfToken=null,csrfExpiry=0,csrfPending=false,csrfQueue=[];
function getCSRF(cb){var now=Date.now();if(csrfToken&&csrfExpiry>now){cb(csrfToken);return;}csrfQueue.push(cb);if(csrfPending)return;csrfPending=true;fetch('/app/api.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'action=get_csrf_token',credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){csrfPending=false;if(d.ok&&d.token){csrfToken=d.token;csrfExpiry=now+43200000;var cbs=csrfQueue.slice();csrfQueue=[];cbs.forEach(function(c){c(csrfToken);});}else{csrfQueue.forEach(function(c){c(null);});csrfQueue=[];}}).catch(function(){csrfPending=false;csrfQueue.forEach(function(c){c(null);});csrfQueue=[];});}
function needsCSRF(a){return['register','upgrade_email','login','logout','change_password','card_checkout','crypto_invoice','update_profile','delete_account','profile_ext_set','send','send_sticker','send_photo','send_voice'].indexOf(a)!==-1;}
function addCSRF(body,token){if(!token)return body;if(body instanceof FormData){body.append('_csrf',token);return body;}if(typeof body==='string')return body+'&_csrf='+encodeURIComponent(token);return body;}

 * Layout: 3-pane (.left | .center | .right) + .bottom-nav on mobile.
 * Auth: cookie-based (vc_web_sess), same-origin with /app/api.php.
 * Router: hash-based. Boots from meta[name="vc-boot"].
 * ES5: var, + concatenation, function declarations.
 */
(function(){
'use strict';

/* ===== Global error handler — red banner at bottom ===== */
window.addEventListener('error', function(e){
  console.error('JS Error:', e.message, e.filename, e.lineno);
  if (e.filename && e.filename.indexOf(location.origin + '/') !== 0) return; // browser extensions (wallets) are not our errors
  showFatal('JS: ' + (e.message||'unknown') + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function(e){
  console.error('Unhandled:', e.reason);
  if (e.reason && /-extension:\/\//.test(e.reason.stack || '')) return;
  if (e.reason && e.reason.message) showFatal('Async: ' + e.reason.message);
});
function showFatal(msg){
  var d = document.getElementById('vc-fatal');
  if (!d){ d = document.createElement('div'); d.id='vc-fatal';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#3a1020;color:#ff6b85;padding:10px 14px;font-size:12px;font-family:monospace;z-index:99999;border-top:1px solid rgba(255,107,133,.4)';
    document.body.appendChild(d);
  }
  d.textContent = '\u26A0 ' + msg;
  d.style.display = 'block';
  clearTimeout(d._t); d._t = setTimeout(function(){ d.style.display='none'; }, 8000);
}

/* ===== State ===== */
var state = {
  uid: 0, lang: 'ru', theme: 'system', resolvedTheme: 'dark', me: null, auth: null, isGuest: false, authHeartbeatAt: 0, meLoading: null, meLoadFailed: false, smart: {}, cityCatalog: [], smartGuestStarting: false, smartFilterApplied: false,
  route: '/', routeQuery: null,
  deck: [], deckAll: [], deckIdx: 0, deckLoading: false, deckLoadError: false, deckSwiped: [], guestLikes: 0, deckActionBusy: false, deckSwipeCleanup: null,
  onlineDeck: null, onlineDeckLoading: false, onlineDeckError: false, onlineDeckSeq: 0, onlineDeckFetchedAt: 0,
  discoverFilter: {gender:'all',city:'all',ageMin:18,ageMax:80,dist:50,photo:false,online:false,interests:[]}, discoverMoreExpanded:false,
  deckStoryTimer: null, deckStoryIdx: 0, deckStoryPaused: false,
  chats: [], currentChat: null, chatPollTimer: null, chatSelfDestructTimer: null, chatLastMsgId: 0, chatSending: false, chatPollBusy: false, chatAutoScroll: true, chatNewBelow: 0,
  chatMeta: null, chatTypingTimer: null, chatLastTypingAt: 0,
  livePollTimer: null, livePollBusy: false, liveRefreshTimer: null, messageToastReady: false, messageToastSeen: {},
  socialToastReady: false, socialToastCounts: {likes:0,guests:0}, socialToastLastAt: {like:0,guest:0}, socialToastDay: '', socialToastDayCount: 0,
  notificationAudioContext: null, notificationSoundUnlocked: false, notificationSoundLastAt: 0, notifPrefs: {msg:true,like:true,guest:true,sound:true,sound_msg:true,sound_like:true,sound_guest:true}, profileInterestTimer: null, profileInterestSent: {},
  pendingCryptoTimer: null, pendingCryptoPolls: 0, pendingPurchaseResumeBusy: false,
  gifts: null, stickerPackAccess: {},
  activityTab: 'all', activitySeq: 0,
  profile: null, profileEdit: false, profileGateOpen: false, pendingLike: null, profileIntent: null, swipeCoachShown: false,
  profileDetail: null, profileDetailLoading: null, profileDetailReturn: '/', profileDetailPhoto: 0,
  pushSub: null, pushHydrated: false, pushSupported: ('serviceWorker' in navigator && 'PushManager' in window),
  installPrompt: null,
  filter: 'all',
  cryptoPacks: null, storeCatalogLoading: false, cryptoEnabled: false, cryptoProvider: 'legacy', cryptoChains: [], cryptoNetwork: 'usdt_trc20', storeCatalog: null, storePromo: null, storeServerOffset: 0, storePromoTimer: null, rescueOfferTimer: null,
  storeAttribution: null, storeVisitKey: '', storeCheckoutActive: null, storeCheckoutBusy: false,
  tosAccepted: null, tosPromise: null,
  accountRecoveryPromptOpen: false, accountRecoveryPromptShown: false, guestRecoveryNeeded: false,
  isWide: window.innerWidth >= 1100,
  isMed: window.innerWidth >= 768 && window.innerWidth < 1100,
  analyticsSession: '', analyticsSeen: {}
};
var VC_STORE_PACKS=[
  {vibes:350,eur:7,chats:1,messages:10,code:'starter'},
  {vibes:1050,eur:18,chats:3,messages:10,code:'plus'},
  {vibes:1750,eur:28,chats:5,messages:10,code:'popular'},
  {vibes:3500,eur:52,chats:10,messages:10,code:'max'}
];
function storePayPackCard(chats,eur,featured){return '<button type="button" class="store-pay-pack'+(featured?' is-featured':'')+'" aria-describedby="vc-pack-why" disabled aria-disabled="true"><span><strong>'+h(chatCountLabel(chats))+'</strong><small>€'+Number(eur||0).toFixed(2)+'</small></span></button>';}
var VC_GUEST_ACCESS_MARKER='vc_guest_access_marker';
document.addEventListener('pointerdown',unlockNotificationAudio,{once:true,passive:true});
document.addEventListener('keydown',unlockNotificationAudio,{once:true});
function readGuestAccessMarker(){try{return parseInt(localStorage.getItem(VC_GUEST_ACCESS_MARKER)||'0',10)||0;}catch(e){return 0;}}
function setGuestAccessMarker(uid){try{if(uid)localStorage.setItem(VC_GUEST_ACCESS_MARKER,String(parseInt(uid,10)||0));else localStorage.removeItem(VC_GUEST_ACCESS_MARKER);}catch(e){}}

/* ===== Helpers ===== */
function $(s, r){ return (r||document).querySelector(s); }
function $$(s, r){ return Array.from((r||document).querySelectorAll(s)); }
function el(tag, props, kids){
  var e = document.createElement(tag);
  if (props) for (var k in props){
    if (k === 'class') e.className = props[k];
    else if (k === 'html') e.innerHTML = props[k];
    else if (k === 'text') e.textContent = props[k];
    else if (k.indexOf('on') === 0 && typeof props[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), props[k]);
    else if (k === 'dataset') for (var d in props[k]) e.dataset[d] = props[k][d];
    else e.setAttribute(k, props[k]);
  }
  if (kids){ var arr = Array.isArray(kids) ? kids : [kids]; for (var i=0;i<arr.length;i++){ var c = arr[i]; if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); } }
  if (e.classList && e.classList.contains('lightbox')) setupDialogA11y(e);
  return e;
}
function setupDialogA11y(dialog){
  if(!dialog||dialog._a11yReady)return;dialog._a11yReady=true;
  var previous=document.activeElement;
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');if(!dialog.hasAttribute('aria-label'))dialog.setAttribute('aria-label',t('dialog','Диалог'));dialog.tabIndex=-1;
  var observer=window.MutationObserver?new MutationObserver(function(){if(!document.documentElement.contains(dialog)){observer.disconnect();if(previous&&previous.focus)previous.focus();}}):null;if(observer)observer.observe(document.body,{childList:true,subtree:true});
  dialog.addEventListener('keydown',function(e){
    if(e.key==='Escape'){e.preventDefault();if(dialog.parentNode)dialog.parentNode.removeChild(dialog);if(previous&&previous.focus)previous.focus();return;}
    if(e.key!=='Tab')return;
    var focusable=$$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',dialog).filter(function(x){return x.offsetParent!==null;});
    if(!focusable.length){e.preventDefault();dialog.focus();return;}
    var first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  setTimeout(function(){if(!dialog.parentNode)return;var first=dialog.querySelector('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])');(first||dialog).focus();},0);
}
function vcModal(opts){
  opts=opts||{};
  return new Promise(function(resolve){
    var previous=document.activeElement;
    var layer=el('div',{class:'vc-modal-layer '+(opts.tone?('tone-'+opts.tone):'')});
    var card=el('div',{class:'vc-modal-card',role:'dialog','aria-modal':'true','aria-label':opts.title||t('dialog','Диалог')});
    var icon=opts.iconHtml?'<div class="vc-modal-icon">'+opts.iconHtml+'</div>':(opts.icon?'<div class="vc-modal-icon">'+semanticGlassIcon(opts.icon,'vc-modal-glass-icon')+'</div>':'');
    var title=opts.title?'<h2>'+h(opts.title)+'</h2>':'';
    var text=opts.html?'<div class="vc-modal-copy">'+opts.html+'</div>':(opts.message?'<div class="vc-modal-copy">'+h(opts.message)+'</div>':'');
    var fields=Array.isArray(opts.fields)?opts.fields:[];
    var formHtml='';
    for(var i=0;i<fields.length;i++){
      var f=fields[i]||{},id='vc-modal-field-'+i,label=f.label?'<label for="'+id+'">'+h(f.label)+'</label>':'',common=' id="'+id+'" data-field="'+h(f.name||('field_'+i))+'"'+(f.required?' required':'')+(f.autocomplete?' autocomplete="'+h(f.autocomplete)+'"':'')+(f.maxlength?' maxlength="'+parseInt(f.maxlength,10)+'"':'')+(f.minlength?' minlength="'+parseInt(f.minlength,10)+'"':'')+(f.min!=null?' min="'+Number(f.min)+'"':'')+(f.max!=null?' max="'+Number(f.max)+'"':'')+(f.placeholder?' placeholder="'+h(f.placeholder)+'"':'');
      if(f.type==='textarea')formHtml+='<div class="vc-modal-field">'+label+'<textarea'+common+' rows="'+(parseInt(f.rows,10)||4)+'">'+h(f.value||'')+'</textarea></div>';
      else if(f.type==='select'){var oh='';for(var oi=0;oi<(f.options||[]).length;oi++){var o=f.options[oi],ov=typeof o==='object'?o.value:o,ol=typeof o==='object'?o.label:o;oh+='<option value="'+h(ov)+'"'+(String(ov)===String(f.value)?' selected':'')+'>'+h(ol)+'</option>';}formHtml+='<div class="vc-modal-field">'+label+'<select'+common+'>'+oh+'</select></div>';}
      else if(f.type==='password')formHtml+='<div class="vc-modal-field">'+label+'<div class="vc-modal-pass"><input type="password"'+common+' value="'+h(f.value||'')+'" aria-describedby="'+id+'-note"><button type="button" class="vc-modal-eye" data-reveal="'+id+'" aria-pressed="false" aria-label="'+h(t('show_password','Показать пароль'))+'">'+semanticGlassIcon('eye')+'</button></div><small class="vc-modal-note" id="'+id+'-note" data-hint="'+h(f.hint||'')+'" aria-live="polite">'+h(f.hint||'')+'</small></div>';
      else formHtml+='<div class="vc-modal-field">'+label+'<input type="'+h(f.type||'text')+'"'+common+' value="'+h(f.value||'')+'" aria-describedby="'+id+'-note"><small class="vc-modal-note" id="'+id+'-note" data-hint="'+h(f.hint||'')+'" aria-live="polite">'+h(f.hint||'')+'</small></div>';
    }
    var cancelText=opts.cancelText===false?'':(opts.cancelText||t('cancel','Отмена'));
    var confirmText=opts.confirmText||t('confirm','Подтвердить');
    card.innerHTML='<button type="button" class="vc-modal-x" aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close','vc-modal-close-icon')+'</button>'+icon+title+text+(formHtml?'<div class="vc-modal-fields">'+formHtml+'</div><div class="vc-modal-form-error" role="alert" hidden></div>':'')+'<div class="vc-modal-actions">'+(cancelText?'<button type="button" class="vc-modal-cancel">'+h(cancelText)+'</button>':'')+'<button type="button" class="vc-modal-confirm">'+h(confirmText)+'</button></div>';
    layer.appendChild(card);document.body.appendChild(layer);document.body.classList.add('vc-modal-open');
    var done=false;
    function close(value){if(done)return;done=true;if(layer.parentNode)layer.parentNode.removeChild(layer);if(!document.querySelector('.vc-modal-layer'))document.body.classList.remove('vc-modal-open');if(previous&&previous.focus)setTimeout(function(){previous.focus();},0);resolve(value);}
    function collect(){var out={};$$('[data-field]',card).forEach(function(x){out[x.dataset.field]=x.type==='checkbox'?!!x.checked:x.value;});return out;}
    var x=card.querySelector('.vc-modal-x'),cancel=card.querySelector('.vc-modal-cancel'),ok=card.querySelector('.vc-modal-confirm');
    if(x)x.addEventListener('click',function(){close(false);});if(cancel)cancel.addEventListener('click',function(){close(false);});
    var busy=false;
    function fieldNode(name){return name?card.querySelector('[data-field="'+String(name).replace(/[^A-Za-z0-9_-]/g,'')+'"]'):null;}
    function noteNode(n){return n&&n.id?card.querySelector('#'+n.id+'-note'):null;}
    function refreshNote(n){
      var box=noteNode(n);if(!box)return;
      var text=n._err||(n._caps?t('caps_lock_on','Включён Caps Lock'):'')||n._match||box.getAttribute('data-hint')||'';
      var kind=n._err?'bad':(n._caps?'warn':(n._match?(n._matchOk?'ok':'bad'):''));
      box.textContent=text;box.className='vc-modal-note'+(kind?' is-'+kind:'');
      if(n._err)n.setAttribute('aria-invalid','true');else n.removeAttribute('aria-invalid');
    }
    function setError(n,msg){if(!n)return;n._err=msg||'';refreshNote(n);if(msg&&!noteNode(n)&&n.reportValidity)n.reportValidity();}
    function showFormError(msg){var box=card.querySelector('.vc-modal-form-error');if(!box)return;box.textContent=msg||'';box.hidden=!msg;}
    function problem(n){
      var v=n.validity||{};
      if(v.valueMissing)return t('field_required','Заполните это поле');
      if(n.type==='email'&&(v.typeMismatch||v.patternMismatch))return t('login_err_bad_email','Неверный email');
      if(n.minLength>0&&n.value.length<n.minLength)return n.type==='password'?t('login_err_weak_password','Пароль слишком короткий'):t('field_too_short','Слишком короткое значение');
      return n.validationMessage||t('field_invalid','Проверьте значение');
    }
    function firstInvalid(){var list=$$('[data-field]',card);for(var i=0;i<list.length;i++){var n=list[i];if(n.type==='checkbox')continue;if(!n.checkValidity()||(n.minLength>0&&n.value&&n.value.length<n.minLength))return n;}return null;}
    async function submit(){
      if(busy)return;
      showFormError('');
      $$('[data-field]',card).forEach(function(n){if(n._err){n._err='';refreshNote(n);}});
      var bad=firstInvalid();
      if(bad){setError(bad,problem(bad));bad.focus();return;}
      var values=fields.length?collect():true;
      if(typeof opts.validate==='function'&&fields.length){
        var verdict=opts.validate(values);
        if(verdict){var vn=fieldNode(verdict.field);if(vn){setError(vn,verdict.message);vn.focus();}else showFormError(verdict.message);return;}
      }
      if(typeof opts.onSubmit==='function'){
        busy=true;ok.disabled=true;ok.setAttribute('aria-busy','true');
        var res=null;
        try{res=await opts.onSubmit(values);}catch(err){res={ok:false,message:t('network_error','Ошибка сети')};}
        busy=false;ok.disabled=false;ok.removeAttribute('aria-busy');
        if(!res||!res.ok){
          var tn=res&&res.field?fieldNode(res.field):null;
          if(tn){setError(tn,res.message||t('field_invalid','Проверьте значение'));tn.focus();}
          if(res&&res.formMessage)showFormError(res.formMessage);
          else if(!tn)showFormError((res&&res.message)||t('network_error','Ошибка сети'));
          return;
        }
      }
      close(values);
    }
    ok.addEventListener('click',submit);
    card.addEventListener('input',function(e){
      var n=e.target;if(!n||!n.getAttribute||!n.getAttribute('data-field'))return;
      if(n._err){n._err='';refreshNote(n);}
      showFormError('');
      fields.forEach(function(f){
        if(!f||!f.matchWith)return;
        var a=fieldNode(f.name),b=fieldNode(f.matchWith);
        if(!a||!b||(n!==a&&n!==b))return;
        if(!a.value)a._match='';
        else if(a.value===b.value){a._match=t('passwords_match','Пароли совпадают');a._matchOk=true;}
        else if(a.value.length>=b.value.length){a._match=t('passwords_mismatch','Пароли не совпадают');a._matchOk=false;}
        else a._match='';
        refreshNote(a);
      });
    });
    function capsState(e){var n=e.target;if(!n||n.type!=='password'||!e.getModifierState)return;var on=!!e.getModifierState('CapsLock');if(n._caps!==on){n._caps=on;refreshNote(n);}}
    card.addEventListener('keydown',capsState);card.addEventListener('keyup',capsState);
    card.addEventListener('click',function(e){
      var rb=e.target.closest?e.target.closest('[data-reveal]'):null;if(!rb)return;
      var pn=card.querySelector('#'+String(rb.getAttribute('data-reveal')).replace(/[^A-Za-z0-9_-]/g,''));if(!pn)return;
      var show=pn.type==='password';pn.type=show?'text':'password';
      rb.setAttribute('aria-pressed',show?'true':'false');rb.setAttribute('aria-label',t(show?'hide_password':'show_password',show?'Скрыть пароль':'Показать пароль'));pn.focus();
    });
    layer.addEventListener('click',function(e){if(e.target===layer&&opts.dismiss!==false)close(false);});
    card.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&opts.dismiss!==false){e.preventDefault();close(false);return;}
      if(e.key==='Tab'){var focusable=$$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',card).filter(function(n){return n.offsetParent!==null;});if(!focusable.length){e.preventDefault();card.focus();return;}var first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
      if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName!=='TEXTAREA'){e.preventDefault();ok.click();}
    });
    if(typeof opts.onReady==='function')opts.onReady(card,close);
    setTimeout(function(){var first=card.querySelector('input,textarea,select,.vc-modal-confirm');if(first)first.focus();},20);
  });
}
function vcConfirm(message,opts){opts=opts||{};opts.message=message;opts.icon=opts.icon||'';return vcModal(opts);}
function vcPrompt(message,value,opts){opts=opts||{};opts.message=message;opts.fields=[{name:'value',type:opts.type||'text',value:value||'',placeholder:opts.placeholder||'',required:opts.required!==false,min:opts.min,max:opts.max,maxlength:opts.maxlength}];return vcModal(opts).then(function(r){return r&&r.value!=null?r.value:false;});}
function vcNotice(title,message,tone){return vcModal({title:title,message:message,tone:tone||'success',icon:tone==='error'?'!':'✓',cancelText:false,confirmText:t('ok','Хорошо')});}
function vcPurchase(opts){
  opts=opts||{};var price=parseInt(opts.price,10)||0,balance=parseInt(state.me&&state.me.balance,10)||0,short=Math.max(0,price-balance);
  if(short)funnelTrack('paywall_view',{placement:opts.resume&&opts.resume.action||'purchase',price:price,balance:balance},String(opts.resume&&opts.resume.action||'purchase')+':'+price);
  var html='<div class="vc-purchase-summary"><div><span>'+h(t('will_be_charged','Будет списано'))+'</span><strong>'+vibeAmount(price)+'</strong></div><div><span>'+h(t('account_balance','Баланс аккаунта'))+'</span><strong>'+vibeAmount(balance)+'</strong></div>'+(short?'<div class="is-short"><span>'+h(t('missing','Не хватает'))+'</span><strong>'+vibeAmount(short)+'</strong></div>':'')+'</div><p class="vc-account-balance-note">'+h(t('account_balance_charge_note','Сначала используется баланс аккаунта. Нового списания с карты без вашего подтверждения не будет.'))+'</p>'+(opts.html||'');
  return vcModal({title:opts.title||t('confirm_purchase','Подтвердите покупку'),icon:opts.icon||'wallet',html:html,tone:short?'warning':(opts.tone||''),cancelText:opts.cancelText,confirmText:short?t('top_up','Пополнить баланс'):(opts.confirmText||t('buy','Купить'))}).then(function(ok){if(!ok)return false;if(typeof opts.onConfirm==='function'){try{opts.onConfirm({short:short,price:price,balance:balance});}catch(e){}}if(short){state.pendingPurchase=opts.retry||null;if(opts.resume){try{sessionStorage.setItem('vc_pending_purchase',JSON.stringify({action:opts.resume.action,data:opts.resume.data||{},route:opts.resume.route||state.route||'/',title:opts.resume.title||opts.title||t('purchase','Покупка'),at:Date.now(),uid:state.uid||0}));}catch(e){}}navigate('/store');return false;}return true;});
}
/* Direct payment chooser v2.  The legacy wallet-first implementation above
 * remains as a compatibility fallback in old bundles; this later declaration
 * is the active path for all current purchase surfaces. */
function vcPaymentMethodTitle(method){
  method=method||{};
  var brand=String(method.brand||'').trim(),last4=String(method.last4||'').trim();
  return (brand||t('bank_card','Банковская карта'))+(last4?' ···· '+last4:'');
}
function vcPaymentMethodState(){
  return authApi('payment_methods').then(function(r){return r&&r.ok?r:{ok:false,methods:[],card_enabled:false,crypto_enabled:false,crypto_networks:[]};}).catch(function(){return {ok:false,methods:[],card_enabled:false,crypto_enabled:false,crypto_networks:[]};});
}
function vcRememberPendingPurchase(opts){
  state.pendingPurchase=opts&&opts.retry||null;
  if(!opts||!opts.resume)return;
  try{sessionStorage.setItem('vc_pending_purchase',JSON.stringify({action:opts.resume.action,data:opts.resume.data||{},route:opts.resume.route||state.route||'/',title:opts.resume.title||opts.title||t('purchase','Покупка'),at:Date.now(),uid:state.uid||0}));}catch(e){}
}
function vcCheckoutIntentId(scope){
  scope=String(scope||'purchase').replace(/[^a-z0-9_-]+/gi,'_').slice(0,40);var key='vc_checkout_intent_'+scope,data=null;
  try{data=JSON.parse(sessionStorage.getItem(key)||'null');}catch(e){}
  if(!data||!data.id||Date.now()-(parseInt(data.at,10)||0)>30*60*1000){data={id:(window.crypto&&crypto.randomUUID?crypto.randomUUID():('pi_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14))),at:Date.now()};try{sessionStorage.setItem(key,JSON.stringify(data));}catch(e2){}}
  return data.id;
}
function vcClearCheckoutIntent(scope){
  scope=String(scope||'purchase').replace(/[^a-z0-9_-]+/gi,'_').slice(0,40);
  try{sessionStorage.removeItem('vc_checkout_intent_'+scope);}catch(e){}
}
function vcClearCryptoIntentKey(key){
  if(!key)return;
  try{sessionStorage.removeItem(String(key));}catch(e){}
}
function vcClearCheckoutIntents(pending){
  // PAY-002: a terminal purchase status retires its idempotency intents, so the
  // next attempt mints a fresh invoice instead of reusing a closed one.
  if(pending&&pending.intent_scope)vcClearCheckoutIntent(pending.intent_scope);
  if(pending&&pending.intent_key2)vcClearCryptoIntentKey(pending.intent_key2);
}
function vcClearPendingPurchase(){
  state.pendingPurchase=null;
  try{sessionStorage.removeItem('vc_pending_purchase');}catch(e){}
}
function vcOpenCryptoProvider(invoice,extra){
  if(invoice&&invoice.provider==='direct'){showDirectInvoice(invoice,extra||{});return true;}
  if(!invoice||!invoice.payment_url)return false;
  state.storeCheckoutActive={stage:'provider_opened',pid:parseInt(invoice.pid||0,10)||0,provider:'cryptomus',started_at:Math.floor(Date.now()/1000)};
  funnelTrack('provider_opened',storeSignalContext({provider:'cryptomus',payment_id:parseInt(invoice.pid||0,10)||0,order_id:invoice.order_public_id||''}),'provider:'+(parseInt(invoice.pid||0,10)||0));
  var pendingRec={pid:invoice.pid,at:Date.now(),expires_at:parseInt(invoice.expires_at,10)||0,coins:parseInt(invoice.effective_coins||invoice.coins,10)||0,fulfillment:String(invoice.fulfillment||''),chat_count:parseInt(invoice.chat_count,10)||0};
  if(extra&&extra.intent_scope)pendingRec.intent_scope=extra.intent_scope;
  if(extra&&extra.intent_key2)pendingRec.intent_key2=extra.intent_key2;
  try{sessionStorage.setItem('vc_pending_crypto_payment',JSON.stringify(pendingRec));}catch(e){}
  window.location.href=invoice.payment_url;
  return true;
}
async function vcStartCryptoCheckout(opts,payment,network){
  var packId=parseInt(opts.cryptoPackId,10)||0;if(!packId)return false;
  if(guestNeedsProfileGate()){showGuestProfileGate(null,function(){vcPurchase(opts);},{action:'purchase'});return false;}
  vcRememberPendingPurchase(opts);
  var accepted=await ensureTosAccepted();if(!accepted)return false;
  var profileId=parseInt(opts.profileId||(opts.resume&&opts.resume.data&&opts.resume.data.virtual),10)||0;
  var cryptoScope='crypto_'+packId+'_'+profileId+'_'+(network||'usdt_trc20')+'_'+(opts.promoId||'');
  var intentId=vcCheckoutIntentId(cryptoScope);
  state.storeCheckoutBusy=true;
  try{
    var r=await authApi('crypto_invoice',{pack_id:packId,network:network||'usdt_trc20',promo_id:opts.promoId||'',profile_id:profileId,intent_id:intentId});
    state.storeCheckoutBusy=false;
    if(r&&r.ok){funnelTrack('checkout_started',{provider:'crypto',pack_id:packId,profile_id:profileId});return vcOpenCryptoProvider(r,{intent_scope:cryptoScope});}
    if(r&&r.err==='profile_required'){showGuestProfileGate(null,function(){vcPurchase(opts);},{action:'purchase'});return false;}
    if(r&&r.err==='invoice_closed')vcClearCheckoutIntent(cryptoScope);
    vcClearPendingPurchase();toast(localizedErrorText(r&&r.err,t('store_pay_unavailable','Оплата временно недоступна')),'error');return false;
  }catch(e){state.storeCheckoutBusy=false;vcClearPendingPurchase();toast(t('network_error','Ошибка сети'),'error');return false;}
}
async function vcPurchase(opts){
  opts=opts||{};
  var price=parseInt(opts.price,10)||0,balance=parseInt(state.me&&state.me.balance,10)||0,short=Math.max(0,price-balance);
  if(!price)return false;
  if(short)funnelTrack('paywall_view',{placement:opts.resume&&opts.resume.action||'purchase',price:price,balance:balance},String(opts.resume&&opts.resume.action||'purchase')+':'+price);
  var payment=await vcPaymentMethodState(),methods=Array.isArray(payment.methods)?payment.methods.filter(function(method){return String(method.type||'card')==='card';}):[],choices=[];
  if(opts.wallet!==false&&balance>=price)choices.push({value:'wallet',label:t('account_balance','Баланс аккаунта')+' · '+vibeAmount(price)});
  if(payment.card_enabled&&opts.cardIntent)methods.forEach(function(method){choices.push({value:'card:'+parseInt(method.id,10),label:vcPaymentMethodTitle(method)+(method.is_default?' · '+t('default_method','По умолчанию'):'')});});
  var cryptoNetworks=Array.isArray(payment.crypto_networks)?payment.crypto_networks:[];
  if(payment.crypto_enabled&&parseInt(opts.cryptoPackId,10)>0)choices.push({value:'crypto',label:t('crypto_checkout','Криптовалюта')});
  if(payment.test_enabled&&parseInt(opts.cryptoPackId,10)>0)choices.push({value:'test',label:t('test_payment_method','Тестовая оплата · без списания денег')});
  var savedRows=(payment.card_enabled?methods:[]).map(function(method){
    var exp=method.exp_month&&method.exp_year?(' · '+String(method.exp_month).padStart(2,'0')+'/'+String(method.exp_year).slice(-2)):'';
    return '<div class="vc-payment-method-row"><span class="vc-payment-method-icon">'+glassIcon('wallet')+'</span><span><strong>'+h(vcPaymentMethodTitle(method))+'</strong><small>'+h(exp||t('saved_payment_method','Сохранённый способ оплаты'))+'</small></span><em>'+h(t('saved','Сохранено'))+'</em></div>';
  }).join('');
  var summary='<div class="vc-purchase-summary"><div><span>'+h(t('will_be_charged','Будет списано'))+'</span><strong>'+vibeAmount(price)+'</strong></div>'+(opts.wallet===false?'':'<div><span>'+h(t('account_balance','Баланс аккаунта'))+'</span><strong>'+vibeAmount(balance)+'</strong></div>')+(short&&opts.wallet!==false?'<div class="is-short"><span>'+h(t('missing','Не хватает'))+'</span><strong>'+vibeAmount(short)+'</strong></div>':'')+'</div>'+(opts.html||'');
  if(!choices.length){await vcModal({title:opts.title||t('confirm_purchase','Подтвердите покупку'),icon:opts.icon||'wallet',html:summary+'<p class="vc-payment-no-balance">'+h(t('payment_methods_unavailable','Подключённые способы оплаты временно недоступны. Покупка не создана и списания не было.'))+'</p>',tone:'warning',cancelText:false,confirmText:t('close','Закрыть')});return false;}
  var fields=[{name:'payment_method',type:'select',label:t('store_payment_choice','Выберите способ оплаты'),options:choices,value:choices[0].value}];
  if(choices.some(function(choice){return choice.value==='crypto';})&&cryptoNetworks.length>1)fields.push({name:'crypto_network',type:'select',label:t('crypto_choose_network','Сеть оплаты'),options:cryptoNetworks.map(function(network){return {value:network.key,label:network.label};}),value:String(cryptoNetworks[0].key||'')});
  var html=summary+(savedRows?'<div class="vc-payment-method-list">'+savedRows+'</div>':'')+'<p class="vc-payment-security">'+glassIcon('lock')+' '+h(payment.security_copy||t('payment_security_copy','Данные карты хранятся у платёжного провайдера. Сайт хранит только токен и последние 4 цифры.'))+'</p>';
  var result=await vcModal({title:opts.title||t('confirm_purchase','Подтвердите покупку'),icon:opts.icon||'wallet',html:html,tone:short?'warning':(opts.tone||''),cancelText:opts.cancelText,confirmText:t('pay_now','Оплатить сейчас'),fields:fields});
  if(!result)return false;
  var selected=String(result.payment_method||'');
  if(selected==='wallet'){
    if(typeof opts.onConfirm==='function'){try{opts.onConfirm({short:short,price:price,balance:balance,method:'wallet'});}catch(e){}}
    return true;
  }
  if(selected.indexOf('card:')===0){
    if(typeof opts.onConfirm==='function'){try{opts.onConfirm({short:short,price:price,balance:balance,method:'card'});}catch(e){}}
    vcRememberPendingPurchase(opts);
    var methodId=parseInt(selected.split(':')[1],10)||0,cardScope='card_'+String(opts.resume&&opts.resume.action||'purchase')+'_'+methodId,intentId=vcCheckoutIntentId(cardScope);
    try{
      var cardResult=await authApi('payment_card_checkout',{method_id:methodId,intent_id:intentId,purchase:JSON.stringify(opts.cardIntent||{})});
      if(cardResult&&cardResult.ok&&(cardResult.status==='paid'||cardResult.paid)){vcClearCheckoutIntent(cardScope);await resumePendingPurchase({paymentConfirmed:true,provider:'card'});return false;}
      if(cardResult&&cardResult.ok&&cardResult.action_url){window.location.href=cardResult.action_url;return false;}
      if(cardResult&&cardResult.ok&&cardResult.status==='pending'){toast(t('payment_processing','Платёж обрабатывается'));return false;}
      vcClearPendingPurchase();toast(localizedErrorText(cardResult&&cardResult.err,t('payment_failed','Платёж не прошёл')),'error');return false;
    }catch(e){vcClearPendingPurchase();toast(t('network_error','Ошибка сети'),'error');return false;}
  }
  if(selected==='test'){
    if(guestNeedsProfileGate()){showGuestProfileGate(null,function(){vcPurchase(opts);},{action:'purchase'});return false;}
    if(typeof opts.onConfirm==='function'){try{opts.onConfirm({short:short,price:price,balance:balance,method:'test'});}catch(e){}}
    vcRememberPendingPurchase(opts);
    var testResult=await vcTestCheckout({pack_id:parseInt(opts.cryptoPackId,10)||0,profile_id:parseInt(opts.profileId||(opts.resume&&opts.resume.data&&opts.resume.data.virtual),10)||0},{silent:true});
    if(testResult&&testResult.ok){await resumePendingPurchase({paymentConfirmed:true,provider:'test'});return false;}
    vcClearPendingPurchase();return false;
  }
  if(selected==='crypto'){
    if(typeof opts.onConfirm==='function'){try{opts.onConfirm({short:short,price:price,balance:balance,method:'crypto'});}catch(e){}}
    return vcStartCryptoCheckout(opts,payment,String(result.crypto_network||(cryptoNetworks[0]&&cryptoNetworks[0].key)||'usdt_trc20'));
  }
  return false;
}
function openQuickBuy(r,retry){
  var balance=parseInt(state.me&&state.me.balance,10)||0,need=parseInt(r&&r.need,10)||0,missing=need>balance?need-balance:need;
  state.pendingPurchase=typeof retry==='function'?retry:null;
  return vcModal({title:t('not_enough_vibes','Недостаточно средств на балансе'),icon:'wallet',tone:'warning',html:'<div class="vc-purchase-summary"><div><span>'+h(t('account_balance','Баланс аккаунта'))+'</span><strong>'+vibeAmount(balance)+'</strong></div><div class="is-short"><span>'+h(t('missing','Не хватает'))+'</span><strong>'+vibeAmount(Math.max(1,missing))+'</strong></div></div><p>'+h(t('quick_buy_copy','Выберите подходящий пакет. После оплаты вернитесь к действию — выбранный профиль и покупка сохранятся.'))+'</p>',cancelText:t('later','Позже'),confirmText:t('open_store','Перейти к оплате')}).then(function(ok){if(ok)navigate('/store');return true;});
}
function resumePendingPurchase(options){
  options=options||{};if(state.pendingPurchaseResumeBusy)return Promise.resolve(false);
  var pending=null;try{pending=JSON.parse(sessionStorage.getItem('vc_pending_purchase')||'null');}catch(e){}if(!pending||!pending.action||!pending.at)return Promise.resolve(false);if(Date.now()-pending.at>2*60*60*1000){vcClearPendingPurchase();return Promise.resolve(false);}
  if(!pending.uid||pending.uid!==(state.uid||0)){vcClearPendingPurchase();return Promise.resolve(false);}
  state.pendingPurchaseResumeBusy=true;
  return vcConfirm(pending.title||t('purchase','Покупка'),{title:t('confirm_purchase','Подтвердите покупку'),confirmText:t('buy','Купить'),cancelText:t('later','Позже')}).then(function(okGo){
  if(!okGo){state.pendingPurchaseResumeBusy=false;vcClearPendingPurchase();return false;}
  if(pending.route)navigate(pending.route);
  return api(pending.action,pending.data||{}).then(function(r){
    if(!r||!r.ok){state.pendingPurchaseResumeBusy=false;if(r&&(r.err==='low_balance'||r.err==='insufficient'||r.err==='insufficient_balance'))return false;vcClearPendingPurchase();handleApiError(r,'Error');return false;}
    vcClearPendingPurchase();if(pending.action==='send'&&pending.data&&pending.data.virtual)clearChatDraft(pending.data.virtual);
    return loadMe().then(function(){renderTopbar();if(pending.route)navigate(pending.route);setTimeout(router,30);var message=pending.action==='send'?t('payment_message_sent','Оплата прошла, сохранённое сообщение отправлено автоматически.'):(pending.title||t('done','Готово'));return vcNotice(t('payment_success','Оплата прошла успешно'),message,'success');}).then(function(){state.pendingPurchaseResumeBusy=false;return true;});
  }).catch(function(){state.pendingPurchaseResumeBusy=false;return false;});
  });
}
function t(key, fallback, num){ var s = window.t ? window.t(key, null, num) : key; var known=window.I18N&&typeof window.I18N.has==='function'&&window.I18N.has(key); if (s === key && fallback != null && !known) return fallback; return s; }
function legalUrl(doc){
  var urls={tos:'/terms/',privacy:'/privacy/','community-guidelines':'/community-guidelines/','eu-terms':'/terms-for-eu-residents/','withdrawal-eu':'/right-of-withdrawal-for-eu-residents/','privacy-gdpr':'/privacy-gdpr/'};
  if(urls[doc])return urls[doc];
  var lang=String(state.lang||'ru').slice(0,2),base='/operator/'+doc;
  return base+(lang==='uk'?'':(lang==='ru'?'.ru':'.en'))+'.html';
}
function findProfileById(id){
  id=parseInt(id,10)||0;if(!id)return null;
  var direct=state.profileDetail;if(direct&&parseInt(direct.id||direct.user_id,10)===id)return direct;
  var groups=[state.deck,state.deckAll,state.onlineDeck,state.chats,state.me&&state.me.virtuals,state.me&&state.me.inbox];
  for(var g=0;g<groups.length;g++){var arr=groups[g]||[];for(var i=0;i<arr.length;i++){var p=arr[i]||{};if(parseInt(p.id||p.user_id||p.peer_id,10)===id)return p;}}
  return null;
}
var VC_VIBE_SCALE_BASE=[5,10,25,50,100,250,350,500,750,1000,2500,5000,7500,10000];
function vcVibeScaleData(min,max,value){
  min=Math.max(1,parseInt(min,10)||1);max=Math.max(min,parseInt(max,10)||10000);value=Math.max(min,Math.min(max,parseInt(value,10)||min));
  var values=VC_VIBE_SCALE_BASE.filter(function(v){return v>=min&&v<=max;});
  if(values.indexOf(min)<0)values.push(min);if(values.indexOf(max)<0)values.push(max);if(values.indexOf(value)<0)values.push(value);
  values.sort(function(a,b){return a-b;});var index=0,best=Infinity;for(var i=0;i<values.length;i++){var d=Math.abs(values[i]-value);if(d<best){best=d;index=i;}}
  return {values:values,index:index,min:min,max:max};
}
function vcVibeScaleHtml(id,scale,detail){
  var majors=[scale.min,50,250,1000,5000,scale.max],seen={},ticks='';
  for(var i=0;i<majors.length;i++){var amount=majors[i];if(amount<scale.min||amount>scale.max||seen[amount])continue;seen[amount]=1;var idx=scale.values.indexOf(amount);if(idx<0)continue;ticks+='<button type="button" data-vc-vibe-index="'+idx+'">'+vibeAmount(amount)+'</button>';}
  return '<div class="vc-vibe-scale" id="'+h(id)+'"><div class="vc-vibe-scale-value"><span>'+h(t('selected_amount','Выбрано'))+'</span><strong data-vc-vibe-amount>'+vibeAmount(scale.values[scale.index])+'</strong></div><p data-vc-vibe-detail>'+h(detail||'')+'</p><div class="vc-vibe-scale-ticks" aria-hidden="true">'+ticks+'</div></div>';
}
function vcWireVibeScale(card,id,scale,detailFn){
  var host=card.querySelector('#'+id),input=card.querySelector('[data-field="amount"]');if(!host||!input)return;
  var amountNode=host.querySelector('[data-vc-vibe-amount]'),detailNode=host.querySelector('[data-vc-vibe-detail]');
  function render(){var idx=Math.max(0,Math.min(scale.values.length-1,parseInt(input.value,10)||0)),amount=scale.values[idx];if(amountNode)amountNode.textContent=vibeAmount(amount);if(detailNode&&typeof detailFn==='function')detailNode.textContent=detailFn(amount);$$('[data-vc-vibe-index]',host).forEach(function(btn){btn.classList.toggle('is-active',parseInt(btn.dataset.vcVibeIndex,10)===idx);});}
  input.addEventListener('input',render);input.addEventListener('change',render);$$('[data-vc-vibe-index]',host).forEach(function(btn){btn.addEventListener('click',function(){input.value=btn.dataset.vcVibeIndex;input.dispatchEvent(new Event('input',{bubbles:true}));});});render();
}
function h(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var PROFILE_NAME_EN={'алена':'Alena','аліна':'Alina','анастасія':'Anastasiia','андрій':'Andrii','анна':'Anna','богдана':'Bohdana','божена':'Bozhena','василина':'Vasylyna','вероніка':'Veronika','вікторія':'Viktoriia','гість':'Guest','гостя':'Guest',"дар'я":'Daria','дмитрий':'Dmitry','дмитро':'Dmytro','емілія':'Emiliia','єва':'Yeva','злата':'Zlata','зоряна':'Zoriana','іван':'Ivan','ірина':'Iryna','катерина':'Kateryna','ксенія':'Kseniia','максим':'Maksym','маргарита':'Marharyta','марія':'Mariia','мила':'Mila','мілана':'Milana','наталія':'Nataliia','нікіта':'Nikita','оксана':'Oksana','олег':'Oleh','олена':'Olena','орися':'Orysia','пепа':'Pepa','поліна':'Polina','саша':'Sasha','соломія':'Solomiia','софія':'Sofiia','уляна':'Uliana','юлія':'Yuliia','ярина':'Yaryna'};
var PROFILE_CITY_EN={'харків':'Kharkiv','харьков':'Kharkiv','київ':'Kyiv','киев':'Kyiv','одеса':'Odesa','одесса':'Odesa','львів':'Lviv','львов':'Lviv','дніпро':'Dnipro','днепр':'Dnipro','вінниця':'Vinnytsia','винница':'Vinnytsia','запоріжжя':'Zaporizhzhia','запорожье':'Zaporizhzhia','україна':'Ukraine','украина':'Ukraine'};
var PROFILE_INTEREST_EN={'фітнес':'Fitness','фитнес':'Fitness','спорт':'Sports','музика':'Music','музыка':'Music','подорожі':'Travel','путешествия':'Travel','книги':'Books','кава':'Coffee','кофе':'Coffee','фотографія':'Photography','фотография':'Photography','фото':'Photography','кіно':'Movies','кино':'Movies','йога':'Yoga','мистецтво':'Art','искусство':'Art','море':'Sea','кулінарія':'Cooking','кулинария':'Cooking','гори':'Mountains','горы':'Mountains','тварини':'Animals','животные':'Animals',"кав'ярні":'Cafés','кофейни':'Cafés','медицина':'Medicine','біг':'Running','бег':'Running','література':'Literature','литература':'Literature','малювання':'Drawing','рисование':'Drawing','маркетинг':'Marketing','сноуборд':'Snowboarding','архітектура':'Architecture','архитектура':'Architecture','джаз':'Jazz','танці':'Dancing','танцы':'Dancing','мови':'Languages','языки':'Languages','вино':'Wine','театр':'Theater','психологія':'Psychology','психология':'Psychology','фортепіано':'Piano','фортепиано':'Piano','історія':'History','история':'History','серфінг':'Surfing','серфинг':'Surfing','шоколад':'Chocolate','природа':'Nature','ігри':'Games','игры':'Games','дизайн':'Design','право':'Law','клуби':'Clubs','клубы':'Clubs','діти':'Children','дети':'Children','прогулянки':'Walks','прогулки':'Walks','журналістика':'Journalism','журналистика':'Journalism','альтернативний рок':'Alternative rock','альтернативный рок':'Alternative rock'};
var PROFILE_VALUE_EN={'учитель':'Teacher','учителька':'Teacher','студент':'Student','студентка':'Student','домохозяйка':'Homemaker','домогосподарка':'Homemaker','архитектор':'Architect','архітектор':'Architect','адвокат':'Lawyer','альтернативний рок':'Alternative rock','альтернативный рок':'Alternative rock','туса':'Party mood'};
var PROFILE_NAME_UK={'алена':'Олена','елена':'Олена','евгения':'Євгенія','ева':'Єва',"дарья":"Дар'я",'дмитрий':'Дмитро','иван':'Іван','ирина':'Ірина','ксения':'Ксенія','мария':'Марія','наталья':'Наталія','никита':'Микита','полина':'Поліна','софия':'Софія','ульяна':'Уляна','юлия':'Юлія'};
var PROFILE_CITY_UK={'харків':'Харків','харьков':'Харків','київ':'Київ','киев':'Київ','одеса':'Одеса','одесса':'Одеса','львів':'Львів','львов':'Львів','дніпро':'Дніпро','днепр':'Дніпро','вінниця':'Вінниця','винница':'Вінниця','запоріжжя':'Запоріжжя','запорожье':'Запоріжжя','україна':'Україна','украина':'Україна'};
var PROFILE_INTEREST_UK={'фитнес':'Фітнес','музыка':'Музика','путешествия':'Подорожі','кофе':'Кава','фотография':'Фотографія','кино':'Кіно','искусство':'Мистецтво','кулинария':'Кулінарія','горы':'Гори','животные':'Тварини','кофейни':"Кав'ярні",'бег':'Біг','литература':'Література','рисование':'Малювання','архитектура':'Архітектура','танцы':'Танці','языки':'Мови','психология':'Психологія','фортепиано':'Фортепіано','история':'Історія','серфинг':'Серфінг','игры':'Ігри','клубы':'Клуби','дети':'Діти','прогулки':'Прогулянки','журналистика':'Журналістика','альтернативный рок':'Альтернативний рок'};
var PROFILE_VALUE_UK={'учитель':'Учитель','учительница':'Учителька','студентка':'Студентка','домохозяйка':'Домогосподарка','архитектор':'Архітектор','адвокат':'Адвокат','альтернативный рок':'Альтернативний рок','туса':'Вечірки'};
/* Some catalog values (feelings_data, occupations) are stored in Ukrainian; show them in Russian for RU users. */
var PROFILE_VALUE_RU={'учителька':'Учительница','домогосподарка':'Домохозяйка','архітектор':'Архитектор','альтернативний рок':'Альтернативный рок','вечірки':'Вечеринки','флірт':'Флирт','скучив':'Скучаю','скучила':'Скучаю','сумую':'Скучаю','думки':'Мысли','кохаю':'Люблю'};
function localeToken(value){return String(value==null?'':value).trim().replace(/[’`]/g,"'").toLocaleLowerCase();}
function englishTransliterate(value){
  var map={'А':'A','Б':'B','В':'V','Г':'H','Ґ':'G','Д':'D','Е':'E','Ё':'Yo','Є':'Ye','Ж':'Zh','З':'Z','И':'Y','І':'I','Ї':'Yi','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya'};
  return String(value==null?'':value).split('').map(function(ch){var up=ch.toLocaleUpperCase(),out=map[up];if(out==null)return ch;return ch===ch.toLocaleLowerCase()&&ch!==up?(out.charAt(0).toLocaleLowerCase()+out.slice(1)):out;}).join('');
}
/* A profile name is identity data, not interface copy. Translating or rotating it
 * made one woman appear under different names in the client and chatter apps. */
/* Guest accounts get a placeholder name at creation; render it in the current UI language. */
var GUEST_PLACEHOLDER_NAMES={'гість':'guest_man','гость':'guest_man','гостя':'guest_woman','гостья':'guest_woman'};
function localizedPersonName(value){return String(value==null?'':value).trim();}
function ownDisplayName(value){var raw=localizedPersonName(value),key=GUEST_PLACEHOLDER_NAMES[localeToken(raw)];return key?t(key,raw):raw;}
function localizedCity(value){var raw=String(value==null?'':value).trim(),lang=String(state.lang||'').slice(0,2);if(!raw)return raw;return raw.split(',').map(function(part){var clean=part.trim();if(lang==='uk')return PROFILE_CITY_UK[localeToken(clean)]||clean;if(lang==='en')return PROFILE_CITY_EN[localeToken(clean)]||englishTransliterate(clean);return clean;}).join(', ');}
function vcViewerCityRaw(){
  var profile=(state.me&&state.me.profile)||state.profile||{},city=String(profile.city||profile.location||'').trim();
  if(!city&&typeof smartCityName==='function')city=String(smartCityName()||'').trim();
  return city;
}
function vcDynamicProfileCity(){return localizedCity(vcViewerCityRaw());}
function vcNormalizeDynamicProfileCities(payload,action){
  var viewerCity=vcViewerCityRaw();
  if(!viewerCity||!payload||typeof payload!=='object')return payload;
  var ownId=parseInt(state.uid,10)||0,seen=[];
  if(action==='me'&&!ownId)ownId=parseInt(payload.user_id||payload.uid,10)||0;
  function hasOwn(obj,key){return Object.prototype.hasOwnProperty.call(obj,key);}
  function walk(node,key,parent){
    if(!node||typeof node!=='object'||seen.indexOf(node)>=0)return;
    seen.push(node);
    if(Array.isArray(node)){for(var ai=0;ai<node.length;ai++)walk(node[ai],key,node);return;}
    var profileId=parseInt(node.peer_id||node.virtual_id||node.actor_id||node.user_id||node.id,10)||0;
    var hasCity=hasOwn(node,'city')||hasOwn(node,'location')||hasOwn(node,'peer_city')||hasOwn(node,'actor_city');
    var hasIdentity=profileId>0&&(hasOwn(node,'name')||hasOwn(node,'fullname')||hasOwn(node,'peer_name')||hasOwn(node,'actor_name')||hasOwn(node,'photo')||hasOwn(node,'avatar')||hasOwn(node,'age')||hasOwn(node,'u_age')||hasOwn(node,'sex'));
    var ownProfile=action==='me'&&parent===payload&&key==='profile';
    if(hasCity&&hasIdentity&&!ownProfile&&(!ownId||profileId!==ownId)){
      if(hasOwn(node,'city'))node.city=viewerCity;
      if(hasOwn(node,'location'))node.location=viewerCity;
      if(hasOwn(node,'peer_city'))node.peer_city=viewerCity;
      if(hasOwn(node,'actor_city'))node.actor_city=viewerCity;
    }
    for(var childKey in node)if(hasOwn(node,childKey)&&node[childKey]&&typeof node[childKey]==='object')walk(node[childKey],childKey,node);
  }
  walk(payload,'',null);
  return payload;
}
function localizedInterest(value){var raw=String(value==null?'':value).trim(),lang=String(state.lang||'').slice(0,2);if(!raw)return raw;if(lang==='uk')return PROFILE_INTEREST_UK[localeToken(raw)]||raw;if(lang==='en')return PROFILE_INTEREST_EN[localeToken(raw)]||englishTransliterate(raw);return raw;}
function localizedProfileValue(value){var raw=String(value==null?'':value).trim(),lang=String(state.lang||'').slice(0,2);if(!raw)return raw;if(lang==='uk')return PROFILE_VALUE_UK[localeToken(raw)]||raw;if(lang==='en')return PROFILE_VALUE_EN[localeToken(raw)]||englishTransliterate(raw);return PROFILE_VALUE_RU[localeToken(raw)]||raw;}
function bindActivation(node,handler,role){
  if(!node||typeof handler!=='function')return;
  var tag=String(node.tagName||'').toUpperCase(),nativeControl=tag==='BUTTON'||tag==='A'||tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA';
  if(!nativeControl){node.setAttribute('role',role||'button');if(!node.hasAttribute('tabindex'))node.tabIndex=0;}
  node.addEventListener('click',handler);
  if(!nativeControl)node.addEventListener('keydown',function(e){if(e.target===node&&(e.key==='Enter'||e.key===' ')){e.preventDefault();handler(e);}});
}
function setBusy(node,busy){
  if(!node)return;node.disabled=!!busy;node.classList.toggle('is-loading',!!busy);if(busy)node.setAttribute('aria-busy','true');else node.removeAttribute('aria-busy');
}
function renderLoadError(host,message,retry){
  if(!host)return;host.innerHTML='<div class="empty-state" role="alert"><p>'+h(message||t('network_error','Ошибка сети'))+'</p>'+(retry?'<button type="button" class="set-btn vc-inline-retry">'+h(t('retry','Повторить'))+'</button>':'')+'</div>';
  var btn=host.querySelector('.vc-inline-retry');if(btn)btn.addEventListener('click',function(){btn.disabled=true;retry();});
}
function fmtTime(ts){
  if (!ts) return '';
  var d = new Date(ts*1000), now = new Date(), diff = (now - d)/1000;
  if (diff < 60) return t('chat_now','сейчас');
  if (diff < 3600) return Math.floor(diff/60) + ' ' + t('time_min_short','мин');
  if (diff < 86400) return Math.floor(diff/3600) + ' ' + t('time_hour_short','ч');
  var days = Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate()) - new Date(d.getFullYear(),d.getMonth(),d.getDate()))/86400000);
  if (days === 1) return t('chat_yesterday','Вчера');
  if (days > 1 && days < 7) return days + ' ' + t('time_day_short','дн.');
  return d.toLocaleDateString(state.lang||undefined,{day:'2-digit',month:'2-digit'});
}
function fmtMessageClock(ts){
  if(!ts)return '';
  try{return new Date(ts*1000).toLocaleTimeString(state.lang||undefined,{hour:'2-digit',minute:'2-digit'});}catch(e){var d=new Date(ts*1000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
}
function fmtNum(value){var n=Number(value)||0;try{return new Intl.NumberFormat(state.lang||'ru').format(n);}catch(e){return String(n);}}
/* Customer-facing prices are always shown in EUR.  The backend keeps integer
   accounting units (50 units = €1) so historical balances and ledgers remain
   exact and no money logic depends on floating-point values. */
var VC_ACCOUNT_UNITS_PER_EUR=50;
function euroAmountFromUnits(value){
  var amount=(Number(value)||0)/VC_ACCOUNT_UNITS_PER_EUR,negative=amount<0,absolute=Math.abs(amount),whole=Math.abs(absolute-Math.round(absolute))<.000001;
  var decimal=whole?String(Math.round(absolute)):absolute.toFixed(2);
  if((state.lang||'').toLowerCase()!=='en')decimal=decimal.replace('.',',');
  return (negative?'-':'')+'€'+decimal;
}
function euroInputFromUnits(value){return ((Math.max(0,Number(value)||0))/VC_ACCOUNT_UNITS_PER_EUR).toFixed(2);}
function unitsFromEuroInput(value){var parsed=parseFloat(String(value==null?'':value).replace(',','.'));return Number.isFinite(parsed)?Math.max(0,Math.round(parsed*VC_ACCOUNT_UNITS_PER_EUR)):0;}
function vibeAmount(value){return euroAmountFromUnits(value);}
function chatCountLabel(n){
  n=Math.max(0,parseInt(n,10)||0);var r10=n%10,r100=n%100;
  var key=(r10===1&&r100!==11)?'chat_one':((r10>=2&&r10<=4&&(r100<12||r100>14))?'chat_few':'chat_many');
  return n+' '+t(key,key==='chat_one'?'чат':(key==='chat_few'?'чата':'чатов'));
}
function vibeShort(value){return euroAmountFromUnits(value);}
function formatDayCount(value){
  var n=Math.max(0,parseInt(value,10)||0),lang=String(state.lang||'ru').slice(0,2),unit='дней';
  if(lang==='ru'){var r10=n%10,r100=n%100;unit=(r10===1&&r100!==11)?'день':(r10>=2&&r10<=4&&(r100<12||r100>14)?'дня':'дней');}
  else if(lang==='uk'){var u10=n%10,u100=n%100;unit=(u10===1&&u100!==11)?'день':(u10>=2&&u10<=4&&(u100<12||u100>14)?'дні':'днів');}
  else if(lang==='en')unit=n===1?'day':'days';
  else if(lang==='es')unit=n===1?'día':'días';
  else if(lang==='de')unit=n===1?'Tag':'Tage';
  else if(lang==='fr')unit=n===1?'jour':'jours';
  else if(lang==='pt')unit=n===1?'dia':'dias';
  else if(lang==='it')unit=n===1?'giorno':'giorni';
  else if(lang==='tr')unit='gün';
  return n+' '+unit;
}
function contextCtaHtml(opts){
  opts=opts||{};
  var tones=['coral','purple','gold','blue','green'],tone=tones.indexOf(opts.tone)>=0?opts.tone:'coral',classes=['vc-context-cta','tone-'+tone];
  if(opts.compact)classes.push('is-compact');if(opts.centered)classes.push('is-centered');if(opts.micro)classes.push('is-micro');if(opts.className)classes.push(opts.className);
  function actionHtml(action,secondary){
    if(!action||!action.label)return '';
    var attrs=action.route?' data-context-route="'+h(action.route)+'"':(action.action?' data-context-action="'+h(action.action)+'"':'');
    return '<button type="button" class="'+(secondary?'vc-context-secondary':'vc-context-primary')+'"'+attrs+'>'+(action.icon?'<span aria-hidden="true">'+semanticGlassIcon(action.icon,'vc-context-action-icon')+'</span>':'')+'<strong>'+h(action.label)+'</strong>'+(secondary?'':'<b aria-hidden="true">→</b>')+'</button>';
  }
  var progress='';
  if(opts.progress){var value=Math.max(0,Math.min(100,parseInt(opts.progress.value,10)||0)),label=opts.progress.label||t('progress','Progress');progress='<div class="vc-context-progress"><div><span>'+h(label)+'</span><strong>'+h(opts.progress.detail||value+'%')+'</strong></div><i role="progressbar" aria-label="'+h(label)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+value+'"><em style="--vc-context-progress:'+value+'%"></em></i></div>';}
  var actions=actionHtml(opts.primary,false)+actionHtml(opts.secondary,true);
  return '<section class="'+h(classes.join(' '))+'"><div class="vc-context-main"><div class="vc-context-icon" aria-hidden="true"><span>'+semanticGlassIcon(opts.icon||'star','vc-context-glass-icon')+'</span><i></i></div><div class="vc-context-copy">'+(opts.eyebrow?'<small>'+h(opts.eyebrow)+'</small>':'')+'<strong>'+h(opts.title||'')+'</strong>'+(opts.copy?'<p>'+h(opts.copy)+'</p>':'')+'</div></div>'+progress+(actions?'<div class="vc-context-actions">'+actions+'</div>':'')+'</section>';
}
function wireContextCtas(root){
  $$('[data-context-route]',root||document).forEach(function(btn){btn.addEventListener('click',function(){navigate(btn.dataset.contextRoute);});});
}
function premiumPageHead(opts){
  opts=opts||{};return '<section class="vc-page-head '+(opts.tone?('tone-'+h(opts.tone)):'')+'"><div class="vc-page-copy">'+(opts.eyebrow?'<small>'+h(opts.eyebrow)+'</small>':'')+'<h1>'+h(opts.title||'')+'</h1>'+(opts.subtitle?'<p>'+h(opts.subtitle)+'</p>':'')+'</div>'+(opts.aside||'')+'</section>';
}
function beginRouteMotion(route){
  var app=document.getElementById('app'),body=document.getElementById('vc-main-body');if(!app||!body)return;
  app.setAttribute('data-route',route||'/');app.classList.remove('vc-route-ready');app.classList.add('vc-route-loading');
  body.classList.remove('vc-route-enter');void body.offsetWidth;body.classList.add('vc-route-enter');
  clearTimeout(app._routeMotionTimer);app._routeMotionTimer=setTimeout(function(){app.classList.remove('vc-route-loading');app.classList.add('vc-route-ready');},520);
}
function avatarBg(name){
  var palettes = [['#c1523f','#a8432f'],['#b4573f','#8f3f2c'],['#a8643a','#8a4f2b'],['#8a6a4a','#6f533a'],['#5b7f67','#46664f'],['#5a7a8a','#466373']];
  var idx = 0; if (name) for (var i=0;i<name.length;i++) idx += name.charCodeAt(i);
  var p = palettes[idx % palettes.length];
  return 'linear-gradient(135deg,' + p[0] + ',' + p[1] + ')';
}
function initials(name){
  if (!name) return '?';
  var parts = String(name).trim().split(/\s+/);
  return (parts[0][0]||'?') + (parts[1] ? parts[1][0] : '');
}
function handleSessionExpired(){
  if(!state.uid&&state.route==='/onboarding')return;
  state.guestRecoveryNeeded=readGuestAccessMarker()>0;
  state.uid=0;state.me=null;state.auth=null;state.isGuest=false;
  if(state.livePollTimer){clearTimeout(state.livePollTimer);state.livePollTimer=null;}
  navigate('/onboarding');
  toast(t('session_expired','Сессия завершилась. Войдите, чтобы вернуть профиль.'),'error');
}

/* ===== API client (WEB/PWA cookie auth) ===== */
/* Temporary product switch: keep desire data and settlement logic, hide every
   customer entry point until the feature is ready to return. */
var VC_DESIRE_UI_ENABLED = false;
var TOS_MONEY_ACTIONS = {
  send:1, gift_send:1,
  sticker_pack_buy:1,
  offer_create:1, offer_accept_counter:1, offer_complete:1, offer_dispute:1
};
/* Honest presence: the server counts the client as online only while someone uses the page. Every API call reports
   the seconds since the last touch, click, key, wheel or mouse movement (or return to the tab); a tab left open and
   untouched goes offline after client_idle_offline_sec on the server. Programmatic scrolling and focus (new messages,
   dialogs) deliberately do not count. */
var vcLastInteractionAt=Date.now();
(function(){
  var mark=function(){vcLastInteractionAt=Date.now();},lastMove=0;
  ['pointerdown','keydown','touchstart','wheel'].forEach(function(type){window.addEventListener(type,mark,{capture:true,passive:true});});
  window.addEventListener('mousemove',function(){var now=Date.now();if(now-lastMove>4000){lastMove=now;vcLastInteractionAt=now;}},{capture:true,passive:true});
  window.addEventListener('focus',mark);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')mark();});
})();
function vcIdleSeconds(){return Math.max(0,Math.round((Date.now()-(vcLastInteractionAt||Date.now()))/1000));}
function apiRequest(action, extra){
  var fd = new FormData();
  fd.append('action', action);
  if (extra) for (var k in extra) fd.append(k, extra[k]);
  fd.append('idle_s', String(vcIdleSeconds()));
  if(action==='thread'&&extra&&state.currentChat&&String(extra.virtual)===String(state.currentChat)&&chatCanMarkSeen())fd.append('viewing','1');
  return fetch('/app/api.php', {method:'POST', body:fd, credentials:'same-origin'})
    .then(function(r){ return r.text(); })
    .then(function(txt){
      try { var parsed=JSON.parse(txt); if(parsed&&parsed.err==='no_session')handleSessionExpired();vcNormalizeDynamicProfileCities(parsed,action); applyPassiveApiState(parsed,action); return parsed; }
      catch(e){ console.error('API bad JSON:', txt.slice(0,200)); throw new Error('Bad JSON from '+action); }
    });
}
function promptTosAcceptance(info){
  return new Promise(function(resolve){
    var ov=el('div',{class:'lightbox tos-dialog',style:'position:fixed;inset:0;z-index:10030;display:flex;align-items:center;justify-content:center;padding:18px'}),url=legalUrl('tos'),privacy=legalUrl('privacy'),eu=legalUrl('eu-terms');
  ov.innerHTML='<div role="dialog" aria-modal="true" aria-labelledby="vc-tos-title" tabindex="-1" style="width:min(100%,560px);padding:22px"><h2 id="vc-tos-title" style="margin:0 42px 8px 0">'+h(t('tos_title','Условия и 18+'))+'</h2><div class="tos-legal-links"><a href="'+h(url)+'" target="_blank" rel="noopener">'+h(t('terms','Условия'))+' ↗</a><a href="'+h(privacy)+'" target="_blank" rel="noopener">'+h(t('privacy_policy','Конфиденциальность'))+' ↗</a><a href="'+h(eu)+'" target="_blank" rel="noopener">'+h(t('eu_consumer_terms','Условия ЕС'))+' ↗</a><a href="'+h(legalUrl('withdrawal-eu'))+'" target="_blank" rel="noopener">'+h(t('withdrawal_eu','Отказ от покупки (ЕС)'))+' ↗</a><a href="'+h(legalUrl('privacy-gdpr'))+'" target="_blank" rel="noopener">'+h(t('privacy_gdpr','Уведомление о GDPR'))+' ↗</a></div><label class="tos-check"><input type="checkbox" id="vc-tos-age" checked> <span>'+h(t('tos_age_confirm','Мне исполнилось 18 лет, я принимаю Условия и Политику конфиденциальности'))+'</span></label><div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="set-btn" data-cancel style="flex:1">'+h(t('cancel','Отмена'))+'</button><button type="button" class="set-btn tos-accept" data-accept style="flex:1">'+h(t('accept','Принять'))+'</button></div></div>';
    document.body.appendChild(ov);setupDialogA11y(ov);var age=ov.querySelector('#vc-tos-age'),accept=ov.querySelector('[data-accept]');function sync(){accept.disabled=!age.checked;}age.addEventListener('change',sync);sync();function done(v){if(ov.parentNode)ov.parentNode.removeChild(ov);resolve(v);}ov.querySelector('[data-cancel]').addEventListener('click',function(){done(false);});accept.addEventListener('click',function(){done(true);});ov.addEventListener('click',function(e){if(e.target===ov)done(false);});ov.addEventListener('keydown',function(e){if(e.key==='Escape')done(false);});
  });
}
function ensureTosAccepted(){
  if (state.tosAccepted === true) return Promise.resolve(true);
  if (state.tosPromise) return state.tosPromise;
  state.tosPromise = apiRequest('tos_check').then(function(r){
    if (!r || !r.ok){ handleApiError(r,t('tos_check_failed','Не удалось проверить условия')); return false; }
    if (r.accepted){ state.tosAccepted=true; return true; }
    return promptTosAcceptance(r).then(function(accepted){if(!accepted)return false;return apiRequest('tos_accept').then(function(rr){
      if (rr && rr.ok){ state.tosAccepted=true; loadTosStatus(); return true; }
      handleApiError(rr,t('tos_accept_failed','Не удалось принять условия')); return false;
    });});
  }).catch(function(){ toast(t('network_error','Ошибка сети'),'error'); return false; }).then(function(ok){ state.tosPromise=null; return ok; });
  return state.tosPromise;
}
function api(action, extra){
  if (!TOS_MONEY_ACTIONS[action]) return apiRequest(action,extra);
  return ensureTosAccepted().then(function(ok){
    if(!ok)return {ok:false,err:'tos_required'};
    return apiRequest(action,extra).then(function(result){
      /* A stale tab can believe that the current ToS version is accepted while
         the server correctly rejects the action. The gate runs before any
         message/payment mutation, so one verified retry cannot duplicate it. */
      if(!result||result.err!=='tos_required')return result;
      state.tosAccepted=false;state.tosPromise=null;
      return ensureTosAccepted().then(function(accepted){
        return accepted?apiRequest(action,extra):result;
      });
    });
  });
}
/* Auth API (app/auth.php) */
function authApi(action, extra){
  var fd = new FormData();
  fd.append('action', action);
  if (extra) for (var k in extra) fd.append(k, extra[k]);
  return fetch('/app/auth.php', {method:'POST', body:fd, credentials:'same-origin'})
    .then(function(r){ return r.text(); })
    .then(function(txt){ try { var parsed=JSON.parse(txt);if(action!=='me'&&parsed&&parsed.err==='no_session')handleSessionExpired();return parsed; } catch(e){ console.error('Auth bad JSON:', txt.slice(0,200)); throw new Error('Bad JSON'); } });
}

async function secureCurrentAccount(options){
  options=options||{};
  var auth=state.auth||{},email=String(auth.email||''),outcome=null;
  var values=await vcModal({
    title:t('save_access','Сохранить доступ'),
    icon:'lock',
    message:t('save_access_copy','Закрепите текущий профиль: баланс, фото и переписки останутся на месте и будут доступны после входа на другом устройстве.'),
    fields:[
      {name:'email',type:'email',label:t('set_email','Email'),value:email,required:true,autocomplete:'email'},
      {name:'password',type:'password',label:t('password','Пароль'),minlength:8,required:true,autocomplete:'new-password',hint:t('password_min_hint','Минимум 8 символов')},
      {name:'repeat',type:'password',label:t('repeat_password','Повторите пароль'),minlength:8,required:true,autocomplete:'new-password',matchWith:'password'}
    ],
    confirmText:t('save_access','Сохранить доступ'),
    validate:function(v){
      if(String(v.password||'').length<8)return {field:'password',message:t('login_err_weak_password','Пароль слишком короткий')};
      if(v.password!==v.repeat)return {field:'repeat',message:t('passwords_mismatch','Пароли не совпадают')};
      return null;
    },
    onSubmit:async function(v){
      var res=await authApi('upgrade_email',{email:String(v.email||'').trim(),password:v.password}).catch(function(){return {ok:false,err:'network'};});
      outcome=res;
      if(res&&res.ok)return {ok:true};
      var code=res&&res.err;
      if(code==='email_taken')return {ok:false,field:'email',message:t('email_in_use_title','Этот email уже используется'),formMessage:t('email_in_use_current_copy','Мы не переключили аккаунт и сохранили текущий баланс и переписки. Укажите другой email для этого профиля или обратитесь в поддержку для безопасного объединения.')};
      if(code==='weak_password')return {ok:false,field:'password',message:t('login_err_weak_password','Пароль слишком короткий')};
      if(code==='bad_email')return {ok:false,field:'email',message:t('login_err_bad_email','Неверный email')};
      if(code==='rate_limit')return {ok:false,message:t('login_err_rate_limit','Слишком много попыток')};
      if(code==='guest_account_conflict')return {ok:false,message:t('guest_account_conflict_copy','В нём уже есть фото, переписка или баланс. Чтобы ничего не потерять, сначала закрепите этот профиль на другом email либо обратитесь в поддержку.')};
      return {ok:false,message:localizedErrorText(code,t('network_error','Ошибка сети'))};
    }
  });
  if(!values)return false;
  var r=outcome;
  if(r&&r.ok){
    await loadAuthMeta();await loadMe();
    if(r.verification_sent)await vcNotice(t('check_email','Проверьте email'),t('verification_sent_copy','Мы отправили ссылку подтверждения. Пароль уже сохранён, а после подтверждения email аккаунт будет полностью защищён.'),'success');
    else await vcNotice(t('access_saved','Доступ сохранён'),t('access_saved_password_copy','Email и пароль привязаны к текущему профилю. Используйте их для следующего входа.'),'success');
    return true;
  }
  return false;
}
function maybePromptAccountRecovery(force){
  var auth=state.auth||{},required=auth.account_recovery_required===true||parseInt(auth.account_recovery_required,10)===1;
  if(!required||state.accountRecoveryPromptOpen)return Promise.resolve(false);
  var key='vc_account_recovery_prompted_'+state.uid,seen=false;
  try{seen=sessionStorage.getItem(key)==='1';}catch(e){}
  if(seen&&!force)return Promise.resolve(false);
  state.accountRecoveryPromptOpen=true;state.accountRecoveryPromptShown=true;
  try{sessionStorage.setItem(key,'1');}catch(e2){}
  return vcModal({
    title:t('payment_access_title','Оплата прошла — сохраните доступ'),
    icon:'lock',
    tone:'success',
    message:t('payment_access_copy','Оплата уже зачислена на баланс аккаунта. Добавьте email и пароль, чтобы профиль, покупки и переписки не потерялись при смене устройства или очистке браузера.'),
    cancelText:t('later','Позже'),
    confirmText:t('save_access','Сохранить доступ')
  }).then(function(ok){
    state.accountRecoveryPromptOpen=false;
    return ok?secureCurrentAccount({source:'first_payment'}):false;
  });
}
function readPendingCryptoPayment(){
  try{
    var p=JSON.parse(sessionStorage.getItem('vc_pending_crypto_payment')||'null');
    return p&&parseInt(p.pid,10)>0?p:null;
  }catch(e){return null;}
}
function clearPendingCryptoPayment(){
  if(state.pendingCryptoTimer){clearTimeout(state.pendingCryptoTimer);state.pendingCryptoTimer=null;}
  state.pendingCryptoPolls=0;
  try{sessionStorage.removeItem('vc_pending_crypto_payment');}catch(e){}
}
function reconcilePendingCryptoPayment(){
  if(state.pendingCryptoTimer){clearTimeout(state.pendingCryptoTimer);state.pendingCryptoTimer=null;}
  var pending=readPendingCryptoPayment();
  if(!state.uid||!pending)return Promise.resolve(false);
  var expires=parseInt(pending.expires_at,10)||Math.floor((parseInt(pending.at,10)||Date.now())/1000)+1800;
  if(expires<Math.floor(Date.now()/1000)){clearPendingCryptoPayment();vcClearCheckoutIntents(pending);vcClearPendingPurchase();return Promise.resolve(false);}
  state.pendingCryptoPolls++;
  return authApi('crypto_status',{pid:parseInt(pending.pid,10)}).then(function(r){
    if(!r||!r.ok)return false;
    if(r.status==='confirmed'){
      clearPendingCryptoPayment();vcClearCheckoutIntents(pending);
      return loadAuthMeta().then(function(){return loadMe();}).then(function(){
        renderTopbar();
        return resumePendingPurchase({paymentConfirmed:true,provider:'crypto'});
      }).then(function(resumed){
        if(resumed)return true;
        var chats=parseInt(r.chat_count,10)||0,message=chats>0?(chats+' '+(chats===1?t('chat_available','чат доступен'):t('chats_available','чата доступны'))):t('payment_available_now','Покупка уже доступна в аккаунте.');
        return vcNotice(t('payment_success','Оплата прошла успешно'),message,'success');
      }).then(function(){return maybePromptAccountRecovery(true);});
    }
    if(r.provider==='direct'&&(r.status==='pending'||r.status==='confirming')&&state.pendingCryptoPolls===1&&!state.directInvoice)showDirectInvoice(r,{resumed:true,intent_key2:pending.intent_key2});
    if(r.status==='failed'||r.status==='expired'){
      clearPendingCryptoPayment();vcClearCheckoutIntents(pending);vcClearPendingPurchase();
      toast(t('payment_not_completed','Платёж не завершён'),'error');
      return false;
    }
    if(state.pendingCryptoPolls===1){
      var q=state.routeQuery||new URLSearchParams(window.location.search.replace(/^\?/,''));
      if(q.get('crypto'))toast(t('payment_checking','Проверяем подтверждение платежа...'));
    }
    if(state.pendingCryptoPolls<(pending.direct?300:30))state.pendingCryptoTimer=setTimeout(reconcilePendingCryptoPayment,pending.direct?6000:4000);
    return false;
  }).catch(function(){
    if(state.pendingCryptoPolls<(pending.direct?300:30))state.pendingCryptoTimer=setTimeout(reconcilePendingCryptoPayment,pending.direct?8000:5000);
    return false;
  });
}

/* ===== First-party funnel analytics (no message/email/photo contents) ===== */
function funnelSessionId(){
  if(state.analyticsSession)return state.analyticsSession;var key='vc_funnel_session',id='';
  try{id=sessionStorage.getItem(key)||'';}catch(e){}
  if(!id){id='s_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);try{sessionStorage.setItem(key,id);}catch(e2){}}
  state.analyticsSession=id;return id;
}
function funnelPlatform(){return window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches?'pwa':'web';}
function vcAnonId(){try{var k='vc_anon',v=localStorage.getItem(k);if(!v){v='a_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);try{localStorage.setItem(k,v);}catch(e){}}return v;}catch(e2){return 'a_'+Date.now().toString(36);}}
function funnelTrackAnon(type,context,onceKey){var allow={landing_view:1,return_visit:1,pwa_install_prompt:1,pwa_install_clicked:1};if(!type||!allow[type])return Promise.resolve(null);var key=onceKey||'',seenKey=key?('anon:'+type+':'+key):'';if(seenKey&&state.analyticsSeen[seenKey])return Promise.resolve(null);if(seenKey)state.analyticsSeen[seenKey]=1;context=context||{};return apiRequest('track_anon',{anonymous_id:vcAnonId(),event_type:type,context:JSON.stringify(context),session_id:funnelSessionId(),platform:funnelPlatform()}).catch(function(){return null;});}
function funnelTrack(type,context,onceKey){
  if(!type)return Promise.resolve(null);if(!state.uid)return funnelTrackAnon(type,context,onceKey);var key=onceKey||'',seenKey=key?(type+':'+key):'';
  if(seenKey&&state.analyticsSeen[seenKey])return Promise.resolve(null);if(seenKey)state.analyticsSeen[seenKey]=1;
  context=context||{};context.route=context.route||state.route||location.hash||'/';
  return apiRequest('track_event',{event_type:type,context:JSON.stringify(context),session_id:funnelSessionId(),platform:funnelPlatform(),anonymous_id:vcAnonId()}).then(function(r){
    if(r&&r.active_promo)state.storePromo=r.active_promo;
    return r;
  }).catch(function(){return null;});
}
function storeSignalContext(extra){
  var context=extra||{},source=state.storeAttribution||{};
  if(!context.profile_id&&parseInt(source.profile_id,10)>0)context.profile_id=parseInt(source.profile_id,10);
  if(source.trigger&&!context.trigger)context.trigger=source.trigger;
  if(source.session_key&&!context.store_session)context.store_session=source.session_key;
  context.surface=context.surface||'store';
  return context;
}
window.addEventListener('vc-analytics',function(e){
  var d=e&&e.detail||{},name=String(d.event||''),map={pwa_prompt_shown:'pwa_install_prompt',pwa_ios_overlay_shown:'pwa_install_prompt',pwa_install_clicked:'pwa_install_clicked',pwa_installed:'pwa_installed'};
  if(map[name])funnelTrack(map[name],d.params||{},name==='pwa_installed'?'installed':name);
});

/* ===== Toast ===== */
function toast(msg, type){
  var existing = document.querySelectorAll('.toast');
  for (var i=0;i<existing.length;i++){ if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]); }
  var d = document.createElement('div');
  d.className = 'toast' + (type ? ' ' + type : '');
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function(){ d.classList.add('show'); }, 10);
  setTimeout(function(){ d.classList.remove('show'); setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 300); }, 2800);
}
function vcClientRequestId(prefix){
  var id=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,16));
  return String(prefix||'msg')+'_'+String(id).toLowerCase();
}
function syncIncomingMessageToasts(nextChats, previousChats){
  nextChats=Array.isArray(nextChats)?nextChats:[];previousChats=Array.isArray(previousChats)?previousChats:[];
  var prev={};for(var i=0;i<previousChats.length;i++){var p=previousChats[i]||{},pid=parseInt(p.id||p.peer_id||p.user_id,10)||0;if(pid)prev[pid]=p;}
  if(!state.messageToastReady){for(var j=0;j<nextChats.length;j++){var first=nextChats[j]||{},fid=parseInt(first.id||first.peer_id||first.user_id,10)||0;if(fid)state.messageToastSeen[fid+':'+(first.last_at||0)]=1;}state.messageToastReady=true;return;}
  for(var k=0;k<nextChats.length;k++){
    var item=nextChats[k]||{},id=parseInt(item.id||item.peer_id||item.user_id,10)||0;if(!id||item.last_from_me||parseInt(item.unread,10)<=0)continue;
    var old=prev[id]||{},isNew=(parseInt(item.last_at,10)||0)>(parseInt(old.last_at,10)||0)||(parseInt(item.unread,10)||0)>(parseInt(old.unread,10)||0),key=id+':'+(item.last_at||0);if(!isNew||state.messageToastSeen[key])continue;state.messageToastSeen[key]=1;
    if(state.currentChat===id||String(state.route||'')==='/chat/'+id)continue;
    showIncomingMessageToast(item,id);
  }
}
function showIncomingMessageToast(item,pid){
  var name=localizedPersonName(item.name||item.fullname||t('new_message','Новое сообщение')),text=chatMessagePreview(item)||item.last_msg||t('new_message','Новое сообщение');
  vcnShow({kind:'message',key:'m'+pid+':'+(item.last_at||0),actorId:pid,name:name,photo:item.photo||'',title:name,body:text,at:chatLastActivity(item)||Math.floor(Date.now()/1000),route:'/chat/'+pid});
}
function notificationDayKey(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function notificationEventAllowed(kind){
  var key=vcnPrefKey(kind);if(!key)return true;
  var p=state.notifPrefs||{};
  return p[key]!==false&&p[key]!==0&&p[key]!=='0';
}
function vcQuietHoursLocal(){try{var o=JSON.parse(localStorage.getItem('vc_quiet_hours')||'null');if(o&&typeof o==='object')return {on:!!o.on,from:/^\d{1,2}:\d{2}$/.test(o.from)?o.from:'22:00',to:/^\d{1,2}:\d{2}$/.test(o.to)?o.to:'08:00'};}catch(e){}return {on:false,from:'22:00',to:'08:00'};}
function vcQuietHours(){try{var s=(typeof state!=='undefined'&&state&&state.notifPrefs)?state.notifPrefs:null;if(s&&(s.quiet_on!==undefined||s.quiet_from!==undefined||s.quiet_to!==undefined)){return {on:!!s.quiet_on,from:/^\d{1,2}:\d{2}$/.test(s.quiet_from)?s.quiet_from:'22:00',to:/^\d{1,2}:\d{2}$/.test(s.quiet_to)?s.quiet_to:'08:00'};}}catch(e){}return vcQuietHoursLocal();}
function vcInQuietHours(){var q=vcQuietHours();if(!q.on)return false;var m=function(v){var x=/^(\d{1,2}):(\d{2})$/.exec(v);return x?(parseInt(x[1],10)*60+parseInt(x[2],10)):0;},d=new Date(),n=d.getHours()*60+d.getMinutes(),a=m(q.from),b=m(q.to);if(a===b)return false;return a<b?(n>=a&&n<b):(n>=a||n<b);}
function notificationSoundAllowed(kind){
  if(vcInQuietHours())return false;
  var p=state.notifPrefs||{}; if(p.sound===false||p.sound===0)return false;
  var key='sound_'+(kind==='message'?'msg':kind); return p[key]!==false&&p[key]!==0;
}
function unlockNotificationAudio(){
  state.notificationSoundUnlocked=true;
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{state.notificationAudioContext=state.notificationAudioContext||new AC();if(state.notificationAudioContext.state==='suspended')state.notificationAudioContext.resume().catch(function(){});}catch(e){}
}
function playNotificationSound(kind){
  if(!notificationSoundAllowed(kind)||document.visibilityState==='hidden')return;
  var now=Date.now(),minGap=kind==='guest'?30000:(kind==='like'?10000:2000);
  if(now-(state.notificationSoundLastAt||0)<minGap)return;
  if(!state.notificationSoundUnlocked)return;
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{
    state.notificationAudioContext=state.notificationAudioContext||new AC();var ctx=state.notificationAudioContext;
    if(ctx.state==='suspended'){ctx.resume().catch(function(){});return;}
    var freq=kind==='message'?[520,660]:(kind==='like'?[620]:(kind==='online'?[660,880]:(kind==='money'?[784,1046]:[420]))),start=ctx.currentTime;
    for(var i=0;i<freq.length;i++){var osc=ctx.createOscillator(),gain=ctx.createGain(),at=start+i*.11;osc.type='sine';osc.frequency.value=freq[i];gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(kind==='guest'?.018:.028,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+.09);osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+.1);}
    state.notificationSoundLastAt=now;
  }catch(e){}
}
function notificationKindTone(kind){return kind==='message'?'message':(kind==='like'?'like':'guest');}
/* ===== Notifications v7: one card design for pop-ups and the notification center =====
   Sources: unread chats (inbox), likes/guests (existing lists), server notices (op_app_notices:
   online alerts, top-ups, offers, support, broadcasts) and hints. Each kind has its own colour
   (--vcn-<kind> tokens in app.css) so the type is clear at a glance. */
var VCN_MAX_TOASTS=3;
var vcnToasts=[],vcnCenter=null;
var VCN_PREF={message:'msg',photo:'msg',gift:'msg',offer:'msg',like:'like',match:'like',guest:'guest',online:'online',topup:'money',promo:'money',support:'',system:'',hint:''};
function vcnPrefKey(kind){return Object.prototype.hasOwnProperty.call(VCN_PREF,kind)?VCN_PREF[kind]:'';}
function vcnKindInfo(kind){
  switch(kind){
    case 'message':return {icon:'chat',label:t('ntf_kind_message','Сообщение'),ttl:10000,sound:'message'};
    case 'photo':return {icon:'camera',label:t('ntf_kind_photo','Фото'),ttl:9000,sound:'message'};
    case 'gift':return {icon:'gift',label:t('ntf_kind_gift','Подарок'),ttl:9000,sound:'message'};
    case 'offer':return {icon:'wish',label:t('ntf_kind_offer','Предложение'),ttl:9000,sound:'message'};
    case 'like':return {icon:'heart',label:t('ntf_kind_like','Лайк'),ttl:7000,sound:'like'};
    case 'match':return {icon:'heart',label:t('ntf_kind_match','Мэтч'),ttl:8000,sound:'like'};
    case 'guest':return {icon:'eye',label:t('ntf_kind_guest','Просмотр'),ttl:6000,sound:'guest'};
    case 'online':return {icon:'bolt',label:t('ntf_kind_online','Онлайн'),ttl:9000,sound:'online'};
    case 'topup':return {icon:'wallet',label:t('ntf_kind_topup','Пополнение'),ttl:9000,sound:'money'};
    case 'promo':return {icon:'gift',label:t('ntf_kind_promo','Акция'),ttl:9000,sound:'money'};
    case 'support':return {icon:'info',label:t('ntf_kind_support','Поддержка'),ttl:9000,sound:''};
    case 'hint':return {icon:'ideas',label:t('ntf_kind_hint','Подсказка'),ttl:8000,sound:''};
    default:return {icon:'bell',label:t('ntf_kind_system','Событие'),ttl:8000,sound:''};
  }
}
/* Pop-up stack, bottom-right corner: the newest card sits at the bottom and older ones are pushed up.
   At most vcnLimit() cards are on screen; the rest wait in vcnQueue and appear one after another. */
var VCN_MAX_QUEUE=8;
var vcnQueue=[];
function vcnLimit(){return window.innerWidth<=768?2:VCN_MAX_TOASTS;}
function vcnReducedMotion(){return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
/* Height of whatever is docked to the bottom edge right now: tab bar, profile action bar or chat composer. */
function vcnInset(){
  var vh=window.innerHeight,sel=['#vc-bottom-nav','.pp-actions','.chat-composer'],inset=0,i,node,cs,box;
  for(i=0;i<sel.length;i++){
    node=document.querySelector(sel[i]);if(!node)continue;
    cs=window.getComputedStyle(node);if(cs.display==='none'||cs.visibility==='hidden')continue;
    box=node.getBoundingClientRect();
    if(box.height>0&&box.bottom>=vh-12&&box.top<vh)inset=Math.max(inset,Math.ceil(vh-box.top));
  }
  return inset;
}
function vcnPlace(){document.documentElement.style.setProperty('--vcn-inset',vcnInset()+'px');}
function vcnStackEl(){
  var s=document.getElementById('vcn-stack');
  if(!s){
    s=el('div',{id:'vcn-stack',class:'vcn-stack'});document.body.appendChild(s);
    if(window.ResizeObserver)new ResizeObserver(function(){var hh=s.offsetHeight;document.documentElement.style.setProperty('--vcn-stack-h',hh?(hh+10)+'px':'0px');}).observe(s);
  }
  return s;
}
/* Runs change() and glides the cards that stay on screen to their new place instead of letting them jump. */
function vcnFlip(change){
  var s=document.getElementById('vcn-stack'),kids=s?[].slice.call(s.children):[],from=[];
  try{
    kids.forEach(function(k){
      from.push(k.getBoundingClientRect().top);
      if(k.getAnimations)k.getAnimations().forEach(function(a){if(a.vcnFlip)a.cancel();});
    });
  }catch(e){from=[];}
  change();
  if(!from.length||vcnReducedMotion())return;
  try{
    kids.forEach(function(k,i){
      if(!k.parentNode||!k.animate)return;
      var dy=from[i]-k.getBoundingClientRect().top,a;
      if(Math.abs(dy)>1){a=k.animate([{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});a.vcnFlip=true;}
    });
  }catch(e){}
}
function vcnInOpenChat(n){
  var pid=parseInt(n&&n.actorId,10)||0;
  return !!(n&&n.kind==='message'&&pid&&((state.currentChat&&state.currentChat===pid)||state.route==='/chat/'+pid));
}
/* Counter chip above the stack while cards are waiting for a free place. */
function vcnMoreChip(){
  var s=document.getElementById('vcn-stack'),chip,count=vcnQueue.length;
  if(!s)return;
  chip=s.querySelector('.vcn-more');
  if(!count){if(chip)s.removeChild(chip);return;}
  if(!chip){
    chip=el('button',{type:'button',class:'vcn-more'});
    chip.addEventListener('click',function(){vcnQueue.length=0;vcnMoreChip();openNotificationCenter();});
    s.appendChild(chip);
  }
  chip.textContent=t('ntf_more','Ещё {n}').replace('{n}',count);
}
function vcnPump(){
  var next;
  if(vcnCenter)vcnQueue.length=0;
  while(vcnQueue.length&&vcnToasts.length<vcnLimit()){
    next=vcnQueue.shift();
    if(!vcnInOpenChat(next))vcnMount(next);
  }
  vcnMoreChip();
}
function vcnMount(n){
  var info=vcnKindInfo(n.kind),node=el('section',{class:'vcn vcn-toast',role:'status',tabindex:'-1',dataset:{kind:n.kind}}),stack,ttl;
  var rec={n:n,node:node,key:n.key,isToast:true,timer:null,started:0,left:0,paused:false,hold:false,removed:false};
  rec.close=function(){vcnRemove(rec,false);};
  node.innerHTML=vcnCardHtml(n,'toast')+'<button type="button" class="vcn-close" aria-label="'+h(t('close','Закрыть'))+'">'+glassIcon('close')+'</button><i class="vcn-timer" aria-hidden="true"></i>';
  ttl=parseInt(n.ttl,10)||info.ttl;node.querySelector('.vcn-timer').style.animationDuration=ttl+'ms';
  stack=vcnStackEl();vcnPlace();
  vcnFlip(function(){stack.insertBefore(node,stack.firstChild);});
  vcnToasts.unshift(rec);vcnMoreChip();
  vcnStart(rec,ttl);vcnSwipe(rec);
  if(info.sound)playNotificationSound(info.sound);
  node.addEventListener('mouseenter',function(){vcnPause(rec);});
  node.addEventListener('mouseleave',function(){vcnResume(rec);});
  node.addEventListener('focusin',function(){vcnPause(rec);});
  node.addEventListener('focusout',function(e){if(!node.contains(e.relatedTarget))vcnResume(rec);});
  node.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();vcnRemove(rec,false);}});
  node.addEventListener('click',function(e){
    var tg=e.target;if(!tg||!tg.closest)return;
    if(tg.closest('.vcn-close')){vcnRemove(rec,false);return;}
    var btn=tg.closest('[data-vcn-act]');
    if(btn){vcnActivate(rec,n.actions[parseInt(btn.dataset.vcnAct,10)]);return;}
    if(tg.closest('form,input'))return;
    vcnActivate(rec,vcnDefaultAction(n.actions||[]));
  });
  return rec;
}
function vcnTimeLabel(at){
  at=parseInt(at,10)||0;if(!at)return '';
  if(Math.floor(Date.now()/1000)-at<45)return t('just_now','только что');
  return relativePresenceTime(at);
}
function vcnAvatarHtml(n,info){
  var name=localizedPersonName(n.name||''),photo=n.photo||'';
  if(!(parseInt(n.actorId,10)||photo||name))return '<span class="vcn-avatar is-icon" aria-hidden="true">'+glassIcon(info.icon)+'</span>';
  var face=photo?'<img'+vcThumbSrc(photo)+' alt="" loading="lazy" decoding="async">':'<b>'+h(initials(name||'?'))+'</b>';
  return '<span class="vcn-avatar"'+(photo?'':' style="background:'+avatarBg(name||'?')+'"')+' aria-hidden="true">'+face+'<i class="vcn-badge">'+(n.kind==='online'?'':glassIcon(info.icon))+'</i></span>';
}
/* Up to two buttons per card; the first is the primary action. */
function vcnActionsFor(n){
  var pid=parseInt(n.actorId,10)||0,route=n.route||'',out=[];
  function go(label,r,primary,fn){out.push({label:label,route:r,primary:!!primary,fn:fn||null});}
  switch(n.kind){
    case 'message':
      if(pid)out.push({label:t('reply','Ответить'),reply:true,primary:true});
      go(t('open_chat','Открыть диалог'),route||('/chat/'+pid),!pid);
      break;
    case 'online':
      go(t('ntf_write','Написать'),route||('/chat/'+pid),true);
      if(pid)go(t('ntf_profile','Анкета'),'/profile/'+pid);
      break;
    case 'like':case 'match':
      if(pid)go(t('ntf_profile','Анкета'),'/profile/'+pid,true);
      if(pid)go(t('ntf_write','Написать'),'/chat/'+pid);
      break;
    case 'guest':
      if(pid)go(t('ntf_profile','Анкета'),'/profile/'+pid,true);
      go(t('open_activity','К просмотрам'),'/activity',!pid,function(){state.activityTab='guests';navigate('/activity');});
      break;
    case 'topup':go(t('ntf_balance','К балансу'),route||'/store',true);break;
    default:if(route)go(t('open','Открыть'),route,true);
  }
  return out.slice(0,2);
}
function vcnCardHtml(n,ctx){
  var info=vcnKindInfo(n.kind),title=n.title||n.name||'',body=n.body||'',actions=n.actions||(n.actions=vcnActionsFor(n)),ah='',i;
  for(i=0;i<actions.length;i++)ah+='<button type="button" class="vcn-btn'+(actions[i].primary?' is-primary':'')+'" data-vcn-act="'+i+'">'+h(actions[i].label)+'</button>';
  var units=(n.meta&&parseInt(n.meta.units,10))||0;
  var amount=(n.kind==='topup'&&units>0)?'<b class="vcn-amount">+'+h(vibeAmount(units))+'</b>':'';
  var live=(n.kind==='online'&&n.onlineNow)?'<span class="vcn-live">'+h(t('ntf_online_now','Сейчас в сети'))+'</span>':'';
  return '<span class="vcn-rail" aria-hidden="true"></span>'+vcnAvatarHtml(n,info)+
    '<div class="vcn-copy"><div class="vcn-meta"><span class="vcn-label">'+h(info.label)+'</span>'+live+(n.at?'<time class="vcn-time" datetime="'+h(new Date(n.at*1000).toISOString())+'">'+h(vcnTimeLabel(n.at))+'</time>':'')+'</div>'+
    (title?'<div class="vcn-titleline"><strong class="vcn-title">'+h(title)+'</strong>'+amount+'</div>':'')+
    (body?'<p class="vcn-text'+(n.kind==='message'?' is-quote':'')+'">'+h(body)+'</p>':'')+
    (n.kind==='message'&&n.actorId?'<form class="vcn-reply" hidden></form>':'')+
    (ah?'<div class="vcn-actions">'+ah+'</div>':'')+'</div>';
}
function vcnDefaultAction(actions){
  for(var i=0;i<actions.length;i++)if(!actions[i].reply)return actions[i];
  return actions[0]||null;
}
function vcnMarkRead(ids){
  ids=(ids||[]).filter(function(x){return parseInt(x,10)>0;});if(!ids.length)return;
  api('notices_read',{ids:JSON.stringify(ids)}).then(function(r){
    if(r&&r.ok&&state.me){state.me.notice_unread=parseInt(r.unread,10)||0;updateChatsBadge();}
  }).catch(function(){});
}
/* rec: {n, node, close(), isToast}. Runs one of the card actions. */
function vcnActivate(rec,act){
  if(!act)return;
  if(act.reply){vcnOpenReply(rec);return;}
  var n=rec.n;
  if(typeof rec.close==='function')rec.close();
  if(n.noticeId)vcnMarkRead([n.noticeId]);
  if(typeof act.fn==='function')act.fn();else if(act.route)navigate(act.route);
}
function vcnStart(rec,ms){
  clearTimeout(rec.timer);rec.started=Date.now();rec.left=ms;
  rec.timer=setTimeout(function(){vcnRemove(rec,false);},ms);
}
function vcnPause(rec){
  if(rec.paused||rec.removed)return;
  rec.paused=true;clearTimeout(rec.timer);rec.left=Math.max(1500,rec.left-(Date.now()-rec.started));rec.node.classList.add('is-paused');
}
function vcnResume(rec){
  if(!rec.paused||rec.removed||rec.hold)return;
  rec.paused=false;rec.node.classList.remove('is-paused');vcnStart(rec,rec.left);
}
function vcnRemove(rec,instant,keepSlot){
  if(!rec||rec.removed)return;
  rec.removed=true;clearTimeout(rec.timer);
  var i=vcnToasts.indexOf(rec);if(i>=0)vcnToasts.splice(i,1);
  var node=rec.node;
  function drop(){
    vcnFlip(function(){if(node.parentNode)node.parentNode.removeChild(node);});
    if(keepSlot)vcnMoreChip();else vcnPump();
  }
  if(instant||vcnReducedMotion()){drop();return;}
  node.classList.add('is-leaving');setTimeout(drop,200);
}
function vcnSwipe(rec){
  var node=rec.node,sx=0,dx=0,active=false;
  node.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse'||(e.target.closest&&e.target.closest('button,input,form')))return;active=true;sx=e.clientX;dx=0;});
  node.addEventListener('pointermove',function(e){if(!active)return;dx=e.clientX-sx;node.style.transform='translateX('+dx+'px)';node.style.opacity=String(Math.max(.25,1-Math.abs(dx)/280));});
  function end(){if(!active)return;active=false;if(Math.abs(dx)>90)vcnRemove(rec,false);else{node.style.transform='';node.style.opacity='';}}
  node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
}
/* Inline quick reply under a message card (toast or centre row). */
function vcnOpenReply(rec){
  var n=rec.n,pid=parseInt(n.actorId,10)||0;if(!pid)return;
  if(guestNeedsProfileGate()){if(typeof rec.close==='function')rec.close();navigate('/chat/'+pid);return;}
  var form=rec.node.querySelector('.vcn-reply');if(!form){navigate('/chat/'+pid);return;}
  if(!form.hidden){var again=form.querySelector('input');if(again)again.focus();return;}
  if(rec.isToast){rec.hold=true;vcnPause(rec);}
  var ph=t('ntf_reply_placeholder','Ваш ответ…');
  form.innerHTML='<input type="text" class="vcn-reply-input" maxlength="500" autocomplete="off" enterkeyhint="send" placeholder="'+h(ph)+'" aria-label="'+h(ph)+'"><button type="submit" class="vcn-reply-send" aria-label="'+h(t('send','Отправить'))+'">'+glassIcon('send')+'</button><p class="vcn-reply-error" role="alert" hidden></p>';
  form.hidden=false;rec.node.classList.add('is-replying');
  var input=form.querySelector('input'),sendBtn=form.querySelector('.vcn-reply-send'),errEl=form.querySelector('.vcn-reply-error'),sending=false;
  input.focus();
  input.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(rec.isToast)vcnRemove(rec,false);else{form.hidden=true;rec.node.classList.remove('is-replying');}}});
  form.addEventListener('submit',function(e){
    e.preventDefault();var text=input.value.trim();if(!text||sending)return;
    sending=true;sendBtn.disabled=true;input.disabled=true;errEl.hidden=true;
    var requestId=vcClientRequestId('msg');
    api('send',{virtual:pid,text:text,self_destruct_sec:0,request_id:requestId}).then(function(r){
      if(r&&r.ok){
        rec.node.classList.remove('is-replying');rec.node.classList.add('is-sent');form.hidden=true;
        var acts=rec.node.querySelector('.vcn-actions');if(acts)acts.innerHTML='<span class="vcn-sent">'+glassIcon('check')+h(t('ntf_sent','Отправлено'))+'</span>';
        if(rec.isToast){rec.hold=false;rec.paused=false;vcnStart(rec,1800);}
        if(chatCanMarkSeen())api('thread',{virtual:pid,limit:1,mark_seen:1}).catch(function(){});
        refreshLiveStateSoon(400);return;
      }
      sending=false;sendBtn.disabled=false;input.disabled=false;
      if(r&&(r.err==='low_balance'||r.err==='insufficient'||r.err==='insufficient_balance')){if(typeof rec.close==='function')rec.close();openChatContinuePaywall(pid,text,0,requestId);return;}
      errEl.textContent=localizedErrorText(r&&r.err,t('send_failed','Не удалось отправить'));errEl.hidden=false;input.focus();
    }).catch(function(){sending=false;sendBtn.disabled=false;input.disabled=false;errEl.textContent=t('network_error','Ошибка сети');errEl.hidden=false;});
  });
}
/* Pop-up card. n: {kind,key,actorId,name,photo,title,body,at,route,meta,noticeId,actions,ttl} */
function vcnShow(n){
  n=n||{};var kind=String(n.kind||'system');
  if(!notificationEventAllowed(kind))return null;
  if(kind!=='message'&&kind!=='topup'&&kind!=='support'&&vcInQuietHours())return null;
  n.kind=kind;
  var pid=parseInt(n.actorId,10)||0,key=String(n.key||(kind+':'+(pid||n.noticeId||n.title||''))),i;
  n.key=key;
  if(vcnInOpenChat(n))return null;
  if(vcnCenter){vcnReloadCenterSoon();return null;}
  for(i=0;i<vcnToasts.length;i++)if(vcnToasts[i].key===key){vcnRemove(vcnToasts[i],true,true);break;}
  vcnQueue=vcnQueue.filter(function(q){return q.key!==key;});
  if(vcnToasts.length>=vcnLimit()){
    vcnQueue.push(n);
    while(vcnQueue.length>VCN_MAX_QUEUE)vcnQueue.shift();
    vcnMoreChip();return null;
  }
  return vcnMount(n);
}
/* Opening a chat closes the pop-ups that belong to it. */
function vcnDismissChat(pid){
  if(!pid)return;
  vcnToasts.slice().forEach(function(r){if(r.n.kind==='message'&&(parseInt(r.n.actorId,10)||0)===pid)vcnRemove(r,false);});
  vcnQueue=vcnQueue.filter(function(q){return !(q.kind==='message'&&(parseInt(q.actorId,10)||0)===pid);});
  vcnMoreChip();
}
window.addEventListener('hashchange',function(){
  var hash=String(window.location.hash||'');
  if(hash.indexOf('#/chat/')===0)vcnDismissChat(parseInt(hash.slice(7),10)||0);
  setTimeout(vcnPlace,450);
});
window.addEventListener('resize',vcnPlace);
window.addEventListener('load',function(){setTimeout(vcnPlace,800);});
/* ---- server notices (live poll) ---- */
function vcnCursorKey(){return 'vc_notice_cursor_'+(parseInt(state.uid,10)||0);}
function vcnCursorGet(){try{var v=localStorage.getItem(vcnCursorKey());return v===null?-1:(parseInt(v,10)||0);}catch(e){return -1;}}
function vcnCursorSet(v){try{localStorage.setItem(vcnCursorKey(),String(v));}catch(e){}}
function vcnNoticeToCard(it){
  return {kind:String(it.kind||'system'),key:'n'+it.id,noticeId:parseInt(it.id,10)||0,actorId:parseInt(it.actor_id,10)||0,name:it.name||'',photo:it.photo||'',title:it.title||'',body:it.body||'',at:parseInt(it.at,10)||0,route:it.route||'',meta:(it.meta&&typeof it.meta==='object')?it.meta:{},unread:!parseInt(it.read,10),onlineNow:!!parseInt(it.online_now,10)};
}
/* initOnly: the first answer on this device only sets the cursor, so history never pops up. */
function vcnSyncNotices(r,initOnly){
  if(!r||r.notice_unread==null||!state.me)return;
  state.me.notice_unread=parseInt(r.notice_unread,10)||0;
  var max=parseInt(r.notice_max,10)||0,cursor=vcnCursorGet();
  if(cursor<0){vcnCursorSet(max);}
  else if(!initOnly){
    var items=Array.isArray(r.notices)?r.notices:[],top=cursor,i;
    for(i=0;i<items.length;i++){var it=items[i],id=parseInt(it&&it.id,10)||0;if(!id||id<=cursor)continue;if(id>top)top=id;vcnShow(vcnNoticeToCard(it));}
    if(top>cursor)vcnCursorSet(top);else if(max>cursor&&!items.length)vcnCursorSet(max);
  }
  updateChatsBadge();
}
/* ---- notification centre ---- */
function vcnFilterMatch(f,kind){
  switch(f){
    case 'chats':return kind==='message'||kind==='photo'||kind==='gift'||kind==='offer';
    case 'likes':return kind==='like'||kind==='match';
    case 'guests':return kind==='guest';
    case 'online':return kind==='online';
    case 'money':return kind==='topup'||kind==='promo';
    default:return true;
  }
}
function vcnHintKind(type){
  type=String(type||'').toLowerCase();
  if(type.indexOf('like')>=0)return 'like';if(type.indexOf('guest')>=0||type.indexOf('visit')>=0)return 'guest';if(type.indexOf('match')>=0)return 'match';
  if(type.indexOf('message')>=0||type.indexOf('chat')>=0)return 'message';if(type.indexOf('gift')>=0)return 'gift';return 'hint';
}
function vcnCollect(notices,likes,guests,hints){
  var items=[],i,n;
  var chats=state.chats||(state.me&&state.me.inbox)||[];
  for(i=0;i<chats.length;i++){
    var c=chats[i]||{},cid=parseInt(c.peer_id||c.id,10)||0,unread=parseInt(c.unread,10)||0;
    if(!cid||!unread||c.last_from_me)continue;
    items.push({kind:'message',key:'c'+cid,actorId:cid,name:c.name||c.fullname||'',photo:c.photo||c.avatar||'',title:localizedPersonName(c.name||c.fullname||''),body:chatMessagePreview(c)||t('new_message','Новое сообщение'),at:chatLastActivity(c),unread:true,route:'/chat/'+cid,meta:{count:unread}});
  }
  var likeList=(likes&&likes.ok&&Array.isArray(likes.items)?likes.items:[]).slice().sort(function(a,b){return (parseInt(b.at,10)||0)-(parseInt(a.at,10)||0);}),likeNew=parseInt(state.me&&state.me.likes_new,10)||0;
  for(i=0;i<Math.min(500,likeList.length);i++){n=likeList[i];items.push({kind:'like',key:'l'+(n.id||n.user_id),actorId:parseInt(n.id||n.user_id,10)||0,name:n.name||n.fullname||'',photo:n.photo||'',title:localizedPersonName(n.name||n.fullname||'')+(n.age?', '+n.age:''),body:t('ntf_like_body','Оценил(а) вашу анкету'),at:parseInt(n.at,10)||0,unread:i<likeNew,meta:{}});}
  var guestList=(guests&&guests.ok&&Array.isArray(guests.items)?guests.items:[]).slice().sort(function(a,b){return (parseInt(b.at,10)||0)-(parseInt(a.at,10)||0);}),guestNew=parseInt(state.me&&state.me.guests_new,10)||0;
  for(i=0;i<Math.min(500,guestList.length);i++){n=guestList[i];var tm=parseInt(n.times,10)||1;items.push({kind:'guest',key:'g'+(n.id||n.user_id),actorId:parseInt(n.id||n.user_id,10)||0,name:n.name||n.fullname||'',photo:n.photo||'',title:localizedPersonName(n.name||n.fullname||'')+(n.age?', '+n.age:''),body:tm>1?t('ntf_guest_return_body','Снова посмотрел(а) вашу анкету')+' · '+tm+'×':t('ntf_guest_body','Посмотрел(а) вашу анкету'),at:parseInt(n.at,10)||0,unread:i<guestNew,meta:{}});}
  var nl=(notices&&notices.ok&&Array.isArray(notices.items))?notices.items:[];
  for(i=0;i<nl.length;i++)items.push(vcnNoticeToCard(nl[i]));
  var hs=hints&&hints.ok?(hints.items||[]):[],seen={};
  for(i=0;i<hs.length;i++){
    var x=hs[i]||{},sig=[x.id||'',x.type||'',x.actor_id||'',x.text||x.teaser||''].join('|');if(x.type==='call'||seen[sig])continue;seen[sig]=1;
    var hk=vcnHintKind(x.type),hid=parseInt(x.id,10)||0;
    var card={kind:hk,key:'h'+(hid||i),actorId:parseInt(x.actor_id||x.vp_id,10)||0,name:x.actor_name||'',photo:x.photo||'',title:x.actor_name?localizedPersonName(x.actor_name):'',body:x.text||x.teaser||x.msg||'',at:parseInt(x.at,10)||0,unread:true,meta:{}};
    items.push(card);
  }
  items.sort(function(a,b){return (b.at||0)-(a.at||0);});
  return items;
}
function vcnTrackedHtml(list){
  var head='<h3>'+h(t('ntf_tracked_title','Вы следите за анкетами'))+(list.length?' <span>'+list.length+'</span>':'')+'</h3>';
  if(!list.length)return '<section class="vcn-group vcn-tracked">'+head+'<p class="vcn-hint">'+h(t('ntf_tracked_hint','Нажмите «Сообщить, когда онлайн» в анкете — мы напишем, когда она появится в сети.'))+'</p></section>';
  var rows='';
  for(var i=0;i<list.length;i++){
    var w=list[i],name=localizedPersonName(w.name||''),st=w.online?t('ntf_status_online','в сети'):(w.last_seen?t('last_seen','была')+' '+relativePresenceTime(w.last_seen):t('ntf_status_offline','не в сети'));
    rows+='<li class="vcn-watch" data-kind="online"><span class="vcn-avatar"'+(w.photo?'':' style="background:'+avatarBg(name||'?')+'"')+' aria-hidden="true">'+(w.photo?'<img'+vcThumbSrc(w.photo)+' alt="" loading="lazy">':'<b>'+h(initials(name||'?'))+'</b>')+(w.online?'<i class="vcn-badge"></i>':'')+'</span><span class="vcn-watch-copy"><strong>'+h(name)+'</strong><small class="'+(w.online?'is-on':'')+'">'+h(st)+'</small></span><button type="button" class="vcn-btn" data-vcn-unwatch="'+(parseInt(w.id,10)||0)+'">'+h(t('ntf_stop_watch','Отключить'))+'</button></li>';
  }
  return '<section class="vcn-group vcn-tracked">'+head+'<ul class="vcn-watchlist">'+rows+'</ul></section>';
}
function vcnRenderCenter(){
  var c=vcnCenter;if(!c||!c.loaded)return;
  var scroll=c.drawer.querySelector('.vcn-scroll'),chips=c.drawer.querySelector('.vcn-chips'),f=c.filter;
  var defs=[['all',t('all','Все')],['chats',t('ntf_filter_messages','Сообщения')],['likes',t('likes','Лайки')],['guests',t('ntf_filter_guests','Просмотры')],['online',t('ntf_kind_online','Онлайн')]],ch='',i;
  for(i=0;i<defs.length;i++){
    var cnt=0;for(var j=0;j<c.items.length;j++)if(c.items[j].unread&&vcnFilterMatch(defs[i][0],c.items[j].kind))cnt++;
    ch+='<button type="button" role="tab" class="vcn-chip'+(defs[i][0]===f?' is-active':'')+(c.page?' tab'+(defs[i][0]===f?' on':''):'')+'" data-vcn-filter="'+defs[i][0]+'" aria-selected="'+(defs[i][0]===f?'true':'false')+'">'+h(defs[i][1])+(cnt?'<b>'+(cnt>99?'99+':cnt)+'</b>':'')+'</button>';
  }
  chips.innerHTML=ch;
  var shown=c.items.filter(function(n){return vcnFilterMatch(f,n.kind);}),fresh=shown.filter(function(n){return n.unread;}),older=shown.filter(function(n){return !n.unread;}).slice(0,(f==='likes'||f==='guests')?500:60);
  c.rows=[];
  function group(title,list){
    var rows='';
    for(var k=0;k<list.length;k++){c.rows.push(list[k]);rows+='<div class="vcn vcn-row'+(list[k].unread?' is-unread':'')+'" data-kind="'+h(list[k].kind)+'" data-i="'+(c.rows.length-1)+'" role="listitem" tabindex="0">'+vcnCardHtml(list[k],'row')+'</div>';}
    return '<section class="vcn-group"><h3>'+h(title)+' <span>'+list.length+'</span></h3><div class="vcn-list" role="list">'+rows+'</div></section>';
  }
  var html='';
  if(!shown.length){
    var emptyIcons={all:'bell',chats:'chat',likes:'heart',guests:'eye',online:'bell',money:'wallet'},emptyTitles={all:t('ntf_empty_title','Новых уведомлений нет'),chats:t('ntf_empty_chats','Новых сообщений нет'),likes:t('ntf_empty_likes','Лайков пока нет'),guests:t('ntf_empty_guests','Просмотров пока нет'),online:t('ntf_empty_online','Никто из отслеживаемых не в сети'),money:t('ntf_empty_money','Операций пока нет')};
html='<div class="vcn-empty"><span class="vcn-empty-icon">'+glassIcon(emptyIcons[f]||'bell')+'</span><strong>'+h(emptyTitles[f]||emptyTitles.all)+'</strong><p>'+h(f==='all'?t('ntf_empty_copy','Сообщения, лайки, просмотры и появление анкет в сети будут здесь.'):t('ntf_empty_filter_copy','Когда что-то появится, вы увидите это здесь.'))+'</p></div>';
  }else if(c.page){html+=v4NtfGroups(c,fresh.concat(older).sort(function(a,b){return (b.at||0)-(a.at||0);}));
  }else{
    if(fresh.length)html+=group(t('ntf_group_new','Новые'),fresh);
    if(older.length)html+=group(t('ntf_group_earlier','Ранее'),older);
  }
  if((f==='all'&&(c.watch||[]).length)||f==='online')html+=vcnTrackedHtml(c.watch||[]);
  scroll.innerHTML=html;
  var readAll=c.drawer.querySelector('[data-vcn="readall"]');if(readAll)readAll.hidden=!c.items.some(function(n){return n.unread&&n.kind!=='message';});
}
function vcnLoadCenter(){
  var c=vcnCenter;if(!c)return;
  var safe=function(p){return p.catch(function(){return {ok:false};});};
  Promise.all([safe(api('notices_list')),safe(api('likes_list')),safe(api('guests_list')),safe(api('hints_list')),safe(api('online_watch_list'))]).then(function(all){
    if(vcnCenter!==c)return;
    var failed=!(all[0]&&all[0].ok)&&!(all[1]&&all[1].ok)&&!(all[2]&&all[2].ok);
    if(failed){c.drawer.querySelector('.vcn-scroll').innerHTML='<div class="vcn-empty"><strong>'+h(t('ntf_load_failed','Не удалось загрузить уведомления'))+'</strong><button type="button" class="vcn-btn is-primary" data-vcn="retry">'+h(t('retry','Повторить'))+'</button></div>';return;}
    c.items=vcnCollect(all[0],all[1],all[2],all[3]);c.watch=(all[4]&&all[4].ok&&Array.isArray(all[4].items))?all[4].items:[];c.loaded=true;
    c.hadNotices=c.items.some(function(n){return n.noticeId&&n.unread;});
    vcnRenderCenter();
  });
}
function vcnReloadCenterSoon(){
  var c=vcnCenter;if(!c||!c.loaded)return;
  clearTimeout(c.reloadTimer);c.reloadTimer=setTimeout(function(){if(vcnCenter===c)vcnLoadCenter();},700);
}
function vcnMarkAllSeen(c){
  var jobs=[],me=state.me;
  if(!c||!c.loaded||!me)return;
  if((parseInt(me.notice_unread,10)||0)>0||c.hadNotices)jobs.push(api('notices_read',{all:1}).then(function(r){if(r&&r.ok)me.notice_unread=parseInt(r.unread,10)||0;}));
  if((parseInt(me.likes_new,10)||0)>0)jobs.push(api('mark_seen',{kind:'likes'}).then(function(r){if(r&&r.ok)me.likes_new=0;}));
  if((parseInt(me.guests_new,10)||0)>0)jobs.push(api('mark_seen',{kind:'guests'}).then(function(r){if(r&&r.ok)me.guests_new=0;}));
  if(!jobs.length)return;
  state.socialToastCounts={likes:parseInt(me.likes_new,10)||0,guests:parseInt(me.guests_new,10)||0};
  Promise.all(jobs.map(function(p){return p.catch(function(){});})).then(function(){state.socialToastCounts={likes:parseInt(me.likes_new,10)||0,guests:parseInt(me.guests_new,10)||0};updateChatsBadge();});
}
function vcnCloseCenter(){
  var c=vcnCenter;if(!c)return;
  vcnCenter=null;clearTimeout(c.reloadTimer);
  document.removeEventListener('keydown',c.onKey,true);
  if(c.overlay){
    c.overlay.classList.remove('is-in');
    setTimeout(function(){if(c.overlay.parentNode)c.overlay.parentNode.removeChild(c.overlay);},200);
    if(c.prev&&c.prev.focus&&document.contains(c.prev))setTimeout(function(){c.prev.focus();},0);
  }
  vcnMarkAllSeen(c);
}
function vcnOpenCenter(host){
  if(vcnCenter){if(!host)return;vcnCloseCenter();}
  var page=!!host,overlay=page?null:el('div',{class:'vcn-overlay'}),drawer=page?el('section',{class:'vcn-drawer is-page','aria-labelledby':'vcn-center-title'}):el('aside',{class:'vcn-drawer',role:'dialog','aria-modal':'true','aria-labelledby':'vcn-center-title',tabindex:'-1'});
  drawer.innerHTML='<header class="vcn-drawer-head"><div><small>otkrovenno.online</small><h2 id="vcn-center-title">'+h(t('notifications','Уведомления'))+'</h2></div><div class="vcn-drawer-tools"><button type="button" class="vcn-linkbtn" data-vcn="readall" hidden>'+h(t('ntf_mark_all','Прочитать все'))+'</button>'+(page?'':'<button type="button" class="vcn-x" data-vcn="close" aria-label="'+h(t('close','Закрыть'))+'">'+glassIcon('close')+'</button>')+'</div></header><nav class="vcn-chips" role="tablist" aria-label="'+h(t('notifications','Уведомления'))+'"></nav><div class="vcn-scroll"><div class="spin"></div></div><footer class="vcn-drawer-foot"><button type="button" data-vcn="settings">'+glassIcon('settings')+'<span>'+h(t('ntf_settings_link','Настроить уведомления'))+'</span></button></footer>';
  if(page){host.innerHTML='';host.appendChild(drawer);}else{overlay.appendChild(drawer);document.body.appendChild(overlay);}
  var c=vcnCenter={overlay:overlay,drawer:drawer,page:page,prev:document.activeElement,filter:(state.vcnStartFilter||'all'),items:[],watch:[],rows:[],loaded:false,hadNotices:false,reloadTimer:null};state.vcnStartFilter='';
  c.onKey=function(e){
    if(e.key==='Escape'){var openReply=drawer.querySelector('.vcn-reply:not([hidden])');if(openReply&&drawer.contains(document.activeElement))return;e.preventDefault();vcnCloseCenter();return;}
    if(e.key!=='Tab')return;
    var f=Array.prototype.filter.call(drawer.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'),function(x){return x.offsetParent!==null;});
    if(!f.length){e.preventDefault();return;}
    var first=f[0],last=f[f.length-1];
    if(e.shiftKey&&(document.activeElement===first||document.activeElement===drawer)){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  if(!page){document.addEventListener('keydown',c.onKey,true);overlay.addEventListener('click',function(e){if(e.target===overlay)vcnCloseCenter();});}
  drawer.addEventListener('click',function(e){
    var tg=e.target;if(!tg||!tg.closest)return;
    var ctl=tg.closest('[data-vcn]');
    if(ctl){
      var what=ctl.dataset.vcn;
      if(what==='close')vcnCloseCenter();
      else if(what==='readall'){vcnMarkAllSeen(c);c.items.forEach(function(n){if(n.kind!=='message')n.unread=false;});vcnRenderCenter();}
      else if(what==='retry'){drawer.querySelector('.vcn-scroll').innerHTML='<div class="spin"></div>';vcnLoadCenter();}
      else if(what==='settings'){vcnCloseCenter();navigate('/settings');}
      
      return;
    }
    var chip=tg.closest('[data-vcn-filter]');if(chip){c.filter=chip.dataset.vcnFilter;vcnRenderCenter();var sc=drawer.querySelector('.vcn-scroll');if(sc)sc.scrollTop=0;return;}
    var un=tg.closest('[data-vcn-unwatch]');
    if(un){
      var wid=parseInt(un.dataset.vcnUnwatch,10)||0;un.disabled=true;
      api('online_watch_toggle',{virtual:wid}).then(function(r){
        if(r&&r.ok&&!r.armed){c.watch=c.watch.filter(function(w){return (parseInt(w.id,10)||0)!==wid;});vcnRenderCenter();toast(t('ntf_watch_stopped','Слежение отключено'),'success');}
        else{un.disabled=false;if(r&&r.ok&&r.armed)api('online_watch_toggle',{virtual:wid});}
      }).catch(function(){un.disabled=false;toast(t('network_error','Ошибка сети'),'error');});
      return;
    }
    var row=tg.closest('.vcn-row');if(!row||tg.closest('form,input'))return;
    var n=c.rows[parseInt(row.dataset.i,10)];if(!n)return;
    var rec={n:n,node:row,isToast:false,close:vcnCloseCenter};
    var btn=tg.closest('[data-vcn-act]');
    vcnActivate(rec,btn?n.actions[parseInt(btn.dataset.vcnAct,10)]:vcnDefaultAction(n.actions||[]));
  });
  drawer.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&e.target&&e.target.classList&&e.target.classList.contains('vcn-row')){e.preventDefault();var n=c.rows[parseInt(e.target.dataset.i,10)];if(n)vcnActivate({n:n,node:e.target,isToast:false,close:vcnCloseCenter},vcnDefaultAction(n.actions||[]));}
  });
  if(overlay)requestAnimationFrame(function(){overlay.classList.add('is-in');var x=drawer.querySelector('.vcn-x');if(x)x.focus();});
  vcnLoadCenter();
}
/* Compatibility entry point: every caller now renders the shared v7 card. */
function showSignalToast(kind,data){
  data=data||{};
  return vcnShow({kind:kind,key:data.key,actorId:data.actorId,name:data.actorName||data.title||'',photo:data.photo||'',title:data.title||'',body:data.body||'',route:data.route||'',at:data.at});
}
function socialToastLimiterAllows(kind){
  var now=Date.now(),day=notificationDayKey();
  if(state.socialToastDay!==day){state.socialToastDay=day;state.socialToastDayCount=0;}
  var gap=kind==='like'?10000:1800000;
  if(now-(state.socialToastLastAt[kind]||0)<gap||state.socialToastDayCount>=2)return false;
  state.socialToastLastAt[kind]=now;state.socialToastDayCount++;return true;
}
function showSocialSignalToast(kind,item,count){
  item=item||{};var actorId=parseInt(item.id||item.user_id,10)||0,name=localizedPersonName(item.name||item.fullname||t('someone','Кто-то')),times=parseInt(item.times,10)||1;
  if(!actorId||!notificationEventAllowed(kind)||!socialToastLimiterAllows(kind))return;
  var isGuest=kind==='guest',body=(isGuest&&count>1)?t('guests_group_body','Новых просмотров: {n}').replace('{n}',count):(isGuest?(times>1?t('ntf_guest_return_body','Снова посмотрел(а) вашу анкету'):t('ntf_guest_body','Посмотрел(а) вашу анкету')):t('ntf_like_body','Оценил(а) вашу анкету'));
  vcnShow({kind:kind,key:kind+':'+actorId,actorId:actorId,name:name,photo:item.photo||'',title:name+(item.age?', '+item.age:''),body:body,at:parseInt(item.at,10)||Math.floor(Date.now()/1000)});
}
function syncSocialNotificationToasts(next){
  if(!next||!state.me)return;
  var likes=parseInt(next.likes_new,10)||0,guests=parseInt(next.guests_new,10)||0;
  if(!state.socialToastReady){state.socialToastReady=true;state.socialToastCounts={likes:likes,guests:guests};return;}
  var prevC=state.socialToastCounts,likeRaised=likes>prevC.likes,guestRaised=guests>prevC.guests,guestDelta=guests-prevC.guests;
  state.socialToastCounts={likes:likes,guests:guests};
  if(!likeRaised&&!guestRaised)return;
  if(likeRaised){apiRequest('likes_list').then(function(r){var it=r&&r.items&&r.items[0];if(it)showSocialSignalToast('like',it,1);});}
  else if(guestRaised){apiRequest('guests_list').then(function(r){var it=r&&r.items&&r.items[0];if(it)showSocialSignalToast('guest',it,guestDelta);});}
}
function localizedErrorText(value, fallback){
  var raw=String(value||fallback||'').trim();
  if(!raw)return t('action_failed','Не удалось выполнить действие');
  if(raw==='Error')return t('error','Ошибка');
  if(raw==='Network error')return t('network_error','Ошибка сети');
  if(window.I18N&&typeof window.I18N.has==='function'&&window.I18N.has(raw))return t(raw);
  if(/^[a-z0-9_-]+$/i.test(raw))return t('action_failed','Не удалось выполнить действие');
  return raw;
}
function vcSurfaceModalError(text){
  try{
    var sum=document.querySelector('.vc-modal-layer .vc-purchase-summary');
    if(!sum)return false;
    var slot=sum.parentNode.querySelector('.vc-purchase-error');
    if(!slot){slot=document.createElement('div');slot.className='vc-purchase-error';slot.setAttribute('role','alert');sum.parentNode.insertBefore(slot,sum.nextSibling);}
    slot.textContent=String(text==null?'':text);
    slot.style.display='';
    return true;
  }catch(e){return false;}
}
function handleApiError(r, fallback){
  var err = (r && r.err) || fallback || 'Error';
  if(/^[a-z0-9_.-]{2,60}$/i.test(String(err)))state.lastError={code:String(err),at:Date.now()};
  if(err==='tos_required'){toast(t('tos_not_accepted','Для операции нужно принять Условия использования'),'error');return true;}
  if (err === 'low_balance' || err === 'insufficient' || err === 'insufficient_balance'){
    openQuickBuy(r);
    return true;
  }
  if(err==='price_changed'){var pcMsg=t('price_changed','Цена изменилась. Проверьте и подтвердите ещё раз.')+(r&&r.price!=null?' · '+vibeAmount(r.price):'');toast(pcMsg,'error');vcSurfaceModalError(pcMsg);refreshLiveStateSoon(100);return true;}
  var geMsg=localizedErrorText(err, fallback);toast(geMsg, 'error');vcSurfaceModalError(geMsg);
  return false;
}
function fileToDataUrl(file, maxBytes){
  return new Promise(function(resolve,reject){
    if (!file) { reject(new Error('no_file')); return; }
    if (maxBytes && file.size > maxBytes){ reject(new Error('too_big')); return; }
    var reader = new FileReader();
    reader.onload = function(){ resolve(String(reader.result||'')); };
    reader.onerror = function(){ reject(new Error('read_failed')); };
    reader.readAsDataURL(file);
  });
}
function isImageFileCandidate(file){
  if(!file)return false;
  var type=String(file.type||'').toLowerCase(),name=String(file.name||'').toLowerCase();
  return type.indexOf('image/')===0||/\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}
function imageFileToDataUrl(file,maxBytes,maxSide){
  maxBytes=maxBytes||8*1024*1024;maxSide=maxSide||2048;
  return new Promise(function(resolve,reject){
    if(!isImageFileCandidate(file)){reject(new Error('bad_type'));return;}
    var objectUrl='';try{objectUrl=URL.createObjectURL(file);}catch(e){reject(new Error('read_failed'));return;}
    var img=new Image();
    function done(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}}
    img.onerror=function(){done();reject(new Error(/\.(heic|heif)$/i.test(String(file.name||''))||/hei[cf]/i.test(String(file.type||''))?'heic_unsupported':'read_failed'));};
    img.onload=function(){
      var ow=img.naturalWidth||img.width,oh=img.naturalHeight||img.height;if(!ow||!oh){done();reject(new Error('read_failed'));return;}
      var scale=Math.min(1,maxSide/Math.max(ow,oh)),w=Math.max(1,Math.round(ow*scale)),hh=Math.max(1,Math.round(oh*scale));
      var canvas=document.createElement('canvas');canvas.width=w;canvas.height=hh;var ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx){done();reject(new Error('read_failed'));return;}ctx.fillStyle='#fff';ctx.fillRect(0,0,w,hh);ctx.drawImage(img,0,0,w,hh);done();
      var qualities=[.9,.82,.74,.66],qi=0;
      function encode(){canvas.toBlob(function(blob){if(!blob){reject(new Error('read_failed'));return;}if(blob.size>maxBytes&&qi<qualities.length-1){qi++;encode();return;}if(blob.size>maxBytes){reject(new Error('too_big'));return;}fileToDataUrl(blob,maxBytes).then(resolve,reject);},'image/jpeg',qualities[qi]);}
      encode();
    };
    img.src=objectUrl;
  });
}
/* Glass PNG icons are retired: every icon renders as a prototype-style line SVG. */
function glassIcon(name,className){var k=VC_GLASS_TO_LINE[String(name||'')]||String(name||'');return '<svg class="vc-glass-icon'+(className?' '+className:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(VC_LINE_ICONS[k]||VC_LINE_ICONS.star)+'</svg>';}
/* Prototype line icons (design-prototype-20261002) — thin stroke set for the rebuilt shell and discover view. */
var VC_LINE_ICONS={
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.2 4.2 0 0 0 7 0"/><path d="M9 9.8h.01M15 9.8h.01"/>',
  heart:'<path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>',
  chat:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-8.5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  settings:'<path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1 .5 2h4l.5-2 2-1 2 .5 2-3L19 13v-3l1.5-1.5-2-3-2 .5-2-1-.5-2Z"/><circle cx="11" cy="11.5" r="3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  moon:'<path d="M20.5 14A9 9 0 0 1 10 3a9 9 0 1 0 10.5 11Z"/>',
  pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  'chevron-right':'<path d="m9 5 7 7-7 7"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sliders:'<path d="M4 6h3m4 0h9M4 18h9m4 0h3M4 12h9m4 0h3"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  sparkles:'<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7ZM20 2v4m-2-2h4"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  undo:'<path d="M4 4v6h6M4 10a8 8 0 1 1 1 8"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  verified:'<path d="m12 2 3 2 3.5.5.7 3.5 2 3-2 3-.7 3.5-3.5.5-3 2-3-2-3.5-.5-.7-3.5-2-3 2-3 .7-3.5L9 4Z"/><path d="m8 11 3 3 5-5" fill="none"/>',
  shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  refresh:'<path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5M4 17a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/>',
  coffee:'<path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 9h2a3 3 0 0 1 0 6h-2M7 2v3M12 2v3M2 22h17"/>',
  travel:'<path d="m22 2-7 20-4-9-9-4ZM22 2 11 13"/>',
  film:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4m-4 8h4M17 8h4m-4 8h4M7 12h10"/>',
  book:'<path d="M12 5C8 2 3 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-1-1-6-2-10 1Zm0 0v16"/>',
  music:'<path d="M9 18V5l12-3v14M9 9l12-3"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
  leaf:'<path d="M20 3C5 1 1 10 6 17c7 5 16 1 14-14ZM4 21l10-10"/>',
  art:'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-4c-1-1 0-3 2-3h2c4 0 2-11-7-11Z"/><path d="M7 8h.01M12 6h.01M17 8h.01M6 13h.01" stroke-width="3"/>',
  sea:'<path d="M2 8q3-4 5 0t5 0 5 0 5 0M2 14q3-4 5 0t5 0 5 0 5 0M2 20q3-4 5 0t5 0 5 0 5 0"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  send:'<path d="m22 2-7 20-4-9-9-4ZM22 2 11 13"/>',
  'chat-spark':'<path d="M19 14a8 8 0 0 1-7 6H4l-1 1v-9a8 8 0 0 1 10-8"/><path d="m18 2 1.3 3.7L23 7l-3.7 1.3L18 12l-1.3-3.7L13 7l3.7-1.3Z"/><path d="M7 12h4M7 16h7"/>',
  'arrow-up-right':'<path d="M6 18 18 6M6 6h12v12"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  back:'<path d="m15 5-7 7 7 7"/>',
  store:'<path d="M5 8h14l-1.2 12H6.2Z"/><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/>',
  gift:'<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M4 13h16M12 9v11M8.5 9a2.5 2.5 0 1 1 2-4c.8.9 1.5 2.5 1.5 4M15.5 9a2.5 2.5 0 1 0-2-4c-.8.9-1.5 2.5-1.5 4"/>',
  sticker:'<path d="M21 12a9 9 0 1 1-9-9c5 0 9 4 9 9Z"/><path d="M12 21c0-5 4-9 9-9"/><path d="M9 10h.01M15 10h.01M9.5 14.5c.8.7 1.6 1 2.5 1"/>',
  ideas:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.4.6 1.2.6 1.7v.5h6v-.5c0-.5 0-1.3.6-1.7A6 6 0 0 0 12 3Z"/>',
  wish:'<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Zm7-1v4m-2-2h4"/>',
  attach:'<path d="m21.4 11.1-8.5 8.5a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  more:'<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
  block:'<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  unblock:'<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
  edit:'<path d="m5 19-1 1 4-1L20 7a2.1 2.1 0 0 0-3-3L5 16Z"/>',
  camera:'<path d="M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.5"/>',
  trash:'<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  wallet:'<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M3 7V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1M16 13h3"/>',
  crown:'<path d="m3 8 4 3 5-6 5 6 4-3-2 11H5Z"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  'theme-system':'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  game:'<path d="M17.5 5h-11A4.5 4.5 0 0 0 2 9.5c0 5 2.5 9.5 5 9.5 1.5 0 2-1 3.5-1h3c1.5 0 2 1 3.5 1 2.5 0 5-4.5 5-9.5A4.5 4.5 0 0 0 17.5 5Z"/><path d="M6 9h4M8 7v4M15 8h.01M18 10h.01" stroke-width="2.2"/>',
  eye:'<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  language:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><ellipse cx="12" cy="12" rx="4" ry="9"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 21h16"/>',
  bolt:'<path d="M13 2 4 14h6l-1 8 9-12h-6Z"/>'
};
var VC_GLASS_TO_LINE={discover:'compass',chats:'chat',matches:'heart',store:'store',top:'star',profile:'user',activity:'bell',hub:'bell',settings:'settings',rewind:'undo',pass:'close',like:'heart',message:'chat',gift:'gift',sticker:'sticker',ideas:'ideas',wish:'wish',back:'back',attach:'attach',send:'send',bell:'bell',more:'more',down:'chevron-down',report:'shield',block:'block',unblock:'unblock',edit:'edit',camera:'camera',trash:'trash',location:'pin',lock:'lock',check:'check',star:'star',wallet:'wallet',crown:'crown',logout:'logout','theme-light':'sun','theme-dark':'moon','theme-system':'theme-system',search:'search',filter:'sliders',timer:'timer',game:'game',close:'close',eye:'eye',language:'language',download:'download','guest-man':'user','guest-woman':'user','guest-women':'people','guest-men':'people','guest-everyone':'people'};
function vcBrandMark(){return '<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 34C15 29 3 22 3 12a9 9 0 0 1 17-4 9 9 0 0 1 17 4c0 10-12 17-17 22Z" fill="currentColor"/><path d="m12 17 6 7 11-13" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';}
function vcIcon(name,className){var path=VC_LINE_ICONS[String(name||'')]||VC_LINE_ICONS.sparkles;return '<svg class="p-icon'+(className?' '+className:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>';}
function vcInterestIcon(value){var m={'кофе':'coffee','coffee':'coffee','путешествия':'travel','travel':'travel','кино':'film','film':'film','книги':'book','books':'book','музыка':'music','music':'music','природа':'leaf','nature':'leaf','искусство':'art','art':'art','море':'sea','sea':'sea'};var k=String(value||'').toLowerCase();return vcIcon(m[k]||'sparkles');}
var VC_GLASS_ICON_NAMES={discover:1,chats:1,matches:1,store:1,top:1,profile:1,activity:1,hub:1,settings:1,rewind:1,pass:1,like:1,message:1,gift:1,sticker:1,ideas:1,wish:1,back:1,attach:1,send:1,bell:1,more:1,down:1,report:1,block:1,unblock:1,edit:1,camera:1,trash:1,location:1,lock:1,check:1,star:1,wallet:1,crown:1,logout:1,'theme-light':1,'theme-dark':1,'theme-system':1,search:1,filter:1,timer:1,game:1,close:1,eye:1,language:1,download:1,'guest-man':1,'guest-woman':1,'guest-women':1,'guest-men':1,'guest-everyone':1};
var VC_GLASS_ICON_SYMBOLS={'✦':'star','◇':'star','◆':'crown','●':'bell','◌':'bell','✓':'check','✔':'check','❤':'like','♥':'like','💕':'matches','💬':'message','👋':'message','👁':'eye','🏆':'top','🎮':'game','🔐':'lock','🔒':'lock','🔓':'lock','🔔':'bell','✨':'hub','💡':'ideas','💰':'wallet','💳':'wallet','↗':'wallet','🎁':'gift','📷':'camera','📸':'camera','🗑':'trash','⌖':'location','📍':'location','☀':'theme-light','☾':'theme-dark','◐':'theme-system','↪':'logout','🔥':'activity','⏱':'timer','⌕':'search','📱':'download','⚑':'report','!':'report','⊘':'block','↩':'unblock','♾':'crown','×':'close','✕':'close'};
function semanticGlassIcon(value,className,fallback){
  var raw=String(value||''),key=VC_GLASS_ICON_SYMBOLS[raw]||raw.replace(/^icon-/,'').replace(/_/g,'-');
  if(!VC_GLASS_ICON_NAMES[key])key=fallback||'star';
  return glassIcon(key,'vc-semantic-icon'+(className?' '+className:''));
}

/* ===== Appearance — light / dark / system ===== */
var VC_THEME_KEY='vc_theme';
var vcThemeMedia=null;
function normalizeTheme(value){value=String(value||'').toLowerCase();return value==='light'||value==='dark'||value==='system'?value:'light';}
function storedTheme(){try{return normalizeTheme(localStorage.getItem(VC_THEME_KEY));}catch(e){return 'light';}}
function resolvedTheme(preference){preference=normalizeTheme(preference);if(preference!=='system')return preference;return window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}
function themeAccessibleLabel(preference,resolved){
  var label=t('theme','Тема')+' · '+t(resolved==='light'?'theme_light':'theme_dark',resolved==='light'?'Светлая':'Тёмная');
  if(preference==='system')label+=' · '+t('theme_system','Как в системе');
  return label;
}
function syncThemeControls(preference,resolved){
  preference=normalizeTheme(preference);resolved=resolved||resolvedTheme(preference);
  var railButton=document.querySelector('[data-rail-theme-toggle]');
  if(railButton){
    var railLabel=themeAccessibleLabel(preference,resolved),next=resolved==='light'?'dark':'light';
    railButton.setAttribute('aria-checked',resolved==='dark'?'true':'false');railButton.setAttribute('aria-label',railLabel);railButton.setAttribute('title',railLabel);
    var railIcon=railButton.querySelector('.vc-rail-theme-current');if(railIcon)railIcon.innerHTML=semanticGlassIcon('theme-'+resolved);
    var railStrong=railButton.querySelector('.vc-rail-theme-copy strong');if(railStrong)railStrong.textContent=t(resolved==='light'?'theme_light':'theme_dark',resolved==='light'?'Светлая':'Тёмная');
    var railSmall=railButton.querySelector('.vc-rail-theme-copy small');
    if(preference==='system'){if(!railSmall){railSmall=document.createElement('small');var copy=railButton.querySelector('.vc-rail-theme-copy');if(copy)copy.appendChild(railSmall);}if(railSmall)railSmall.textContent=t('theme_system','Как в системе');}
    else if(railSmall)railSmall.remove();
    var railTrack=railButton.querySelector('.vc-rail-theme-track');if(railTrack)railTrack.dataset.nextTheme=next;
  }
  var quick=document.getElementById('vc-theme-quick');
  if(quick){var nextTheme=resolved==='light'?'dark':'light',quickLabel=t('theme','Тема')+' · '+t(nextTheme==='light'?'theme_light':'theme_dark',nextTheme==='light'?'Светлая':'Тёмная');quick.setAttribute('aria-label',quickLabel);quick.setAttribute('title',quickLabel);quick.innerHTML=semanticGlassIcon('theme-'+nextTheme);}
  $$('[data-vc-theme]').forEach(function(button){var active=button.dataset.vcTheme===preference;button.classList.toggle('is-active',active);button.setAttribute('aria-checked',active?'true':'false');button.tabIndex=active?0:-1;});
}
function applyTheme(preference,persist){
  preference=normalizeTheme(preference);var resolved=resolvedTheme(preference),root=document.documentElement;
  state.theme=preference;state.resolvedTheme=resolved;
  root.setAttribute('data-theme',resolved);root.setAttribute('data-theme-preference',preference);root.style.colorScheme=resolved;
  var colorScheme=document.querySelector('meta[name="color-scheme"]');if(colorScheme)colorScheme.setAttribute('content','light dark');
  var themeColor=document.querySelector('meta[name="theme-color"]');if(themeColor)themeColor.setAttribute('content',resolved==='light'?'#faf9f6':'#1e211f');
  var appleStatus=document.getElementById('vc-apple-status-bar');if(appleStatus)appleStatus.setAttribute('content',resolved==='light'?'default':'black-translucent');
  if(persist!==false){try{localStorage.setItem(VC_THEME_KEY,preference);}catch(e){}}
  syncThemeControls(preference,resolved);
  window.dispatchEvent(new CustomEvent('vc-theme-change',{detail:{preference:preference,resolved:resolved}}));
  return resolved;
}
function initTheme(){
  applyTheme(storedTheme(),false);
  if(!window.matchMedia)return;
  vcThemeMedia=window.matchMedia('(prefers-color-scheme: dark)');
  var onSystemChange=function(){if(state.theme==='system')applyTheme('system',false);};
  if(vcThemeMedia.addEventListener)vcThemeMedia.addEventListener('change',onSystemChange);else if(vcThemeMedia.addListener)vcThemeMedia.addListener(onSystemChange);
}

/* ===== Contextual progressive-profile intent ===== */
var VC_PROFILE_INTENT_KEY='vc_profile_intent';
function findIntentProfile(id,hint){
  id=parseInt(id,10)||0;hint=hint||{};var pools=[state.profileDetail||{},hint],i,j,row;
  for(i=0;i<(state.deckAll||[]).length;i++)pools.push(state.deckAll[i]);
  for(j=0;j<(state.chats||[]).length;j++)pools.push(state.chats[j]);
  for(i=0;i<pools.length;i++){row=pools[i]||{};if((parseInt(row.id||row.user_id||row.peer_id||row.virtual_id,10)||0)===id)return {id:id,name:row.name||row.fullname||row.peer_name||'',photo:row.photo||row.avatar||'',city:row.city||row.location||''};}
  return {id:id,name:hint.name||hint.fullname||'',photo:hint.photo||hint.avatar||'',city:hint.city||''};
}
function readProfileIntent(){
  var value=state.profileIntent;try{if(!value)value=JSON.parse(sessionStorage.getItem(VC_PROFILE_INTENT_KEY)||'null');}catch(e){value=null;}
  if(!value||!value.profile_id||!value.action||!value.at||Date.now()-value.at>24*60*60*1000){clearProfileIntent();return null;}
  state.profileIntent=value;return value;
}
function rememberProfileIntent(action,profileId,hint,returnRoute){
  profileId=parseInt(profileId,10)||0;if(!profileId)return null;
  var profile=findIntentProfile(profileId,hint),intent={action:action==='like'?'like':'message',profile_id:profileId,profile:profile,return_route:returnRoute||state.route||'/',at:Date.now()};
  state.profileIntent=intent;try{sessionStorage.setItem(VC_PROFILE_INTENT_KEY,JSON.stringify(intent));}catch(e){}return intent;
}
function clearProfileIntent(){state.profileIntent=null;try{sessionStorage.removeItem(VC_PROFILE_INTENT_KEY);}catch(e){}}
function resumeProfileIntent(fallbackCard,completedIntent){
  var intent=completedIntent||readProfileIntent();if(!intent)return false;clearProfileIntent();
  var profile=findIntentProfile(intent.profile_id,fallbackCard||intent.profile||{});
  if(intent.action==='like'){
    if(String(intent.return_route||'').indexOf('/profile/')===0){api('profile_like',{virtual:intent.profile_id}).then(function(r){if(!r||!r.ok){handleApiError(r,'Error');return;}profile.liked=!!r.liked;if(state.profileDetail&&(parseInt(state.profileDetail.id||state.profileDetail.user_id,10)||0)===intent.profile_id)state.profileDetail.liked=profile.liked;if(state.route==='/profile/'+intent.profile_id)viewProfileDetail(intent.profile_id);if(profile.liked)showLikeSuccess(profile);}).catch(function(){toast(t('network_error','Ошибка сети'),'error');});return true;}
    submitDeckLike(Object.assign({},fallbackCard||intent.profile||{},profile));return true;
  }
  navigate('/chat/'+intent.profile_id);return true;
}
function gateProfileIntent(action,profileId,hint,returnRoute){
  if(!guestNeedsProfileGate()||state.profileGateOpen)return false;
  var intent=rememberProfileIntent(action,profileId,hint,returnRoute);if(!intent)return false;
  showGuestProfileGate(findIntentProfile(profileId,hint),function(completedIntent){resumeProfileIntent(hint,completedIntent);});return true;
}

/* ===== Boot ===== */
var VC_SUPPORTED_LANGS=['uk','ru'];
function normalizeAppLanguage(value){
  var lang=String(value||'').trim().toLowerCase().split(/[-_]/)[0];
  if(lang==='uk')lang='ru'; /* Ukrainian is hidden (owner request 2026-10-02) */
  return VC_SUPPORTED_LANGS.indexOf(lang)>=0?lang:'';
}
function syncStaticLocale(){
  var updateBtn=document.getElementById('pwa-update-btn');if(updateBtn)updateBtn.remove();
  var installBtn=document.getElementById('install-btn');if(installBtn)installBtn.innerHTML=semanticGlassIcon('download','vc-install-inline-icon')+'<span>'+h(t('install_prompt','Установить приложение'))+'</span>';
  var offline=document.querySelector('#offline-banner span');if(offline)offline.innerHTML=semanticGlassIcon('report','vc-offline-inline-icon')+'<span>'+h(t('offline','Офлайн — данные могут быть устаревшими'))+'</span>';
}
function applyAppLanguage(value,source,refresh){
  var lang=normalizeAppLanguage(value)||'ru';
  if(window.I18N){
    if(source==='manual')window.I18N.set(lang,true);
    else if(source==='account'&&typeof window.I18N.useAccount==='function')window.I18N.useAccount(lang);
    else window.I18N.set(lang,false);
  }
  state.lang=lang;
  syncStaticLocale();
  if(refresh){
    var rail=document.getElementById('vc-rail');if(rail){rail.innerHTML=railHtml();wireRail();}
    var bn=document.getElementById('vc-bottom-nav');if(bn){bn.innerHTML=bottomNavHtml();wireBottomNav();}
    renderTopbar();
    setTimeout(router,0);
  }
  return lang;
}
function syncAccountLanguage(payload){
  var accountLang=normalizeAppLanguage(payload&&payload.lang);
  var localSource=window.I18N&&window.I18N.source||'';
  var current=normalizeAppLanguage(state.lang)||'ru';
  if(localSource==='manual'){
    if(accountLang!==current&&!state.languageSyncPending){
      state.languageSyncPending=true;
      api('set_lang',{lang:current}).then(function(){state.languageSyncPending=false;}).catch(function(){state.languageSyncPending=false;});
    }
    return false;
  }
  if(accountLang){
    if(accountLang!==current)applyAppLanguage(accountLang,'account',false);
    else if(window.I18N)window.I18N.source='account';
    return accountLang!==current;
  }
  if(!state.languageSyncPending){
    state.languageSyncPending=true;
    api('set_lang',{lang:current}).then(function(){state.languageSyncPending=false;}).catch(function(){state.languageSyncPending=false;});
  }
  return false;
}
/* Missing media (404/offline) must never render a broken-image glyph. */
var VC_IMG_FALLBACK='/app/assets/photo-placeholder.svg';
function installImageFallback(){
  /* Images are reused (story carousel swaps src), so state is keyed by the failing URL, not the element. */
  document.addEventListener('error',function(e){
    var img=e.target;
    if(!img||img.tagName!=='IMG')return;
    var src=img.getAttribute('src')||'';
    if(src===VC_IMG_FALLBACK||/\/app\/assets\//.test(src)){img.style.visibility='hidden';return;}
    img.dataset.vcBroken=src;img.removeAttribute('srcset');img.classList.add('vc-img-broken');img.style.visibility='';
    img.src=VC_IMG_FALLBACK;
  },true);
  document.addEventListener('load',function(e){
    var img=e.target;
    if(!img||img.tagName!=='IMG'||!img.dataset.vcBroken)return;
    var loaded=img.getAttribute('src')||'';if(loaded!==VC_IMG_FALLBACK){delete img.dataset.vcBroken;img.classList.remove('vc-img-broken');img.style.visibility='';}
  },true);
}
function boot(){
  installImageFallback();
  initTheme();
  var meta = document.querySelector('meta[name="vc-boot"]');
  var bootLang = '';
  if (meta){
    try { var b = JSON.parse(meta.content); state.uid = b.uid||0; bootLang = b.lang||''; state.smart=b.smart||{}; state.cityCatalog=Array.isArray(b.cities)?b.cities:[]; }
    catch(e){}
  }
  state.lang = normalizeAppLanguage((window.I18N&&window.I18N.lang)||bootLang)||'ru';
  if (window.I18N && state.lang) window.I18N.set(state.lang,false);
  syncStaticLocale();

  clearTimeout(window._vcBootTimeout);
  var bs = document.getElementById('boot-screen');
  var app = document.getElementById('app');
  if (app) { app.hidden = false; app.style.display = 'grid'; app.classList.add('ready'); app.setAttribute('aria-busy','true'); }
  if(!navigator.onLine){var offline=document.getElementById('offline-banner');if(offline)offline.hidden=false;}
  if(window._vcInstallPrompt)state.installPrompt=window._vcInstallPrompt;

  window.addEventListener('hashchange', router);
  window.addEventListener('online', function(){ var b = document.getElementById('offline-banner'); if (b) b.hidden = true; toast(t('online','Онлайн'), 'success'); refreshLiveStateSoon(100); });
  window.addEventListener('offline', function(){ var b = document.getElementById('offline-banner'); if (b) b.hidden = false; });
  window.addEventListener('pwa-installable', function(){ state.installPrompt = window._vcInstallPrompt; });
  window.addEventListener('pwa-installed', function(){ toast(t('installed_toast','Установлено'), 'success'); state.installPrompt = null; });
  window.addEventListener('resize', onResize);
  window.addEventListener('pageshow',function(){refreshLiveStateSoon(100);});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){refreshLiveStateSoon(100);if(state.currentChat)setTimeout(pollChat,120);}else if(state.chatPollTimer){clearTimeout(state.chatPollTimer);state.chatPollTimer=null;}});

  onResize();
  wireServiceWorkerMessages();
  hydratePushSubscription();
  /* Always resolve the cookie session before routing. Calling router explicitly is
     important when the page is reloaded while already on #/onboarding: assigning
     the same hash does not emit hashchange in browsers. */
  loadAuthMeta().then(function(r){
    if (r && r.ok) return loadMe();
    if(readGuestAccessMarker()>0){
      /* Do not silently create a second guest over an expired/lost session.
         The recovery screen keeps the old paid/profile UID from being orphaned. */
      state.guestRecoveryNeeded=true;state.uid=0;state.me=null;
      return null;
    }
    return startGuestPreview();
  }).catch(function(){
    return state.uid ? loadMe() : null;
  }).then(function(){
    router();if(app)app.setAttribute('aria-busy','false');if(bs)bs.style.display='none';startLiveStatePoll();
    if(!state.uid){funnelTrackAnon('landing_view',{entry:(state.smart&&Object.keys(state.smart).length)?'smart_link':'direct'},'landing');}
    if(state.uid){setTimeout(function(){reconcilePendingCryptoPayment();maybePromptAccountRecovery(false);},250);}
    if(state.uid){
      funnelTrack('landing_view',{entry:state.smart&&Object.keys(state.smart).length?'smart_link':'direct'},'landing');
      var last=0;try{last=parseInt(localStorage.getItem('vc_last_visit_at')||'0',10)||0;localStorage.setItem('vc_last_visit_at',String(Date.now()));}catch(e){}
      if(last&&Date.now()-last>30*60*1000)funnelTrack('return_visit',{away_minutes:Math.round((Date.now()-last)/60000)},'return');
      try{var qp=new URLSearchParams(location.search);if(qp.get('vc_push'))funnelTrack('push_open',{trigger:qp.get('vc_push'),ref_id:qp.get('vc_push_ref')||''},qp.get('vc_push')+':'+(qp.get('vc_push_ref')||''));}catch(e2){}
    }
  });
}
window._vcApp = { navigate: navigate, loadMe: loadMe };
function startGuestPreview(){
  if(state.uid)return Promise.resolve(state.me||true);
  if(readGuestAccessMarker()>0){state.guestRecoveryNeeded=true;return Promise.resolve(null);}
  if(state.guestPreviewPromise)return state.guestPreviewPromise;
  var sex=parseInt((state.smart||{}).sex,10)||0;
  state.guestPreviewPromise=authApi('guest_create',smartGuestPayload(sex,0,smartInitialLook(sex),true)).then(function(r){
    if(!r||!r.ok)throw new Error(localizedErrorText(r&&r.err));
    state.uid=parseInt(r.uid,10)||0;
    return loadAuthMeta().then(function(){return loadMe();});
  }).catch(function(err){toast(err.message||t('network_error','Ошибка сети'),'error');return null;}).then(function(result){state.guestPreviewPromise=null;return result;});
  return state.guestPreviewPromise;
}
function onResize(){
  state.isWide = window.innerWidth >= 1100;
  state.isMed = window.innerWidth >= 768 && window.innerWidth < 1100;
  if(state.currentChat&&state.chatAutoScroll)setTimeout(function(){scrollChatToBottom(true);},40);
}

/* Load /me */
function applyAuthMeta(r){
  if (!r || !r.ok) return r;
  state.auth = r;
  state.authHeartbeatAt=Date.now();
  state.uid = parseInt(r.uid,10) || state.uid;
  state.isGuest = r.is_guest === true || parseInt(r.is_guest,10) === 1 || r.auth_type === 'guest';
  state.guestRecoveryNeeded=false;
  if(state.isGuest)setGuestAccessMarker(state.uid);else setGuestAccessMarker(0);
  if(state.pushSub)persistPushSubscription(state.pushSub);
  return r;
}
function loadAuthMeta(){
  return authApi('me').then(function(r){
    if (r && r.ok) applyAuthMeta(r);
    else if (r && r.err === 'no_session'){
      state.auth = r; state.uid = 0; state.isGuest = false;
    }
    return r;
  });
}
function loadMe(){
  if(state.meLoading)return state.meLoading;
  state.meLoading=api('me').then(function(r){
    if (r && r.ok){
      state.meLoadFailed=false;
      syncAccountLanguage(r);
      state.me = r;
      if(r.notif_prefs&&typeof r.notif_prefs==='object')state.notifPrefs=r.notif_prefs;
      state.uid = r.user_id || r.uid || state.uid;
      if(r.account_recovery_required!=null){
        state.auth=state.auth||{};
        state.auth.account_recovery_required=!!r.account_recovery_required;
        state.auth.has_paid_order=!!r.has_paid_order;
        state.auth.first_payment_at=parseInt(r.first_payment_at,10)||0;
        state.auth.email_verified=!!r.email_verified;
      }
      if (r.profile) state.profile = r.profile;
      vcNormalizeDynamicProfileCities(r,'me');
      if (r.virtuals){
        state.deckAll = r.virtuals.slice();
        funnelTrack('deck_view',{count:r.virtuals.length},'deck');
        if(!state.smartFilterApplied&&state.smart&&state.smart.geo){
          var viewerCity=vcViewerCityRaw();
          if(viewerCity)state.discoverFilter.city=viewerCity;
          var smartLook=parseInt((r.profile&&r.profile.look)||0,10);if(smartLook===1||smartLook===2)state.discoverFilter.gender=String(smartLook);
          state.smartFilterApplied=true;
        }
        applyDiscoverFilter(false);
        if(state.discoverFilter&&state.discoverFilter.online)refreshDiscoverOnline(true);
      }
      if (r.inbox){ syncIncomingMessageToasts(r.inbox,state.chats); state.chats = r.inbox; }
      syncSocialNotificationToasts(r);
      vcnSyncNotices(r,true);
      refreshEconomyDisplay();
      updateChatsBadge();
    } else if (r && (r.err === 'no_session' || r.err === 'no_user')){
      state.meLoadFailed=false;
      state.uid = 0; state.me = null;
      navigate('/onboarding');
    } else if (r && r.err === 'cooldown_active'){
      /* Deleted profile within the 24h cooldown: the generic load error with a
         Retry button can never succeed, so show the server's explanation. */
      state.meLoadFailed=false;
      renderCooldownScreen(r.msg);
    }else state.meLoadFailed=true;
    return r;
  }).catch(function(e){ console.error('loadMe fail', e); state.meLoadFailed=true;return null; }).then(function(r){state.meLoading=null;return r;});
  return state.meLoading;
}

function applyPassiveApiState(r, action){
  if (!r || !r.ok || !state.me || action === 'me') return;
  var changed = false;
  if (r.balance != null){ state.me.balance = parseFloat(r.balance)||0; changed = true; }
  if (r.free_balance != null){ state.me.free_balance = parseFloat(r.free_balance)||0; }
  else if (r.free != null){ state.me.free_balance = parseFloat(r.free)||0; }
  if (r.hints_count != null){ state.me.hints_count = parseInt(r.hints_count,10)||0; }
  if(r.notice_unread!=null)vcnSyncNotices(r);
  if(r.notif_prefs&&typeof r.notif_prefs==='object')state.notifPrefs=r.notif_prefs;
  if(r.likes_new!=null||r.guests_new!=null){
    syncSocialNotificationToasts({likes_new:r.likes_new!=null?r.likes_new:(state.me.likes_new||0),guests_new:r.guests_new!=null?r.guests_new:(state.me.guests_new||0)});
    if(r.likes_new!=null)state.me.likes_new=parseInt(r.likes_new,10)||0;
    if(r.guests_new!=null)state.me.guests_new=parseInt(r.guests_new,10)||0;
  }
  if(r.account_recovery_required!=null){
    state.auth=state.auth||{};
    state.auth.account_recovery_required=!!r.account_recovery_required;
    state.auth.has_paid_order=!!r.has_paid_order;
    state.auth.first_payment_at=parseInt(r.first_payment_at,10)||0;
    state.auth.email_verified=!!r.email_verified;
    if(r.account_recovery_required)setTimeout(function(){maybePromptAccountRecovery(false);},120);
  }
  if (Array.isArray(r.inbox)){
    var previousInbox=state.chats||[];syncIncomingMessageToasts(r.inbox,previousInbox);
    state.chats = r.inbox;
    state.me.inbox = r.inbox;
    syncChatListRows();
    updateChatsBadge();
  }
  if ((action==='live_state'&&Object.prototype.hasOwnProperty.call(r,'active_promo'))||r.active_promo){
    syncLivePromotion(r.active_promo||null,r.server_time||0);
  }
  if (changed) refreshEconomyDisplay();
  if (action !== 'live_state' && action !== 'thread' && r.balance != null) refreshLiveStateSoon(350);
}
function refreshEconomyDisplay(){
  var me=state.me||{};
  var ub=document.querySelector('#vc-rail .user-mini .ub');
  if(ub){ub.textContent=sidebarAccountLabel();ub.title=ub.textContent;}
  var bal=vibeAmount(parseInt(me.balance,10)||0);
  $$('#vc-rail-balance,#vc-pf-balance,[data-topup-balance]').forEach(function(node){node.textContent=bal;});
}
/* ===== Top-up (2026-10-10): preset or custom whole-euro amount. While no real PSP is connected the server's test
   provider credits the balance without charging; the server decides availability and the credit rate. ===== */
function vcTopupConfig(){var c=state.storeTopup||{},presets=Array.isArray(c.presets)&&c.presets.length?c.presets:[10,20,50];return {min:Math.max(1,parseInt(c.min_eur,10)||5),max:Math.max(1,parseInt(c.max_eur,10)||500),presets:presets};}
function vcTopupLimitText(c){return t('topup_limits','От €{min} до €{max}, целыми евро').replace('{min}',c.min).replace('{max}',c.max);}
function vcTopupMethodHtml(){
  if(state.cryptoPacks===null)return '<div class="vc-topup-method is-loading"><div class="spin"></div></div>';
  if(state.testPayments)return '<div class="vc-topup-method is-test"><span class="vc-test-badge">'+h(t('test_mode','Тестовый режим'))+'</span><p>'+h(t('test_payment_copy','Тестовая оплата: деньги не списываются, сумма сразу появится на балансе.'))+'</p></div>';
  return '<div class="vc-topup-method is-off"><p>'+h(t('topup_unavailable','Пополнение заработает после подключения оплаты. Сейчас ничего не списывается.'))+'</p></div>';
}
function vcTopupFormHtml(idPrefix){
  var c=vcTopupConfig(),chips='',sel=c.presets.length>1?1:0;
  for(var i=0;i<c.presets.length;i++){var v=parseInt(c.presets[i],10)||0;chips+='<button type="button" class="vc-topup-chip'+(i===sel?' is-selected':'')+'" data-topup-amount="'+v+'" aria-pressed="'+(i===sel?'true':'false')+'">€'+v+'</button>';}
  return '<div class="vc-topup-form" data-topup-form data-selected="'+(parseInt(c.presets[sel],10)||c.min)+'">'+
    '<div class="vc-topup-chips" role="group" aria-label="'+h(t('topup_amount','Сумма пополнения'))+'">'+chips+'</div>'+
    '<label class="vc-topup-custom" for="'+idPrefix+'-custom"><span>'+h(t('topup_custom','Своя сумма'))+'</span><span class="vc-topup-input"><b aria-hidden="true">€</b><input id="'+idPrefix+'-custom" type="number" inputmode="numeric" min="'+c.min+'" max="'+c.max+'" step="1" placeholder="'+c.min+'–'+c.max+'" data-topup-custom aria-describedby="'+idPrefix+'-hint"></span></label>'+
    '<p class="vc-topup-hint" id="'+idPrefix+'-hint" data-topup-hint>'+h(vcTopupLimitText(c))+'</p>'+
    vcTopupMethodHtml()+
    '<button type="button" class="vc-topup-submit" data-topup-submit>'+h(t('top_up','Пополнить баланс'))+'</button>'+
  '</div>';
}
function wireTopupForm(root,onDone){
  var form=root&&root.querySelector('[data-topup-form]');if(!form||form.dataset.bound)return;form.dataset.bound='1';
  var c=vcTopupConfig(),input=form.querySelector('[data-topup-custom]'),hint=form.querySelector('[data-topup-hint]'),submit=form.querySelector('[data-topup-submit]');
  function custom(){return String(input.value||'').trim()!=='';}
  function amount(){if(custom()){var v=Number(String(input.value).replace(',','.'));return (isFinite(v)&&Math.floor(v)===v)?v:NaN;}return parseInt(form.dataset.selected,10)||0;}
  function sync(){
    var v=amount(),valid=!isNaN(v)&&v>=c.min&&v<=c.max;
    form.classList.toggle('is-invalid',custom()&&!valid);
    hint.textContent=(custom()&&!valid)?t('topup_amount_invalid','Введите целую сумму от €{min} до €{max}').replace('{min}',c.min).replace('{max}',c.max):vcTopupLimitText(c);
    submit.disabled=!valid||!state.testPayments||!!state.storeCheckoutBusy;
    submit.textContent=valid?t('topup_pay','Пополнить на {amount}').replace('{amount}','€'+v):t('top_up','Пополнить баланс');
  }
  $$('[data-topup-amount]',form).forEach(function(chip){chip.addEventListener('click',function(){
    form.dataset.selected=chip.dataset.topupAmount;input.value='';
    $$('[data-topup-amount]',form).forEach(function(x){var on=x===chip;x.classList.toggle('is-selected',on);x.setAttribute('aria-pressed',on?'true':'false');});sync();
  });});
  input.addEventListener('input',function(){if(custom())$$('[data-topup-amount]',form).forEach(function(x){x.classList.remove('is-selected');x.setAttribute('aria-pressed','false');});sync();});
  input.addEventListener('keydown',function(e){if(e.key==='Enter'&&!submit.disabled){e.preventDefault();submit.click();}});
  submit.addEventListener('click',async function(){
    var v=amount();if(submit.disabled||isNaN(v)||v<c.min||v>c.max)return;
    submit.disabled=true;var r=await vcTestCheckout({amount_eur:v});
    if(r&&r.ok){input.value='';if(typeof onDone==='function')onDone(r);}
    if(form.isConnected)sync();
  });
  sync();
}
async function vcTestCheckout(purchase,opts){
  purchase=purchase||{};opts=opts||{};
  if(state.storeCheckoutBusy)return false;
  if(guestNeedsProfileGate()){showGuestProfileGate(null,function(){vcTestCheckout(purchase,opts);},{action:'purchase'});return false;}
  if(!await ensureTosAccepted())return false;
  var scope='test_'+(purchase.pack_id?('p'+purchase.pack_id):('a'+purchase.amount_eur)),intentId=vcCheckoutIntentId(scope);
  state.storeCheckoutBusy=true;
  try{
    var r=await authApi('test_checkout',{pack_id:parseInt(purchase.pack_id,10)||0,amount_eur:parseInt(purchase.amount_eur,10)||0,profile_id:parseInt(purchase.profile_id,10)||0,intent_id:intentId});
    state.storeCheckoutBusy=false;
    if(r&&r.ok){
      /* The intent is spent: the next purchase of the same amount must create a new order. */
      vcClearCheckoutIntent(scope);state.purchaseHistory=undefined;state.cryptoPacks=null;state.meLoading=null;
      try{await loadMe();}catch(e){}
      refreshEconomyDisplay();
      if(state.route==='/store')viewStore();else if(state.route==='/profile')viewProfile();
      if(!opts.silent){
        var done=r.fulfillment==='chat_slots'?t('test_payment_chats_done','Доступно чатов: {n}. Деньги не списывались.').replace('{n}',String(r.chat_count||0)):t('test_payment_wallet_done','{amount} зачислено на баланс. Деньги не списывались.').replace('{amount}',euroAmountFromUnits(r.credited_vibes||0));
        vcNotice(t('test_payment_done','Тестовая оплата прошла'),done,'success');
      }
      return r;
    }
    if(r&&r.err==='profile_required'){showGuestProfileGate(null,function(){vcTestCheckout(purchase,opts);},{action:'purchase'});return false;}
    toast(localizedErrorText(r&&r.err,t('payment_failed','Платёж не прошёл')),'error');return false;
  }catch(e){state.storeCheckoutBusy=false;toast(t('network_error','Ошибка сети'),'error');return false;}
}
function openTopUp(opts){
  opts=opts||{};
  var ov=el('div',{class:'lightbox vc-topup-layer'});
  function close(){document.removeEventListener('keydown',onKey);if(ov.parentNode)ov.parentNode.removeChild(ov);}
  function onKey(e){if(e.key==='Escape')close();}
  function render(){
    ov.innerHTML='<div class="vc-topup-sheet" role="dialog" aria-modal="true" aria-labelledby="vc-topup-title" tabindex="-1">'+
      '<div class="vc-topup-head"><div><span class="vc-topup-eyebrow">'+h(t('account_balance','Баланс аккаунта'))+' · <b data-topup-balance>'+h(vibeAmount(parseInt(state.me&&state.me.balance,10)||0))+'</b></span><strong id="vc-topup-title">'+h(t('top_up','Пополнить баланс'))+'</strong></div><button type="button" class="vc-icon-glass vc-overlay-close" data-close aria-label="'+h(t('close','Закрыть'))+'">'+vcIcon('close')+'</button></div>'+
      vcTopupFormHtml('vc-topup-sheet')+
      '<button type="button" class="vc-topup-more" data-topup-store><span>'+h(t('topup_all_purchases','Пакеты чатов и история покупок'))+'</span>'+vcIcon('chevron-right')+'</button>'+
    '</div>';
    wireTopupForm(ov,close);
    ov.querySelector('[data-close]').addEventListener('click',close);
    ov.querySelector('[data-topup-store]').addEventListener('click',function(){close();navigate('/store');});
    var sheet=ov.querySelector('.vc-topup-sheet');if(sheet)sheet.focus();
  }
  ov.addEventListener('click',function(e){if(e.target===ov)close();});
  document.addEventListener('keydown',onKey);
  document.body.appendChild(ov);
  render();
  if(state.cryptoPacks===null)requestStoreCatalog().then(function(){if(ov.parentNode)render();});
}
/* Store: top-up and chat packs are the first thing on the purchases page. */
function vcStoreBuyHtml(){
  var packs=(state.storePacks||[]).filter(function(p){return p.fulfillment==='chat_slots';}),canBuy=!!state.testPayments||vcCryptoLive(),rows='';
  for(var i=0;i<packs.length;i++){
    var p=packs[i],chats=Math.max(1,parseInt(p.chats,10)||1),eur=Number(p.eur)||0,best=chats===3;
    rows+='<button type="button" class="vc-store-pack'+(best?' is-best':'')+'" data-store-pack="'+h(p.pack_id)+'"'+(canBuy?'':' disabled aria-disabled="true"')+'><span class="vc-store-pack-n" aria-hidden="true">'+chats+'</span><span class="vc-store-pack-copy"><strong>'+h(chatCountLabel(chats))+'</strong><small>'+h(t('chat_pack_meta','{n} сообщений в каждом чате').replace('{n}',String(p.messages_per_chat||10)))+'</small></span>'+(best?'<em>'+h(t('pack_popular','Выгодно'))+'</em>':'')+'<span class="vc-store-pack-price"><b>'+(vcCryptoDirectPrices()?'<s>€'+eur.toFixed(2)+'</s> '+h(vcUsdt(eur)):'€'+eur.toFixed(2))+'</b>'+(chats>1?'<small>'+(vcCryptoDirectPrices()?h(vcUsdt(eur/chats)):'€'+(eur/chats).toFixed(2))+' '+h(t('per_chat','за чат'))+'</small>':'')+'</span></button>';
  }
  var packsBody=packs.length?'<div class="vc-store-pack-list">'+rows+'</div>':(state.cryptoPacks===null?'<div class="vc-store-loading"><div class="spin"></div></div>':'<p class="vc-store-note">'+h(t('packs_unavailable_why','Пакеты станут доступны после подключения оплаты. Сейчас покупки работают из чата.'))+'</p>');
  return '<div class="vc-store-buy">'+
    '<section class="store-method vc-store-topup" id="vc-store-topup"><div class="vc-store-card-head"><span>'+semanticGlassIcon('wallet')+'</span><div><strong>'+h(t('top_up','Пополнить баланс'))+'</strong><small>'+h(t('purchase_balance_copy','Для фото, подарков и функций профиля'))+'</small></div></div>'+vcTopupFormHtml('vc-store-topup')+'</section>'+
    '<section class="store-method vc-store-packs"><div class="vc-store-card-head"><span>'+glassIcon('message')+'</span><div><strong>'+h(t('chat_packages','Пакеты чатов'))+'</strong><small>'+h(t('chat_packs_copy','Пакет открывает переписку с анкетой'))+'</small></div></div>'+packsBody+(packs.length&&!canBuy?'<p class="vc-store-note">'+h(t('topup_unavailable','Пополнение заработает после подключения оплаты. Сейчас ничего не списывается.'))+'</p>':'')+'</section>'+
  '</div>';
}
function wireStoreBuy(root){
  wireTopupForm(root);
  $$('[data-store-pack]',root).forEach(function(btn){btn.addEventListener('click',function(){vcStoreBuyPack(parseInt(btn.dataset.storePack,10)||0);});});
}
async function vcStoreBuyPack(packId){
  if(!packId)return;
  if(!state.testPayments){if(vcCryptoLive())return buyVibes(packId);toast(t('store_pay_unavailable','Оплата временно недоступна'),'error');return;}
  var pack=null;for(var i=0;i<(state.storePacks||[]).length;i++){if(parseInt(state.storePacks[i].pack_id,10)===packId){pack=state.storePacks[i];break;}}
  if(!pack)return;
  var chats=Math.max(1,parseInt(pack.chats,10)||1);
  var ok=await vcModal({title:t('confirm_purchase','Подтвердите покупку'),icon:'wallet',html:'<div class="vc-purchase-summary"><div><span>'+h(t('you_receive','Вы получите'))+'</span><strong>'+h(chatCountLabel(chats))+'</strong></div><div><span>'+h(t('price','Цена'))+'</span><strong>€'+(Number(pack.eur)||0).toFixed(2)+'</strong></div></div><p class="vc-test-note"><span class="vc-test-badge">'+h(t('test_mode','Тестовый режим'))+'</span> '+h(t('test_payment_copy_pack','Тестовая оплата: деньги не списываются, чаты станут доступны сразу.'))+'</p>',confirmText:t('pay_now','Оплатить сейчас'),cancelText:t('later','Позже')});
  if(!ok)return;
  await vcTestCheckout({pack_id:packId,profile_id:parseInt(state.storeAttribution&&state.storeAttribution.profile_id,10)||0});
}
function sidebarAccountLabel(){
  var me=state.me||{},profile=me.profile||{},auth=state.auth||{};
  var email=String(auth.email||me.email||profile.email||'').trim();
  return email||t('email_not_added','Email не указан');
}
function refreshLiveStateSoon(delay){
  if(state.liveRefreshTimer)clearTimeout(state.liveRefreshTimer);
  if(!state.uid)return;
  state.liveRefreshTimer=setTimeout(function(){state.liveRefreshTimer=null;pollLiveState();},delay==null?250:delay);
}
function startLiveStatePoll(){
  if(state.livePollTimer)clearTimeout(state.livePollTimer);
  if(!state.uid)return;
  state.livePollTimer=setTimeout(pollLiveState,1200);
}
function pollLiveState(){
  if(state.livePollTimer){clearTimeout(state.livePollTimer);state.livePollTimer=null;}
  if(!state.uid)return;
  if(state.livePollBusy){state.livePollTimer=setTimeout(pollLiveState,1200);return;}
  if(document.visibilityState==='hidden'||!navigator.onLine){state.livePollTimer=setTimeout(pollLiveState,15000);return;}
  if(!state.authHeartbeatAt||Date.now()-state.authHeartbeatAt>12*60*60*1000)loadAuthMeta();
  state.livePollBusy=true;
  apiRequest('live_state',{notice_after:vcnCursorGet()}).catch(function(){return null;}).then(function(){
    state.livePollBusy=false;
    if((state.route==='/'||state.route==='/discover')&&state.discoverFilter&&state.discoverFilter.online&&!state.onlineDeckLoading&&Date.now()-(state.onlineDeckFetchedAt||0)>20000)refreshDiscoverOnline(false);
    if(state.uid)state.livePollTimer=setTimeout(pollLiveState,state.currentChat?6000:8000);
  });
}

function smartGuestPayload(sex,age,look,deferAge){
  var s=state.smart||{};
  /* session_id lets the server bind the pre-registration funnel (op_anon_stitch)
     to this tab; anonymous rows tracked with a session only stitch from it. */
  return {sex:sex,age:age,look:look,age_pending:deferAge?1:0,lang:state.lang,referal:s.ref||'',geo:s.city_key||s.geo||'',bayer:s.bayer||'',utm:s.utm||'',age_min:parseInt(s.age_min,10)||0,age_max:parseInt(s.age_max,10)||0,anon_id:vcAnonId(),session_id:funnelSessionId()};
}
/* Campaign age_min/age_max describe an audience, not this person's exact age. */
function smartInitialAge(){var s=state.smart||{};return parseInt(s.age,10)||0;}
function smartInitialLook(sex){var s=state.smart||{},look=parseInt(s.look,10)||0;if(look>=1&&look<=3)return look;sex=parseInt(sex||s.sex,10)||0;return sex===1?2:(sex===2?1:0);}
function smartLinkCanAutoEnter(){var s=state.smart||{},sex=parseInt(s.sex,10)||0,key=String(s.city_key||s.geo||'');return (sex===1||sex===2)&&!!vcCityByKeyClient(key);}
function smartAgeLabel(){var s=state.smart||{},exact=parseInt(s.age,10)||0,min=parseInt(s.age_min,10)||0,max=parseInt(s.age_max,10)||0;if(exact)return String(exact);if(min&&max)return min+'–'+max;if(min)return min+'+';return '';}
function smartCityName(){
  var c=(state.smart&&state.smart.city)||{};
  return c['name_'+state.lang]||c.name_en||c.name_ru||c.name_uk||'';
}

/* Searchable city picker shared by onboarding, profile edit and the profile gate. */
function vcCityNormalize(value){
  var s=String(value==null?'':value).toLocaleLowerCase();
  try{if(s.normalize)s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
  return s.replace(/ё/g,'е').replace(/[ьъ]/g,'').replace(/[^a-zа-яіїєґ0-9]/gi,'');
}
function vcCityLabel(city){
  city=city||{};return city['name_'+state.lang]||city.name_ru||city.name_uk||city.name_en||city.key||'';
}
function vcCityByKeyClient(key){
  key=String(key||'').toLowerCase();for(var i=0;i<state.cityCatalog.length;i++)if(String(state.cityCatalog[i].key||'').toLowerCase()===key)return state.cityCatalog[i];return null;
}
function vcCityKeyForName(value){
  var needle=vcCityNormalize(value);if(!needle)return '';
  for(var i=0;i<state.cityCatalog.length;i++){var c=state.cityCatalog[i],names=[c.name_ru,c.name_uk,c.name_en,c.key];for(var n=0;n<names.length;n++)if(vcCityNormalize(names[n])===needle)return String(c.key||'');}
  return '';
}
function vcCitySuggestions(query){
  var q=vcCityNormalize(query);if(q.length<2)return [];
  var rows=[];
  for(var i=0;i<state.cityCatalog.length;i++){
    var c=state.cityCatalog[i],names=[c.name_ru,c.name_uk,c.name_en,c.key].filter(Boolean),score=99;
    for(var n=0;n<names.length;n++){var norm=vcCityNormalize(names[n]);if(norm.indexOf(q)===0)score=Math.min(score,0);else if(norm.indexOf(q)>=0)score=Math.min(score,1);}
    if(score<99)rows.push({city:c,score:score,label:vcCityLabel(c)});
  }
  rows.sort(function(a,b){return a.score-b.score||a.label.localeCompare(b.label,state.lang||'ru');});
  return rows.slice(0,8).map(function(x){return x.city;});
}
function vcCityPicker(input,opts){
  if(!input)return null;opts=opts||{};
  var host=input.closest?input.closest('.city-picker'):input.parentNode;if(!host)return null;
  host.classList.add('city-picker');
  var menu=host.querySelector('.city-suggest');
  if(!menu){menu=document.createElement('div');menu.className='city-suggest';host.appendChild(menu);}
  menu.hidden=true;menu.setAttribute('role','listbox');
  var selectedKey=String(opts.initialKey||input.dataset.cityKey||'');
  var initial=vcCityByKeyClient(selectedKey);if(initial&&!input.value.trim())input.value=vcCityLabel(initial);if(selectedKey)input.dataset.cityKey=selectedKey;
  function close(){menu.hidden=true;}
  function render(){
    var value=input.value.trim();if(value.length<2){menu.innerHTML='';close();return;}
    var rows=vcCitySuggestions(value);if(!rows.length){menu.innerHTML='';close();return;}
    var html='';for(var i=0;i<rows.length;i++){var city=rows[i],label=vcCityLabel(city),alts=[city.name_ru,city.name_uk,city.name_en].filter(function(x){return x&&x!==label;});html+='<button type="button" class="city-suggest-item" role="option" data-city-key="'+h(city.key)+'"><strong>'+h(label)+'</strong>'+(alts.length?'<small>'+h(alts.slice(0,2).join(' · '))+'</small>':'')+'</button>';}
    menu.innerHTML=html;menu.hidden=false;
    menu.querySelectorAll('[data-city-key]').forEach(function(btn){
      btn.addEventListener('click',function(){var city=vcCityByKeyClient(btn.dataset.cityKey);if(!city)return;selectedKey=String(city.key||'');input.dataset.cityKey=selectedKey;input.value=vcCityLabel(city);close();if(typeof opts.onSelect==='function')opts.onSelect(city);input.dispatchEvent(new Event('change',{bubbles:true}));});
      btn.addEventListener('keydown',function(e){
        var buttons=Array.prototype.slice.call(menu.querySelectorAll('[data-city-key]')),index=buttons.indexOf(btn),next=index;
        if(e.key==='Escape'){e.preventDefault();close();input.focus();return;}
        if(e.key==='ArrowDown')next=(index+1)%buttons.length;else if(e.key==='ArrowUp')next=(index-1+buttons.length)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;
        e.preventDefault();buttons[next].focus();
      });
    });
  }
  input.addEventListener('input',function(){selectedKey='';input.dataset.cityKey='';if(typeof opts.onInput==='function')opts.onInput('');render();});
  input.addEventListener('focus',render);input.addEventListener('blur',function(){setTimeout(function(){if(!host.contains(document.activeElement))close();},150);});
  input.addEventListener('keydown',function(e){if(e.key==='Escape'){close();return;}if((e.key==='ArrowDown'||e.key==='Enter')&&!menu.hidden){var first=menu.querySelector('button');if(first){e.preventDefault();if(e.key==='Enter')first.click();else first.focus();}}});
  return {getKey:function(){return selectedKey||String(input.dataset.cityKey||'');},getCity:function(){return vcCityByKeyClient(selectedKey||input.dataset.cityKey||'');}};
}

/* ===== Router ===== */
function navigate(path){
  var chatMatch=String(path||'').match(/^\/chat\/(\d+)/),peerId=chatMatch?(parseInt(chatMatch[1],10)||0):0;
  if(peerId&&state.uid&&state.me&&gateProfileIntent('message',peerId,findIntentProfile(peerId),state.route||'/'))return;
  var target='#'+path;if(window.location.hash===target){router();return;}window.location.hash=target;
}
function closeRouteOverlays(){if(state.mediaViewerClose){var closeViewer=state.mediaViewerClose;state.mediaViewerClose=null;closeViewer();}if(state.stickerPickerClose){var closeStickers=state.stickerPickerClose;state.stickerPickerClose=null;closeStickers();}$$('.lightbox,.vc-sticker-layer').forEach(function(overlay){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);});}
function getRoute(){
  var hh = window.location.hash.replace(/^#/, '');
  var qi=hh.indexOf('?'),query=qi>=0?hh.slice(qi+1):'';
  if(qi>=0)hh=hh.slice(0,qi);
  state.routeQuery=new URLSearchParams(query||window.location.search.replace(/^\?/,''));
  if (!hh || hh === '/') return '/';
  return hh;
}
function router(){
  var route = getRoute();
  var previousRoute = state.route;
  if(previousRoute.indexOf('/profile/')===0 && route!==previousRoute && state.profileInterestTimer){clearTimeout(state.profileInterestTimer);state.profileInterestTimer=null;}
  if(previousRoute==='/store' && route!=='/store'){
    var leavingCheckout=!!state.storeCheckoutActive;
    funnelTrack(leavingCheckout?'checkout_abandoned':'store_closed',
      storeSignalContext({reason:'route_change',stage:leavingCheckout?state.storeCheckoutActive.stage:'store'}));
    state.storeCheckoutActive=null;
    state.storeVisitKey='';
    state.storeAttribution=null;
  }
  if(route==='/store' && previousRoute!=='/store'){
    state.storeVisitKey='store_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
    state.storeCheckoutActive=null;
  }
  closeRouteOverlays();
  state.route = route;
  v4TrackNav(route);v4CloseSheet();document.body.classList.toggle('v4-no-nav',v4NoNavRoute(route));
  vcSyncDocumentTitle();
  if(vcnCenter&&vcnCenter.page&&route!=='/notifications')vcnCloseCenter();
  setTimeout(renderRescueOfferBanner,0);
  var isAuthScreen = route.indexOf('/onboarding') === 0 || route.indexOf('/auth') === 0 || route.indexOf('/magic') === 0;
  document.body.classList.toggle('vc-chat-route',route.indexOf('/chat/')===0);
  document.body.classList.toggle('vc-discover-route',route==='/'||route==='/discover');
  document.body.classList.toggle('vc-auth-route',isAuthScreen);
  if(state.profileGateOpen)document.body.classList.add('vc-auth-route');
  if(window.VC_INSTALL&&typeof window.VC_INSTALL._syncButton==='function')window.VC_INSTALL._syncButton();
  if (route.indexOf('/chat/') !== 0){
    if (state.chatPollTimer){ clearTimeout(state.chatPollTimer); state.chatPollTimer = null; }
    if (state.chatTypingTimer){ clearTimeout(state.chatTypingTimer); state.chatTypingTimer = null; }
    if (state.chatSelfDestructTimer){ clearTimeout(state.chatSelfDestructTimer); state.chatSelfDestructTimer = null; }
    state.currentChat = null; state.chatPollBusy = false; state.chatMeta = null;
  }
  if (isAuthScreen){
    if (route === '/onboarding' && state.uid && state.me){ navigate('/'); return; }
    if (route === '/auth' && state.uid && state.me && !state.isGuest){ navigate('/'); return; }
    var app = document.getElementById('app');
    if (app){ app.className = 'app auth-screen'; app.innerHTML = '<div class="auth-wrap" id="vc-auth-wrap"></div>'; }
    if (route === '/onboarding') return viewOnboarding();
    if (route === '/login') { navigate('/auth'); return; }
    if (route === '/auth') return viewAuth();
    if (route.indexOf('/magic') === 0) return viewMagic();
    return viewOnboarding();
  }
  if (!state.uid){ navigate('/onboarding'); return; }
  if (!state.me){if(state.meLoadFailed){renderAppLoadError();return;}loadMe().then(router);return;}
  var directChat=route.match(/^\/chat\/(\d+)/);
  if(directChat&&gateProfileIntent('message',parseInt(directChat[1],10)||0,findIntentProfile(parseInt(directChat[1],10)||0),route))return;
  var storedIntent=readProfileIntent();
  if(storedIntent&&guestNeedsProfileGate()&&!state.profileGateOpen&&(route===storedIntent.return_route||route==='/'||route==='/discover')){showGuestProfileGate(findIntentProfile(storedIntent.profile_id,storedIntent.profile||{}),function(completedIntent){resumeProfileIntent(storedIntent.profile||{},completedIntent);});return;}
  renderShell();
  var v4Body=document.getElementById('vc-main-body');if(v4Body)v4Body.classList.remove('v4-view');
  beginRouteMotion(route);
  if(route!==previousRoute){var routeBody=document.getElementById('vc-main-body');if(routeBody)routeBody.scrollTop=0;}
  setActiveNav(route);
  var center = document.querySelector('.center');
  if (center) center.classList.toggle('no-topbar', route.indexOf('/chat/') === 0);
  renderTopbar();
  renderContext();
  if (route === '/' || route === '/discover') return viewDiscover();
  if (route === '/chats') return viewChats();
  if (route === '/likes') return v4ViewLikes();
  if (route.indexOf('/chat/') === 0){ var id = parseInt(route.split('/')[2],10);if(!id){navigate('/chats');return;}viewChat(id);v4ObserveChat(id);return; }
  // Retired leaderboard links return to the activity center.
  if (route === '/top'){ navigate('/activity'); return; }
  if (route === '/store') return viewStore();
  if (route.indexOf('/profile/') === 0){ var profileId=parseInt(route.split('/')[2],10);if(!profileId){navigate('/');return;}return viewProfileDetail(profileId); }
  if (route === '/profile'){ viewProfile();v4AfterRender(v4ProfileExtras);return; }
  if (route === '/activity') { vcnPresetFilter(); return viewNotifications(); }
  if (route === '/notifications') return viewNotifications();
  if (route === '/hub'){ navigate('/activity'); return; }
  if (route === '/settings'){ viewSettings();v4AfterRender(v4SettingsNav);return; }
  if (route === '/support') return viewSupport();
  // Historical deep links from old match notifications now open the inbox.
  if (route === '/matches'){ navigate('/chats'); return; }
  navigate('/');
}
function renderAppLoadError(){
  var app=document.getElementById('app');if(!app)return;app.className='app auth-screen';app.innerHTML='<div class="auth-wrap"><div class="auth-card" role="alert"><div class="auth-logo vc-brand-lockup">'+vcBrandMark()+'</div><div class="auth-title">'+h(t('load_failed','Не удалось загрузить данные'))+'</div><div class="auth-sub">'+h(t('check_connection','Проверьте соединение и попробуйте снова'))+'</div><button type="button" class="auth-submit" id="vc-app-retry">'+h(t('retry','Повторить'))+'</button> <button type="button" class="auth-submit" id="vc-app-help">'+h(t('help','Помощь'))+'</button><div class="auth-sub">'+h(t('error_code','Код ошибки'))+': <b id="vc-app-errcode"></b></div></div></div>';
  var ec0=document.getElementById('vc-app-errcode');if(ec0)ec0.textContent='VC-ME-'+Date.now().toString(36).toUpperCase().slice(-6);
  var hb0=document.getElementById('vc-app-help');if(hb0)hb0.addEventListener('click',function(){navigate('/settings');});
  document.getElementById('vc-app-retry').addEventListener('click',function(){var btn=this;btn.disabled=true;btn.textContent=t('loading','Загрузка...');state.meLoadFailed=false;loadAuthMeta().then(function(r){return r&&r.ok?loadMe():null;}).then(router).catch(function(){state.meLoadFailed=true;renderAppLoadError();});});
}
function renderCooldownScreen(msg){
  var app=document.getElementById('app');if(!app)return;app.className='app auth-screen';
  app.innerHTML='<div class="auth-wrap"><div class="auth-card" role="alert"><div class="auth-logo vc-brand-lockup">'+vcBrandMark()+'</div><div class="auth-title">'+h(t('account_deleted','Аккаунт удалён'))+'</div><div class="auth-sub">'+h(msg||t('cooldown_active','Новая регистрация будет доступна позже'))+'</div><button type="button" class="auth-submit" id="vc-app-help">'+h(t('help','Помощь'))+'</button></div></div>';
  var hb=document.getElementById('vc-app-help');if(hb)hb.addEventListener('click',function(){navigate('/settings');});
}
function setActiveNav(route){
  var items = $$('.nav-item');
  var key = 'discover';
  if (route === '/' || route === '/discover') key = 'discover';
  else if (route === '/likes') key = 'likes';
  else if (route === '/chats' || route.indexOf('/chat/') === 0) key = 'chats';
  else if (route === '/store') key = 'store';
  else if (route === '/profile' || route.indexOf('/profile/') === 0) key = 'profile';
  else if (route === '/activity' || route === '/notifications') key = 'notifications';
  else if (route === '/settings') key = 'settings';
  else if (route === '/support') key = 'support';
  items.forEach(function(it){var active=it.dataset.key===key;it.classList.toggle('active',active);if(active)it.setAttribute('aria-current','page');else it.removeAttribute('aria-current');});
  var bn = $$('.bn-item');
  var bkey = key;
  /* Phones have four tabs; everything secondary lives under Profile (prototype 2026-10-14). */
  if (bkey === 'settings' || bkey === 'store' || bkey === 'support' || bkey === 'notifications') bkey = 'profile';
  bn.forEach(function(it){var active=it.dataset.key===bkey;it.classList.toggle('active',active);if(active)it.setAttribute('aria-current','page');else it.removeAttribute('aria-current');});
}

/* ===== Redesign 2026-10-14 («Свайп», deliverables/site-prototype-20261014): icons + likes ===== */
var V4_ICONS={
  /* v4-stage4-icons: prototype icons for interests, media and states */
  copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  play:'*<path d="M7 5v14l12-7z"/>',
  pause:'*<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  cake:'<path d="M4 20h16M5 20v-6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6M12 11V7M12 7a1.5 1.5 0 1 0-1.5-1.5"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5A3 3 0 0 0 12 8a3 3 0 0 0 0 6 3 3 0 0 1 0 6 3 3 0 0 1-2.5-1.5M12 6v2M12 18v2"/>',
  cup:'<path d="M4 8h12v6a5 5 0 0 1-10 0zM16 9h2a2 2 0 0 1 0 4h-2M6 20h8"/>',
  chef:'<path d="M8 20h8v-5H8zM7 15V9a5 5 0 0 1 10 0v6"/>',
  leaf:'<path d="M4 20c0-8 6-14 16-16 0 10-6 16-14 16"/><path d="M4 20c4-4 8-6 12-8"/>',
  music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  book:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  wave:'<path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 6c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  dance:'<circle cx="12" cy="4" r="2"/><path d="M12 6v6l-4 8M12 12l4 8M8 9l4 3 4-3"/>',
  paw:'<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="9" r="2"/><path d="M8 18c0-3 2-5 4-5s4 2 4 5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/>',
  run:'<circle cx="15" cy="4" r="2"/><path d="m5 20 4-6 3 2 2-5-3-2-4 3M14 13l3 2 2 5"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2a2 2 0 0 1 2-2h2a3 3 0 0 0 3-3 11 11 0 0 0-9-11z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  lotus:'<path d="M12 20c-5 0-8-3-9-7 3 0 5 1 6 2-1-3 0-7 3-10 3 3 4 7 3 10 1-1 3-2 6-2-1 4-4 7-9 7z"/>',
  film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>',
  gamepad:'<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 12h4M9 10v4M16 11h.01M18 13h.01"/>',
  brain:'<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h3V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-3V4z"/>',
  wifioff:'<path d="M2 8.5a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01M3 3l18 18"/>',
  cloud:'<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-1 9z"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  heart:'<path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>',
  heartf:'*<path d="M12 21s-8-5-8-10.6A4.6 4.6 0 0 1 12 8a4.6 4.6 0 0 1 8 2.4C20 16 12 21 12 21z"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  back:'<path d="m15 5-7 7 7 7"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  spark:'*<path d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z"/>',
  gift:'<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 14h18M12 9c-2-4-7-4-7-1s5 1 7 1zm0 0c2-4 7-4 7-1s-5 1-7 1z"/>',
  filter:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chev:'<path d="m9 6 6 6-6 6"/>',
  pin:'<path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11z"/><circle cx="12" cy="10" r="2.5"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 0 14h-1"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 8 9 6 9-6"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  logout:'<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 17-6-6-9 9"/>',
  send:'<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  flag:'<path d="M5 21V4h12l-2 4 2 4H5"/>',
  block:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  share:'<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 7l4-4 4 4"/>',
  chevd:'<path d="m6 9 6 6 6-6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4a3.5 3.5 0 0 1 0 7M22 20a7 7 0 0 0-5-6.7"/>',
  history:'<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M12 8v4l3 2"/>',
  sparkles:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/>',
  monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 10h.01M15 10h.01"/>',
  zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  key:'<circle cx="8" cy="14" r="4"/><path d="M11 11 20 2M16 6l2 2M13 9l2 2"/>',
  refresh:'<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>'
};
function v4Icon(name,cls){var p=V4_ICONS[name]||V4_ICONS.spark,fill=p.charAt(0)==='*';if(fill)p=p.slice(1);return '<svg class="v4-ic i'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true" '+(fill?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"')+'>'+p+'</svg>';}
/* Views built with the new markup mark the scroll container so the shell drops its legacy padding. */
function v4Page(html,cls){var body=document.getElementById('vc-main-body');if(!body)return null;body.classList.add('v4-view');body.innerHTML='<div class="v4 v4-page'+(cls?' '+cls:'')+'">'+html+'</div>';return body;}
function v4PageHead(title,sub){return '<div class="topbar left vis-m"><h1>'+h(title)+'</h1></div><div class="vis-d"><div class="row-between"><div><h1 class="page-h">'+h(title)+'</h1>'+(sub?'<p class="page-sub">'+h(sub)+'</p>':'')+'</div></div></div>';}
function v4Empty(icon,title,text,btnLabel,btnRoute){return '<div class="empty"><div class="em">'+v4Icon(icon)+'</div><b>'+h(title)+'</b>'+h(text)+(btnLabel?'<br><button type="button" class="btn btn-primary" data-route="'+h(btnRoute||'/')+'">'+h(btnLabel)+'</button>':'')+'</div>';}
/* ===== Redesign 2026-10-14 stage 2: deck panel, chats layout, settings nav, profile links ===== */
function v4BalancePill(){return '<a class="vibes" href="#/store" aria-label="'+h(t('account_balance','Баланс аккаунта'))+'">'+v4Icon('wallet')+'<b>'+h(vibeAmount(parseInt((state.me||{}).balance,10)||0))+'</b></a>';}
function v4DeckPanelHtml(card){
  var name=localizedPersonName(card.name||card.fullname||'')||'',age=parseInt(card.age||card.u_age,10)||0,photos=deckPhotosFor(card);
  var city=vcDynamicProfileCity(String(card.city||card.location||'').split(',')[0]),online=!!card.online,bio=String(card.bio||card.about||'');
  var ints=card.interests||card.tags||[],myInts=((state.me&&state.me.profile&&state.me.profile.interests)||[]),chips='';
  for(var i=0;i<ints.length&&i<8;i++){var shared=false;for(var j=0;j<myInts.length;j++){if(String(myInts[j]).toLowerCase()===String(ints[i]).toLowerCase()){shared=true;break;}}chips+='<span class="chip'+(shared?' match':'')+'">'+h(localizedInterest(ints[i]))+'</span>';}
  var facts=[];
  var zod=card.zodiac||null,zodName=zod?profileZodiacText(zod,zod&&zod.id):'';if(zodName)facts.push([t('v4_zodiac','Знак'),zodName]);
  var st=card.daily_status||null,stTitle=st?profileDailyStatusText(st,st&&st.id):'';if(stTitle)facts.push([t('v4_status','Статус'),stTitle]);
  var mood=card.mood||null;if(mood&&mood.title)facts.push([t('v4_mood','Настроение'),((mood.emoji&&!/^[?\uFFFD\s]+$/.test(mood.emoji))?mood.emoji+' ':'')+localizedProfileValue(mood.title)]);
  var job=localizedProfileValue(card.job||card.occupation||'');if(job)facts.push([t('v4_occupation','Занятие'),job]);
  if(card.distance)facts.push([t('v4_distance','Расстояние'),card.distance+' '+t('km','км')]);
  var thumbs=photos.length>1?'<div class="thumbs">'+photos.slice(0,8).map(function(u,pi){return '<button type="button"'+(pi===0?' class="on"':'')+' data-panel-photo="'+pi+'" aria-label="'+h(t('v4_photo','Фото'))+' '+(pi+1)+'"><img'+vcThumbSrc(u)+' alt="" loading="lazy"></button>';}).join('')+'</div>':'';
  return '<div class="pbody" id="vc-deck-panel-body">'+
    '<div class="row-between"><div><h2 class="pname">'+h(name)+(age?', '+age:'')+'</h2><p class="muted small">'+(city?h(city)+' · ':'')+h(online?t('online_now','Сейчас онлайн'):t('offline_short','не в сети'))+'</p></div><span class="pill '+(online?'green':'')+'">'+(online?'<i class="online-dot"></i>':'')+h(online?t('v4_online','В сети'):t('offline_short','не в сети'))+'</span></div>'+thumbs+
    '<h2 class="sec">'+h(t('about_her','О себе'))+'</h2><p class="bio" id="vc-panel-bio"'+(bio?'':' data-pending="1"')+'>'+h(bio)+'</p>'+
    (facts.length?'<div class="facts mt12">'+facts.map(function(f){return '<div><span>'+h(f[0])+'</span><b>'+h(f[1])+'</b></div>';}).join('')+'</div>':'')+
    (chips?'<h2 class="sec">'+h(t('her_interests','Интересы'))+'</h2><div class="chips">'+chips+'</div>':'')+
    '<div class="pactions mt16"><button type="button" class="btn btn-primary" data-panel-act="message">'+v4Icon('chat')+h(t('send_message','Написать'))+'</button><button type="button" class="btn btn-light" data-panel-act="like">'+v4Icon('heart')+h(t('like','Нравится'))+'</button><button type="button" class="btn btn-light" data-panel-act="profile">'+h(t('all_profile','Вся анкета'))+'</button></div></div>';
}
function v4DeckShowPhoto(card,n){
  var photos=deckPhotosFor(card),img=document.getElementById('vc-card-photo');
  if(!img||img.tagName!=='IMG'||!photos[n])return;
  vcSwapCardPhoto(img,photos[n]);
  $$('#vc-photo-segments i').forEach(function(b,i){b.classList.toggle('on',i===n);b.classList.toggle('is-on',i===n);b.classList.toggle('is-done',i<n);});
  $$('[data-panel-photo]').forEach(function(b){b.classList.toggle('on',(parseInt(b.dataset.panelPhoto,10)||0)===n);});
}
function v4ChatRowHtml(c,activePid){
  var displayChatName=localizedPersonName(c.name||c.fullname||''),nm=h(displayChatName),pid=parseInt(c.peer_id||c.id,10)||0;
  var draftRow=chatRowDraftPreview(c),msg=draftRow?('<span class="chat-row-draft" aria-hidden="true">\u270E</span><span class="chat-row-draft-label">'+h(t('chat_draft','Черновик'))+'</span>'+(draftRow.sticker?' '+h(t('sticker','Стикер')):' '+h(draftRow.text))):h(chatInboxPreview(c));
  var tm=h(v4ChatTime(c.last_at||c.last_ts||c.ts)),unreadCount=parseInt(c.unread,10)||0;
  var av=c.photo||c.avatar||'',avHtml=av?'<img'+vcThumbSrc(av)+' alt="" loading="lazy" decoding="async">':h(initials(displayChatName||'?')),avStyle=av?'':' style="background:'+avatarBg(c.name||c.fullname||'?')+'"';
  return '<div class="crow chat-row'+(unreadCount?' has-unread':'')+(draftRow?' has-draft':'')+(pid===activePid?' on':'')+'" role="button" tabindex="0" data-pid="'+pid+'" data-online="'+(c.online?1:0)+'" data-last-at="'+chatLastActivity(c)+'" data-search="'+h((String(c.name||c.fullname||'')+' '+displayChatName).toLocaleLowerCase())+'">'+
    '<div class="av"'+avStyle+'>'+avHtml+(c.online?'<span class="dot"></span>':'')+'</div>'+
    '<div class="cinfo"><div class="cnm"><b>'+nm+(parseInt(c.age,10)?', '+parseInt(c.age,10):'')+'</b><small class="chat-row-presence'+(c.online?' is-online':'')+'">'+h(chatPresenceText(c))+'</small></div><div class="cmsg">'+msg+'</div></div>'+
    '<div class="cmeta"><span class="ctm">'+tm+'</span>'+(unreadCount?'<span class="unread">'+(unreadCount>99?'99+':unreadCount)+'</span>':'')+'</div></div>';
}
function v4ChatLayout(peerId){
  var body=document.getElementById('vc-main-body');if(!body)return;
  if(String(state.route||'').indexOf('/chat/')!==0)return;
  var view=null;for(var i=0;i<body.children.length;i++){if(body.children[i].classList&&body.children[i].classList.contains('chat-view')){view=body.children[i];break;}}
  if(!view)return;
  body.classList.add('v4-view');
  if(!window.matchMedia('(min-width:980px)').matches)return;
  var chats=sortChatsForInbox(state.chats||(state.me?state.me.inbox:[])||[]),rows='',found=false;
  for(i=0;i<chats.length;i++){var pid=parseInt(chats[i].peer_id||chats[i].id,10)||0;if(pid===peerId)found=true;rows+=v4ChatRowHtml(chats[i],peerId);}
  var nameEl=document.getElementById('vc-chat-name'),avImg=document.querySelector('#vc-chat-avatar img'),presEl=document.getElementById('vc-chat-presence');
  var peerName=nameEl?nameEl.textContent.trim():'',peerPhoto=avImg?(avImg.getAttribute('data-full')||avImg.getAttribute('src')||''):'',peerPres=presEl?presEl.textContent.trim():'';
  if(!found)rows='<div class="crow chat-row on" role="button" tabindex="0" data-pid="'+peerId+'"><div class="av">'+(peerPhoto?'<img src="'+h(peerPhoto)+'" alt="">':'')+'</div><div class="cinfo"><div class="cnm"><b>'+h(peerName)+'</b></div><div class="cmsg">'+h(peerPres)+'</div></div></div>'+rows;
  var wrap=document.createElement('div');wrap.className='v4 chats is-thread';wrap.id='vc-chats-layout';
  wrap.innerHTML='<div class="clist"><div class="hd"><div class="row-between"><h1 class="page-h">'+h(t('nav_chats','Чаты'))+'</h1>'+v4BalancePill()+'</div></div><div class="sc"><div class="list clist-rows">'+rows+'</div></div></div><div class="cthread"></div>'+
    '<aside class="cinfo">'+(peerPhoto?'<img class="big" src="'+h(peerPhoto)+'" alt="">':'<div class="big">'+h(initials(peerName||'?'))+'</div>')+'<h2 class="sec">'+h(peerName)+'</h2><p class="muted small">'+h(peerPres)+'</p>'+
    '<div class="stack mt16"><button type="button" class="btn btn-light btn-block" data-cinfo="profile">'+v4Icon('user')+h(t('v4_open_profile','Анкета'))+'</button><button type="button" class="btn btn-soft btn-block" data-cinfo="gift">'+v4Icon('gift')+h(t('v4_gift','Подарок'))+'</button><button type="button" class="btn btn-ghost btn-block" data-cinfo="more">'+v4Icon('more')+h(t('v4_more','Ещё'))+'</button></div></aside>';
  body.insertBefore(wrap,view);wrap.querySelector('.cthread').appendChild(view);
  $$('.chat-row',wrap).forEach(function(r){bindActivation(r,function(){var pid=parseInt(r.dataset.pid,10);if(pid&&pid!==peerId)navigate('/chat/'+pid);},'link');});
  $$('[data-cinfo]',wrap).forEach(function(b){b.addEventListener('click',function(){var k=b.dataset.cinfo;if(k==='profile'){openProfile(peerId);}else if(k==='gift'){var g=document.getElementById('vc-chat-floating-gift');if(g)g.click();}else{var m=document.getElementById('vc-chat-block');if(m)m.click();}});});
  [700,1800,4000].forEach(function(ms){setTimeout(function(){v4ChatSyncPeer(peerId);},ms);});
}
/* The thread header fills in asynchronously; copy name, photo and presence into the list row and the partner card. */
function v4ChatSyncPeer(peerId){
  var wrap=document.getElementById('vc-chats-layout');if(!wrap||String(state.route||'').indexOf('/chat/')!==0)return;
  var nameEl=document.getElementById('vc-chat-name'),avImg=document.querySelector('#vc-chat-avatar img'),presEl=document.getElementById('vc-chat-presence');
  var peerName=nameEl?nameEl.textContent.trim():'',peerPhoto=avImg?(avImg.getAttribute('data-full')||avImg.getAttribute('src')||''):'',peerPres=presEl?presEl.textContent.trim():'';
  if(!peerName)return;
  var row=wrap.querySelector('.crow[data-pid="'+peerId+'"]');
  if(row){var b=row.querySelector('.cnm b');if(b&&b.textContent!==peerName)b.textContent=peerName;var av=row.querySelector('.av');if(av&&peerPhoto&&!av.querySelector('img')){var im=document.createElement('img');im.alt='';im.src=peerPhoto;av.appendChild(im);}}
  var aside=wrap.querySelector('aside.cinfo');if(!aside)return;
  var title=aside.querySelector('.sec');if(title&&title.textContent!==peerName)title.textContent=peerName;
  var pres=aside.querySelector('p.muted');if(pres&&peerPres)pres.textContent=peerPres;
  var big=aside.querySelector('.big');if(big&&peerPhoto&&big.tagName!=='IMG'){var img=document.createElement('img');img.className='big';img.alt='';img.src=peerPhoto;big.parentNode.replaceChild(img,big);}
}
function v4ObserveChat(peerId){
  var body=document.getElementById('vc-main-body');if(!body)return;
  if(state.v4ChatObserver){state.v4ChatObserver.disconnect();state.v4ChatObserver=null;}
  v4ChatLayout(peerId);
  if(!window.MutationObserver)return;
  var obs=new MutationObserver(function(){if(String(state.route||'').indexOf('/chat/')!==0){obs.disconnect();if(state.v4ChatObserver===obs)state.v4ChatObserver=null;return;}v4ChatLayout(peerId);});
  obs.observe(body,{childList:true});state.v4ChatObserver=obs;
}
function v4AfterRender(fn){
  var body=document.getElementById('vc-main-body');if(!body)return;
  fn();
  if(!window.MutationObserver)return;
  if(state.v4RenderObserver){state.v4RenderObserver.disconnect();state.v4RenderObserver=null;}
  var route=state.route,obs=new MutationObserver(function(){if(state.route!==route){obs.disconnect();if(state.v4RenderObserver===obs)state.v4RenderObserver=null;return;}fn();});
  obs.observe(body,{childList:true,subtree:true});state.v4RenderObserver=obs;
  setTimeout(function(){if(state.v4RenderObserver===obs){obs.disconnect();state.v4RenderObserver=null;}},5000);
}
function v4SettingsIcon(label){
  var s=String(label||'').toLowerCase();
  if(/вход|вхід|email|доступ|пароль/.test(s))return 'lock';
  if(/уведом|сповіщ/.test(s))return 'bell';
  if(/приват|безопас|безпек/.test(s))return 'shield';
  if(/помощ|поддерж|допомог|підтрим/.test(s))return 'help';
  if(/установ|приложен|встанов|застосун/.test(s))return 'monitor';
  if(/оформл|тема|язык|мова/.test(s))return 'sun';
  if(/удал|выход|видал|вихід/.test(s))return 'trash';
  if(/кто вы|хто ви|профил|профіл/.test(s))return 'user';
  return 'gear';
}
function v4SettingsNav(){
  var body=document.getElementById('vc-main-body'),view=body&&body.querySelector('.settings-view');
  if(!view||document.getElementById('vc-v4-setnav'))return;
  var sections=$$('.set-section',view).filter(function(s){return !s.hidden&&s.querySelector('.set-h');});
  if(sections.length<2)return;
  body.classList.add('v4-view');
  var wrap=document.createElement('div');wrap.className='v4 v4-page sets-page';wrap.id='vc-v4-sets';
  wrap.innerHTML='<div class="sets"><nav class="setnav" id="vc-v4-setnav" aria-label="'+h(t('nav_settings','Настройки'))+'"><div class="list"></div></nav><div class="setbody"></div></div>';
  var list=wrap.querySelector('.setnav .list');
  sections.forEach(function(s,i){
    var label=s.querySelector('.set-h').textContent.trim();if(!s.id)s.id='vc-set-sec-'+i;
    var b=document.createElement('button');b.type='button';b.className='row'+(i===0?' on':'');
    b.innerHTML='<span class="ic'+(i===0?' coral':'')+'">'+v4Icon(v4SettingsIcon(label))+'</span><span class="tx"><b>'+h(label)+'</b></span>'+v4Icon('chev','chev');
    b.addEventListener('click',function(){$$('.row',list).forEach(function(x){x.classList.toggle('on',x===b);x.querySelector('.ic').classList.toggle('coral',x===b);});try{s.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){s.scrollIntoView();}});
    list.appendChild(b);
  });
  body.insertBefore(wrap,view);wrap.querySelector('.setbody').appendChild(view);
}
function v4ProfileExtras(){
  var body=document.getElementById('vc-main-body'),panels=body&&body.querySelector('.own-profile-panels');
  if(!panels||document.getElementById('vc-v4-profile-links'))return;
  function row(icon,cls,label,route){return '<button type="button" class="row" data-route="'+route+'"><span class="ic '+cls+'">'+v4Icon(icon)+'</span><span class="tx"><b>'+h(label)+'</b></span>'+v4Icon('chev','chev')+'</button>';}
  var list=document.createElement('div');list.className='v4';list.id='vc-v4-profile-links';
  list.innerHTML='<h2 class="sec">'+h(t('v4_account_section','Аккаунт'))+'</h2><div class="list">'+row('wallet','navy',t('v4_nav_store','Пакеты и баланс'),'/store')+row('heart','coral',t('v4_nav_likes','Симпатии'),'/likes')+row('bell','amber',t('notifications','Уведомления'),'/activity')+row('gear','',t('nav_settings','Настройки'),'/settings')+row('help','green',t('v4_nav_support','Поддержка'),'/support')+'</div>';
  panels.appendChild(list);
  $$('[data-route]',list).forEach(function(b){b.addEventListener('click',function(){navigate(b.dataset.route);});});
}

function viewLikes(){
  var title=t('v4_nav_likes','Симпатии');
  var body=v4Page(v4PageHead(title,t('v4_likes_sub','Кому понравилась ваша анкета'))+'<div id="vc-likes-list"><div class="sk" style="height:220px"></div></div>','v4-likes');
  if(!body)return;
  var list=document.getElementById('vc-likes-list');
  api('likes').then(function(r){
    if(!document.getElementById('vc-likes-list'))return;
    var items=(r&&r.ok&&Array.isArray(r.items))?r.items.slice().sort(function(a,b){return (parseInt(b.at,10)||0)-(parseInt(a.at,10)||0);}):[];
    if(!items.length){
      list.innerHTML=v4Empty('heart',t('v4_likes_empty_title','Пока нет симпатий'),t('v4_likes_empty_text','Лайкайте анкеты в поиске — взаимные симпатии появятся здесь'),t('v4_go_search','В поиск'),'/');
    }else{
      list.innerHTML='<div class="grid2">'+items.map(function(n){
        var id=parseInt(n.id||n.user_id,10)||0,name=localizedPersonName(n.name||n.fullname||''),photo=n.photo||'';
        return '<button type="button" class="pcard" data-route="/profile/'+id+'">'+(photo?'<img src="'+h(photo)+'" alt="" loading="lazy">':'')+'<div class="g"></div>'+(n.online?'<span class="st"><i></i>'+h(t('v4_online','В сети'))+'</span>':'')+'<div class="t"><b>'+h(name)+(n.age?', '+h(n.age):'')+'</b>'+(n.city?'<span>'+h(localizedCity(n.city))+'</span>':'')+'</div></button>';
      }).join('')+'</div>';
    }
    $$('[data-route]',list).forEach(function(el){el.addEventListener('click',function(){navigate(el.dataset.route);});});
    if((parseInt(state.me&&state.me.likes_new,10)||0)>0){api('mark_seen',{kind:'likes'}).then(function(res){if(res&&res.ok&&state.me){state.me.likes_new=0;updateChatsBadge();}}).catch(function(){});}
  }).catch(function(){if(list)list.innerHTML=v4Empty('info',t('load_failed','Не удалось загрузить данные'),'');});
}

/* ===== Layout shell (redesign 2026-10-14: 252px sidebar on desktop, 4 bottom tabs on phones — redesign.css) ===== */
function renderShell(){
  var app = document.getElementById('app');
  if (!app) return;
  if (app.querySelector('#vc-rail')) { return; }
  app.className = 'app v4';
  app.innerHTML =
    '<aside class="sidebar" id="vc-rail">' + railHtml() + '</aside>' +
    '<section class="center" id="vc-center">' +
      '<div class="vc-route-loader" aria-hidden="true"><i></i></div>' +
      '<div class="main-body" id="vc-main-body"></div>' +
    '</section>' +
    '<nav class="bottomnav" id="vc-bottom-nav" aria-label="' + h(t('nav_your_space','Ваше пространство')) + '">' + bottomNavHtml() + '</nav>';
  wireRail();
  wireBottomNav();
}
function railHtml(){
  var me = state.me || {};
  var prof = me.profile || {};
  var selfName=localizedPersonName(prof.fullname || prof.name || (me.uid ? 'User'+me.uid : ''));
  var nm = h(selfName);
  var age = prof.u_age || prof.age || '';
  var av = prof.photo || prof.avatar || '';
  var avHtml = av ? '<img src="'+h(av)+'" alt="">' : h(initials(selfName));
  var avStyle = av ? '' : 'style="background:'+avatarBg(prof.fullname||prof.name||'')+'"';
  var accountLabel=sidebarAccountLabel();
  var activeTheme=state.resolvedTheme||resolvedTheme(state.theme||storedTheme());
  var themeLabel=h(t('theme','Тема'));
  var activeThemeLabel=h(t(activeTheme==='light'?'theme_light':'theme_dark',activeTheme==='light'?'Светлая':'Тёмная'));
  var nextTheme=activeTheme==='light'?'dark':'light';
  var themeSource=state.theme==='system'?h(t('theme_system','Как в системе')):'';
  var themeAccessible=h(themeAccessibleLabel(state.theme||'system',activeTheme));
  function nv(key,route,icon,label,badgeId){return '<div class="nv nav-item" data-key="'+key+'" data-route="'+route+'">'+v4Icon(icon)+'<span>'+h(label)+'</span>'+(badgeId?'<i class="b" id="'+badgeId+'" style="display:none"></i>':'')+'</div>';}
  return '' +
    '<a class="logo" href="#/" aria-label="otkrovenno.online">otkrovenno<em>.online</em></a>' +
    '<nav class="nav desktop-nav" aria-label="' + h(t('nav_your_space','Ваше пространство')) + '">' +
      nv('discover','/','compass',t('nav_discover','Поиск')) +
      nv('likes','/likes','heart',t('v4_nav_likes','Симпатии'),'vc-likes-badge') +
      nv('chats','/chats','chat',t('nav_chats','Чаты'),'vc-chats-badge') +
      nv('notifications','/activity','bell',t('notifications','Уведомления'),'vc-activity-badge') +
      nv('profile','/profile','user',t('nav_profile','Профиль')) +
      '<div class="sep" aria-hidden="true"></div>' +
      nv('store','/store','wallet',t('v4_nav_store','Пакеты и баланс')) +
      nv('settings','/settings','gear',t('nav_settings','Настройки')) +
      nv('support','/support','help',t('v4_nav_support','Поддержка')) +
    '</nav>' +
    '<div class="wallet" role="group" aria-label="'+h(t('account_balance','Баланс аккаунта'))+'">' +
      '<div class="lab">'+h(t('account_balance','Баланс аккаунта'))+'</div>' +
      '<div class="amt" id="vc-rail-balance">'+h(vibeAmount(parseInt(me.balance,10)||0))+'</div>' +
      '<div class="row2"><button type="button" class="btn btn-sm" data-rail-topup>'+h(t('top_up_short','Пополнить'))+'</button><button type="button" class="btn btn-sm o" data-rail-store>'+h(t('v4_packs','Пакеты'))+'</button></div>' +
    '</div>' +
    '<div class="vc-rail-theme" role="group" aria-label="'+themeLabel+'">' +
      '<button type="button" data-rail-theme-toggle role="switch" aria-checked="'+(activeTheme==='dark'?'true':'false')+'" aria-label="'+themeAccessible+'" title="'+themeAccessible+'">'+
        '<span class="vc-rail-theme-current">'+v4Icon(activeTheme==='light'?'sun':'moon')+'</span><span class="vc-rail-theme-copy"><strong>'+activeThemeLabel+'</strong>'+(themeSource?'<small>'+themeSource+'</small>':'')+'</span><span class="vc-rail-theme-track" data-next-theme="'+nextTheme+'" aria-hidden="true"><i></i></span>'+
      '</button>' +
    '</div>' +
    '<div class="me user-mini account" data-route="/profile">' +
      '<div class="avatar navy" '+avStyle+'>'+avHtml+'</div>' +
      '<div><b>'+nm+(age?', '+h(age):'')+'</b><span title="'+h(accountLabel)+'">'+h(accountLabel)+'</span></div>' +
    '</div>';
}
function wireRail(){
  $$('#vc-rail .nav-item, #vc-rail .user-mini').forEach(function(it){
    bindActivation(it,function(){ if(it.dataset.key==='notifications'){openNotificationCenter();return;} var r = it.dataset.route; if (r) navigate(r); },'link');
  });
  $$('#vc-rail [data-rail-theme-toggle]').forEach(function(button){
    bindActivation(button,function(){applyTheme(nextQuickTheme(),true);toast(t('theme_updated','Тема обновлена'),'success');},'button');
  });
  $$('#vc-rail [data-rail-topup]').forEach(function(button){
    bindActivation(button,function(){openTopUp({source:'rail'});},'button');
  });
  $$('#vc-rail [data-rail-store]').forEach(function(button){
    bindActivation(button,function(){navigate('/store');},'button');
  });
}
function nextQuickTheme(){
  var resolved=state.resolvedTheme||resolvedTheme(state.theme||storedTheme());
  return resolved==='light'?'dark':'light';
}
function topbarHtml(){
  var me = state.me || {};
  var prof = me.profile || {};
  var av = prof.photo || prof.avatar || '';
  var avHtml = av ? '<img src="'+h(av)+'" alt="">' : h(initials(localizedPersonName(prof.fullname||prof.name||'')));
  var avStyle = av ? '' : 'style="background:'+avatarBg(prof.fullname||prof.name||'')+'"';
  var nextTheme=nextQuickTheme();
  var nextThemeLabel=t(nextTheme==='light'?'theme_light':'theme_dark',nextTheme==='light'?'Светлая':'Тёмная');
  var themeToggleLabel=t('theme','Тема')+' · '+nextThemeLabel;
  var centerHtml = '';
  return '' +
    centerHtml +
    '<div class="top-actions">' +
      '<div class="tool-btn vc-icon-glass" id="vc-bell" role="button" tabindex="0" aria-label="'+h(t('notifications','Уведомления'))+'">'+glassIcon('bell')+'<span class="dot" id="vc-bell-dot" style="display:none"></span></div>' +
      '<div class="tool-btn vc-icon-glass vc-theme-quick" id="vc-theme-quick" role="button" tabindex="0" aria-label="'+h(themeToggleLabel)+'" title="'+h(themeToggleLabel)+'">'+semanticGlassIcon('theme-'+nextTheme)+'</div>' +
      '<div class="tool-av" id="vc-top-av" role="button" tabindex="0" aria-label="'+h(t('open_profile','Открыть профиль'))+'" '+avStyle+'>'+avHtml+'</div>' +
    '</div>';
}
function renderTopbar(){
  var tb = document.getElementById('vc-topbar');
  if (!tb) return;
  tb.innerHTML = topbarHtml();
  wireTopbar();
}
function wireTopbar(){
  var bell = document.getElementById('vc-bell');
  if (bell){bell.setAttribute('aria-label',t('notifications','Уведомления'));bindActivation(bell,openNotificationCenter,'button');}
  var themeQuick=document.getElementById('vc-theme-quick');
  if(themeQuick)bindActivation(themeQuick,function(){applyTheme(nextQuickTheme(),true);toast(t('theme_updated','Тема обновлена'),'success');},'button');
  var av = document.getElementById('vc-top-av');
  if (av){av.addEventListener('click', function(){ navigate('/profile'); });av.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();navigate('/profile');}});}
  var cog = document.getElementById('vc-filter-cog');
  if (cog) cog.addEventListener('click', openDiscoverFilters);
  $$('.vc-open-filter').forEach(function(btn){btn.addEventListener('click',openDiscoverFilters);});
  var ctxSearch = document.getElementById('vc-ctx-search');
  if (ctxSearch) ctxSearch.addEventListener('keydown', function(e){ if (e.key === 'Enter' && ctxSearch.value.trim()){e.preventDefault();openGlobalSearch(ctxSearch.value.trim());} });
}
function bottomNavHtml(){
  function tab(key,route,icon,label,badgeId){return '<div class="bn-item" data-key="'+key+'" data-route="'+route+'">'+v4Icon(icon)+'<span>'+h(label)+'</span>'+(badgeId?'<i class="badge" id="'+badgeId+'" hidden></i>':'')+'</div>';}
  return '' +
    tab('discover','/','compass',t('nav_discover','Поиск')) +
    tab('likes','/likes','heart',t('v4_nav_likes','Симпатии'),'vc-mobile-likes-badge') +
    tab('chats','/chats','chat',t('nav_chats','Чаты'),'vc-mobile-chats-badge') +
    tab('profile','/profile','user',t('nav_profile','Профиль'));
}
function wireBottomNav(){
  $$('#vc-bottom-nav .bn-item').forEach(function(it){
    bindActivation(it,function(){ if(it.dataset.key==='notifications'){openNotificationCenter();return;} navigate(it.dataset.route); },'link');
  });
}

/* ===== Context panel (right sidebar — prototype V2) ===== */
function contextHtml(){
  var me = state.me || {};
  var chats = (me.inbox || state.chats || []).slice(0,6);
  var virtuals = ((state.deck&&state.deck.length)?state.deck:(me.virtuals||[])).slice(0,4);

  /* Connections feed */
  var connHtml = chats.length ? chats.map(function(c){
    var connName=localizedPersonName(c.name||c.fullname||'?'),nm = h(connName.split(' ')[0]);
    var av = c.photo || c.avatar || '';
    var avHtml = av ? '<img src="'+h(av)+'" alt="">' : h(initials(connName));
    var avStyle = av ? '' : 'style="background:'+avatarBg(c.name||c.fullname||'?')+'"';
    var online = c.online ? '<span class="online"></span>' : '';
    return '<div class="conn-item" data-pid="'+h(c.peer_id||c.id||0)+'"><div class="conn-av" '+avStyle+'>'+avHtml+online+'</div><span class="conn-name">'+nm+'</span></div>';
  }).join('') : '<div style="font-size:12px;color:var(--text3);padding:8px 0">'+h(t('chats_empty','Пока пусто'))+'</div>';

  /* Suggested profiles — compact vertical list without synthetic compatibility scores. */
  var featHtml = virtuals.length ? virtuals.map(function(m){
    var nm = h(localizedPersonName(m.name||m.fullname||''));
    var age = m.age || m.u_age || '';
    var city = h(vcDynamicProfileCity((m.city||m.location||'').split(',')[0]));
    var av = m.photo || m.avatar || (m.photos && m.photos[0]) || '';
    var avHtml = av ? '<img src="'+h(av)+'" alt="">' : '';
    var avStyle = av ? '' : 'style="background:'+avatarBg(m.name||m.fullname||'?')+'"';
    return '<div class="top-row" data-pid="'+h(m.id||m.user_id||0)+'">' +
      '<div class="top-av" '+avStyle+'>'+avHtml+'</div>' +
      '<div class="top-info"><div class="top-nm">'+nm+(age?', '+h(age):'')+'</div><div class="top-sub">'+city+'</div></div>' +
    '</div>';
  }).join('') : '<div style="font-size:12px;color:var(--text3);padding:8px 0">'+h(t('disc_empty','Пусто'))+'</div>';

  /* Stats — mini cards with icons */
  var newLikes = parseInt(me.likes_new,10)||0;
  var statHtml =
    '<div class="stat-card"><div class="stat-ico pink">'+glassIcon('like')+'</div><div class="stat-info"><div class="stat-num">'+newLikes+'</div><div class="stat-lbl">'+h(t('new_likes','Новые лайки'))+'</div></div></div>';

  var isChatRoute=(state.route||'').indexOf('/chat/')===0;
  var sharedHtml='' +
    '<div class="r-section r-search-section">' +
      '<div class="search r-search">'+semanticGlassIcon('search','vc-search-glass-icon')+'<input type="search" id="vc-ctx-search" aria-label="'+h(isChatRoute?t('chat_search_placeholder','Поиск чатов'):t('search_people','Поиск людей'))+'" placeholder="'+h(isChatRoute?t('chat_search_placeholder','Поиск чатов...'):t('search_people','Поиск людей...'))+'"></div>' +
    '</div>' +
    '<div class="r-section">' +
      '<div class="r-head"><h3>'+h(t('nav_chats','Контакты'))+'</h3><span class="more" id="vc-conn-more">'+h(t('see_all','Все'))+' \u2192</span></div>' +
      '<div class="conn-feed">'+connHtml+'</div>' +
    '</div>' +
    '<div class="r-section">' +
      '<div class="r-head"><h3>'+h(t('top_matches','Рекомендации'))+'</h3></div>' +
      '<div class="top-list-vertical">'+featHtml+'</div>' +
    '</div>';
  if(isChatRoute)return sharedHtml;
  return sharedHtml+
    '<div class="r-section">' +
      '<div class="r-head"><h3>'+h(t('vibe_stats','Активность'))+'</h3></div>' +
      '<div class="stat-grid">'+statHtml+'</div>' +
    '</div>';
}
function wireContext(){
  var more = document.getElementById('vc-conn-more');
  if (more) bindActivation(more,function(){ navigate('/chats'); },'link');
  $$('#vc-ctx .conn-item').forEach(function(r){
    bindActivation(r,function(){ var pid = parseInt(r.dataset.pid,10); if (pid) navigate('/chat/'+pid); },'link');
  });
  $$('#vc-ctx .top-row, #vc-ctx .stat-card[data-pid]').forEach(function(r){
    bindActivation(r,function(){ var pid = parseInt(r.dataset.pid,10); if (pid) openProfile(pid); },'button');
  });
  var ctxSearch=document.getElementById('vc-ctx-search');
  if(ctxSearch)ctxSearch.addEventListener('keydown',function(e){if(e.key==='Enter'&&ctxSearch.value.trim()){e.preventDefault();openGlobalSearch(ctxSearch.value.trim());}});
}
function renderContext(){ var ctx = document.getElementById('vc-ctx'); if (!ctx) return; ctx.classList.toggle('chat-context-rail',(state.route||'').indexOf('/chat/')===0);ctx.innerHTML = contextHtml(); wireContext(); }
function openGlobalSearch(query){
  query=String(query||'').trim().toLocaleLowerCase();if(!query)return;var rows=[],seen={},chats=state.chats||[],profiles=state.deckAll||[];
  function add(x,kind){var id=parseInt(x.peer_id||x.id||x.user_id,10)||0;if(!id||seen[id])return;var rawName=x.name||x.fullname||('#'+id),rawCity=vcViewerCityRaw()||x.city||x.location||'',displayName=localizedPersonName(rawName),displayCity=vcDynamicProfileCity(rawCity),displayInterests=(x.interests||x.tags||[]).map(localizedInterest);var hay=[rawName,displayName,rawCity,displayCity,(x.interests||x.tags||[]).join(' '),displayInterests.join(' ')].join(' ').toLocaleLowerCase();if(hay.indexOf(query)<0)return;seen[id]=1;rows.push({id:id,kind:kind,name:displayName,city:displayCity,photo:x.photo||x.avatar||''});}
  for(var i=0;i<chats.length;i++)add(chats[i],'chat');for(var j=0;j<profiles.length;j++)add(profiles[j],'profile');
  var ov=el('div',{class:'lightbox',style:'position:fixed;inset:0;background:rgba(0,0,0,.84);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px'}),html='<div style="background:#1d1924;border-radius:18px;max-width:460px;width:100%;max-height:80vh;overflow:auto;padding:18px"><div style="display:flex;justify-content:space-between;align-items:center"><strong>'+h(t('search_results','Результаты поиска'))+'</strong><button type="button" class="vc-icon-glass vc-overlay-close" data-close aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close')+'</button></div>';
  if(!rows.length)html+='<div class="empty-state"><p>'+h(t('search_empty','Ничего не найдено'))+'</p></div>';else for(var k=0;k<rows.length;k++){var x=rows[k];html+='<button type="button" class="vc-search-result" data-id="'+h(x.id)+'" data-kind="'+h(x.kind)+'" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 0;border:0;border-top:1px solid rgba(255,255,255,.06);background:none;color:#fff;text-align:left;cursor:pointer"><span style="width:42px;height:42px;border-radius:50%;background:'+(x.photo?'url('+h(x.photo)+') center/cover,':'')+avatarBg(x.name)+'"></span><span><strong>'+h(x.name)+'</strong><small style="display:block;color:var(--text3)">'+h(x.city)+'</small></span></button>';}
  ov.innerHTML=html+'</div>';document.body.appendChild(ov);function close(){if(ov.parentNode)ov.parentNode.removeChild(ov);}ov.querySelector('[data-close]').addEventListener('click',close);ov.addEventListener('click',function(e){if(e.target===ov)close();});$$('.vc-search-result',ov).forEach(function(btn){btn.addEventListener('click',function(){var id=parseInt(btn.dataset.id,10);close();if(btn.dataset.kind==='chat')navigate('/chat/'+id);else openProfile(id);});});
}
function openProfile(id){
  id=parseInt(id,10)||0;if(!id)return;
  if(state.route.indexOf('/profile/')!==0)state.profileDetailReturn=state.route||'/';
  try{var rb0=document.getElementById('vc-main-body');if(rb0)state.deckScroll=rb0.scrollTop||0;}catch(e){}
  navigate('/profile/'+id);
}
function profileTrustData(trust){
  return null;
}
function profileTrustHtml(trust,expanded){
  var data=profileTrustData(trust);if(!data)return '';
  if(expanded)return '<div class="vc-profile-trust-card '+h(data.kind)+'"><strong>'+h(data.label)+'</strong><p>'+h(data.detail)+'</p></div>';
  return '<span class="vc-profile-trust-badge '+h(data.kind)+'" title="'+h(data.detail)+'" aria-label="'+h(data.label)+': '+h(data.detail)+'">'+h(data.label)+'</span>';
}
function profileEnumText(key,value){
  var labels={serious:'Серьёзные отношения',dating:'Свидания',flirt:'Флирт',friendship:'Дружба',chat:'Общение',unsure:'Пока не решила',employed:'Работает',self_employed:'На себя',business:'Свой бизнес',student:'Учится',between_jobs:'В поиске работы',retired:'На пенсии',other:'Другое',no:'Нет',sometimes:'Иногда',yes:'Да',social:'В компании',want:'Хочет детей',have:'Есть дети',dont_want:'Не хочет детей',open:'Открыта к этому',single:'Свободна',divorced:'В разводе',separated:'Живёт отдельно',widowed:'Вдова',complicated:'Всё сложно',dog:'Собака',cat:'Кот',love_animals:'Любит животных'};
  var fieldLabels={occupation:'Занятость',relationship_goal:'Цель знакомства',employment:'Работа',smoking:'Курение',alcohol:'Алкоголь',children:'Дети',marital_status:'Семейное положение',pets:'Питомцы',music:'Музыка'};
  return {label:t('profile_field_'+key,fieldLabels[key]||key),value:t('profile_value_'+value,labels[value]||value)};
}
var PROFILE_ZODIAC_META=[
  null,
  {asset:'aries',key:'zodiac_aries',fallback:'Aries'},
  {asset:'taurus',key:'zodiac_taurus',fallback:'Taurus'},
  {asset:'gemini',key:'zodiac_gemini',fallback:'Gemini'},
  {asset:'cancer',key:'zodiac_cancer',fallback:'Cancer'},
  {asset:'leo',key:'zodiac_leo',fallback:'Leo'},
  {asset:'virgo',key:'zodiac_virgo',fallback:'Virgo'},
  {asset:'libra',key:'zodiac_libra',fallback:'Libra'},
  {asset:'scorpio',key:'zodiac_scorpio',fallback:'Scorpio'},
  {asset:'sagittarius',key:'zodiac_sagittarius',fallback:'Sagittarius'},
  {asset:'capricorn',key:'zodiac_capricorn',fallback:'Capricorn'},
  {asset:'aquarius',key:'zodiac_aquarius',fallback:'Aquarius'},
  {asset:'pisces',key:'zodiac_pisces',fallback:'Pisces'}
];
var PROFILE_STATUS_META=[
  null,
  {asset:'chat',key:'profile_status_chat',fallback:'Looking to chat'},
  {asset:'flirt',key:'profile_status_flirt',fallback:'Ready to flirt'},
  {asset:'calm',key:'profile_status_calm',fallback:'Calm vibe'},
  {asset:'adventure',key:'profile_status_adventure',fallback:'Seeking adventure'},
  {asset:'coffee',key:'profile_status_coffee',fallback:'Coffee & talks'},
  {asset:'pause',key:'profile_status_pause',fallback:'Not now (pause)'},
  {asset:'open',key:'profile_status_open',fallback:'Open to new'}
];
function profileMetaId(info,fallbackId){
  if(info!=null&&typeof info!=='object'&&fallbackId==null)fallbackId=info;
  info=(info&&typeof info==='object')?info:{};
  return parseInt(info.id!=null?info.id:fallbackId,10)||0;
}
function profileLocalizedMetaText(info,fallbackId,metaList){
  info=(info&&typeof info==='object')?info:{};
  var id=profileMetaId(info,fallbackId),meta=metaList[id];
  if(!id)return '';
  if(!meta)return String(info.name||info.title||'');
  return t(meta.key,meta.fallback);
}
function profileZodiacText(info,fallbackId){return profileLocalizedMetaText(info,fallbackId,PROFILE_ZODIAC_META).trim();}
function profileDailyStatusText(info,fallbackId){return profileLocalizedMetaText(info,fallbackId,PROFILE_STATUS_META).trim();}
function profileMetaGlassIcon(kind,info,fallbackId,className){
  var list=kind==='zodiac'?PROFILE_ZODIAC_META:(kind==='status'?PROFILE_STATUS_META:null),id=list?profileMetaId(info,fallbackId):0,meta=list&&list[id];
  if(!meta||!/^[a-z0-9-]+$/.test(meta.asset||''))return '';
  return '<img class="vc-profile-symbol-icon'+(className?' '+h(className):'')+'" src="/app/assets/glass/'+kind+'-'+h(meta.asset)+'.png" alt="" aria-hidden="true">';
}
function rankGlassIcon(rank,className){
  rank=parseInt(rank,10)||0;
  if(rank<1||rank>10)return rank?String(rank):'—';
  var file=(rank<10?'0':'')+rank;
  return '<span class="vc-rank-emblem'+(className?' '+h(className):'')+'" role="img" aria-label="TOP '+rank+'"><img src="/app/assets/glass/rank-'+file+'.png" alt="" aria-hidden="true"></span>';
}
function viewProfileDetail(id){
  var body=document.getElementById('vc-main-body');if(!body)return;
  if(state.profileInterestTimer){clearTimeout(state.profileInterestTimer);state.profileInterestTimer=null;}
  body.innerHTML='<div class="public-profile-page"><div class="pp-skeleton"><i></i><div><b></b><span></span><span></span><span></span></div></div></div>';
  var routeAtLoad=state.route;
  state.profileDetailLoading=Promise.all([api('vprofile',{virtual:id}),api('online_watch_status',{virtual:id}).catch(function(){return {ok:false};})]).then(function(all){
    if(state.route!==routeAtLoad)return;var r=all[0],watch=all[1];
    if(!r||!r.ok){renderLoadError(body,localizedErrorText(r&&r.err,t('network_error','Не удалось загрузить анкету')),function(){viewProfileDetail(id);});return;}
    var p=r.profile||r;p._watch=watch&&watch.ok?watch:null;state.profileDetail=p;state.profileDetailPhoto=0;
    api('profile_view',{virtual:id}).catch(function(){});v4RenderProfileDetail(p);
    state.profileInterestTimer=setTimeout(function(){
      state.profileInterestTimer=null;
      if(state.route===routeAtLoad&&state.profileDetail&&parseInt(state.profileDetail.id,10)===parseInt(id,10)){
        var key='dwell:'+id;if(!state.profileInterestSent[key]){state.profileInterestSent[key]=1;api('profile_interest',{virtual:id,dwell:15,source:'dwell'}).catch(function(){});}
      }
    },15000);
  }).catch(function(){if(state.route===routeAtLoad)renderLoadError(body,t('network_error','Не удалось загрузить анкету'),function(){viewProfileDetail(id);});});
}
function renderProfileDetail(p){
  var body=document.getElementById('vc-main-body');if(!body)return;
  var profileName=localizedPersonName(p.name||p.fullname||''),profileCity=vcDynamicProfileCity(p.city||p.location||t('nearby','Рядом'));
  var pid=parseInt(p.id||p.user_id,10)||0,gallery=Array.isArray(p.gallery)?p.gallery.slice():[],photos=[],photoMap=[];
  if(p.photo){photos.push(p.photo);photoMap.push(-1);}for(var pg=0;pg<gallery.length;pg++){if(gallery[pg]&&photos.indexOf(gallery[pg])<0){photos.push(gallery[pg]);photoMap.push(pg);}}if(!photos.length){photos=[''];photoMap=[-1];}p._photoIndexMap=photoMap;
  markChatProfilePhotosSeen(pid,photos.length);
  var photoLikeCounts=p.photo_like_counts||{},photoLiked=p.photo_liked||{},profileLikeCount=parseInt(p.profile_like_count,10)||0;
  function photoLikeCount(ref){var k=String(ref),n=photoLikeCounts[k]!=null?photoLikeCounts[k]:photoLikeCounts[ref];return Math.max(0,parseInt(n,10)||0);}
  function photoLikedState(ref){return parseInt(photoLiked[String(ref)]!=null?photoLiked[String(ref)]:photoLiked[ref],10)===1;}
  var hero=p.photo||photos[0]||'',heroRef=photoMap.length?photoMap[0]:-1,online=!!(p.presence&&p.presence.online),lastSeen=p.presence&&p.presence.last_seen?relativePresenceTime(p.presence.last_seen):'';
  var thumbHtml='',galleryHtml='',heroLikeAllowed=true;
  for(var i=0;i<photos.length;i++){
    var galleryIdx=photoMap[i],photoAria=t('photo','Фото')+' '+(i+1),photoStyle=photos[i]?' style="--pp-img:url('+h(photos[i])+')"':'';
    var photoRef=String(galleryIdx),pLikeCount=photoLikeCount(galleryIdx),pLiked=photoLikedState(galleryIdx);
    var photoLikeBtn='<button type="button" class="pp-photo-like-btn'+(pLiked?' active':'')+'" data-pp-photo-like="'+h(photoRef)+'" aria-pressed="'+(pLiked?'true':'false')+'" aria-label="'+h(t('like','Лайк'))+'">'+glassIcon('like')+'<span>'+pLikeCount+'</span></button>';
    thumbHtml+='<span class="pp-thumb-wrap"><button type="button" class="pp-thumb'+(i===0?' active':'')+'" data-pp-photo="'+i+'"'+photoStyle+' aria-label="'+h(photoAria)+'"></button>'+photoLikeBtn+'</span>';
    
  }
  var interests=(p.interests||[]).map(function(x){return '<span>'+h(localizedInterest(x))+'</span>';}).join('');
  var gifts=p.received_gifts||[],giftsHtml='';
  for(var g=0;g<gifts.length;g++){var gift=gifts[g]||{};giftsHtml+='<div class="pp-gift">'+(gift.gift_img?'<img src="'+h(gift.gift_img)+'" alt="">':'<span>'+glassIcon('gift')+'</span>')+'<div><strong>'+h(gift.sender_name?localizedPersonName(gift.sender_name):t('anonymous','Анонимно'))+'</strong><p>'+h(gift.message||t('gift_received','Подарок для неё'))+'</p></div><b>'+((gift.gift_cost||gift.cost)?vibeAmount(gift.gift_cost||gift.cost):'')+'</b></div>';}
  var giftsBlockHtml=giftsHtml||'<div class="pp-gift-empty"><div class="pp-gift-empty-main"><div class="pp-gift-empty-icon" aria-hidden="true"><span>'+glassIcon('gift')+'</span><i></i></div><div class="pp-gift-empty-copy"><strong>'+h(t('gift_empty_title','Будьте первым, кто её порадует'))+'</strong><p>'+h(t('gift_empty_copy','Подарок заметнее обычного лайка и останется в её профиле. Добавьте несколько личных слов — это запомнится.'))+'</p></div></div><button type="button" id="pp-gift-empty" class="vc-labelled-glass-button">'+glassIcon('gift')+'<span>'+h(t('gift_empty_cta','Подарить подарок'))+'</span><b aria-hidden="true">→</b></button></div>';
  var zodText=profileZodiacText(p.zodiac,p.zodiac&&p.zodiac.id),statusText=profileDailyStatusText(p.daily_status,p.daily_status&&p.daily_status.id);
  var zod=zodText?('<span class="vc-profile-symbol">'+profileMetaGlassIcon('zodiac',p.zodiac,p.zodiac&&p.zodiac.id)+h(zodText)+'</span>'):'',status=statusText?('<span class="vc-profile-symbol">'+profileMetaGlassIcon('status',p.daily_status,p.daily_status&&p.daily_status.id)+h(statusText)+'</span>'):'';
  var trustCard=profileTrustHtml(p.trust,true);
  var profileBioText=String(p.bio||'').trim();
  var profileBioHtml=profileBioText?'<div class="pp-card pp-about"><div class="pp-section-head"><div><small>'+h(t('profile','Анкета'))+'</small><h2>'+h(t('prof_bio','О себе'))+'</h2></div></div><div class="pp-bio'+(profileBioText.length>220?' is-clamped':'')+'" id="pp-bio">'+h(profileBioText)+'</div>'+(profileBioText.length>220?'<button type="button" class="pp-bio-toggle" id="pp-bio-toggle" aria-expanded="false" aria-controls="pp-bio">'+h(t('bio_more','Показать полностью'))+'</button>':'')+'</div>':'<div class="pp-card pp-about pp-about-empty"><div class="pp-section-head"><div><small>'+h(t('profile','Анкета'))+'</small><h2>'+h(t('profile_no_bio_title','Узнайте её в разговоре'))+'</h2></div></div><p class="pp-bio-empty">'+h(t('profile_no_bio_copy','Иногда лучший способ узнать человека — задать вопрос лично.'))+'</p></div>';
  body.innerHTML='<div class="public-profile-page">'+
    '<header class="pp-head"><button type="button" id="pp-back" class="vc-icon-glass" aria-label="'+h(t('back','Назад'))+'">'+glassIcon('back')+'</button><div><small>'+h(t('profile','Анкета'))+'</small><strong>'+h(profileName)+'</strong></div><button type="button" id="pp-share" class="vc-icon-glass" aria-label="'+h(t('share','Поделиться'))+'">'+glassIcon('send')+'<span class="pp-share-label">'+h(t('share','Поделиться'))+'</span></button></header>'+
    '<div class="pp-grid"><section class="pp-media"><button type="button" class="pp-hero" id="pp-hero" style="--pp-img:url('+h(hero)+')"><div class="pp-hero-shade"></div><div class="pp-hero-info"><div class="pp-presence '+(online?'online':'')+'"><i></i>'+h(online?t('online_status','онлайн'):(lastSeen?(t('last_seen','была')+' '+lastSeen):t('offline_short','не в сети')))+'</div><h1>'+h(profileName)+(p.age?', <span>'+parseInt(p.age,10)+'</span>':'')+(p.premium?' '+semanticGlassIcon('crown','vc-profile-premium-icon'):'')+'</h1>'+(profileCity?'<p>'+semanticGlassIcon('location','vc-profile-location-icon')+'<span>'+h(profileCity)+'</span></p>':'')+'</div></button><div class="pp-thumbs">'+thumbHtml+'</div></section>'+ 
    '<section class="pp-content"><div class="pp-actions"><button type="button" class="primary vc-labelled-glass-button" id="pp-message">'+glassIcon('message')+'<span>'+h(t('send_message','Написать'))+'</span></button><button type="button" id="pp-like" class="vc-labelled-glass-button '+(p.liked?'active':'')+'" aria-pressed="'+(p.liked?'true':'false')+'">'+glassIcon('like')+'<span>'+h(p.liked?t('liked','Нравится'):t('like','Лайк'))+'</span></button><button type="button" id="pp-gift" class="vc-labelled-glass-button">'+glassIcon('gift')+'<span>'+h(t('gift','Подарок'))+'</span></button>'+(VC_DESIRE_UI_ENABLED?'<button type="button" id="pp-offer" class="vc-labelled-glass-button">'+glassIcon('wish')+'<span>'+h(t('offer_action','Желание'))+'</span></button>':'')+'</div>'+
      '<div class="pp-chips">'+profileTrustHtml(p.trust,false)+status+zod+'</div>'+trustCard+profileBioHtml+
      (interests?'<div class="pp-card pp-about pp-interests-only"><div class="pp-section-head"><div><small>'+h(t('profile_details','Профиль'))+'</small><h2>'+h(t('prof_interests','Интересы'))+'</h2></div></div><div class="pp-interests">'+interests+'</div></div>':'')+
      '<div class="pp-card pp-gifts-card"><div class="pp-section-head"><div><small>'+h(t('received_gifts','Полученные подарки'))+'</small><h2>'+h(t('signs_of_attention','Знаки внимания'))+'</h2></div></div><div class="pp-gifts">'+giftsBlockHtml+'</div></div>'+
      '<div class="pp-card pp-safety"><button type="button" class="vc-labelled-glass-button" id="pp-watch">'+glassIcon('bell')+'<span>'+h((p._watch&&p._watch.armed)?t('online_watch_off','Не уведомлять о появлении'):t('online_watch_on','Сообщить, когда онлайн'))+'</span></button><button type="button" class="vc-labelled-glass-button" id="pp-report">'+glassIcon('report')+'<span>'+h(t('report','Пожаловаться'))+'</span></button></div>'+ 
      '<p class="pp-disclaimer">'+h(t('profile_disclaimer','Контент анкеты приватный. Распространение материалов и публикация переписки без согласия запрещены. Часть контента может быть улучшена с помощью AI.'))+'</p>'+
    '</section></div></div>';
  /* Keep the hero action outside the image button so the markup stays valid
   * and the like control never accidentally opens the viewer. */
  var heroEl=document.getElementById('pp-hero');
  if(heroEl&&heroEl.parentNode){
    var heroWrap=document.createElement('div'); heroWrap.className='pp-hero-wrap'; heroEl.parentNode.insertBefore(heroWrap,heroEl); heroWrap.appendChild(heroEl);
    var heroLike=document.createElement('button'); heroLike.type='button'; heroLike.id='pp-hero-photo-like'; heroLike.className='pp-photo-like-btn pp-hero-like-btn'+(photoLikedState(heroRef)?' active':''); heroLike.dataset.ppPhotoLike=String(heroRef); heroLike.disabled=!heroLikeAllowed; heroLike.setAttribute('aria-pressed',photoLikedState(heroRef)?'true':'false'); heroLike.setAttribute('aria-label',t('like','Лайк')); heroLike.innerHTML=glassIcon('like')+'<span>'+photoLikeCount(heroRef)+'</span>'; heroWrap.appendChild(heroLike);
  }
  var profileLikeButton=document.getElementById('pp-like');
  if(profileLikeButton&&!profileLikeButton.querySelector('.pp-profile-like-count')){var profileCount=document.createElement('b');profileCount.className='pp-profile-like-count';profileCount.textContent=profileLikeCount;profileLikeButton.appendChild(profileCount);}
  wireProfileDetail(p,photos);
}
function wireProfileDetail(p,photos){
  var pid=parseInt(p.id||p.user_id,10)||0,photoMap=p._photoIndexMap||[];
  var bioToggle=document.getElementById('pp-bio-toggle');if(bioToggle)bioToggle.addEventListener('click',function(){var bio=document.getElementById('pp-bio'),open=bio.classList.toggle('is-clamped')===false;bioToggle.setAttribute('aria-expanded',open?'true':'false');bioToggle.textContent=open?t('bio_less','Свернуть'):t('bio_more','Показать полностью');});
  var back=document.getElementById('pp-back');if(back)back.addEventListener('click',function(){var to=state.profileDetailReturn||'/';if(to.indexOf('/profile/')===0)to='/';navigate(to);});
  function galleryIndex(idx){var gi=photoMap[idx];return gi==null?idx:gi;}
  function trackGallery(surface,idx){
    funnelTrack('profile_gallery_opened',{profile_id:pid,surface:surface||'profile',photo_idx:galleryIndex(idx),photo_count:photos.length});
    var key='gallery:'+pid;if(!state.profileInterestSent[key]){state.profileInterestSent[key]=1;api('profile_interest',{virtual:pid,dwell:15,source:'gallery'}).catch(function(){});}
  }
  function trackPhoto(idx,surface){
    funnelTrack('profile_photo_viewed',{profile_id:pid,surface:surface||'profile',photo_idx:galleryIndex(idx)});
  }
  function selectPhoto(idx){idx=parseInt(idx,10)||0;state.profileDetailPhoto=idx;$$('.pp-thumb').forEach(function(x){x.classList.toggle('active',parseInt(x.dataset.ppPhoto,10)===idx);});var hero=document.getElementById('pp-hero');if(hero&&photos[idx])hero.style.setProperty('--pp-img','url('+photos[idx]+')');}
  $$('.pp-thumb').forEach(function(btn){btn.addEventListener('click',function(){var idx=parseInt(btn.dataset.ppPhoto,10);trackGallery('thumbnail',idx);trackPhoto(idx,'thumbnail');selectPhoto(idx);});});
  var hero=document.getElementById('pp-hero');if(hero)hero.addEventListener('click',function(){var idx=state.profileDetailPhoto||0;trackGallery('hero',idx);trackPhoto(idx,'hero');openMediaViewer(photos,idx,localizedPersonName(p.name||''));});
  
  function beginProfileConversation(){navigate('/chat/'+pid);}
  var msg=document.getElementById('pp-message');if(msg)msg.addEventListener('click',beginProfileConversation);
  function performProfileLike(){
    if(!like)return;setBusy(like,true);api('profile_like',{virtual:pid}).then(function(r){setBusy(like,false);if(!r||!r.ok){handleApiError(r,'Error');return;}p.liked=!!r.liked;if(r.profile_like_count!=null){p.profile_like_count=parseInt(r.profile_like_count,10)||0;var count=like.querySelector('.pp-profile-like-count');if(count)count.textContent=p.profile_like_count;}like.classList.toggle('active',p.liked);like.setAttribute('aria-pressed',p.liked?'true':'false');var countHtml='<b class="pp-profile-like-count">'+(parseInt(p.profile_like_count,10)||0)+'</b>';like.innerHTML=glassIcon('like')+'<span>'+h(p.liked?t('liked','Нравится'):t('like','Лайк'))+'</span>'+countHtml;if(p.liked)showLikeSuccess(p);}).catch(function(){setBusy(like,false);toast(t('network_error','Ошибка сети'),'error');});
  }
  var like=document.getElementById('pp-like');if(like)like.addEventListener('click',function(){if(!p.liked&&guestNeedsProfileGate()){showGuestProfileGate(p,performProfileLike);return;}performProfileLike();});
  function updatePhotoLikeButtons(ref,liked,count){
    p.photo_liked=p.photo_liked||{};p.photo_like_counts=p.photo_like_counts||{};p.photo_liked[String(ref)]=liked?1:0;p.photo_like_counts[String(ref)]=parseInt(count,10)||0;
    $$('[data-pp-photo-like]').forEach(function(btn){if(String(btn.dataset.ppPhotoLike)!==String(ref))return;btn.classList.toggle('active',!!liked);btn.setAttribute('aria-pressed',liked?'true':'false');var n=btn.querySelector('span');if(n)n.textContent=String(parseInt(count,10)||0);});
  }
  $$('[data-pp-photo-like]').forEach(function(btn){btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(btn.disabled)return;var ref=parseInt(btn.dataset.ppPhotoLike,10);btn.disabled=true;api('photo_like',{virtual:pid,photo_idx:ref}).then(function(r){btn.disabled=false;if(!r||!r.ok){handleApiError(r,'Error');return;}updatePhotoLikeButtons(ref,!!r.liked,parseInt(r.count,10)||0);}).catch(function(){btn.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});});
  var gift=document.getElementById('pp-gift');if(gift)gift.addEventListener('click',function(){openGiftPicker(pid);});
  var emptyGift=document.getElementById('pp-gift-empty');if(emptyGift)emptyGift.addEventListener('click',function(){openGiftPicker(pid);});
  var offer=document.getElementById('pp-offer');if(offer)offer.addEventListener('click',function(){openOfferComposer(pid,p.name||'');});
  var watch=document.getElementById('pp-watch');if(watch)watch.addEventListener('click',function(){watch.disabled=true;api('online_watch_toggle',{virtual:pid}).then(function(r){watch.disabled=false;if(r&&r.ok){p._watch={armed:!!r.armed};watch.innerHTML=glassIcon('bell')+'<span>'+h(r.armed?t('online_watch_off','Не уведомлять о появлении'):t('online_watch_on','Сообщить, когда онлайн'))+'</span>';toast(r.armed?t('online_watch_enabled','Уведомление включено'):t('online_watch_disabled','Уведомление выключено'),'success');}else handleApiError(r,'Error');}).catch(function(){watch.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});
  var report=document.getElementById('pp-report');if(report)report.addEventListener('click',function(){openProfileReport(p);});
  var share=document.getElementById('pp-share');if(share)share.addEventListener('click',function(){var url=location.origin+location.pathname+'#/profile/'+pid;if(navigator.share)navigator.share({title:(p.name||'Откровенно'),url:url}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){toast(t('copied','Ссылка скопирована'),'success');});});
}
function openMediaViewer(photos,start,name){
  photos=(photos||[]).filter(Boolean);if(!photos.length)return;
  if(state.mediaViewerClose)state.mediaViewerClose();
  var idx=Math.max(0,Math.min(photos.length-1,parseInt(start,10)||0)),previousFocus=document.activeElement,oldOverflow=document.body.style.overflow,ov=el('div',{class:'lightbox pp-lightbox',role:'dialog','aria-modal':'true','aria-label':t('photo_viewer','Просмотр фото')});
  ov.innerHTML='<button type="button" class="pp-lb-close vc-icon-glass" aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close')+'</button><button type="button" class="pp-lb-prev vc-icon-glass" aria-label="'+h(t('previous','Предыдущее'))+'">'+glassIcon('back')+'</button><img class="pp-lb-media" alt="'+h(name||t('photo','Фото'))+'" draggable="false"><button type="button" class="pp-lb-next vc-icon-glass" aria-label="'+h(t('next','Следующее'))+'">'+glassIcon('back','vc-flip-horizontal')+'</button><span class="pp-lb-count" aria-live="polite"></span>';
  document.body.appendChild(ov);document.body.style.overflow='hidden';
  var im=ov.querySelector('.pp-lb-media'),count=ov.querySelector('.pp-lb-count'),prev=ov.querySelector('.pp-lb-prev'),next=ov.querySelector('.pp-lb-next'),touchStartX=0;
  function draw(){ov.classList.remove('is-error');im.src=photos[idx];count.textContent=(idx+1)+' / '+photos.length;}
  function move(delta){if(photos.length<2)return;idx=(idx+delta+photos.length)%photos.length;draw();}
  function close(){if(state.mediaViewerClose===close)state.mediaViewerClose=null;document.removeEventListener('keydown',onKey);document.body.style.overflow=oldOverflow;if(ov.parentNode)ov.parentNode.removeChild(ov);if(previousFocus&&previousFocus.focus)previousFocus.focus();}
  function onKey(e){if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}else if(e.key==='ArrowRight'){e.preventDefault();move(1);}}
  if(photos.length<2){prev.remove();next.remove();}else{prev.addEventListener('click',function(){move(-1);});next.addEventListener('click',function(){move(1);});}ov.querySelector('.pp-lb-close').addEventListener('click',close);ov.addEventListener('click',function(e){if(e.target===ov)close();});document.addEventListener('keydown',onKey);
  im.addEventListener('error',function(){ov.classList.add('is-error');count.textContent=t('photo_load_error',t('load_err','Ошибка загрузки'));});im.addEventListener('pointerdown',function(e){touchStartX=e.clientX;});im.addEventListener('pointerup',function(e){var delta=e.clientX-touchStartX;if(Math.abs(delta)>48)move(delta>0?-1:1);});
  state.mediaViewerClose=close;draw();ov.querySelector('.pp-lb-close').focus();
}
async function openOfferComposer(pid,name){
  var scale=vcVibeScaleData(5,10000,350),r=await vcModal({title:t('offer_action','Желание'),icon:'wish',html:'<p>'+h(t('offer_explain','Предложите совместное действие. Сумма резервируется и будет перечислена только после выполнения.'))+'</p>'+vcVibeScaleHtml('vc-offer-vibe-scale',scale,t('offer_escrow_hint','Сумма будет безопасно зарезервирована до выполнения.')),fields:[{name:'description',type:'textarea',label:t('offer_description','Что предлагаете'),placeholder:t('offer_placeholder','Например: сходить вместе на кофе'),maxlength:500,required:true},{name:'amount',type:'range',label:t('offer_amount','Сумма, €'),value:String(scale.index),min:0,max:scale.values.length-1,required:true}],confirmText:t('offer_send','Отправить предложение'),onReady:function(card){vcWireVibeScale(card,'vc-offer-vibe-scale',scale,function(amount){return t('account_balance','Баланс аккаунта')+': '+vibeAmount(parseInt(state.me&&state.me.balance,10)||0)+' · '+t('maximum','Максимум')+': '+vibeAmount(10000);});}});if(!r)return;var amount=scale.values[Math.max(0,Math.min(scale.values.length-1,parseInt(r.amount,10)||0))]||0;if(amount<5||amount>10000){toast(t('offer_range','Выберите сумму от €0,10 до €200'),'error');return;}var out=await api('offer_create',{virtual:pid,description:String(r.description||'').trim(),amount:amount});if(out&&out.ok){if(state.me&&out.balance!=null)state.me.balance=out.balance;renderTopbar();await vcNotice(t('offer_sent','Желание отправлено'),t('offer_sent_copy','Средства зарезервированы. Ответ появится в чате.'),'success');}else handleApiError(out,'Error');
}
async function openProfileReport(p){var r=await vcModal({title:t('report_profile','Пожаловаться на анкету'),tone:'danger',icon:'⚑',message:t('report_safe','Жалоба попадёт в поддержку. Опишите конкретную проблему.'),fields:[{name:'reason',type:'select',label:t('reason','Причина'),options:[{value:'fake',label:t('report_fake','Поддельная анкета')},{value:'abuse',label:t('report_abuse','Оскорбления или давление')},{value:'spam',label:t('report_spam','Спам или реклама')},{value:'content',label:t('report_content','Неприемлемый контент')},{value:'other',label:t('other','Другое')}]},{name:'description',type:'textarea',label:t('details','Подробности'),maxlength:1000,required:true}],confirmText:t('send_report','Отправить жалобу')});if(!r)return;var profileId=parseInt(p.id||p.user_id,10)||0,out=await api('support_create',{category:'other',related_type:'profile',related_id:profileId,description:'Report · '+r.reason+' · '+String(r.description||'').trim()});if(out&&out.ok)await vcNotice(t('report_sent','Жалоба отправлена'),t('report_ticket','Обращение создано')+' #'+out.id,'success');else handleApiError(out,'Error');}
async function showLikeSuccess(p){var go=await vcModal({title:t('like_sent_title','Лайк отправлен'),icon:'like',html:'<div class="vc-like-result"><strong>'+h(localizedPersonName(p.name||''))+'</strong><p>'+h(t('like_sent_copy','Не ждите совпадения — начните с лёгкого сообщения прямо сейчас.'))+'</p></div>',cancelText:t('keep_swiping','Продолжить поиск'),confirmText:t('send_message','Написать')});if(go)navigate('/chat/'+(p.id||p.user_id));}
function showProfileModal(p){
  var ov = el('div', {class:'lightbox', style:'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px'});
  var photo = p.photo || p.avatar || '';
  var nm = h(localizedPersonName(p.name || p.fullname || ''));
  var age = p.u_age || p.age || '';
  var city = h(vcDynamicProfileCity(p.city || p.location || ''));
  var bio = h(p.bio || '');
  var pid=parseInt(p.id||p.user_id||0,10),gallery=Array.isArray(p.gallery)?p.gallery:[];
  var galleryHtml='';
  for(var gi=0;gi<gallery.length;gi++){
    galleryHtml+='<button type="button" data-view-gallery="'+gi+'" style="position:relative;border:0;border-radius:10px;min-height:82px;background:url('+h(gallery[gi])+') center/cover;overflow:hidden;cursor:pointer"></button>';
  }
  var photoBg = photo ? 'url('+h(photo)+') center/cover' : avatarBg(p.name||p.fullname||'?');
  ov.innerHTML = '<div style="background:#1d1924;border-radius:22px;max-width:400px;width:100%;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.6)">' +
    '<div style="height:300px;background:'+photoBg+';position:relative">' +
      '<button id="vc-pm-close" class="vc-icon-glass" aria-label="'+h(t('close','Закрыть'))+'" style="position:absolute;top:12px;left:12px;width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:0;cursor:pointer">'+semanticGlassIcon('close')+'</button>' +
      '<div style="position:absolute;bottom:12px;left:16px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)"><div style="font-size:22px;font-weight:800">'+nm+(age?', '+h(age):'')+'</div><div style="font-size:13px;opacity:.8">'+city+'</div></div>' +
    '</div>' +
    (bio ? '<div style="padding:16px;font-size:13px;color:#cfc8d6;line-height:1.5">'+bio+'</div>' : '') +
    (galleryHtml?'<div style="padding:0 16px 12px;display:grid;grid-template-columns:repeat(3,1fr);gap:7px">'+galleryHtml+'</div>':'') +
    ((!p.presence||!p.presence.online)?'<div style="padding:0 16px 12px"><button id="vc-pm-watch" class="vc-labelled-glass-button" style="width:100%;padding:9px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.04);color:#fff;cursor:pointer">'+glassIcon('bell')+'<span>'+h((p._watch&&p._watch.armed)?t('online_watch_off','Не уведомлять о появлении онлайн'):t('online_watch_on','Сообщить, когда появится онлайн'))+'</span></button></div>':'') +
    '<div style="padding:12px 16px 16px;display:flex;gap:8px">' +
      '<button id="vc-pm-msg" style="flex:1;padding:12px;border:0;border-radius:12px;background:linear-gradient(135deg,#ff8d74,#ff6b5e);color:#fff;font-weight:700;cursor:pointer">'+h(t('send_message','Написать'))+'</button>' +
      '<button id="vc-pm-like" class="vc-icon-glass" aria-label="'+h(t('disc_like','Лайк'))+'" aria-pressed="'+(p.liked?'true':'false')+'" style="padding:12px 20px;border:0;border-radius:12px;background:'+(p.liked?'rgba(255,107,94,.24)':'rgba(255,255,255,.07)')+';color:#ff8d74;cursor:pointer">'+glassIcon('like')+'</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(ov);
  var legacyLike=document.getElementById('vc-pm-like');
  if(legacyLike){var legacyCount=document.createElement('b');legacyCount.className='pp-profile-like-count';legacyCount.textContent=String(parseInt(p.profile_like_count,10)||0);legacyCount.style.marginLeft='6px';legacyLike.appendChild(legacyCount);}
  document.getElementById('vc-pm-close').addEventListener('click', function(){ if (ov.parentNode) ov.parentNode.removeChild(ov); });
  document.getElementById('vc-pm-msg').addEventListener('click', function(){ if (ov.parentNode) ov.parentNode.removeChild(ov); navigate('/chat/'+(p.id||p.user_id||0)); });
  document.getElementById('vc-pm-like').addEventListener('click', function(){var btn=this;btn.disabled=true;api('profile_like', {virtual: p.id||p.user_id}).then(function(r){btn.disabled=false;if(r&&r.ok){p.liked=!!r.liked;if(r.profile_like_count!=null){p.profile_like_count=parseInt(r.profile_like_count,10)||0;var c=btn.querySelector('.pp-profile-like-count');if(c)c.textContent=String(p.profile_like_count);}btn.setAttribute('aria-pressed',p.liked?'true':'false');btn.style.background=p.liked?'rgba(255,107,94,.24)':'rgba(255,255,255,.07)';toast(p.liked?t('toast_liked','Лайк отправлен'):t('toast_like_removed','Лайк убран'),'success');}else handleApiError(r,'Error');}).catch(function(){btn.disabled=false;toast(t('network_error','Ошибка сети'),'error');}); });
  funnelTrack('profile_gallery_opened',{profile_id:pid,surface:'legacy_modal',photo_count:gallery.length});
  $$('[data-view-gallery]',ov).forEach(function(btn){btn.addEventListener('click',function(){var idx=parseInt(btn.dataset.viewGallery,10)||0;funnelTrack('profile_photo_viewed',{profile_id:pid,surface:'legacy_modal',photo_idx:idx});openMediaViewer(gallery,idx,localizedPersonName(p.name||p.fullname||''));});});
  var watch=document.getElementById('vc-pm-watch');if(watch)watch.addEventListener('click',function(){watch.disabled=true;api('online_watch_toggle',{virtual:pid}).then(function(r){watch.disabled=false;if(r&&r.ok){watch.innerHTML=glassIcon('bell')+'<span>'+h(r.armed?t('online_watch_off','Не уведомлять о появлении онлайн'):t('online_watch_on','Сообщить, когда появится онлайн'))+'</span>';toast(r.armed?t('online_watch_enabled','Уведомление включено'):t('online_watch_disabled','Уведомление выключено'),'success');}else handleApiError(r,'Error');}).catch(function(){watch.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});
  ov.addEventListener('click', function(e){ if (e.target === ov) if (ov.parentNode) ov.parentNode.removeChild(ov); });
}
/* ===== View: Onboarding ===== */
function viewOnboarding(){
  var wrap = document.getElementById('vc-auth-wrap');
  if (!wrap) return;
  wrap.classList.add('auth-wrap-onboarding');
  var smart=state.smart||{}, selSex = parseInt(smart.sex,10)||0, onbSmartAge=smartInitialAge(), selAge = (onbSmartAge>=18&&onbSmartAge<=80)?onbSmartAge:0;
  var recovery=!!state.guestRecoveryNeeded;
  var selLook = smartInitialLook(selSex), inferred=!!(smart.sex||smart.look||smart.age||smart.age_min||smart.age_max||smart.geo);
  var cityKey=String(smart.city_key||smart.geo||'');if(!vcCityByKeyClient(cityKey))cityKey='';
  var cityName=smartCityName()||vcCityLabel(vcCityByKeyClient(cityKey));
  wrap.innerHTML =
    '<div class="onboarding">' +
      '<div class="onb-logo vc-brand-lockup">'+vcBrandMark()+'<span class="vt">otkrovenno<span class="brand-tld">.online</span></span></div>' +
      '<h1 class="onb-title">'+h(t('onb_title','Кто вы?'))+'</h1>' +
      '<p class="onb-sub">'+h(t('onb_sub','Настройте поиск и посмотрите анкеты'))+'</p>' +
      (recovery?'<div class="onb-smart"><strong>'+h(t('recover_guest_title','Верните прежний профиль'))+'</strong><span>'+h(t('recover_guest_copy','В этом браузере был гостевой профиль. Войдите, чтобы не потерять его баланс и переписки. Новый профиль создавайте только если старый вам не нужен.'))+'</span></div>':'')+
      (inferred?'<div class="onb-smart">'+glassIcon('check')+'<strong>'+h([cityName,smartAgeLabel(),selLook===2?t('women','Девушки'):(selLook===1?t('men','Парни'):(selLook===3?t('everyone','Все'):''))].filter(Boolean).join(' · '))+'</strong><span>'+h(t('smart_prefill_hint','Мы уже настроили рекомендации. Всё можно изменить.'))+'</span></div>':'')+
      '<div class="onb-card">' +
        '<div class="onb-step">'+h(t('onb_step_gender','Ваш пол'))+'</div>' +
        '<div class="onb-genders">' +
          '<button type="button" class="gender-btn'+(selSex===1?' selected':'')+'" data-sex="1" aria-pressed="'+(selSex===1?'true':'false')+'">'+semanticGlassIcon('guest-man','vc-guest-gender-icon')+'<span class="g-label">'+h(t('man','Парень'))+'</span></button>' +
          '<button type="button" class="gender-btn'+(selSex===2?' selected':'')+'" data-sex="2" aria-pressed="'+(selSex===2?'true':'false')+'">'+semanticGlassIcon('guest-woman','vc-guest-gender-icon')+'<span class="g-label">'+h(t('woman','Девушка'))+'</span></button>' +
        '</div>' +
        '<div class="onb-step">'+h(t('looking_for','Кого ищете'))+'</div>'+
        '<div class="onb-looking">'+
          '<button type="button" class="look-btn vc-labelled-glass-button'+(selLook===2?' selected':'')+'" data-look="2" aria-pressed="'+(selLook===2?'true':'false')+'">'+semanticGlassIcon('guest-women','vc-guest-looking-icon')+'<span>'+h(t('women','Девушек'))+'</span></button>'+
          '<button type="button" class="look-btn vc-labelled-glass-button'+(selLook===1?' selected':'')+'" data-look="1" aria-pressed="'+(selLook===1?'true':'false')+'">'+semanticGlassIcon('guest-men','vc-guest-looking-icon')+'<span>'+h(t('men','Парней'))+'</span></button>'+
          '<button type="button" class="look-btn vc-labelled-glass-button'+(selLook===3?' selected':'')+'" data-look="3" aria-pressed="'+(selLook===3?'true':'false')+'">'+semanticGlassIcon('guest-everyone','vc-guest-looking-icon')+'<span>'+h(t('everyone','Всех'))+'</span></button>'+
        '</div>'+
        '<div class="onb-step" style="margin-top:8px">'+h(t('your_age','Ваш возраст'))+'</div>' +
        '<div class="onb-age"><input type="number" min="18" max="80" step="1" inputmode="numeric" required value="'+(selAge||'')+'" id="vc-onb-age" aria-label="'+h(t('your_age','Ваш возраст'))+'"><span class="onb-age-hint" aria-hidden="true">18–80</span></div>' +
        '<div class="onb-step onb-city-step">'+h(t('city','Город'))+'</div>'+
        '<div class="city-picker onb-city-picker"><input id="vc-onb-city" value="'+h(cityName)+'" data-city-key="'+h(cityKey)+'" maxlength="60" autocomplete="address-level2" placeholder="'+h(t('city_search_placeholder','Начните вводить город'))+'"><div class="city-suggest" role="listbox" hidden></div></div>' +
        '<button class="onb-cta" id="vc-onb-go"'+(selSex&&selLook&&selAge>=18&&selAge<=80&&cityKey?'':' disabled')+'>'+h(recovery?t('start_over','Начать заново'):t('start_vibing','Посмотреть анкеты'))+'</button>' +
        '<p class="onb-missing" id="vc-onb-missing" role="status" aria-live="polite"></p>' +
      '</div>' +
      '<div class="onb-auth"><button id="vc-onb-auth" class="link-btn">'+h(recovery?t('recover_with_login','Войти и вернуть профиль'):t('have_account','Уже есть аккаунт? Войти'))+'</button></div>' +
    '</div>';
  var onbCity=document.getElementById('vc-onb-city');
  vcCityPicker(onbCity,{initialKey:cityKey,onSelect:function(city){cityKey=String(city.key||'');state.smart.city_key=cityKey;cityName=vcCityLabel(city);updateCta();},onInput:function(){cityKey='';state.smart.city_key='';updateCta();}});
  function updateCta(){
    var btn = document.getElementById('vc-onb-go'), miss = document.getElementById('vc-onb-missing'), todo = [];
    if (!selSex) todo.push(t('onb_miss_sex','пол'));
    if (!selLook) todo.push(t('onb_miss_look','кого ищете'));
    if (!(selAge>=18&&selAge<=80)) todo.push(t('onb_miss_age','возраст'));
    if (!cityKey) todo.push(t('onb_miss_city','город'));
    if (btn) btn.disabled = todo.length > 0;
    if (miss) miss.textContent = todo.length ? (t('onb_missing','Осталось указать:')+' '+todo.join(', ')) : '';
  }
  updateCta();
  $$('.gender-btn').forEach(function(b){
    b.addEventListener('click', function(){ selSex = parseInt(b.dataset.sex,10); $$('.gender-btn').forEach(function(x){ x.classList.toggle('selected', x === b);x.setAttribute('aria-pressed',x===b?'true':'false'); }); updateCta(); });
  });
  $$('.look-btn').forEach(function(b){
    b.addEventListener('click',function(){selLook=parseInt(b.dataset.look,10);$$('.look-btn').forEach(function(x){x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');});updateCta();});
  });
  var ageInput = document.getElementById('vc-onb-age');
  if (ageInput) ageInput.addEventListener('input', function(){ var nextAge=parseInt(ageInput.value,10);selAge=Number.isFinite(nextAge)?nextAge:0;updateCta(); });
  if (ageInput) ageInput.addEventListener('blur', function(){ if (ageInput.value !== '') ageInput.classList.add('is-touched'); });
  var goBtn = document.getElementById('vc-onb-go');
  if (goBtn) goBtn.addEventListener('click', async function(){
    if (!selSex||!selLook||selAge<18||selAge>80){if(ageInput)ageInput.reportValidity();return;}
    if(recovery){
      var startOver=await vcConfirm(t('start_over_warning','Создать новый профиль? Старый гостевой профиль останется отдельно и без входа может быть недоступен.'),{title:t('start_over','Начать заново'),tone:'warning',confirmText:t('start_over','Начать заново')});
      if(!startOver)return;
      setGuestAccessMarker(0);state.guestRecoveryNeeded=false;
    }
    var btn = document.getElementById('vc-onb-go'); if (btn){ btn.disabled = true; btn.textContent = h(t('loading','Загрузка...')); }
    authApi('guest_create', smartGuestPayload(selSex,selAge,selLook)).then(function(r){
      if (r && r.ok){ finishAuthenticatedSession(r,true); }
      else if (r && r.err === 'rate_limit') toast(t('login_err_rate_limit','Слишком много попыток'), 'error');
      else { toast(localizedErrorText(r&&r.err), 'error'); if (btn){ btn.disabled = false; btn.textContent = h(t('start_vibing','Посмотреть анкеты')); } }
    }).catch(function(){ toast(t('network_error','Ошибка сети'), 'error'); if (btn){ btn.disabled = false; btn.textContent = h(t('start_vibing','Посмотреть анкеты')); } });
  });
  var authBtn = document.getElementById('vc-onb-auth');
  if (authBtn) authBtn.addEventListener('click', function(){ state.authPref={sex:selSex,age:selAge,look:selLook,city_key:cityKey};navigate('/auth'); });
}

/* ===== View: Auth (unified card) ===== */
function viewAuth(){
  var wrap = document.getElementById('vc-auth-wrap');
  if (!wrap) return;
  var mode = 'login';
  var registerPhotoData='';
  var smart=state.smart||{},pref=state.authPref||{},prefSex=parseInt(pref.sex||smart.sex,10)||0,prefAge=parseInt(pref.age,10)||smartInitialAge()||0,prefLook=parseInt(pref.look,10)||smartInitialLook(prefSex);
  function registerProfileHtml(){
    var smartComplete=!!(prefSex&&prefAge>=18&&prefLook&&vcCityByKeyClient(pref.city_key||smart.city_key||smart.geo||''));
    if(smartComplete)return '<div class="auth-smart-profile">'+h(t('smart_profile_ready','Подбор уже настроен по рекламной ссылке'))+' · '+h(smartCityName()||t('your_city','ваш город'))+'</div><input type="hidden" id="vc-auth-sex" value="'+prefSex+'"><input type="hidden" id="vc-auth-age" value="'+prefAge+'"><input type="hidden" id="vc-auth-look" value="'+prefLook+'">';
    return '<div class="auth-profile-fields"><label>'+h(t('you_are','Вы'))+'<select id="vc-auth-sex" required><option value="">—</option><option value="1"'+(prefSex===1?' selected':'')+'>'+h(t('man','Мужчина'))+'</option><option value="2"'+(prefSex===2?' selected':'')+'>'+h(t('woman','Женщина'))+'</option></select></label><label>'+h(t('age','Возраст'))+'<input type="number" id="vc-auth-age" min="18" max="80" inputmode="numeric" value="'+(prefAge||'')+'" required></label><label>'+h(t('looking_for','Ищу'))+'<select id="vc-auth-look" required><option value="">—</option><option value="2"'+(prefLook===2?' selected':'')+'>'+h(t('women','Девушек'))+'</option><option value="1"'+(prefLook===1?' selected':'')+'>'+h(t('men','Мужчин'))+'</option><option value="3"'+(prefLook===3?' selected':'')+'>'+h(t('everyone','Всех'))+'</option></select></label></div>';
  }
  function render(){
    wrap.innerHTML =
      '<div class="auth-card">' +
        '<div class="auth-logo vc-brand-lockup">'+vcBrandMark()+'<span class="vt">otkrovenno<span class="brand-tld">.online</span></span></div>' +
        '<div class="auth-title">'+h(mode==='register'?t('register_btn','Зарегистрироваться'):t('login_title','Вход в otkrovenno.online'))+'</div>' +
        '<div class="auth-sub">'+h(mode==='register'?t('register_sub','Профиль появится в поиске сразу после регистрации.'):t('login_sub','Войдите, чтобы вернуться к перепискам.'))+'</div>' +
        '<form id="vc-auth-form" class="auth-form">' +
          (mode === 'register' ? '<label class="auth-field" for="vc-auth-name"><span>'+h(t('name','Имя'))+'</span><input type="text" name="name" id="vc-auth-name" maxlength="80" aria-label="'+h(t('name','Имя'))+'" placeholder="'+h(t('your_name','Ваше имя'))+'" autocomplete="name" required></label><label class="auth-register-photo" for="vc-auth-photo"><span id="vc-auth-photo-preview">'+semanticGlassIcon('camera')+'</span><strong>'+h(t('add_photo','Добавить фото'))+'</strong><small>'+h(t('registration_photo_hint','Нужно для вашей анкеты. Фото можно изменить позже.'))+'</small><input type="file" id="vc-auth-photo" accept="image/*,.heic,.heif" required></label>' : '') +
          '<label class="auth-field" for="vc-auth-email"><span>'+h(t('auth_email_label','Почта'))+'</span><input type="email" name="email" id="vc-auth-email" aria-label="'+h(t('auth_email_label','Почта'))+'" placeholder="'+h(t('login_email_ph','you@example.com'))+'" autocomplete="email" required></label>' +
          '<label class="auth-field" for="vc-auth-pass"><span>'+h(t('password','Пароль'))+'</span><input type="password" name="password" id="vc-auth-pass" aria-label="'+h(t('password','Пароль'))+'" placeholder="'+h(mode==='register'?t('login_pass_ph','минимум 8 символов'):'')+'" autocomplete="'+(mode==='register'?'new-password':'current-password')+'" required></label>' +
          (mode === 'register' ? '<label class="auth-field" for="vc-auth-pass2"><span>'+h(t('login_password_confirm','Повторите пароль'))+'</span><input type="password" name="password_confirm" id="vc-auth-pass2" aria-label="'+h(t('login_password_confirm','Повторите пароль'))+'" autocomplete="new-password" required></label>'+registerProfileHtml() : '') +
          '<button type="submit" class="auth-submit">'+h(mode === 'register' ? t('register_btn','Зарегистрироваться') : t('login_btn','Войти'))+'</button>' +
        '</form>' +
        '<button type="button" class="auth-toggle" id="vc-auth-toggle">'+h(mode === 'register' ? t('login_link','Уже есть аккаунт? Войти') : t('register_link','Нет аккаунта? Зарегистрируйся'))+'</button>' +
        '<details class="auth-magic"'+(mode==='register'?' hidden':'')+'><summary>'+h(t('forgot_password','Забыли пароль? Войти по ссылке'))+'</summary><p class="magic-hint">'+h(t('magic_link_hint','Отправим одноразовую ссылку для входа на ваш email. После входа пароль можно сменить в настройках.'))+'</p><div class="magic-form"><input type="email" id="vc-magic-email" placeholder="'+h(t('login_email_ph','you@example.com'))+'"><button type="button" id="vc-magic-go">'+h(t('magic_send','Отправить линк'))+'</button></div><div class="magic-result" id="vc-magic-result"></div></details>' +
      '</div>';
    var form = document.getElementById('vc-auth-form');
    var registerPhotoInput=document.getElementById('vc-auth-photo');
    if(registerPhotoInput)registerPhotoInput.addEventListener('change',function(){
      var file=this.files&&this.files[0],preview=document.getElementById('vc-auth-photo-preview');
      registerPhotoData='';
      if(!file)return;
      if(!isImageFileCandidate(file)){this.value='';toast(t('bad_type','Неподдерживаемый формат'),'error');return;}
      imageFileToDataUrl(file,8*1024*1024,2048).then(function(data){
        registerPhotoData=data;
        if(preview)preview.innerHTML='<img src="'+h(data)+'" alt="">';
      }).catch(function(e){
        registerPhotoInput.value='';
        toast(e.message==='too_big'?t('photo_too_big','Фото больше 8 МБ'):t('read_failed','Не удалось прочитать файл'),'error');
      });
    });
    if (form) form.addEventListener('submit', function(e){
      e.preventDefault();
      var email = document.getElementById('vc-auth-email').value.trim();
      var pass = document.getElementById('vc-auth-pass').value;
      var submit=form.querySelector('.auth-submit'),request,isRegister=mode==='register';
      if (isRegister){
        var pass2 = document.getElementById('vc-auth-pass2').value;
        if (pass !== pass2){ toast(t('passwords_mismatch','Пароли не совпадают'), 'error'); return; }
        var profileName=document.getElementById('vc-auth-name').value.trim();
        if(!profileNameReady(profileName)){toast(t('name_required','Укажите настоящее имя'),'error');return;}
        if(!registerPhotoData){toast(t('photo_required','Добавьте фотографию'),'error');return;}
        var sex=parseInt(document.getElementById('vc-auth-sex').value,10)||0,age=parseInt(document.getElementById('vc-auth-age').value,10)||0,look=parseInt(document.getElementById('vc-auth-look').value,10)||0;
        if(!sex||age<18||age>80||!look){toast(t('profile_required','Укажите пол, возраст и кого ищете'),'error');return;}
        request=authApi('register', Object.assign(smartGuestPayload(sex,age,look,false),{email:email,password:pass,lang:state.lang,sex:sex,age:age,look:look,name:profileName,photo:registerPhotoData}));
      } else {
        request=authApi('login', {email: email, password: pass});
      }
      submit.disabled=true;var oldText=submit.textContent;submit.textContent=t('loading','Загрузка...');
      request.then(function(r){var handled=onAuthResult(r,isRegister);if(!r||!r.ok){submit.disabled=false;submit.textContent=oldText;}return handled;}).catch(function(){submit.disabled=false;submit.textContent=oldText;toast(t('network_error','Ошибка сети'),'error');});
    });
    var toggle = document.getElementById('vc-auth-toggle');
    if (toggle) toggle.addEventListener('click', function(){
      var emailInput=document.getElementById('vc-auth-email');
      state.signupDraft={uid:state.uid,email:emailInput?emailInput.value.trim():''};
      toggle.disabled=true;
      startGuestPreview().then(function(){
        if(!state.uid){toggle.disabled=false;return;}
        state.signupDraft.uid=state.uid;
        navigate('/');
        setTimeout(function(){showGuestProfileGate(null,function(){navigate('/');},{action:'register'});},50);
      });
    });
    var mgo = document.getElementById('vc-magic-go');
    if (mgo) mgo.addEventListener('click', function(){
      var email = document.getElementById('vc-magic-email').value.trim();
      if (!email){ toast(t('login_err_bad_email','Неверный email'), 'error'); return; }
      mgo.disabled = true; mgo.textContent = t('loading','Загрузка...');
      authApi('magic_send', {email: email}).then(function(r){
        var out = document.getElementById('vc-magic-result');
        if (r && r.ok && r.sent !== false){
          if (out) out.innerHTML = '<div style="margin-top:8px;font-size:12px;color:#34d478">'+h(t('magic_sent','Линк отправлен! Проверь почту.'))+'</div>';
        } else if (out && r && (r.err === 'mail_not_configured' || r.sent === false)) out.innerHTML = '<div style="margin-top:8px;font-size:12px;color:#ffb36b">'+h(t('magic_unavailable','Вход по ссылке временно недоступен. Используйте email и пароль.'))+'</div>';
        else if (out) out.textContent = localizedErrorText(r&&r.err);
        mgo.disabled = false; mgo.textContent = t('magic_send','Отправить линк');
      }).catch(function(){mgo.disabled=false;mgo.textContent=t('magic_send','Отправить линк');toast(t('network_error','Ошибка сети'),'error');});
    });
    var magicBox=wrap.querySelector('.auth-magic'),magicEmail=document.getElementById('vc-magic-email');if(state.authOpenMagic&&magicBox){magicBox.open=true;state.authOpenMagic=false;}
    if(magicBox)magicBox.addEventListener('toggle',function(){var loginEmail=document.getElementById('vc-auth-email');if(magicBox.open&&magicEmail&&!magicEmail.value&&loginEmail)magicEmail.value=loginEmail.value.trim();if(magicBox.open&&magicEmail)magicEmail.focus();});
    if(magicEmail)magicEmail.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();if(mgo&&!mgo.disabled)mgo.click();}});
  }
  render();
}
function finishAuthenticatedSession(r,isNew){
  if (r){
    state.uid = parseInt(r.uid,10) || state.uid;
  }
  return loadAuthMeta().then(function(){ return loadMe(); }).then(function(){return isNew?welcomeNewUser():null;}).then(function(){if(r&&r.restored)return vcNotice(t('account_restored','Аккаунт восстановлен'),t('account_restored_copy','Профиль, переписки и баланс снова доступны.'),'success');return null;}).then(function(){ navigate('/'); });
}
/* The client never sends a welcome command itself. After the progressive
 * name/photo gate is complete, /me may enroll one rate-limited automated
 * server campaign while both the client and the profile owner are online. */
function welcomeNewUser(){return Promise.resolve(null);}
function onAuthResult(r,isNew){
  if (r && r.ok){
    return finishAuthenticatedSession(r,!!isNew);
  } else if (r && r.err === 'rate_limit') toast(t('login_err_rate_limit','Слишком много попыток'), 'error');
  else if (r && r.err === 'bad_credentials') toast(t('login_err_bad_credentials','Неверный email или пароль'), 'error');
  else if (r && r.err === 'email_taken') toast(t('login_err_email_taken','Email уже занят'), 'error');
  else if (r && r.err === 'weak_password') toast(t('login_err_weak_password','Пароль слишком короткий'), 'error');
  else if (r && r.err === 'bad_email') toast(t('login_err_bad_email','Неверный email'), 'error');
  else if (r && r.err === 'account_removed') toast(t('login_err_account_removed','Аккаунт удалён'), 'error');
  else if (r && r.err === 'guest_account_conflict') vcNotice(t('current_profile_preserved','Текущий профиль сохранён'),t('guest_account_conflict_copy','В нём уже есть фото, переписка или баланс. Чтобы ничего не потерять, сначала закрепите этот профиль на другом email либо обратитесь в поддержку.'),'error');
  else toast(localizedErrorText(r&&r.err), 'error');
  return Promise.resolve(false);
}

/* ===== View: Magic link verify ===== */
function viewMagic(){
  var wrap = document.getElementById('vc-auth-wrap');
  if (!wrap) return;
  var hashQ = window.location.hash.split('?');
  var params = new URLSearchParams(hashQ.length > 1 ? hashQ[1] : '');
  var token = params.get('token') || '';
  wrap.innerHTML = '<div class="auth-card"><div class="auth-logo vc-brand-lockup">'+vcBrandMark()+'<span class="vt">otkrovenno<span class="brand-tld">.online</span></span></div><div class="auth-title">'+h(t('magic_verify','Проверяем линк...'))+'</div><div class="magic-result" id="vc-magic-result"><div class="spin"></div></div></div>';
  var out = document.getElementById('vc-magic-result');
  function magicFail(box){ if(!box)return; box.innerHTML='<p class="magic-fail-text">'+h(t('magic_invalid','Ссылка недействительна или устарела.'))+'</p><button type="button" class="auth-submit" data-magic-go="magic">'+h(t('magic_request_new','Запросить новую'))+'</button><button type="button" class="auth-toggle" data-magic-go="login">'+h(t('magic_login_password','Войти с паролем'))+'</button>'; $$('[data-magic-go]',box).forEach(function(b){b.addEventListener('click',function(){state.authOpenMagic=(b.dataset.magicGo==='magic');navigate('/auth');});}); }
  if (!token){ magicFail(out); return; }
  authApi('magic_verify', {token: token}).then(function(r){
    if (r && r.ok){
      if (out) out.innerHTML = '<div style="color:#34d478">\u2713</div>';
      state.uid = r.uid || state.uid;
      setTimeout(function(){ loadAuthMeta().then(function(){return loadMe();}).then(function(){ navigate('/'); }); }, 800);
    } else magicFail(out);
  });
}

function discoverMoreCandidates(){
  var cards=state.deck||[],start=Math.max(0,(parseInt(state.deckIdx,10)||0)+1),seen={},rows=[];
  for(var i=start;i<cards.length&&rows.length<4;i++){
    var card=cards[i]||{},id=parseInt(card.id||card.user_id,10)||0;
    if(!id||seen[id])continue;
    seen[id]=1;rows.push(card);
  }
  return rows;
}
function discoverMoreStatus(card){
  if(card&&card.online)return t('online_now','Сейчас онлайн');
  var photos=deckPhotosFor(card).length;
  if(photos>1)return photos+' '+t('photos_in_profile','фото в анкете');
  if(card&&((card.interests&&card.interests.length)||(card.tags&&card.tags.length)))return t('interests_filled','Есть темы для разговора');
  return t('new_in_selection','Новая анкета в подборке');
}
function vcIcebreakerQuestions(){return [t('icebreaker_q1','Как выглядит твой идеальный выходной?'),t('icebreaker_q2','В какое место ты хотела бы вернуться?'),t('icebreaker_q3','Какая маленькая радость сделала твой день?'),t('icebreaker_q4','Куда бы ты отправилась прямо сейчас?')];}
function vcIcebreakerHtml(){
  var qs=vcIcebreakerQuestions();
  if(!(state.icebreakerIdx>=0)||state.icebreakerIdx>=qs.length)state.icebreakerIdx=0;
  var q=qs[state.icebreakerIdx]||qs[0];
  return '<section class="vc-icebreaker" aria-label="'+h(t('icebreaker_title','Вместо обычного «Привет, как дела?»'))+'">'+
    '<div class="vc-icebreaker-top"><span class="vc-icebreaker-tag">'+h(t('icebreaker_label','Первый шаг — проще'))+'</span><button type="button" class="vc-icebreaker-next" data-icebreaker-next aria-label="'+h(t('icebreaker_next','Другой вопрос'))+'" title="'+h(t('icebreaker_next','Другой вопрос'))+'">'+vcIcon('refresh')+'</button></div>'+
    '<h3>'+h(t('icebreaker_title','Вместо обычного «Привет, как дела?»'))+'</h3>'+
    '<p class="vc-icebreaker-text" id="vc-icebreaker-text">«'+h(q)+'»</p>'+
    '<button type="button" class="vc-icebreaker-start" data-icebreaker-start>'+vcIcon('send')+'<span>'+h(t('icebreaker_start','Начать с этого'))+'</span></button>'+
    '</section>';
}
function vcSafetyNoteHtml(){
  return '<a class="vc-safety-note" href="/community-guidelines/" target="_blank" rel="noopener">'+vcIcon('shield')+'<span><strong>'+h(t('safety_comfort','Ваш комфорт — в приоритете'))+'</strong><small>'+h(t('safety_pace','Знакомьтесь в своём темпе'))+'</small></span>'+vcIcon('chevron-right')+'</a>';
}
/* Downscaled copies of virtual-profile photos: photo/up/vpt/<width>/<dir>/<file> (made by _dev/design_20261006/make_photo_thumbs.py).
   A missing copy falls back to the original through the capture-phase error handler below. */
function vcPhotoCopy(u,w){var m=/^(.*\/photo\/up\/)vp(\/[0-9]+\/[^\/?#]+\.jpg)(\?.*)?$/i.exec(String(u||''));return m?m[1]+'vpt/'+w+m[2]+(m[3]||''):'';}
function vcThumbSrc(u){var c=vcPhotoCopy(u,240);return c?' src="'+h(c)+'" data-full="'+h(u)+'"':' src="'+h(u)+'"';}
function vcCardSrc(u){var c=vcPhotoCopy(u,800);return c?' src="'+h(u)+'" srcset="'+h(c)+' 800w, '+h(u)+' 1280w" sizes="(max-width:700px) 92vw, 480px" data-full="'+h(u)+'"':' src="'+h(u)+'"';}
document.addEventListener('error',function(e){var im=e.target;if(!im||im.tagName!=='IMG'||!im.getAttribute)return;var full=im.getAttribute('data-full');if(!full)return;im.removeAttribute('data-full');im.removeAttribute('srcset');im.removeAttribute('sizes');im.src=full;},true);
function discoverMoreHtml(){
  var candidates=discoverMoreCandidates();
  var visibleCount=state.discoverMoreExpanded?candidates.length:Math.min(3,candidates.length),rows='';
  for(var i=0;i<visibleCount;i++){
    var card=candidates[i]||{},id=parseInt(card.id||card.user_id,10)||0,name=localizedPersonName(card.name||card.fullname||''),age=parseInt(card.age||card.u_age,10)||0;
    var photo=(deckPhotosFor(card)[0]||card.photo||card.avatar||''),ints=(card.interests||card.tags||[]).slice(0,2),mini='';
    for(var j=0;j<ints.length;j++)mini+=h(localizedInterest(ints[j]))+(j<ints.length-1?' · ':'');
    rows+='<button type="button" class="discover-more-person recommendation'+(card.online?' is-online':'')+'" data-discover-profile="'+id+'" aria-label="'+h(t('open_profile','Открыть анкету')+' '+name)+'">'+
      '<span class="recommendation-photo">'+(photo?'<img'+vcThumbSrc(photo)+' alt="" loading="lazy" decoding="async">':'<span class="discover-more-avatar" style="background:'+avatarBg(name||'?')+'">'+h((name||'?').charAt(0).toUpperCase())+'</span>')+(card.online?'<span class="online-dot" aria-hidden="true"></span>':'')+'</span>'+
      '<span class="recommendation-info"><strong>'+h(name)+(age?', '+age:'')+'</strong><small>'+h(vcDynamicProfileCity(String(card.city||card.location||'').split(',')[0]))+'</small>'+(mini?'<span class="mini-tag">'+mini+'</span>':'')+'</span>'+
      vcIcon('chevron-right')+'</button>';
  }
  var toggle=candidates.length>3?'<button type="button" class="discover-more-toggle browse-all" data-discover-more-toggle aria-expanded="'+(state.discoverMoreExpanded?'true':'false')+'"><span>'+h(state.discoverMoreExpanded?t('show_less','Свернуть'):t('browse_all','Посмотреть всех'))+'</span>'+vcIcon('arrow-right')+'</button>':'';
  var moreInner=candidates.length?
    '<div class="aside-heading"><h2>'+h(t('new_faces','Новые лица'))+'</h2><span class="today-label">'+h(t('today_short','сегодня'))+'</span></div>'+
    '<p class="aside-description">'+h(t('new_faces_sub','Возможно, вы на одной волне'))+'</p>'+
    '<div class="discover-more-list">'+rows+'</div>'+toggle
    :'<p class="aside-description">'+h(t('new_faces_empty','Больше анкет появится чуть позже'))+'</p>';
  return '<aside class="discover-more" id="vc-discover-more" aria-label="'+h(t('more_for_you','Ещё для вас'))+'">'+
    moreInner+vcIcebreakerHtml()+vcSafetyNoteHtml()+'</aside>';
}
function wireDiscoverMore(){
  var host=document.getElementById('vc-discover-more');if(!host)return;
  $$('[data-discover-profile]',host).forEach(function(btn){btn.addEventListener('click',function(){openProfile(parseInt(btn.dataset.discoverProfile,10)||0);});});
  var toggle=host.querySelector('[data-discover-more-toggle]');if(toggle)toggle.addEventListener('click',function(){
    state.discoverMoreExpanded=!state.discoverMoreExpanded;
    var fresh=discoverMoreHtml();if(!fresh)return;
    host.outerHTML=fresh;wireDiscoverMore();
  });
  var ibNext=host.querySelector('[data-icebreaker-next]');
  if(ibNext)ibNext.addEventListener('click',function(){
    var qs=vcIcebreakerQuestions();
    state.icebreakerIdx=((parseInt(state.icebreakerIdx,10)||0)+1)%qs.length;
    var qEl=document.getElementById('vc-icebreaker-text');
    if(qEl)qEl.textContent='«'+qs[state.icebreakerIdx]+'»';
  });
  var ibStart=host.querySelector('[data-icebreaker-start]');
  if(ibStart)ibStart.addEventListener('click',function(){
    var card=(state.deck||[])[parseInt(state.deckIdx,10)||0]||{},id=parseInt(card.id||card.user_id,10)||0;
    if(!id)return;
    var qEl=document.getElementById('vc-icebreaker-text');
    var text=qEl?String(qEl.textContent||'').replace(/^[«\s]+|[»\s]+$/g,''):'';
    saveChatDraft(id,text);
    navigate('/chat/'+id);
  });
}

/* Prototype deck card (design-prototype-20261002): photo left / details right. */
function vcDeckCardHtml(card){
  var name=localizedPersonName(card.name||card.fullname||'')||'',age=parseInt(card.age||card.u_age,10)||0;
  var photos=deckPhotosFor(card),photo=photos[0]||card.photo||card.avatar||'';
  var city=vcDynamicProfileCity(String(card.city||card.location||'').split(',')[0]);
  var online=!!card.online,bio=String(card.bio||'');
  var ints=(card.interests||card.tags||[]).slice(0,4),chips='';
  var myInts=((state.me&&state.me.profile&&state.me.profile.interests)||[]);
  for(var i=0;i<ints.length;i++){
    var isShared=false;for(var j=0;j<myInts.length;j++){if(String(myInts[j]).toLowerCase()===String(ints[i]).toLowerCase()){isShared=true;break;}}
    chips+='<span class="chip glass'+(isShared?' match':'')+'">'+h(localizedInterest(ints[i]))+'</span>';
  }
  var verified=card.verified?'<span class="verified" aria-label="'+h(t('verified_badge','анкета проверена'))+'">'+vcIcon('verified')+'</span>':'';
  var segs=photos.length>1?'<div class="photo-segments" id="vc-photo-segments" aria-hidden="true">'+photos.map(function(u,pi){return '<i'+(pi===0?' class="on is-on"':'')+'></i>';}).join('')+'</div>':'';
  var taps=photos.length>1?'<button type="button" class="photo-tap photo-tap-prev" data-photo-step="-1" aria-label="'+h(t('prev_photo','Предыдущее фото'))+'">'+glassIcon('back','vc-photo-nav-icon')+'</button><button type="button" class="photo-tap photo-tap-next" data-photo-step="1" aria-label="'+h(t('next_photo','Следующее фото'))+'">'+glassIcon('back','vc-photo-nav-icon vc-flip-horizontal')+'</button>':'';
  return '<article class="dcard profile-card" id="vc-glass-card" aria-label="'+h(name+(age?', '+age:''))+'">'+
    '<div class="profile-photo">'+
      (photo?'<img class="ph"'+vcCardSrc(photo)+' alt="" fetchpriority="high" id="vc-card-photo">':'<div class="ph" id="vc-card-photo" style="background:'+avatarBg(name||'?')+'"></div>')+
      '<div class="grad-t"></div><div class="grad-b"></div>'+segs+taps+
      '<span class="state'+(online?'':' off')+'"><i></i>'+h(online?t('online_now','Сейчас онлайн'):t('offline_short','не в сети'))+'</span>'+
      '<button type="button" class="info" id="vc-full-profile" data-act="profile" aria-label="'+h(t('all_profile','Вся анкета'))+'" title="'+h(t('all_profile','Вся анкета'))+'">'+v4Icon('info')+'</button>'+
      '<div class="dinfo"><div class="nm">'+h(name)+(age?', '+age:'')+verified+'</div>'+(city?'<div class="loc">'+v4Icon('pin')+h(city)+'</div>':'')+(chips?'<div class="chips">'+chips+'</div>':'')+'<p class="bio" id="vc-card-bio"'+(bio?'':' data-pending="1"')+'>'+h(bio)+'</p></div>'+
      '<div class="stamp like" aria-hidden="true">'+h(t('disc_like','Нравится'))+'</div><div class="stamp nope" aria-hidden="true">'+h(t('disc_nope','Пропустить'))+'</div>'+
    '</div></article>';
}
/* ===== View: Discover (split-card prototype — unified glass container) ===== */
function viewDiscover(){
  var body = document.getElementById('vc-main-body');
  if (!body) return;
  stopStoryTimer();
  if(state.deckSwipeCleanup){state.deckSwipeCleanup();state.deckSwipeCleanup=null;}
  var cards = state.deck || [];
  var filterDock=discoverFilterDockHtml();
  var filterBtn='<button type="button" class="ibtn" data-v4-filters aria-label="'+h(t('v4_filters','Фильтры'))+'" title="'+h(t('v4_filters','Фильтры'))+'">'+v4Icon('filter')+'</button>';
  var counter=(cards.length&&state.deckIdx<cards.length)?(state.deckIdx+1)+' / '+cards.length:'';
  function dhead(filterDock){var onl=!!(state.discoverFilter&&state.discoverFilter.online);var tabs='<div class="tabs v4-disc-tabs" role="group" aria-label="'+h(t('v4_disc_show','Кого показывать'))+'"><button type="button" class="tab'+(onl?'':' on')+'" data-disc-online="0" aria-pressed="'+(onl?'false':'true')+'">'+h(t('v4_for_you','Для вас'))+'</button><button type="button" class="tab'+(onl?' on':'')+'" data-disc-online="1" aria-pressed="'+(onl?'true':'false')+'"><span class="dot"></span>'+h(t('v4_online','В сети'))+'</button></div>';return '<div class="dhead row-between"><div class="dtitle"><a class="logo vis-m" href="#/" aria-label="otkrovenno.online">otkrovenno<em>.online</em></a><div class="vis-d"><h1 class="page-h" id="page-title" tabindex="-1">'+h(t('nav_discover','Поиск'))+'</h1><p class="page-sub vc-deck-counter" id="profile-counter">'+h(counter)+'</p></div></div><div class="dtools">'+v4BalancePill()+filterDock+filterBtn+'</div></div>'+tabs;}
  if (!cards.length || state.deckIdx >= cards.length){
    var onlineActive=!!(state.discoverFilter&&state.discoverFilter.online),onlineLoading=onlineActive&&state.onlineDeckLoading,onlineError=onlineActive&&state.onlineDeckError;
    var onlineZero=onlineActive&&!onlineLoading&&!onlineError&&Array.isArray(state.onlineDeck)&&state.onlineDeck.length===0;
    var anyError=onlineActive?onlineError:state.deckLoadError,filteredEmpty=!anyError&&!onlineLoading&&discoverFilterActive()&&((state.deckAll||[]).length>0||onlineZero)&&!cards.length,fparts=filteredEmpty?discoverFilterParts():[],fchips='';
    if(filteredEmpty){for(var fp=0;fp<fparts.length;fp++)fchips+='<button type="button" class="vc-empty-remove" data-remove-filter="'+h(fparts[fp].key)+'" aria-label="'+h(t('filter_remove','Убрать')+': '+fparts[fp].label)+'"><span>'+h(fparts[fp].label)+'</span><b aria-hidden="true">×</b></button>';}
    var emptyTitle=anyError?t('network_error','Ошибка сети'):(onlineLoading?t('online_filter_checking','Проверяем, кто сейчас в сети…'):(onlineZero?t('online_filter_empty','Сейчас никто не в сети'):(filteredEmpty?t('disc_empty_filtered','По вашим фильтрам анкет нет'):t('disc_empty','Анкеты закончились'))));
    var emptySub=anyError?t('check_connection','Проверьте соединение и попробуйте снова'):(onlineLoading?'':(onlineZero?t('online_filter_empty_sub','Отключите фильтр — покажем остальные анкеты.'):(filteredEmpty?t('disc_empty_filtered_sub','Уберите одно из ограничений — остальные сохранятся.'):t('disc_empty_sub','Новые анкеты появятся немного позже'))));
    v4Page('<div class="disc"><div class="dcol">'+dhead(filterDock)+'<div class="deckwrap"><div class="deck"><div class="deck-end" role="status"><div class="em">'+v4Icon(anyError?'info':(onlineLoading?'clock':'compass'))+'</div><b>'+h(emptyTitle)+'</b>'+(emptySub?'<p>'+h(emptySub)+'</p>':'')+(fchips?'<div class="chips vc-empty-chips">'+fchips+'</div>':'')+(anyError?'<button type="button" class="btn btn-primary" id="vc-empty-retry">'+h(t('retry','Повторить'))+'</button>':'')+(filteredEmpty?'<div class="row2"><button type="button" class="btn btn-light btn-sm" id="vc-empty-reset">'+h(t('filters_reset_all','Сбросить все'))+'</button><button type="button" class="btn btn-dark btn-sm" id="vc-empty-filters">'+h(t('filters_edit','Изменить фильтры'))+'</button></div>':'')+'</div></div></div></div></div>','disc-page');
    $$('[data-remove-filter]',body).forEach(function(b){b.addEventListener('click',function(){discoverFilterRemove(b.dataset.removeFilter);});});
    var emptyReset=document.getElementById('vc-empty-reset');if(emptyReset)emptyReset.addEventListener('click',function(){state.discoverFilter=discoverFilterDefaults();cancelDiscoverOnlineRequest();applyDiscoverFilter(true);vcPersistDiscoverFilter();renderTopbar();viewDiscover();});
    wireDiscoverFilterDock(body);
    $$('[data-v4-filters]',body).forEach(function(b){b.addEventListener('click',openDiscoverFilters);});
    if(state.deckScroll>0){try{body.scrollTop=state.deckScroll;}catch(e){}state.deckScroll=0;}
    var emptyFilters=document.getElementById('vc-empty-filters');if(emptyFilters)emptyFilters.addEventListener('click',openDiscoverFilters);
    var emptyRetry=document.getElementById('vc-empty-retry');if(emptyRetry)emptyRetry.addEventListener('click',function(){if(onlineActive){refreshDiscoverOnline(true);}else{state.deckLoadError=false;loadMoreDeck();viewDiscover();}});
    if (cards.length && state.deckIdx >= cards.length && !onlineActive) loadMoreDeck();
    return;
  }
  var card = cards[state.deckIdx],next=cards[state.deckIdx+1]||null;
  var rewindEmpty = !(state.deckSwiped && state.deckSwiped.length);
  var nextPhotos=next?deckPhotosFor(next):[],nextPhoto=nextPhotos[0]||(next?(next.photo||next.avatar||''):'');
  var back='<div class="dcard back" aria-hidden="true">'+(nextPhoto?'<img class="ph"'+vcCardSrc(nextPhoto)+' alt="">':'')+'<div class="grad-b"></div></div>';
  var rewindLabel=rewindEmpty?t('disc_rewind_none','Пока нечего возвращать'):t('disc_rewind','Вернуть анкету');
  v4Page('<div class="disc"><div class="dcol">'+dhead(filterDock)+vcCoachHtml()+
    '<div class="deckwrap"><div class="deck" id="vc-card-back-wrap">'+back+vcDeckCardHtml(card)+'</div>'+
    '<div class="actions" id="vc-actions" role="group" aria-label="'+h(t('profile_actions','Действия с анкетой'))+'">'+
      '<button type="button" class="act undo back-button" data-act="rewind" title="'+h(rewindLabel)+'" aria-label="'+h(t('disc_rewind','Вернуть анкету'))+'"'+(rewindEmpty?' disabled':'')+'>'+v4Icon('undo')+'</button>'+
      '<button type="button" class="act nope skip-button" data-act="pass" title="'+h(t('disc_nope','Пропустить'))+'" aria-label="'+h(t('disc_nope','Пропустить'))+'">'+v4Icon('x')+'</button>'+
      '<button type="button" class="act l like-button" data-act="like" title="'+h(t('like','Нравится'))+'" aria-label="'+h(t('like','Нравится'))+'">'+v4Icon('heartf')+'</button>'+
      '<button type="button" class="act msg message-button" id="vc-write-cta" title="'+h(t('send_message','Написать'))+'" aria-label="'+h(t('send_message','Написать'))+'">'+v4Icon('chat')+'</button>'+
    '</div></div>'+
    '<p class="khint deck-kbd-hint" aria-hidden="true">'+h(t('deck_kbd_hint','← пропустить · → лайк · Enter — анкета · Backspace — вернуть'))+'</p>'+
    '<span id="profile-status" class="sr-only" role="status"></span>'+
    '</div><aside class="panel vis-d" id="vc-deck-panel">'+v4DeckPanelHtml(card)+discoverMoreHtml()+'</aside></div>','disc-page');
  var statusEl=document.getElementById('profile-status');
  if (statusEl) statusEl.textContent=localizedPersonName(card.name||card.fullname||'')+(card.age||card.u_age?', '+String(card.age||card.u_age):'');
  $$('#vc-actions [data-act]').forEach(function(btn){ btn.addEventListener('click', function(e){ e.stopPropagation(); handleDeckAction(btn.dataset.act); }); });
  $$('[data-panel-act]',body).forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();handleDeckAction(btn.dataset.panelAct);});});
  $$('[data-panel-photo]',body).forEach(function(btn){btn.addEventListener('click',function(){v4DeckShowPhoto(card,parseInt(btn.dataset.panelPhoto,10)||0);});});
  wireDiscoverMore();
  var writeCta=document.getElementById('vc-write-cta');if(writeCta)writeCta.addEventListener('click',function(e){e.stopPropagation();handleDeckAction('message');});
  var fullProfile=document.getElementById('vc-full-profile');if(fullProfile)fullProfile.addEventListener('click',function(e){e.stopPropagation();handleDeckAction('profile');});
  wireDiscoverFilterDock(body);
  $$('[data-v4-filters]',body).forEach(function(b){b.addEventListener('click',openDiscoverFilters);});
  if(state.deckScroll>0){try{body.scrollTop=state.deckScroll;}catch(e){}state.deckScroll=0;}
  wireSwipe();
  wireDeckPhotos(card);
  if(!state.deckKeysBound){state.deckKeysBound=true;document.addEventListener('keydown',vcDeckKeys);}
  maybeShowSwipeCoach();
  /* Lazy-load bio; refresh the card and the panel copy in place when it arrives. */
  if (card.id){
    authApi('get_bio', {id: card.id}).then(function(r){
      if (!r || !r.ok || !r.bio) return;
      card.bio = r.bio;
      var bioEl = document.getElementById('vc-card-bio');
      if (bioEl && bioEl.getAttribute('data-pending')) { bioEl.textContent = r.bio; bioEl.removeAttribute('data-pending'); }
      var panelBio=document.getElementById('vc-panel-bio');if(panelBio&&panelBio.getAttribute('data-pending')){panelBio.textContent=r.bio;panelBio.removeAttribute('data-pending');}
    }).catch(function(e){ console.error('get_bio error:', e); });
  }
  if (!(state.discoverFilter&&state.discoverFilter.online) && state.deck.length - state.deckIdx < 4) loadMoreDeck();
}
function discoverFilterDockHtml(){
  var df=state.discoverFilter||{};
  return '<div class="filter-bar discover-filter-dock">'+
    '<label class="online-filter"><input type="checkbox" id="vc-online-filter"'+(df.online?' checked':'')+'><span class="switch" aria-hidden="true"></span>'+h(t('online_toggle','Сейчас в сети'))+'</label>'+
    '</div>';
}
function wireDiscoverFilterDock(root){
  var scope=root||document;
  $$('.vc-discover-filter',scope).forEach(function(btn){btn.addEventListener('click',openDiscoverFilters);});
  var onlineToggle=scope.querySelector&&scope.querySelector('#vc-online-filter');
  if(onlineToggle&&!onlineToggle.dataset.bound){onlineToggle.dataset.bound='1';onlineToggle.addEventListener('change',function(){setDiscoverOnlineEnabled(onlineToggle.checked);});}
  /* «Для вас» / «В сети» tabs drive the same checkbox */
  $$('[data-disc-online]',scope).forEach(function(tab){if(tab.dataset.bound)return;tab.dataset.bound='1';tab.addEventListener('click',function(){var want=tab.dataset.discOnline==='1';$$('[data-disc-online]',scope).forEach(function(x){var on=(x.dataset.discOnline==='1')===want;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on?'true':'false');});var cb=scope.querySelector&&scope.querySelector('#vc-online-filter');if(cb&&cb.checked===want)return;if(cb)cb.checked=want;setDiscoverOnlineEnabled(want);});});
}
function vcCoachPending(){return !state.coachDone&&!(state.me&&parseInt(state.me.seen_hint,10)===1);}
function vcCoachHtml(){
  if(!vcCoachPending())return '';
  return '<div class="vc-coach-banner" id="vc-coach" role="status"><span class="vc-coach-ico" aria-hidden="true">'+vcIcon('info')+'</span><p class="vc-coach-long">'+h(t('swipe_coach_text','Свайп влево — пропустить, вправо — поставить лайк. Кнопки снизу работают так же.'))+'</p><p class="vc-coach-short">'+h(t('swipe_coach_short','Свайп влево — пропуск, вправо — лайк'))+'</p><button type="button" id="vc-coach-ok">'+h(t('understood','Понятно'))+'</button></div>';
}
function vcDismissCoach(){
  if(!vcCoachPending())return;state.coachDone=true;
  api('ack_hint').then(function(r){if(r&&r.ok&&state.me)state.me.seen_hint=1;}).catch(function(){});
  var box=document.getElementById('vc-coach');if(box&&box.parentNode)box.parentNode.removeChild(box);
}
function maybeShowSwipeCoach(){
  var ok=document.getElementById('vc-coach-ok');if(!ok||ok.dataset.bound)return;
  ok.dataset.bound='1';ok.addEventListener('click',vcDismissCoach);
}
function vcPersistDiscoverFilter(){try{if(typeof localStorage==='undefined')return;localStorage.setItem('vc_discover_filter',JSON.stringify(state.discoverFilter||{}));}catch(e){}}
function vcRestoreDiscoverFilter(){try{if(typeof localStorage==='undefined')return;var s=localStorage.getItem('vc_discover_filter');if(!s)return;var f=JSON.parse(s);if(!f||typeof f!=='object')return;var d=state.discoverFilter||{};if(f.gender==='all'||f.gender==='1'||f.gender==='2')d.gender=f.gender;if(typeof f.city==='string')d.city=f.city;if(f.ageMin>=18&&f.ageMin<=80)d.ageMin=f.ageMin;if(f.ageMax>=18&&f.ageMax<=80)d.ageMax=f.ageMax;if(d.ageMin>d.ageMax){var t=d.ageMin;d.ageMin=d.ageMax;d.ageMax=t;}if(f.dist>=1&&f.dist<=500)d.dist=f.dist;d.photo=!!f.photo;d.online=!!f.online;if(Object.prototype.toString.call(f.interests)==='[object Array]')d.interests=f.interests.filter(function(x){return typeof x==='string';}).slice(0,30);state.discoverFilter=d;}catch(e){}}
vcRestoreDiscoverFilter();
function discoverFilterActive(){var f=state.discoverFilter||{};return f.gender!=='all'||f.city!=='all'||(f.ageMin||18)>18||(f.ageMax||80)<80||(f.dist||50)<50||!!f.photo||!!f.online||(f.interests&&f.interests.length>0);}
function discoverFilterMatch(v,f){if(f.gender!=='all'&&String(v.sex||'')!==String(f.gender))return false;var city=String(v.city||v.location||'').split(',')[0].trim();if(f.city!=='all'&&city!==f.city)return false;var age=parseInt(v.age||v.u_age,10)||0;if(age&&(age<(f.ageMin||18)||age>(f.ageMax||80)))return false;var dist=parseFloat(v.distkm!=null?v.distkm:v.distance)||0;if(dist&&dist>(f.dist||50))return false;if(f.photo&&!(v.photo||v.avatar||(v.photos&&v.photos.length)))return false;if(f.online&&!v.online)return false;if(f.interests&&f.interests.length){var vi=v.interests||v.tags||[];if(!f.interests.some(function(x){return vi.indexOf(x)>=0;}))return false;}return true;}
function discoverFilterCount(f,src){var n=0;src=src||state.deckAll||[];for(var i=0;i<src.length;i++)if(discoverFilterMatch(src[i],f))n++;return n;}
function discoverFilterDefaults(){return {gender:'all',city:'all',ageMin:18,ageMax:80,dist:50,photo:false,online:false,interests:[]};}
function discoverFilterParts(){
  var f=state.discoverFilter||{},o=[];
  if(f.gender==='1'||f.gender==='2')o.push({key:'gender',label:f.gender==='2'?t('women','Девушки'):t('men','Парни')});
  if(f.city&&f.city!=='all')o.push({key:'city',label:localizedCity(f.city)});
  if((f.ageMin||18)>18||(f.ageMax||80)<80)o.push({key:'age',label:(f.ageMin||18)+'–'+(f.ageMax||80)});
  if((f.dist||50)<50)o.push({key:'dist',label:t('up_to','до')+' '+f.dist+' '+t('km','км')});
  if(f.photo)o.push({key:'photo',label:t('with_photo','С фото')});
  if(f.online)o.push({key:'online',label:t('online_only','Сейчас онлайн')});
  if(f.interests&&f.interests.length)o.push({key:'interests',label:t('prof_interests','Интересы')+' · '+f.interests.length});
  return o;
}
function discoverFilterRemove(key){
  var f=state.discoverFilter||(state.discoverFilter=discoverFilterDefaults()),d=discoverFilterDefaults();
  if(key==='age'){f.ageMin=d.ageMin;f.ageMax=d.ageMax;}else if(key==='interests')f.interests=[];else f[key]=d[key];
  if(key==='online')cancelDiscoverOnlineRequest();
  applyDiscoverFilter(true);vcPersistDiscoverFilter();renderTopbar();viewDiscover();
}
function cancelDiscoverOnlineRequest(){
  state.onlineDeckSeq=(state.onlineDeckSeq||0)+1;state.onlineDeckLoading=false;state.onlineDeckError=false;
}
function setDiscoverOnlineEnabled(enabled){
  var f=state.discoverFilter||(state.discoverFilter=discoverFilterDefaults());f.online=!!enabled;vcPersistDiscoverFilter();
  if(f.online){refreshDiscoverOnline(true);return;}
  cancelDiscoverOnlineRequest();applyDiscoverFilter(true);renderTopbar();if(state.route==='/'||state.route==='/discover')viewDiscover();
}
/* Periodic online refreshes keep the order the user is browsing: profiles still online stay in place, newcomers go to
   the end. Re-sorting moved the current card to the end of the list and hid the remaining ones ("6 / 6"). */
function vcMergeOnlineDeck(prev,fresh){
  if(!Array.isArray(prev)||!prev.length)return fresh;
  var byId={},seen={},out=[];
  for(var i=0;i<fresh.length;i++){var f=fresh[i];if(f)byId[f.id||f.user_id]=f;}
  for(var j=0;j<prev.length;j++){var id=prev[j]&&(prev[j].id||prev[j].user_id);if(id&&byId[id]&&!seen[id]){out.push(byId[id]);seen[id]=1;}}
  for(var k=0;k<fresh.length;k++){var nid=fresh[k]&&(fresh[k].id||fresh[k].user_id);if(nid&&!seen[nid]){out.push(fresh[k]);seen[nid]=1;}}
  return out;
}
function refreshDiscoverOnline(reset){
  var f=state.discoverFilter||{};if(!f.online)return Promise.resolve(null);
  var seq=(state.onlineDeckSeq||0)+1;state.onlineDeckSeq=seq;if(reset)state.onlineDeck=null;
  state.onlineDeckLoading=true;state.onlineDeckError=false;
  if(reset){applyDiscoverFilter(true);if(state.route==='/'||state.route==='/discover')viewDiscover();}
  return api('discover_online',{gender:f.gender||'all'}).then(function(r){
    if(seq!==state.onlineDeckSeq||!(state.discoverFilter&&state.discoverFilter.online))return r;
    if(!r||!r.ok||!Array.isArray(r.virtuals))throw new Error((r&&r.err)||'discover_online_failed');
    var freshOnline=r.virtuals.filter(function(profile){return !!profile.online;});state.onlineDeck=reset?freshOnline:vcMergeOnlineDeck(state.onlineDeck,freshOnline);state.onlineDeckLoading=false;state.onlineDeckError=false;state.onlineDeckFetchedAt=Date.now();
    applyDiscoverFilter(!!reset);renderTopbar();if(state.route==='/'||state.route==='/discover')viewDiscover();return r;
  }).catch(function(err){
    if(seq!==state.onlineDeckSeq||!(state.discoverFilter&&state.discoverFilter.online))return null;
    console.error('discover_online fail',err);state.onlineDeckLoading=false;state.onlineDeckFetchedAt=Date.now();
    if(reset){state.onlineDeck=[];state.onlineDeckError=true;applyDiscoverFilter(true);if(state.route==='/'||state.route==='/discover')viewDiscover();}
    return null;
  });
}
/* The server ranks online profiles first, so right after the "online now" filter is switched off the unfiltered deck
   interleaves the profiles that filter was hiding with the online ones; otherwise it would look unchanged. */
function vcMixOnlineDeck(list){
  var on=[],off=[];for(var i=0;i<list.length;i++)(list[i]&&list[i].online?on:off).push(list[i]);
  if(!on.length||!off.length)return list;
  var out=[];for(var a=0,b=0;a<on.length||b<off.length;){if(b<off.length)out.push(off[b++]);if(a<on.length)out.push(on[a++]);}
  return out;
}
/* The interleaved order is fixed when the filter is switched off; later refills keep it and append newcomers, so an
   unseen card never lands in front of the current one. */
function vcStableMix(list,rebuild){
  var key=function(v){return v.id||v.user_id;},rank=state.deckMixRank;
  if(rebuild||!rank){var mixed=vcMixOnlineDeck(list);rank=state.deckMixRank={};for(var i=0;i<mixed.length;i++)rank[key(mixed[i])]=i;state.deckMixNext=mixed.length;return mixed;}
  for(var j=0;j<list.length;j++)if(rank[key(list[j])]==null)rank[key(list[j])]=state.deckMixNext++;
  return list.slice().sort(function(a,b){return rank[key(a)]-rank[key(b)];});
}
function applyDiscoverFilter(reset){
  var f=state.discoverFilter||{},gone=state.deckGone||(state.deckGone={}),wasOnline=!!state.deckFilterOnline,mixStart=wasOnline&&!f.online;
  state.deckFilterOnline=!!f.online;if(mixStart)state.deckMixLead='offline';
  /* The unfiltered source is always the general deck: state.deck may still hold the online-only list. */
  var src=f.online?(Array.isArray(state.onlineDeck)?state.onlineDeck:[]):(state.deckAll||[]),current=!reset&&state.deck[state.deckIdx],currentId=current&&(current.id||current.user_id),swiped={};
  /* A reset clears the rewind history, but profiles already swiped in either mode stay out of the deck. */
  for(var s=0;s<state.deckSwiped.length;s++){var sc=state.deckSwiped[s].card||{},sid=sc.id||sc.user_id;if(!sid)continue;if(reset)gone[sid]=1;else swiped[sid]=1;}
  if(reset)state.deckSwiped=[];
  function pick(skipGone){return src.filter(function(v){var id=v.id||v.user_id;if((skipGone&&gone[id])||swiped[id])return false;return discoverFilterMatch(v,f);});}
  var list=pick(true);
  /* Every matching profile was already swiped: show them again, as the server does once everything was seen today. */
  if(!list.length&&!f.online){var again=pick(false);if(again.length){state.deckGone={};list=again;}}
  state.deck=(!f.online&&state.deckMixLead==='offline')?vcStableMix(list,reset||mixStart):list;
  if(reset)state.deckIdx=0;else if(currentId){state.deckIdx=0;for(var i=0;i<state.deck.length;i++){if((state.deck[i].id||state.deck[i].user_id)===currentId){state.deckIdx=i;break;}}}else state.deckIdx=Math.min(state.deckIdx,Math.max(0,state.deck.length-1));
}
function openDiscoverFilters(){
  var cur=state.discoverFilter||{},cities={},interests={},src=state.deckAll||state.deck||[];for(var i=0;i<src.length;i++){var c=String(src[i].city||src[i].location||'').split(',')[0].trim();if(c)cities[c]=1;var ints=src[i].interests||src[i].tags||[];for(var j=0;j<ints.length;j++)if(ints[j])interests[ints[j]]=1;}
  var cityOpts='<option value="all">'+h(t('all_cities','Все города'))+'</option>';Object.keys(cities).sort(function(a,b){return localizedCity(a).localeCompare(localizedCity(b),state.lang||'ru');}).forEach(function(c){cityOpts+='<option value="'+h(c)+'"'+(cur.city===c?' selected':'')+'>'+h(localizedCity(c))+'</option>';});
  var intHtml='';Object.keys(interests).sort(function(a,b){return localizedInterest(a).localeCompare(localizedInterest(b),state.lang||'ru');}).slice(0,30).forEach(function(x){intHtml+='<label class="vc-filter-chip"><input type="checkbox" data-filter-interest="'+h(x)+'"'+((cur.interests||[]).indexOf(x)>=0?' checked':'')+'><span>'+h(localizedInterest(x))+'</span></label>';});
  var ov=el('div',{class:'lightbox'});ov.innerHTML='<div class="vc-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="vc-filter-title" tabindex="-1"><div class="vc-filter-head"><strong id="vc-filter-title">'+h(t('filters','Фильтры'))+'</strong><button class="vc-icon-glass vc-overlay-close" data-close aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close')+'</button></div><label class="vc-filter-field">'+h(t('gender','Пол'))+'<select id="vc-filter-gender"><option value="all">'+h(t('all','Все'))+'</option><option value="2"'+(String(cur.gender)==='2'?' selected':'')+'>'+h(t('women','Девушки'))+'</option><option value="1"'+(String(cur.gender)==='1'?' selected':'')+'>'+h(t('men','Парни'))+'</option></select></label><label class="vc-filter-field">'+h(t('city','Город'))+'<select id="vc-filter-city">'+cityOpts+'</select></label><div class="vc-filter-row"><label class="vc-filter-field">'+h(t('age_from','Возраст от'))+'<input id="vc-filter-age-min" type="number" min="18" max="80" value="'+(cur.ageMin||18)+'"></label><label class="vc-filter-field">'+h(t('age_to','Возраст до'))+'<input id="vc-filter-age-max" type="number" min="18" max="80" value="'+(cur.ageMax||80)+'"></label></div><label class="vc-filter-field">'+h(t('distance_km','Расстояние, км'))+'<input id="vc-filter-dist" type="number" min="1" max="500" value="'+(cur.dist||50)+'"></label><div class="vc-filter-checks"><label class="vc-filter-check"><input id="vc-filter-photo" type="checkbox"'+(cur.photo?' checked':'')+'><span>'+h(t('with_photo','С фото'))+'</span></label><label class="vc-filter-check"><input id="vc-filter-online" type="checkbox"'+(cur.online?' checked':'')+'><span>'+h(t('online_only','Сейчас онлайн'))+'</span></label></div>'+(intHtml?'<div class="vc-filter-label">'+h(t('prof_interests','Интересы'))+'</div><div class="vc-filter-chips">'+intHtml+'</div>':'')+'<div class="vc-filter-actions"><button type="button" class="set-btn" id="vc-filter-reset">'+h(t('reset','Сбросить'))+'</button><button type="button" class="set-btn" id="vc-filter-apply">'+h(t('apply','Применить'))+'</button></div><div id="vc-filter-count" class="vc-filter-count-line" role="status" aria-live="polite"></div></div>';document.body.appendChild(ov);var sheet=ov.querySelector('.vc-filter-sheet'),prevFocus=document.activeElement;function onKey(e){if(e.key==='Escape'){e.stopPropagation();close();}else if(e.key==='Tab'){var fs=$$('button:not([disabled]),input:not([disabled]),select:not([disabled])',sheet);if(!fs.length)return;var a=fs[0],z=fs[fs.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}}function close(){document.removeEventListener('keydown',onKey,true);if(ov.parentNode)ov.parentNode.removeChild(ov);if(prevFocus&&prevFocus.focus&&prevFocus.isConnected)try{prevFocus.focus();}catch(e){}}document.addEventListener('keydown',onKey,true);
  function readForm(){var amin=Math.max(18,Math.min(80,parseInt(ov.querySelector('#vc-filter-age-min').value,10)||18)),amax=Math.max(18,Math.min(80,parseInt(ov.querySelector('#vc-filter-age-max').value,10)||80));if(amin>amax){var tmp=amin;amin=amax;amax=tmp;}var selected=[];$$('[data-filter-interest]',ov).forEach(function(ch){if(ch.checked)selected.push(ch.dataset.filterInterest);});return {gender:ov.querySelector('#vc-filter-gender').value,city:ov.querySelector('#vc-filter-city').value,ageMin:amin,ageMax:amax,dist:Math.max(1,Math.min(500,parseInt(ov.querySelector('#vc-filter-dist').value,10)||50)),photo:ov.querySelector('#vc-filter-photo').checked,online:ov.querySelector('#vc-filter-online').checked,interests:selected};}
  var applyBtn=ov.querySelector('#vc-filter-apply'),countLine=ov.querySelector('#vc-filter-count');
  var countSeq=0,countTimer=null;
  function paintCount(n){applyBtn.textContent=t('filters_show','Показать анкеты')+' ('+n+')';countLine.textContent=n?'':t('filters_none_match','Нет подходящих анкет — ослабьте ограничения');}
  function syncCount(){var f=readForm(),local=discoverFilterCount(f,src);paintCount(local);clearTimeout(countTimer);var seq=++countSeq;countTimer=setTimeout(function(){api('discover_count',{gender:f.gender,city:f.city,age_min:f.ageMin,age_max:f.ageMax,online:f.online?1:0,interests:JSON.stringify(f.interests)}).then(function(r){if(seq===countSeq&&ov.isConnected&&r&&r.ok&&r.count!=null)paintCount(f.online?(parseInt(r.count,10)||0):Math.max(local,parseInt(r.count,10)||0));}).catch(function(){});},350);}
  ov.addEventListener('input',syncCount);ov.addEventListener('change',syncCount);syncCount();if(sheet)sheet.focus();
  ov.querySelector('[data-close]').addEventListener('click',close);ov.addEventListener('click',function(e){if(e.target===ov)close();});ov.querySelector('#vc-filter-reset').addEventListener('click',function(){state.discoverFilter=discoverFilterDefaults();cancelDiscoverOnlineRequest();applyDiscoverFilter(true);vcPersistDiscoverFilter();close();renderTopbar();viewDiscover();});applyBtn.addEventListener('click',function(){state.discoverFilter=readForm();vcPersistDiscoverFilter();close();if(state.discoverFilter.online)refreshDiscoverOnline(true);else{cancelDiscoverOnlineRequest();applyDiscoverFilter(true);renderTopbar();viewDiscover();}});
}

function deckPhotosFor(card){
  var photos=(card&&Array.isArray(card.photos)?card.photos:[]).filter(Boolean);if(!photos.length&&card&&(card.photo||card.avatar))photos=[card.photo||card.avatar];
  return photos.slice(0,6);
}
/* Unified glass-container (photo-zone 45% | info-zone 55%) */
function glassContainerHtml(card){
  var photos = deckPhotosFor(card);
  if (!photos.length) photos = [card.photo || card.avatar || ''];
  state.deckPhotos = photos;
  var photo = photos[0] || '';
  var photoImg = photo ? '<img class="photo" id="vc-card-photo" src="'+h(photo)+'" alt="">' : '<div class="photo" id="vc-card-photo" style="background:'+avatarBg(card.name||card.fullname||'?')+'"></div>';
  var nm = h(localizedPersonName(card.name || card.fullname || ''));
  var age = card.age || card.u_age || '';
  var city = h(vcDynamicProfileCity((card.city || card.location || '').split(',')[0]));
  var dist = card.distance ? ' \u00B7 ' + h(card.distance) + ' ' + h(t('km','км')) : '';
  var job = h(localizedProfileValue(card.job || card.occupation || ''));
  var bio = card.bio || card.about || '';
  var ints = card.interests || card.tags || [];
  /* zodiac/status labels stay localized while the visual language is shared GLASS */
  var zod = card.zodiac || null;
  var zodName=profileZodiacText(zod,zod&&zod.id);
  var stInfo = card.daily_status || null;
  var stTitle=profileDailyStatusText(stInfo,stInfo&&stInfo.id);
  /* mood is an object {id, title, emoji} from API */
  var moodInfo = card.mood || null;
  var moodEmoji = (moodInfo && moodInfo.emoji && !/^[?\uFFFD\s]+$/.test(moodInfo.emoji)) ? moodInfo.emoji : '';
  var moodTitle = localizedProfileValue((moodInfo && moodInfo.title) ? moodInfo.title : '');
  var online = card.online;
  var occupation = (state.occupationMap && state.occupationMap[card.id]) ? state.occupationMap[card.id] : '';
  var n = Math.max(photos.length, 1);
  if (n > 6) n = 6;
  var barsHtml = '';
  for (var i=0;i<n;i++) barsHtml += '<i'+(i===0?' class="active"':'')+'><b style="width:0"></b></i>';
  var tagsHtml = '';
  if (ints.length){
    for (var j=0;j<ints.length && j<6;j++){
      var intLabel = localizedInterest(ints[j]);
      tagsHtml += '<span class="info-tag">'+h(intLabel)+'</span>';
    }
  } else {
    tagsHtml = '<span class="info-placeholder">'+h(t('interests_hidden','Скрывает свои интересы'))+'</span>' +
      '<button class="info-ask-btn" type="button" data-chat-id="'+(parseInt(card.id||card.user_id,10)||0)+'">'+h(t('write_to_ask','Написать!'))+'</button>';
  }
  return '' +
  '<div class="glass-container" id="vc-glass-card">' +
    '<div class="photo-zone" id="vc-photo-zone">' +
      photoImg +
      '<div class="swtop" id="vc-swtop">'+barsHtml+'</div>' +
      (photos.length>1?'<button class="photo-nav is-left vc-icon-glass" id="vc-nav-left" type="button" aria-label="'+h(t('prev_photo','Предыдущее фото'))+'">'+glassIcon('back','vc-photo-nav-icon')+'</button><button class="photo-nav is-right vc-icon-glass" id="vc-nav-right" type="button" aria-label="'+h(t('next_photo','Следующее фото'))+'">'+glassIcon('back','vc-photo-nav-icon vc-flip-horizontal')+'</button>':'') +
      '<div class="online-dot'+(online?' on':'')+'"></div>' +
      '<div class="pt-online-badge'+(online?'':' is-offline')+'"><span></span>'+(online?h(t('online_status','онлайн')):h(t('offline_short','не в сети')))+'</div>' +
      '<div class="pt-photo-caption"><span>'+h(t('photo_caption_label','На одной волне'))+'</span><p>«'+h(t('photo_caption_quote','Иногда всё начинается с одного «привет»'))+'»</p></div>' +
    '</div>' +
    '<div class="info-zone" id="vc-info-zone">' +
      '<div class="info-name-row">' +
        '<span class="info-name">'+nm+(age?' <span class="age">'+h(age)+'</span>':'')+'</span>' +
      '</div>' +
      /* Location — separate block */
      (city ? '<div class="info-block">'+semanticGlassIcon('location','vc-info-glass-icon')+'<span class="lbl">'+city+(dist?' \u00B7 '+dist:'')+'</span></div>' : '') +
      /* Other info chips — separated from city */
      '<div class="info-chips-row" id="vc-info-chips">' +
        profileTrustHtml(card.trust,false) +
        (job ? '<span class="info-chip">'+semanticGlassIcon('profile','vc-info-glass-icon')+job+'</span>' : '') +
        (occupation ? '<span class="info-chip">'+semanticGlassIcon('profile','vc-info-glass-icon')+h(localizedProfileValue(occupation))+'</span>' : '') +
        (zodName ? '<span class="info-chip vc-profile-symbol">'+profileMetaGlassIcon('zodiac',zod,zod&&zod.id)+h(zodName)+'</span>' : '') +
        (stTitle ? '<span class="info-chip vc-profile-symbol">'+profileMetaGlassIcon('status',stInfo,stInfo&&stInfo.id)+h(stTitle)+'</span>' : '') +
        (moodTitle ? '<span class="info-chip"><span class="emoji">'+h(moodEmoji)+'</span>'+h(moodTitle)+'</span>' : '') +
      '</div>' +
      /* About section — always show, lazy-load bio if missing */
      '<div class="info-section"><div class="sh">'+h(t('prof_bio','О себе'))+'</div>' +
        (bio ? '<div class="bio" id="vc-card-bio">'+h(bio)+'</div>' : '<div class="info-bio-placeholder" id="vc-bio-placeholder">'+h(t('bio_empty','Не рассказала о себе. Спросите!'))+'</div><div class="bio" id="vc-card-bio" style="display:none"></div>') +
      '</div>' +
      /* Interests */
      '<div class="info-section"><div class="sh">'+h(t('prof_interests','Интересы'))+'</div><div class="info-tags">'+tagsHtml+'</div></div>' +
    '</div>' +
    '<div class="drag-badge like">'+h(t('disc_like','Лайк'))+'</div>' +
    '<div class="drag-badge nope">'+h(t('disc_nope','Пропустить'))+'</div>' +
  '</div>';
}

/* Story bars auto-advance (5s, pause on hover/touch) */
function stopStoryTimer(){ if (state.deckStoryTimer){ clearTimeout(state.deckStoryTimer); state.deckStoryTimer = null; } state.deckStoryPaused = false; }
function initStoryBars(card){
  stopStoryTimer();
  var photos = deckPhotosFor(card);
  if (!photos.length) photos = [card.photo || card.avatar || ''];
  state.deckPhotos = photos;
  state.deckStoryIdx = 0;state.deckStoryManual=false;
  var AUTO = 5000;
  var bars = $$('#vc-swtop i');
  var photoEl = document.getElementById('vc-card-photo');
  if (!bars.length) return;
  function activate(idx){
    bars.forEach(function(b, i){
      b.classList.remove('active','done');
      var inner = b.querySelector('b');
      inner.style.transition = 'none';
      inner.style.width = i < idx ? '100%' : '0%';
      if (i < idx) b.classList.add('done');
    });
    var cur = bars[idx];
    if (cur){
      cur.classList.add('active');
      var inner = cur.querySelector('b');
      inner.style.transition = 'none';
      inner.style.width = '0%';
      void inner.offsetWidth;
      inner.style.transition = vcnReducedMotion() ? 'none' : 'width ' + AUTO + 'ms linear';
      inner.style.width = '100%';
    }
    if (photoEl && photos[idx]){
      if (photoEl.tagName === 'IMG') photoEl.src = photos[idx];
      else photoEl.style.backgroundImage = 'url("'+h(photos[idx])+'")';
    }
    state.deckStoryIdx = idx;
  }
  function next(){
    if (state.deckStoryPaused||state.deckStoryManual) return;
    var ni = state.deckStoryIdx + 1;
    if (ni >= photos.length) ni = 0;
    activate(ni);
    if (storyAutoplayAllowed()) state.deckStoryTimer = setTimeout(next, AUTO);
  }
  activate(0);
  if (storyAutoplayAllowed()) state.deckStoryTimer = setTimeout(next, AUTO);
  else if (document.hidden && !vcnReducedMotion()){ state.deckStoryPaused = true; state.deckStoryHiddenPause = true; }
  state._storyActivate = activate;
  state._storyNext = next;
  /* tap on bar to jump */
  bars.forEach(function(b, i){ b.addEventListener('click', function(e){ e.stopPropagation(); stopStoryTimer(); state.deckStoryPaused = false; activate(i); if (storyAutoplayAllowed()) state.deckStoryTimer = setTimeout(next, AUTO); }); });
  /* Touch may pause the story while the user holds the card. A desktop pointer
     must not stop autoplay merely because the card sits under the cursor. */
  var cardEl = document.getElementById('vc-glass-card');
  if (cardEl){
    cardEl.addEventListener('touchstart', pauseStory, {passive:true});
    cardEl.addEventListener('touchend', resumeStory, {passive:true});
    cardEl.addEventListener('touchcancel', resumeStory, {passive:true});
  }
}
function pauseStory(){
  if (state.deckStoryTimer){ clearTimeout(state.deckStoryTimer); state.deckStoryTimer = null; }
  state.deckStoryPaused = true;
  var bars = $$('#vc-swtop i');
  var cur = bars[state.deckStoryIdx];
  if (cur){
    var inner = cur.querySelector('b');
    if (inner){ var w = getComputedStyle(inner).width; inner.style.transition = 'none'; inner.style.width = w; }
  }
}
function resumeStory(){
  if (!state.deckStoryPaused) return;
  state.deckStoryPaused = false;
  if (!storyAutoplayAllowed()) return;
  var bars = $$('#vc-swtop i');
  var AUTO = 5000;
  var cur = bars[state.deckStoryIdx];
  if (cur){
    var inner = cur.querySelector('b');
    var segW = cur.offsetWidth || 1;
    var curW = parseFloat(getComputedStyle(inner).width) || 0;
    var frac = Math.min(1, curW / segW);
    var remain = Math.max(300, Math.round(AUTO * (1 - frac)));
    inner.style.transition = 'width ' + remain + 'ms linear';
    inner.style.width = '100%';
    state.deckStoryTimer = setTimeout(state._storyNext || function(){}, remain || AUTO);
  } else {
    state.deckStoryTimer = setTimeout(state._storyNext || function(){}, AUTO);
  }
}

/* Autoplay respects "reduce motion" and never ticks in a hidden tab. */
function storyAutoplayAllowed(){ return !vcnReducedMotion() && !document.hidden; }
document.addEventListener('visibilitychange', function(){
  if (!document.getElementById('vc-swtop')) return;
  if (document.hidden){ if (state.deckStoryTimer){ pauseStory(); state.deckStoryHiddenPause = true; } }
  else if (state.deckStoryHiddenPause){ state.deckStoryHiddenPause = false; resumeStory(); }
});

/* Arrow nav (prev/next photo in gallery) */
function wirePhotoNav(){
  var left = document.getElementById('vc-nav-left');
  var right = document.getElementById('vc-nav-right');
  var AUTO = 5000;
  function jump(delta){
    stopStoryTimer(); state.deckStoryPaused = false;state.deckStoryManual=true;
    var photos = state.deckPhotos || [];
    if (!photos.length) return;
    var ni = state.deckStoryIdx + delta;
    if (ni < 0) ni = photos.length - 1;
    if (ni >= photos.length) ni = 0;
    if (state._storyActivate) state._storyActivate(ni);
  }
  if (left) left.addEventListener('click', function(e){ e.stopPropagation(); jump(-1); });
  if (right) right.addEventListener('click', function(e){ e.stopPropagation(); jump(1); });
  var zone=document.getElementById('vc-photo-zone');if(zone)zone.addEventListener('click',function(e){if(Date.now()<(state.deckPhotoClickBlockUntil||0)||(state.deckPhotos||[]).length<2||e.target.closest('.photo-nav')||e.target.closest('.swtop'))return;var rect=zone.getBoundingClientRect();jump(e.clientX<rect.left+rect.width/2?-1:1);});
}

function handleDeckAction(act){
  if(state.deckActionBusy)return;
  var card = (state.deck || [])[state.deckIdx];
  if (!card) return;
  var targetId = card.id || card.user_id || 0;
  vcDismissCoach();
  if (act === 'profile'){ openProfile(card.id || card.user_id || 0); return; }
  if (act === 'message'){
    if(gateProfileIntent('message',targetId,card,state.route||'/'))return;
    navigate('/chat/'+targetId); return;
  }
  if (act === 'like'){
    if(gateProfileIntent('like',targetId,card,state.route||'/'))return;
    submitDeckLike(card);
    return;
  }
  if (act === 'rewind'){
    if (state.deckSwiped.length){
      state.deckSwiped.pop();
      state.deckIdx = Math.max(0, state.deckIdx - 1);
      viewDiscover();
      }
    return;
  }
  state.deckSwiped.push({card: card, action: act});
  state.deckIdx++;
  viewDiscover();
  if (state.deck.length - state.deckIdx < 4) loadMoreDeck();
}
function profileNameReady(name){
  name=String(name==null?'':name).trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>60)return false;
  var normalized=name.toLocaleLowerCase(),placeholders=['гість','гостя','гость','guest','user','пользователь','користувач'];
  return placeholders.indexOf(normalized)<0&&!/^(?:guest|user)[\s_-]*\d+$/i.test(normalized);
}
function applyProfileIdentityInstant(name,photo){
  if(!state.me)return;
  name=String(name||'').trim().replace(/\s+/g,' ');
  photo=String(photo||'').trim();
  state.me.name=name;
  state.me.profile=state.me.profile||{};
  state.me.profile.name=name;state.me.profile.fullname=name;state.me.profile.name_ready=profileNameReady(name);
  if(photo){state.me.profile.photo=photo;state.me.profile.avatar=photo;}
  var rail=document.getElementById('vc-rail');if(rail){rail.innerHTML=railHtml();wireRail();}
  renderTopbar();
}
function guestProfileIdentityReady(){
  var p=(state.me&&state.me.profile)||{};
  var nameReady=p.name_ready!=null?!!p.name_ready:profileNameReady(p.fullname||p.name||'');
  return !!(nameReady&&p.photo&&(parseInt(p.age||p.u_age,10)||0)>=18&&String(p.city||'').trim()&&[1,2].indexOf(parseInt(p.sex,10))>=0&&[1,2,3].indexOf(parseInt(p.look,10))>=0);
}
function guestNeedsProfileGate(){
  return !guestProfileIdentityReady()||!(state.auth&&state.auth.has_password);
}
function signupPersonName(name){
  name=String(name||'').trim();
  if(/ия$/i.test(name))return name.replace(/ия$/i,'ией');
  if(/а$/i.test(name))return name.replace(/а$/i,'ой');
  if(/я$/i.test(name))return name.replace(/я$/i,'ей');
  return name;
}
function submitDeckLike(card){
  var targetId=card&&(card.id||card.user_id||0);if(!targetId||state.deckActionBusy)return;
  state.deckActionBusy=true;$$('#vc-actions .act').forEach(function(btn){btn.disabled=true;});
  api('like',{virtual:targetId}).then(function(r){
    state.deckActionBusy=false;
    if(r&&r.ok){
      if(state.isGuest)state.guestLikes=(state.guestLikes||0)+1;
      state.deckSwiped.push({card:card,action:'like'});state.deckIdx++;viewDiscover();if(state.deck.length-state.deckIdx<4)loadMoreDeck();
    }else{handleApiError(r,'Error');$$('#vc-actions .act').forEach(function(btn){btn.disabled=false;});}
  }).catch(function(){state.deckActionBusy=false;$$('#vc-actions .act').forEach(function(btn){btn.disabled=false;});toast(t('network_error','Ошибка сети'),'error');});
}
function showGuestProfileGate(card,onReady,opts){
  opts=opts||{};
  if(state.profileGateOpen)return;state.profileGateOpen=true;state.pendingLike=card;
  var purchaseGate=opts.action==='purchase';
  var registerGate=opts.action==='register',needsAccess=!(state.auth&&state.auth.has_password),accessSaved=!needsAccess,signupStep=needsAccess?1:2,signupBusy=false;
  var intent=purchaseGate?{action:'purchase',profile_id:0,profile:{},return_route:'/store'}:(readProfileIntent()||rememberProfileIntent('like',card&&(card.id||card.user_id||0),card,state.route||'/')||{action:'like',profile_id:card&&(card.id||card.user_id||0),profile:card||{}});
  var intentProfile=findIntentProfile(intent.profile_id,card||intent.profile||{}),intentName=localizedPersonName(intentProfile.name||('#'+intent.profile_id)),intentAction=intent.action==='message'?'message':'like';
  if(purchaseGate)intentAction='purchase';
  funnelTrack('profile_gate_view',{trigger:intentAction,profile_id:intent.profile_id||0},intentAction+':'+(intent.profile_id||0));
  var intentLabel=intentAction==='purchase'?t('intent_payment_label','Продолжить к оплате'):(intentAction==='message'?t('intent_message_label','Написать сообщение'):t('intent_like_label','Отправить лайк'));
  var intentSubmit=intentAction==='purchase'?t('continue_to_payment','Перейти к оплате'):(intentAction==='message'?t('continue_to_chat','Продолжить в чат'):t('send_like','Отправить лайк'));
  var p=(state.me&&state.me.profile)||{},existingPhoto=p.photo||p.avatar||'',storedName=String(p.fullname||p.name||'').trim(),rawName=profileNameReady(storedName)?storedName:'';
  var city=String(p.city||smartCityName()||''),savedCity=String(p.city||'').trim(),storedAge=parseInt(p.age||p.u_age,10)||0,age=storedAge>=18?storedAge:'',sex=parseInt(p.sex||(state.smart&&state.smart.sex),10)||0,look=parseInt(p.look,10)||smartInitialLook(sex);
  var needsCity=!city;
  var draft=state.signupDraft&&state.signupDraft.uid===state.uid?state.signupDraft:{};
  if(draft.name)rawName=draft.name;if(draft.age)age=draft.age;
  var ov=el('div',{class:'lightbox guest-profile-gate vc-signup-overlay',role:'presentation'});
  ov.innerHTML='<div class="guest-gate-card vc-signup-card" role="dialog" aria-modal="true" aria-labelledby="vc-gate-title" tabindex="-1">'+
    '<button type="button" class="guest-gate-close vc-icon-glass" data-close aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close')+'</button>'+
    '<section class="vc-signup-copy"><div class="guest-gate-kicker">'+h(t('signup_choice_saved','Ваш выбор сохранён'))+'</div><h2 id="vc-gate-title">'+h(intentAction==='message'?t('signup_title_message','Сохраните сообщение'):((intentAction==='like'&&!purchaseGate&&!registerGate)?t('signup_title_like','Сохраните лайк'):t('signup_title_access','Сохраните доступ')))+'</h2><p>'+h(t('signup_context_kept','Два коротких шага — и вы продолжите выбранное действие. Искать анкету заново не придётся.'))+'</p>'+(purchaseGate||registerGate?'<div class="guest-gate-context" id="vc-gate-context"><span>'+semanticGlassIcon(purchaseGate?'wallet':'user')+'</span><div><small>'+h(purchaseGate?intentLabel:t('save_access','Сохранить доступ'))+'</small><strong>'+h(t('signup_one_process','Одна регистрация, без повторных вопросов'))+'</strong></div></div>':'<div class="guest-gate-context" id="vc-gate-context">'+(intentProfile.photo?'<img'+vcThumbSrc(intentProfile.photo)+' alt="">':'<span>'+h((intentName||'?').charAt(0).toUpperCase())+'</span>')+'<div><small>'+h(intentLabel)+'</small><strong>'+h(intentName)+'</strong>'+(intentProfile.city?'<em>'+h(vcDynamicProfileCity(intentProfile.city))+'</em>':'')+'</div></div>')+'<ul class="vc-signup-benefits"><li>'+h(t('signup_no_mail_wait','Без ожидания подтверждения почты'))+'</li><li>'+h(t('signup_no_repeat','Логин и пароль вводятся один раз'))+'</li><li>'+h(t('signup_details_after','Имя, возраст и фото — на следующем шаге'))+'</li></ul><button type="button" class="vc-signup-cancel" data-cancel>'+h(t('signup_back_browse','Ещё посмотреть анкеты'))+'</button></section>'+
    '<section class="vc-signup-form"><ol class="vc-signup-progress" aria-label="'+h(t('signup_steps','Шаги регистрации'))+'"><li data-progress="1"><b>1</b>'+h(t('signup_access','Доступ'))+'</li><li data-progress="2"><b>2</b>'+h(t('signup_about','О вас'))+'</li></ol><h3 id="vc-signup-heading"></h3><p id="vc-signup-description"></p><form id="vc-signup-access" data-signup-step="1" novalidate><label>'+h(t('signup_login_email','Логин · ваш email'))+'<input id="vc-signup-email" type="email" autocomplete="email" required value="'+h((state.auth||{}).email||draft.email||'')+'" aria-describedby="vc-signup-access-status"></label><label id="vc-signup-password-label">'+h(t('password','Пароль'))+'<span class="vc-signup-password"><input id="vc-signup-password" type="password" minlength="8" autocomplete="new-password" required aria-describedby="vc-signup-access-status"><button type="button" id="vc-signup-show-password" aria-label="'+h(t('show_password','Показать пароль'))+'" aria-pressed="false">'+semanticGlassIcon('eye')+'</button></span></label><small>'+h(t('signup_password_hint','Не менее 8 символов. Повторять пароль не нужно.'))+'</small><label class="vc-signup-consent"><input id="vc-signup-consent" type="checkbox"><span>'+h(t('signup_adult_consent','Мне исполнилось 18 лет. Принимаю'))+' <a href="'+h(legalUrl('tos'))+'" target="_blank" rel="noopener">'+h(t('terms','Условия'))+'</a> '+h(t('and','и'))+' <a href="'+h(legalUrl('privacy'))+'" target="_blank" rel="noopener">'+h(t('privacy_policy','Политику конфиденциальности'))+'</a>.</span></label><div id="vc-signup-access-status" class="guest-gate-status" role="alert"></div><div class="vc-signup-cta"><button type="submit" class="guest-gate-submit" id="vc-signup-next">'+h(t('signup_next','Далее — о вас'))+' →</button></div><button type="button" class="vc-signup-cancel" id="vc-signup-login">'+h(t('login_link','Уже есть аккаунт? Войти'))+'</button></form><div data-signup-step="2">'+
    '<label class="guest-photo-picker" id="vc-gate-photo-label" tabindex="0" role="button"><input type="file" id="vc-gate-photo" accept="image/*,.heic,.heif" hidden><span id="vc-gate-preview"'+(existingPhoto?' style="background-image:url('+h(existingPhoto)+'),linear-gradient(145deg,rgba(255,141,116,.35),rgba(193,82,63,.3))"':'')+'>'+(existingPhoto?'':semanticGlassIcon('camera','vc-gate-photo-icon'))+'</span><b>'+h(existingPhoto?t('change_photo','Изменить фото'):t('add_photo_required','Добавить фото'))+'</b></label><small class="guest-photo-hint">'+h(t('registration_photo_hint','Нужно для вашей анкеты. Фото можно изменить позже.'))+'</small>'+
    '<div class="guest-gate-grid"><label>'+h(t('name','Имя'))+'<input id="vc-gate-name" type="text" maxlength="60" autocomplete="name" enterkeyhint="next" value="'+h(rawName)+'" placeholder="'+h(t('name','Имя'))+'"></label><label>'+h(t('age','Возраст'))+'<input id="vc-gate-age" type="number" min="18" max="80" inputmode="numeric" value="'+age+'"></label></div>'+
    (!sex?'<div class="guest-gate-grid"><label>'+h(t('you_are','Вы'))+'<select id="vc-gate-sex"><option value="1">'+h(t('man','Мужчина'))+'</option><option value="2">'+h(t('woman','Женщина'))+'</option></select></label><label>'+h(t('looking_for','Ищу'))+'<select id="vc-gate-look"><option value="2">'+h(t('women','Девушек'))+'</option><option value="1">'+h(t('men','Мужчин'))+'</option><option value="3">'+h(t('everyone','Всех'))+'</option></select></label></div>':'')+
    (needsCity?'<label>'+h(t('city','Город'))+'<div class="guest-city-row"><div class="city-picker"><input id="vc-gate-city" maxlength="60" autocomplete="address-level2" value="'+h(draft.city||'')+'" placeholder="'+h(t('city_search_placeholder','Начните вводить город'))+'"><div class="city-suggest" role="listbox" hidden></div></div><button type="button" id="vc-gate-geo" class="vc-icon-glass" aria-label="'+h(t('detect','Определить'))+'">'+semanticGlassIcon('location')+'</button></div></label>':'<small class="guest-inferred-note">'+h(savedCity?savedCity:(city+' · '+t('smart_data_kept','город и настройки уже взяты из ссылки')))+'</small>')+
    ((state.smart&&(state.smart.age_min||state.smart.age_max))?'<small class="guest-inferred-note">'+h(t('confirm_age_hint','Возраст из рекламы был приблизительным — проверь его.'))+'</small>':'')+
    '<label class="vc-signup-consent" id="vc-signup-profile-consent-label"><input id="vc-signup-profile-consent" type="checkbox"><span>'+h(t('signup_adult_consent','Мне исполнилось 18 лет. Принимаю'))+' <a href="'+h(legalUrl('tos'))+'" target="_blank" rel="noopener">'+h(t('terms','Условия'))+'</a> '+h(t('and','и'))+' <a href="'+h(legalUrl('privacy'))+'" target="_blank" rel="noopener">'+h(t('privacy_policy','Политику конфиденциальности'))+'</a>.</span></label><div class="guest-gate-status" id="vc-gate-status" role="alert" aria-live="polite"></div><div class="vc-signup-cta"><button type="button" class="guest-gate-submit" id="vc-gate-submit">'+h(registerGate?t('signup_finish','Завершить регистрацию'):intentSubmit)+' →</button></div><button type="button" class="vc-signup-cancel" id="vc-signup-back">← '+h(t('back','Назад'))+'</button>'+
    '<small>'+h(t('gate_privacy','Фото и данные будут видны только внутри otkrovenno.online.'))+'</small></div></section></div>';
  document.body.appendChild(ov);setupDialogA11y(ov);var cityInput=ov.querySelector('#vc-gate-city');if(cityInput)vcCityPicker(cityInput,{initialKey:vcCityKeyForName(city||'')});
  document.body.classList.add('vc-auth-route');
  var loginMode=false,accessForm=ov.querySelector('#vc-signup-access'),accessStatus=ov.querySelector('#vc-signup-access-status'),next=ov.querySelector('#vc-signup-next');
  function acceptSignupTerms(){
    return api('tos_accept').then(function(accepted){if(!accepted||!accepted.ok||!accepted.accepted)throw new Error(accepted&&accepted.err||'network');state.tosAccepted=true;return true;});
  }
  function setStep(step){
    signupStep=step;ov.querySelectorAll('[data-signup-step]').forEach(function(panel){panel.hidden=parseInt(panel.getAttribute('data-signup-step'),10)!==step;});
    ov.querySelectorAll('.city-suggest').forEach(function(list){list.hidden=true;});
    ov.querySelectorAll('[data-progress]').forEach(function(item){var active=parseInt(item.dataset.progress,10)===step;item.classList.toggle('active',active);if(active)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
    ov.querySelector('#vc-signup-heading').textContent=step===1?t('signup_access_title','Начнём с самого важного'):t('signup_about_title','Теперь немного о вас');
    ov.querySelector('#vc-signup-description').textContent=step===1?t('signup_access_copy','Сохраните доступ к этой анкете и перепискам. Подтверждать письмо сейчас не нужно.'):t('signup_about_copy','Так собеседник узнает, кто вы. Уже заполненные данные сохранены; пароль повторять не нужно.');
    ov.querySelector('#vc-signup-back').hidden=!needsAccess;
    ov.querySelector('#vc-signup-profile-consent-label').hidden=state.tosAccepted===true||state.signupConsentUid===state.uid;
    if(step===1&&accessSaved){ov.querySelector('#vc-signup-email').readOnly=true;ov.querySelector('#vc-signup-password-label').hidden=true;ov.querySelector('#vc-signup-login').hidden=true;ov.querySelector('#vc-signup-consent').checked=true;accessStatus.textContent=t('access_saved','Доступ сохранён');}
  }
  function close(){if(signupBusy)return;state.signupDraft={uid:state.uid,email:ov.querySelector('#vc-signup-email').value.trim(),name:ov.querySelector('#vc-gate-name').value,age:ov.querySelector('#vc-gate-age').value,city:cityInput?cityInput.value:'',photo:chosen};state.profileGateOpen=false;state.pendingLike=null;clearProfileIntent();document.body.classList.remove('vc-auth-route');if(ov.parentNode)ov.parentNode.removeChild(ov);}
  ov.querySelector('[data-close]').addEventListener('click',close);ov.addEventListener('click',function(e){if(e.target===ov)close();});ov.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  ov.querySelector('[data-cancel]').addEventListener('click',close);ov.querySelector('#vc-signup-back').addEventListener('click',function(){if(!signupBusy)setStep(1);});
  ov.querySelector('#vc-signup-show-password').addEventListener('click',function(){var input=ov.querySelector('#vc-signup-password'),visible=input.type==='password';input.type=visible?'text':'password';this.setAttribute('aria-pressed',visible?'true':'false');this.setAttribute('aria-label',t(visible?'hide_password':'show_password',visible?'Скрыть пароль':'Показать пароль'));});
  ov.querySelector('#vc-signup-login').addEventListener('click',function(){if(signupBusy)return;loginMode=!loginMode;ov.querySelector('#vc-signup-password').autocomplete=loginMode?'current-password':'new-password';ov.querySelector('#vc-signup-password').value='';next.textContent=loginMode?t('login_btn','Войти'):t('signup_next','Далее — о вас');this.textContent=loginMode?t('register_link','Нет аккаунта? Зарегистрируйтесь'):t('login_link','Уже есть аккаунт? Войти');accessStatus.textContent='';});
  accessForm.addEventListener('submit',function(e){
    e.preventDefault();if(signupBusy)return;
    if(accessSaved){setStep(2);return;}
    var email=ov.querySelector('#vc-signup-email'),pass=ov.querySelector('#vc-signup-password'),consent=ov.querySelector('#vc-signup-consent');
    email.value=email.value.trim();
    if(!email.value||!email.validity.valid){email.setAttribute('aria-invalid','true');accessStatus.textContent=t('login_err_bad_email','Укажите корректный email');email.focus();return;}email.removeAttribute('aria-invalid');
    if(!pass.value||(!loginMode&&pass.value.length<8)){pass.setAttribute('aria-invalid','true');accessStatus.textContent=t('login_err_weak_password','Пароль должен содержать не менее 8 символов');pass.focus();return;}pass.removeAttribute('aria-invalid');
    if(!loginMode&&!consent.checked){accessStatus.textContent=t('signup_accept_terms','Подтвердите возраст 18+ и принятие условий');consent.focus();return;}
    signupBusy=true;next.disabled=true;accessStatus.textContent=t('saving','Сохраняем...');
    authApi(loginMode?'login':'upgrade_email',{email:email.value,password:pass.value}).then(function(result){
      if(!result||!result.ok)throw new Error(result&&result.err||'network');
      pass.value='';accessSaved=!loginMode;if(result.uid)state.uid=parseInt(result.uid,10)||state.uid;
      if(!loginMode)state.signupConsentUid=state.uid;
      return loadAuthMeta().then(function(){return loadMe();}).then(function(){return !loginMode&&guestProfileIdentityReady()?acceptSignupTerms():null;});
    }).then(function(){
      accessSaved=true;signupBusy=false;next.disabled=false;accessStatus.textContent='';
      if(loginMode){state.profileGateOpen=false;ov.remove();document.body.classList.remove('vc-auth-route');if(guestProfileIdentityReady()){clearProfileIntent();if(typeof onReady==='function')onReady(intent);else resumeProfileIntent(card,intent);}else showGuestProfileGate(card,onReady,opts);return;}
      if(guestProfileIdentityReady()){state.profileGateOpen=false;clearProfileIntent();ov.remove();document.body.classList.remove('vc-auth-route');if(typeof onReady==='function')onReady(intent);else resumeProfileIntent(card,intent);return;}
      setStep(2);ov.querySelector('#vc-gate-name').focus();
    }).catch(function(err){signupBusy=false;next.disabled=false;accessStatus.textContent=localizedErrorText(err.message);});
  });
  var fileInput=ov.querySelector('#vc-gate-photo'),preview=ov.querySelector('#vc-gate-preview'),chosen=draft.photo||null;
  if(chosen){var draftUrl=URL.createObjectURL(chosen);preview.textContent='';preview.style.backgroundImage='url('+draftUrl+')';setTimeout(function(){URL.revokeObjectURL(draftUrl);},30000);}
  setStep(signupStep);
  if(!needsAccess)api('tos_check').then(function(info){if(info&&info.ok&&info.accepted){state.tosAccepted=true;if(ov.parentNode)ov.querySelector('#vc-signup-profile-consent-label').hidden=true;}}).catch(function(){});
  if(!purchaseGate&&intent.profile_id&&(!intentProfile.name||!intentProfile.photo)){api('vprofile',{virtual:intent.profile_id}).then(function(result){if(!result||!result.ok||!ov.parentNode)return;var remote=result.profile||result,merged=findIntentProfile(intent.profile_id,remote),context=ov.querySelector('#vc-gate-context');if(!context)return;var displayName=localizedPersonName(merged.name||('#'+intent.profile_id));context.innerHTML=(merged.photo?'<img'+vcThumbSrc(merged.photo)+' alt="">':'<span>'+h((displayName||'?').charAt(0).toUpperCase())+'</span>')+'<div><small>'+h(intentLabel)+'</small><strong>'+h(displayName)+'</strong>'+(merged.city?'<em>'+h(vcDynamicProfileCity(merged.city))+'</em>':'')+'</div>';intent.profile=merged;state.profileIntent=intent;try{sessionStorage.setItem(VC_PROFILE_INTENT_KEY,JSON.stringify(intent));}catch(e){}}).catch(function(){});}
  fileInput.addEventListener('click',function(e){e.stopPropagation();});var gatePhotoLabel=ov.querySelector('#vc-gate-photo-label');if(gatePhotoLabel)gatePhotoLabel.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click();}});
  fileInput.addEventListener('change',function(){chosen=fileInput.files&&fileInput.files[0];if(!chosen)return;if(!isImageFileCandidate(chosen)){chosen=null;toast(t('bad_type','Неподдерживаемый формат'),'error');return;}var u=URL.createObjectURL(chosen);preview.textContent='';preview.style.backgroundImage='url('+u+')';setTimeout(function(){URL.revokeObjectURL(u);},30000);var gateStatus=ov.querySelector('#vc-gate-status'),gateLabel=ov.querySelector('#vc-gate-photo-label b');if(gateStatus)gateStatus.textContent='';if(gateLabel)gateLabel.textContent=t('change_photo','Изменить фото');});
  var geo=ov.querySelector('#vc-gate-geo');if(geo)geo.addEventListener('click',function(){if(!navigator.geolocation){toast(t('geo_unavailable','Геолокация недоступна'),'error');return;}geo.disabled=true;navigator.geolocation.getCurrentPosition(function(pos){api('geocode',{lat:pos.coords.latitude,lng:pos.coords.longitude}).then(function(r){geo.disabled=false;if(r&&r.ok&&r.city)ov.querySelector('#vc-gate-city').value=r.city;else handleApiError(r,t('geo_not_found','Не удалось определить город'));}).catch(function(){geo.disabled=false;toast(t('network_error','Ошибка сети'),'error');});},function(){geo.disabled=false;toast(t('geo_denied','Нет доступа к геолокации'),'error');},{timeout:10000,maximumAge:300000});});
  ov.querySelector('#vc-gate-submit').addEventListener('click',function(){
    var btn=this,name=ov.querySelector('#vc-gate-name').value.trim().replace(/\s+/g,' '),exactAge=parseInt(ov.querySelector('#vc-gate-age').value,10)||0,place=cityInput?cityInput.value.trim():city,status=ov.querySelector('#vc-gate-status'),finalSex=sex||(parseInt((ov.querySelector('#vc-gate-sex')||{}).value,10)||0),finalLook=look||(parseInt((ov.querySelector('#vc-gate-look')||{}).value,10)||0);
    if(!profileNameReady(name)){status.textContent=t('name_required','Укажите имя');ov.querySelector('#vc-gate-name').focus();return;}if(exactAge<18||exactAge>80){status.textContent=t('age_18_99','Возраст должен быть от 18 до 80');ov.querySelector('#vc-gate-age').focus();return;}if(!place){status.textContent=t('city_required','Укажите город');if(cityInput)cityInput.focus();return;}if(!finalSex||!finalLook){status.textContent=t('profile_required','Укажите пол и кого ищете');return;}if(!existingPhoto&&!chosen){status.textContent=t('photo_required','Добавьте фото');var gatePhotoLabelFocus=ov.querySelector('#vc-gate-photo-label');if(gatePhotoLabelFocus)gatePhotoLabelFocus.focus();else fileInput.focus();return;}
    if(state.tosAccepted!==true&&state.signupConsentUid!==state.uid&&!ov.querySelector('#vc-signup-profile-consent').checked){status.textContent=t('signup_accept_terms','Подтвердите возраст 18+ и принятие условий');ov.querySelector('#vc-signup-profile-consent').focus();return;}
    signupBusy=true;btn.disabled=true;ov.querySelector('#vc-signup-back').disabled=true;status.textContent=t('saving','Сохраняем...');
    var photoPromise=chosen?imageFileToDataUrl(chosen,8*1024*1024,2048).then(function(data){return api('upload_avatar',{photo:data});}):Promise.resolve({ok:true});
    photoPromise.then(function(pr){
      if(!pr||!pr.ok)throw new Error((pr&&pr.err)||'photo_failed');
      var ints=Array.isArray(p.interests)?p.interests:[];
      return api('save_profile',{name:name,surname:p.surname||'',age:exactAge,city:place,sex:finalSex,look:finalLook,bio:p.bio||'',zodiac:parseInt(p.zodiac_id!=null?p.zodiac_id:p.zodiac,10)||0,daily_status:parseInt(p.daily_status,10)||0,interests:JSON.stringify(ints)}).then(function(sr){return {profile:sr,photo:pr};});
    }).then(function(all){
      if(!all.profile||!all.profile.ok)throw new Error((all.profile&&all.profile.err)||'save_failed');
      var identity=all.profile.profile_identity||{},savedName=identity.name||name,savedPhoto=all.photo.url||identity.photo||existingPhoto;
      applyProfileIdentityInstant(savedName,savedPhoto);existingPhoto=savedPhoto;chosen=null;
      Object.assign(state.me.profile,{age:exactAge,u_age:exactAge,city:place,sex:finalSex,look:finalLook});
      status.textContent='✓ '+t('profile_ready','Профиль готов');
      funnelTrack('profile_gate_complete',{trigger:intentAction,profile_id:intent.profile_id||0},intentAction+':'+(intent.profile_id||0));
      return (state.tosAccepted===true?Promise.resolve(true):acceptSignupTerms()).then(function(){return loadMe();});
    }).then(function(){
      var completedIntent=intent;signupBusy=false;state.signupDraft=null;state.profileGateOpen=false;state.pendingLike=null;clearProfileIntent();document.body.classList.remove('vc-auth-route');
      if(ov.parentNode)ov.parentNode.removeChild(ov);if(state.route==='/profile')viewProfile();if(intentAction==='like')state.guestLikes=1;
      if(typeof onReady==='function')onReady(completedIntent);else resumeProfileIntent(card,completedIntent);
    }).catch(function(err){
      signupBusy=false;btn.disabled=false;ov.querySelector('#vc-signup-back').disabled=false;var code=err&&err.message;
      status.textContent=code==='too_big'?t('photo_too_big','\u0424\u043e\u0442\u043e \u0431\u043e\u043b\u044c\u0448\u0435 8 \u041c\u0411'):(code==='heic_unsupported'?t('heic_unsupported','Это HEIC-фото не поддерживается этой версией iOS. Выберите фото из медиатеки или обновите Safari.'):(code==='bad_type'?t('bad_type','Неподдерживаемый формат'):t('save_failed','Не удалось сохранить. Попробуйте ещё раз.')));
    });
  });
}
function loadMoreDeck(){
  if(state.discoverFilter&&state.discoverFilter.online){refreshDiscoverOnline(false);return;}
  if (state.deckLoading) return;
  state.deckLoading = true;
  api('me').then(function(r){
    state.deckLoading = false;
    if (r && r.ok && r.virtuals){
      state.deckLoadError=false;
      for (var i=0;i<r.virtuals.length;i++){
        var exists = false;
        for (var j=0;j<state.deckAll.length;j++){ if (state.deckAll[j].id === r.virtuals[i].id){ exists = true; break; } }
        if (!exists) state.deckAll.push(r.virtuals[i]);
      }
      applyDiscoverFilter(false);
      if(state.route==='/'||state.route==='/discover')viewDiscover();
    }else{state.deckLoadError=true;if(state.route==='/'||state.route==='/discover')viewDiscover();}
  }).catch(function(){ state.deckLoading = false;state.deckLoadError=true;if(state.route==='/'||state.route==='/discover')viewDiscover(); });
}

/* Swipe physics — targets .glass-container, 25% threshold, ±12° rotation */
function vcSwapCardPhoto(img,url){
  var tmp=document.createElement('div');tmp.innerHTML='<img'+vcCardSrc(url)+' alt="">';
  var n=tmp.firstChild;if(!n||!n.getAttribute)return;
  ['srcset','sizes','data-full'].forEach(function(a){if(n.hasAttribute(a))img.setAttribute(a,n.getAttribute(a));else img.removeAttribute(a);});
  img.src=n.getAttribute('src')||url;
}
function wireDeckPhotos(card){
  var photos=deckPhotosFor(card),img=document.getElementById('vc-card-photo'),bars=$$('#vc-photo-segments i'),idx=0;
  if(photos.length<2||!img)return;
  function show(n){
    idx=Math.max(0,Math.min(photos.length-1,n));vcSwapCardPhoto(img,photos[idx]);
    bars.forEach(function(b,i){b.classList.toggle('is-on',i===idx);b.classList.toggle('is-done',i<idx);});
  }
  $$('.photo-tap').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();if(Date.now()<(state.deckPhotoClickBlockUntil||0))return;show(idx+(parseInt(btn.dataset.photoStep,10)||0));});});
}
/* desktop keys: left = skip, right = like, Enter = full profile, Backspace = undo; only on the search screen, never while typing or over a dialog */
function vcDeckKeys(e){
  if(state.route!=='/'||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
  var tag=(e.target&&e.target.tagName)||'';
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(tag)||(e.target&&e.target.isContentEditable))return;
  if(e.key==='Enter'&&tag!==''&&tag!=='BODY')return;
  if(document.querySelector('.vc-modal-layer,.lightbox,.vcn-overlay,.vc-signup-overlay,.vc-filter-sheet'))return;
  var sel={ArrowLeft:'.skip-button',ArrowRight:'.like-button',Backspace:'.back-button',Enter:'#vc-full-profile'}[e.key];
  if(!sel)return;
  var btn=document.querySelector('#vc-card-back-wrap '+sel+',#vc-actions '+sel);
  if(!btn||btn.disabled)return;
  e.preventDefault();btn.click();
}
function wireSwipe(){
  var card = document.getElementById('vc-glass-card');
  if (!card) return;
  var sX = 0, sY = 0, cX = 0, cY = 0, drag = false, tracking=false, axis='', cw = card.offsetWidth || 620;
  function start(e){
    if (e.target.closest('.photo-nav') || e.target.closest('.swtop') || e.target.closest('.info-zone')) return;
    tracking=true;drag=false;axis='';cX=0;cY=0;cw = card.offsetWidth || 620;
    var p = e.touches ? e.touches[0] : e; sX = p.clientX; sY = p.clientY;
  }
  function move(e){
    if (!tracking) return;
    var p = e.touches ? e.touches[0] : e;
    cX = p.clientX - sX; cY = p.clientY - sY;
    if(!axis){if(Math.max(Math.abs(cX),Math.abs(cY))<8)return;axis=Math.abs(cX)>Math.abs(cY)*1.15?'x':'y';if(axis==='y'){tracking=false;cX=0;cY=0;return;}drag=true;state.deckPhotoClickBlockUntil=Date.now()+450;card.classList.add('dragging');}
    if(axis!=='x')return;
    if(e.cancelable)e.preventDefault();
    var r = (cX / cw) * 12;
    card.style.transform = 'translate(' + cX + 'px,' + (cY*.12) + 'px) rotate(' + r + 'deg)';
    card.classList.toggle('show-like', cX > 60);
    card.classList.toggle('show-nope', cX < -60);
  }
  function end(){
    if (!tracking&&!drag) return;
    tracking=false;if(!drag){cX=0;cY=0;return;}drag = false;
    card.classList.remove('dragging');
    if (Math.abs(cX) > cw * 0.25){
      var d = cX > 0 ? 1 : -1;
      card.style.transform = 'translate(' + (d * 600) + 'px,' + cY + 'px) rotate(' + (d * 12) + 'deg)';
      card.style.opacity = '0';
      setTimeout(function(){ handleDeckAction(d > 0 ? 'like' : 'pass'); }, 300);
    } else {
      card.style.transform = '';
      card.classList.remove('show-like','show-nope');
    }
    cX = 0; cY = 0;
  }
  card.addEventListener('mousedown', start);
  card.addEventListener('dragstart',function(e){e.preventDefault();});
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', end);
  card.addEventListener('touchstart', start, {passive:false});
  document.addEventListener('touchmove', move, {passive:false});
  document.addEventListener('touchend', end);
  state.deckSwipeCleanup=function(){document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',end);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);};
}
function swipeAnim(dir){
  var card = document.getElementById('vc-glass-card');
  if (!card) return;
  card.classList.add('dragging');
  card.style.transform = 'translate(' + (dir * 600) + 'px,0) rotate(' + (dir * 12) + 'deg)';
  card.classList.add(dir > 0 ? 'show-like' : 'show-nope');
  card.style.opacity = '0';
  setTimeout(function(){ card.classList.remove('dragging'); handleDeckAction(dir > 0 ? 'like' : 'pass'); }, 300);
}

/* ===== View: Chats list ===== */
function relativePresenceTime(ts){
  ts=parseInt(ts,10)||0;if(!ts)return '';
  var diff=Math.max(0,Math.floor(Date.now()/1000)-ts),value=0,unit='second';
  if(diff<60){value=0;unit='second';}
  else if(diff<3600){value=-Math.max(1,Math.round(diff/60));unit='minute';}
  else if(diff<86400){value=-Math.max(1,Math.round(diff/3600));unit='hour';}
  else if(diff<604800){value=-Math.max(1,Math.round(diff/86400));unit='day';}
  else return new Date(ts*1000).toLocaleDateString(state.lang||undefined,{day:'numeric',month:'short'});
  try{return new Intl.RelativeTimeFormat(state.lang||'ru',{numeric:'auto'}).format(value,unit);}catch(e){return fmtTime(ts);}
}
function chatPresenceText(info){
  if(info&&(info.online===true||parseInt(info.online,10)===1))return t('online_status','онлайн');
  var rel=relativePresenceTime(info&&info.last_seen);
  return rel?(t('last_seen','была')+' '+rel):t('offline_short','не в сети');
}
var VC_STICKER_MOODS=['hello','question','love','angry','shrug','idea','wink','wow','celebrate'];
var VC_STICKER_FLIRT_MOODS=['wink','kiss','blush','tease','miss-you','compliment','date','heart-eyes','good-night'];
var VC_STICKER_GLAM_MOODS=['cash','music','cheers','fitness','cozy','relax'];
var VC_STICKER_ATTITUDE_MOODS=['facepalm','agreed','fire','shrug','kiss','watching'];
var VC_STICKER_LEGEND_MOODS=['confidence','hello','fire','cash','fitness','love','wink','victory','good-night'];
var VC_STICKER_PACKS={female:VC_STICKER_MOODS,spark:VC_STICKER_FLIRT_MOODS,glam:VC_STICKER_GLAM_MOODS,attitude:VC_STICKER_ATTITUDE_MOODS,male:VC_STICKER_MOODS,legend:VC_STICKER_LEGEND_MOODS};
var VC_STICKER_PACK_META={
  female:{gender:2,label:'sticker_pack_female',fallback:'Она',preview:'female-hello'},
  spark:{gender:2,label:'sticker_pack_spark',fallback:'Искра',preview:'spark-wink',accent:true},
  glam:{gender:2,label:'sticker_pack_glam',fallback:'Шик',preview:'glam-cash'},
  attitude:{gender:2,label:'sticker_pack_attitude',fallback:'Характер',preview:'attitude-facepalm'},
  male:{gender:1,label:'sticker_pack_male',fallback:'Он',preview:'male-hello'},
  legend:{gender:1,label:'sticker_pack_legend',fallback:'Легенда',preview:'legend-confidence',premium:true,price:99,priceUsd:1.99}
};
function vcStickerPartsFromKey(key){
  var match=String(key||'').match(/^([a-z]+)-([a-z-]+)$/),moods=match&&VC_STICKER_PACKS[match[1]];
  return match&&moods&&moods.indexOf(match[2])>=0?{pack:match[1],mood:match[2],index:moods.indexOf(match[2])}:null;
}
function vcStickerKeyFromText(value){
  var match=String(value||'').trim().match(/^\[\[vc_sticker:([a-z]+)-([a-z-]+)\]\]$/),key=match?(match[1]+'-'+match[2]):'';
  return vcStickerPartsFromKey(key)?key:'';
}
function vcStickerToken(key){return vcStickerPartsFromKey(key)?'[[vc_sticker:'+key+']]':'';}
function vcStickerAsset(key){return vcStickerToken(key)?('/app/assets/stickers/sticker-'+key+'.png'):'';}
function vcStickerMood(key){return String(key||'').split('-').slice(1).join('-');}
function vcStickerPackLabel(pack){var meta=VC_STICKER_PACK_META[pack]||VC_STICKER_PACK_META.female;return t(meta.label,meta.fallback);}
function vcStickerAlt(key){var parts=vcStickerPartsFromKey(key);return t('sticker','Стикер')+' · '+(parts?vcStickerPackLabel(parts.pack):t('sticker_pack_female','Она'))+' '+(parts?parts.index+1:'');}
function vcStickerPreview(value){return vcStickerKeyFromText(value)?t('sticker','Стикер'):'';}
function vcStickerPacksForUser(){
  var profile=(state.me&&state.me.profile)||state.profile||{},sex=parseInt(profile.sex||profile.gender,10)||0;
  return sex===2?['female','spark','glam','attitude']:['male','legend'];
}
function vcStickerPackUnlocked(pack){
  var meta=VC_STICKER_PACK_META[pack];
  return !meta||!meta.premium||!!(state.stickerPackAccess&&state.stickerPackAccess[pack]);
}
function vcRefreshStickerPackState(pack){
  return api('sticker_pack_state',{pack:pack}).then(function(r){
    if(r&&r.ok){if(!state.stickerPackAccess)state.stickerPackAccess={};state.stickerPackAccess[pack]=!!r.unlocked;}
    return r||{ok:false};
  }).catch(function(){return {ok:false};});
}
function vcDefaultStickerPack(){
  var allowed=vcStickerPacksForUser(),saved='';try{saved=localStorage.getItem('vc_sticker_pack')||'';}catch(e){}
  return allowed.indexOf(saved)>=0?saved:allowed[0];
}
function chatPreviewText(c){
  if(c&&c.typing)return t('typing','печатает...');
  return chatMessagePreview(c);
}
/* The last message itself, never the typing placeholder: pop-ups and the notification centre show what was written. */
function chatMessagePreview(c){
  var text=String((c&&c.last_msg)||((c&&c.preview)||'')).trim(),type=parseInt(c&&c.last_type,10)||0;
  if(type===1)return t('photo','Фото')+(text?' · '+text:'');
  if(type===2)return t('voice_message','Голосовое сообщение');
  if(type===4)return t('chat_gift','Подарок')+(text?' · '+text:'');
  var stickerPreview=vcStickerPreview(text);if(stickerPreview)return stickerPreview;
  return text;
}
function chatRowDraftPreview(c){var id=parseInt(c&&(c.peer_id||c.id),10)||0;if(!id||c&&c.typing)return null;var d=readChatDraft(id);if(!d||!d.text)return null;var st=vcStickerKeyFromText(d.text);return {sticker:!!st,text:st?'':d.text.replace(/\s+/g,' ').trim().slice(0,60)};}
function chatInboxPreview(c){
  var preview=chatPreviewText(c);if(!preview||c&&c.typing)return preview;
  return c&&c.last_from_me?(t('you_are','Вы')+': '+preview):preview;
}
function chatProfilePhotoCount(c){return Math.max(1,parseInt(c&&c.photo_count,10)||((c&&Array.isArray(c.photos)&&c.photos.length)||0));}
function chatProfileHasNewPhotos(c){
  var id=parseInt(c&&(c.peer_id||c.id),10)||0,count=chatProfilePhotoCount(c);if(!id||count<=1)return false;
  try{return count>(parseInt(localStorage.getItem('vc_profile_photos_seen_'+id),10)||1);}catch(e){return count>1;}
}
function markChatProfilePhotosSeen(id,count){id=parseInt(id,10)||0;count=Math.max(1,parseInt(count,10)||1);if(!id)return;try{localStorage.setItem('vc_profile_photos_seen_'+id,String(count));}catch(e){}}
function chatLastActivity(c){return parseInt(c&&(c.last_at||c.last_ts||c.ts),10)||0;}
function sortChatsForInbox(chats){
  return (Array.isArray(chats)?chats:[]).slice().sort(function(a,b){var diff=chatLastActivity(b)-chatLastActivity(a);if(diff)return diff;return (parseInt(b&&b.id,10)||0)-(parseInt(a&&a.id,10)||0);});
}
function viewChats(){
  var body = document.getElementById('vc-main-body');
  if (!body) return;
  var chats = sortChatsForInbox(state.chats || (state.me ? state.me.inbox : []) || []),unreadN=0,onlineN=0,i;
  for(i=0;i<chats.length;i++){if((parseInt(chats[i].unread,10)||0)>0)unreadN++;if(chats[i].online)onlineN++;}
  var hd='<div class="hd"><div class="row-between"><h1 class="page-h">'+h(t('nav_chats','Чаты'))+'</h1>'+(chats.length?'<button type="button" class="ibtn" id="v4-chat-search-btn" aria-expanded="false" aria-controls="vc-chat-search" aria-label="'+h(t('search_chats','Поиск по чатам'))+'">'+v4Icon('search')+'</button>':'')+'</div>'+
    (chats.length?'<label class="input-wrap mt12" id="v4-chat-search-wrap" hidden>'+v4Icon('search')+'<input class="input" id="vc-chat-search" type="search" aria-label="'+h(t('search_chats','Поиск по чатам'))+'" placeholder="'+h(t('search_chats','Поиск по чатам'))+'"></label>'+
    '<div class="tabs" id="vc-chat-tabs"><button type="button" class="tab on" data-chat-tab="all">'+h(t('v4_tab_all','Все'))+'</button><button type="button" class="tab" data-chat-tab="unread">'+h(t('v4_tab_unread','Непрочитанные'))+(unreadN?'<span class="n">'+unreadN+'</span>':'')+'</button><button type="button" class="tab" data-chat-tab="online"><span class="dot"></span>'+h(t('v4_online','В сети'))+(onlineN?'<span class="n">'+onlineN+'</span>':'')+'</button></div>':'')+'</div>';
  var strip='',sugg=v4OnlineSuggestions(chats);
  if(sugg.length){
    strip='<h2 class="sec v4-online-h">'+h(t('v4_online_now','Сейчас в сети'))+' <a href="#/" data-v4-online-all>'+h(t('all','Все'))+'</a></h2><div class="chat-match-scroller"><div class="faces" id="vc-chat-match-strip" tabindex="0" aria-label="'+h(t('v4_online_now','Сейчас в сети'))+'">';
    for(var si=0;si<sugg.length&&si<18;si++){var sm=sugg[si],sav=sm.photo||'',sn=localizedPersonName(sm.name||'');strip+='<button type="button" class="face" data-match-chat="'+(parseInt(sm.id,10)||0)+'" aria-label="'+h(sn)+'"><span class="chat-match-avatar avatar ring" style="background:'+(sav?'url('+h(vcPhotoCopy(sav,240)||sav)+') center/cover,':'')+avatarBg(sn)+'">'+(sav?'':h(initials(sn)))+'<i class="on"></i></span><small>'+h(sn)+'</small></button>';}
    strip+='</div><button type="button" class="chat-match-next ibtn" id="vc-chat-match-next" aria-label="'+h(t('next','Дальше'))+'">'+glassIcon('back','vc-chat-next-icon vc-flip-horizontal')+'</button></div>';
  }
  var rows='';for(i=0;i<chats.length;i++)rows+=v4ChatRowHtml(chats[i],0);
  var listHtml=chats.length?'<div class="list chat-list" id="vc-chat-list">'+rows+'</div><div class="empty" id="vc-chat-search-empty" hidden><b>'+h(t('no_search_results','Ничего не найдено'))+'</b></div>':contextCtaHtml({tone:'purple',centered:true,icon:'chats',title:t('chats_context_title','Здесь появятся ваши переписки'),copy:t('chats_context_copy','Выберите анкету и напишите сообщение — диалог начнётся сразу.'),primary:{label:t('go_discover','К поиску'),route:'/'}});
  v4Page('<div class="chats" id="vc-chats-layout"><div class="clist">'+hd+'<div class="sc">'+listHtml+strip+'</div></div><div class="cthread vis-d"><div class="chat-empty"><div class="em">'+v4Icon('chat')+'</div><b>'+h(t('v4_select_chat','Выберите чат'))+'</b>'+h(t('v4_select_chat_sub','Переписка откроется здесь'))+'</div></div></div>','chats-page');
  if(!chats.length)wireContextCtas(body);
  var chatListPage=body.querySelector('.chats .sc'),chatListSurface=body.querySelector('.chat-list');
  if(chatListPage&&chatListSurface)chatListSurface.addEventListener('wheel',function(e){
    if(e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    var factor=e.deltaMode===1?16:(e.deltaMode===2?chatListPage.clientHeight:1),before=chatListPage.scrollTop;
    chatListPage.scrollTop+=e.deltaY*factor;
    if(chatListPage.scrollTop!==before)e.preventDefault();
  },{passive:false});
  $$('#vc-main-body .chat-row').forEach(function(r){
    bindActivation(r,function(){ var pid = parseInt(r.dataset.pid,10); if (pid) navigate('/chat/'+pid); },'link');
  });
  $$('[data-match-chat]',body).forEach(function(btn){btn.addEventListener('click',function(){navigate('/chat/'+parseInt(btn.dataset.matchChat,10));});});
  var matchStrip=document.getElementById('vc-chat-match-strip'),matchNext=document.getElementById('vc-chat-match-next');
  function syncMatchNext(){if(!matchStrip||!matchNext)return;var overflow=matchStrip.scrollWidth-matchStrip.clientWidth>4;matchNext.hidden=!overflow;matchNext.disabled=!overflow||matchStrip.scrollLeft>=matchStrip.scrollWidth-matchStrip.clientWidth-4;}
  if(matchStrip){matchStrip.addEventListener('scroll',syncMatchNext,{passive:true});matchStrip.addEventListener('wheel',function(e){if(e.ctrlKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;var before=matchStrip.scrollLeft;matchStrip.scrollLeft+=e.deltaY;if(matchStrip.scrollLeft!==before)e.preventDefault();},{passive:false});requestAnimationFrame(syncMatchNext);}
  if(matchNext)matchNext.addEventListener('click',function(){matchStrip.scrollBy({left:Math.max(180,matchStrip.clientWidth*.72),behavior:'smooth'});});
  var chatSearch=document.getElementById('vc-chat-search'),tab='all';
  function applyChatFilter(){var q=chatSearch?chatSearch.value.trim().toLocaleLowerCase():'',visible=0;$$('.chat-row',body).forEach(function(row){var hide=(!!q&&String(row.dataset.search||'').indexOf(q)<0)||(tab==='unread'&&!row.classList.contains('has-unread'))||(tab==='online'&&row.dataset.online!=='1');row.hidden=hide;if(!hide)visible++;});var empty=document.getElementById('vc-chat-search-empty');if(empty)empty.hidden=!!visible;}
  if(chatSearch)chatSearch.addEventListener('input',applyChatFilter);
  var v4sb=document.getElementById('v4-chat-search-btn'),v4sw=document.getElementById('v4-chat-search-wrap');
  if(v4sb&&v4sw)v4sb.addEventListener('click',function(){var open=v4sw.hidden;v4sw.hidden=!open;v4sb.setAttribute('aria-expanded',open?'true':'false');if(open&&chatSearch)chatSearch.focus();else if(chatSearch){chatSearch.value='';applyChatFilter();}});
  $$('[data-v4-online-all]',body).forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();navigate('/');setTimeout(function(){var cb=document.getElementById('vc-online-filter');if(cb&&!cb.checked){cb.checked=true;setDiscoverOnlineEnabled(true);}},350);});});
  $$('[data-chat-tab]',body).forEach(function(b){b.addEventListener('click',function(){tab=b.dataset.chatTab;$$('[data-chat-tab]',body).forEach(function(x){x.classList.toggle('on',x===b);});applyChatFilter();});});
  updateChatsBadge();
}
function syncChatListRows(){
  var host=document.querySelector('#vc-main-body .chat-list');if(!host)return;
  var chats=sortChatsForInbox(state.chats||(state.me?state.me.inbox:[])||[]),rows=$$('.chat-row',host),search=document.getElementById('vc-chat-search');
  if(rows.length!==chats.length&&(!search||!search.value)){viewChats();return;}
  for(var i=0;i<chats.length;i++){
    var c=chats[i],pid=parseInt(c.peer_id||c.id,10)||0,row=host.querySelector('.chat-row[data-pid="'+pid+'"]');if(!row)continue;
    var msg=row.querySelector('.cmsg'),tm=row.querySelector('.ctm'),pres=row.querySelector('.chat-row-presence'),meta=row.querySelector('.cmeta'),av=row.querySelector('.av');
    if(msg)msg.textContent=chatInboxPreview(c);if(tm)tm.textContent=fmtTime(c.last_at||c.last_ts||c.ts);row.dataset.lastAt=String(chatLastActivity(c));
    if(pres){pres.textContent=chatPresenceText(c);pres.classList.toggle('is-online',!!c.online);}
    if(av){var dot=av.querySelector('.dot');if(c.online&&!dot)av.appendChild(el('span',{class:'dot'}));else if(!c.online&&dot&&dot.parentNode)dot.parentNode.removeChild(dot);}
    if(meta){var unread=meta.querySelector('.unread'),count=parseInt(c.unread,10)||0;row.classList.toggle('has-unread',!!count);if(count){if(!unread){unread=el('span',{class:'unread'});meta.appendChild(unread);}unread.textContent=count>99?'99+':count;}else if(unread&&unread.parentNode)unread.parentNode.removeChild(unread);}
    host.appendChild(row);
  }
  var strip=document.getElementById('vc-chat-match-strip');if(strip){for(var si=0;si<chats.length&&si<18;si++){var sc=chats[si],sid=parseInt(sc.peer_id||sc.id,10)||0,btn=strip.querySelector('[data-match-chat="'+sid+'"]');if(!btn)continue;var count=parseInt(sc.unread,10)||0,photoCount=chatProfilePhotoCount(sc),avatar=btn.querySelector('.chat-match-avatar'),badge=avatar&&avatar.querySelector('.chat-match-unread'),photoBadge=avatar&&avatar.querySelector('.chat-match-photo-count');btn.classList.toggle('has-unread',!!count);btn.classList.toggle('has-gallery',photoCount>1);btn.classList.toggle('has-new-photo',chatProfileHasNewPhotos(sc)||(parseInt(sc.last_type,10)===1&&!sc.last_from_me&&count>0));if(count){if(!badge){badge=el('b',{class:'chat-match-unread'});avatar.appendChild(badge);}badge.textContent=count>99?'99+':count;}else if(badge&&badge.parentNode)badge.parentNode.removeChild(badge);if(photoCount>1){if(!photoBadge){photoBadge=el('i',{class:'chat-match-photo-count','aria-hidden':'true'});avatar.appendChild(photoBadge);}photoBadge.innerHTML=semanticGlassIcon('camera','vc-chat-photo-count-icon')+'<span>'+photoCount+'</span>';}else if(photoBadge&&photoBadge.parentNode)photoBadge.parentNode.removeChild(photoBadge);strip.appendChild(btn);}}
}
function markChatLocallyRead(peerId){
  peerId=parseInt(peerId,10)||0;if(!peerId)return;
  var lists=[state.chats,state.me&&state.me.inbox];
  for(var li=0;li<lists.length;li++){var list=lists[li];if(!Array.isArray(list))continue;for(var i=0;i<list.length;i++){if(parseInt(list[i].peer_id||list[i].id,10)===peerId)list[i].unread=0;}}
  syncChatListRows();updateChatsBadge();
}
/* Browser-tab title: current screen plus the unread total that already drives the app badge. */
function vcDocumentTitle(){
  var route=String(state.route||'/').split('?')[0],name='';
  if(route==='/'||route==='/discover')name=t('nav_discover','Поиск');
  else if(route==='/chats'||route.indexOf('/chat/')===0)name=t('nav_chats','Чаты');
  else if(route==='/activity'||route==='/notifications'||route==='/hub')name=t('notifications','Уведомления');
  else if(route==='/profile')name=t('nav_profile','Профиль');
  else if(route.indexOf('/profile/')===0)name=t('profile','Анкета');
  else if(route==='/settings')name=t('nav_settings','Настройки');
  else if(route==='/store')name=t('purchases','Покупки');
  else if(route==='/support')name=t('support_page_title','Поддержка');
  var n=parseInt(state.appUnread,10)||0;
  return (n>0?'('+(n>99?'99+':n)+') ':'')+(name?name+' · ':'')+'otkrovenno.online';
}
function vcSyncDocumentTitle(){try{var next=vcDocumentTitle();if(document.title!==next)document.title=next;}catch(e){}}
function updateChatsBadge(){
  var chats = state.chats || (state.me ? state.me.inbox : []) || [];
  var total = 0; for (var i=0;i<chats.length;i++) total += (chats[i].unread || 0);
  var b = document.getElementById('vc-chats-badge');
  if (b){if (total){ b.textContent = total; b.style.display = ''; } else b.style.display = 'none';}
  var mb=document.getElementById('vc-mobile-chats-badge');if(mb){mb.hidden=!total;mb.textContent=total>99?'99+':total;}
  var activityTotal=(parseInt(state.me&&state.me.likes_new,10)||0)+(parseInt(state.me&&state.me.guests_new,10)||0)+(parseInt(state.me&&state.me.notice_unread,10)||0);
  var activityBadge=document.getElementById('vc-activity-badge');if(activityBadge){activityBadge.style.display=activityTotal?'':'none';activityBadge.textContent=activityTotal>99?'99+':activityTotal;}
  var mobileActivityBadge=document.getElementById('vc-mobile-activity-badge');if(mobileActivityBadge){mobileActivityBadge.hidden=!activityTotal;mobileActivityBadge.textContent=activityTotal>99?'99+':activityTotal;}
  var likesNew=parseInt(state.me&&state.me.likes_new,10)||0;
  var likesBadge=document.getElementById('vc-likes-badge');if(likesBadge){likesBadge.style.display=likesNew?'':'none';likesBadge.textContent=likesNew>99?'99+':likesNew;}
  var mobileLikesBadge=document.getElementById('vc-mobile-likes-badge');if(mobileLikesBadge){mobileLikesBadge.hidden=!likesNew;mobileLikesBadge.textContent=likesNew>99?'99+':likesNew;}
  var appTotal=total+activityTotal;
  state.appUnread=appTotal;vcSyncDocumentTitle();
  try{if(navigator.setAppBadge){if(appTotal)navigator.setAppBadge(appTotal);else navigator.clearAppBadge();}}catch(e){}
  var bell = document.getElementById('vc-bell-dot'),noticeTotal=appTotal+(parseInt(state.me&&state.me.hints_count,10)||0); if (bell) bell.style.display = noticeTotal ? '' : 'none';
}
function openNotificationCenter(){
  navigate('/notifications');
}
function vcnPresetFilter(){
  var push='',tab=state.activityTab;
  try{push=new URLSearchParams(location.search).get('vc_push')||'';}catch(e){}
  if(push.indexOf('guest')>=0)tab='guests';else if(push.indexOf('like')>=0)tab='likes';
  state.vcnStartFilter=(tab==='guests'||tab==='likes')?tab:'all';state.activityTab='all';
}
function viewNotifications(){
  var body=document.getElementById('vc-main-body');if(!body)return;
  body.innerHTML='<div class="vcn-page-wrap"></div>';
  vcnOpenCenter(body.firstChild);v4NotificationsChrome(body);
}

function chatDraftKey(peerId){return 'vc_chat_draft_'+(parseInt(state.uid,10)||0)+'_'+(parseInt(peerId,10)||0);}
function clearAllChatDrafts(){try{var ks=[];for(var i=0;i<sessionStorage.length;i++){var k=sessionStorage.key(i);if(k&&k.indexOf('vc_chat_draft_')===0)ks.push(k);}for(var j=0;j<ks.length;j++)sessionStorage.removeItem(ks[j]);}catch(e){}}
function saveChatDraft(peerId,text,selfDestruct){
  text=String(text||'');if(!peerId||!text)return;
  try{sessionStorage.setItem(chatDraftKey(peerId),JSON.stringify({text:text,self_destruct_sec:parseInt(selfDestruct,10)||0,at:Date.now()}));}catch(e){}
}
function readChatDraft(peerId){
  var draft=null;try{draft=JSON.parse(sessionStorage.getItem(chatDraftKey(peerId))||'null');}catch(e){}
  if(!draft||!draft.text||!draft.at||Date.now()-draft.at>24*60*60*1000){clearChatDraft(peerId);return null;}return draft;
}
function clearChatDraft(peerId){try{sessionStorage.removeItem(chatDraftKey(peerId));}catch(e){}}
function syncFreeOpener(response){
  if(!response||!state.chatMeta)return;
  if(response.free_opener)state.chatMeta.free_opener=response.free_opener;
  else if(response.method==='free_opener')state.chatMeta.free_opener={enabled:true,available:false,used_for_partner:true,remaining_today:0,reason:'used_for_partner'};
  renderChatCompactContext(state.chatMeta);
}
function openChatContinuePaywall(peerId,text,selfDestruct,requestId){
  var partner=(state.chatMeta&&state.chatMeta.partner)||findChat(peerId)||{},name=localizedPersonName(partner.name||partner.fullname||t('conversation','Разговор')),photo=partner.photo||partner.avatar||'';
  saveChatDraft(peerId,text,selfDestruct);
  funnelTrack('paywall_view',{profile_id:parseInt(peerId,10)||0,trigger:'chat_continue'},'chat_continue:'+(parseInt(peerId,10)||0));
  var profile='<div class="vc-chat-paywall-person">'+(photo?'<img'+vcThumbSrc(photo)+' alt="">':'<span>'+h((name||'?').charAt(0).toUpperCase())+'</span>')+'<div><small>'+h(t('continue_conversation','Продолжить разговор'))+'</small><strong>'+h(name)+'</strong></div></div>';
  var pack='<div class="vc-chat-paywall-pack"><div><span>'+h(t('starter_pack','Приватный чат'))+'</span><strong>'+h(chatCountLabel(1))+'</strong></div><b>€7</b></div>';
  var target=parseInt(peerId,10)||0,pendingRequestId=String(requestId||vcClientRequestId('msg'));
  state.storeAttribution={profile_id:target,trigger:'chat_continue'};
  return vcPurchase({
    title:t('continue_conversation','Продолжить разговор'),icon:'message',price:350,wallet:false,
    html:'<div class="vc-chat-paywall">'+profile+'<p>'+h(t('continue_conversation_copy','Оплатите выбранный чат, чтобы продолжить разговор. После оплаты вы вернётесь сюда, а черновик отправится автоматически.'))+'</p>'+pack+'<small>✓ '+h(t('message_draft_saved','Черновик сообщения сохранён'))+'</small></div>',
    cancelText:t('later','Позже'),cryptoPackId:1001,profileId:target,
    cardIntent:{kind:'chat_pack',pack_id:1001,profile_id:target},
    resume:{action:'send',data:{virtual:target,text:String(text||''),self_destruct_sec:parseInt(selfDestruct,10)||0,request_id:pendingRequestId},route:'/chat/'+target,title:t('message_sent','Сообщение отправлено')}
  }).then(function(result){if(!result)funnelTrack('store_closed',{profile_id:target,trigger:'chat_continue',reason:'paywall_dismissed'});return result;});
}

/* ===== View: Chat thread ===== */
function viewChat(peerId){
  var body = document.getElementById('vc-main-body');
  if (!body) return;
  if (state.chatPollTimer){ clearTimeout(state.chatPollTimer); state.chatPollTimer = null; }
  state.currentChat = peerId;
  state.chatLastMsgId = 0;
  state.chatMeta = null;
  state.chatAutoScroll = true;
  state.chatNewBelow = 0;
  var info = findChat(peerId) || {name: 'User', peer_id: peerId};
  var chatDisplayName=localizedPersonName(info.name || info.fullname || ''),nm = h(chatDisplayName);
  var av = info.photo || info.avatar || '';
  var avHtml = av ? '<img'+vcThumbSrc(av)+' alt="">' : h(initials(chatDisplayName||'?'));
  var avStyle = av ? '' : 'style="background:'+avatarBg(info.name||info.fullname||'?')+'"';
  body.innerHTML =
    '<div class="chat-view chat-compact-view">' +
      '<div class="chat-header">' +
        '<button type="button" class="chat-back vc-icon-glass" id="vc-chat-back" aria-label="'+h(t('back','Назад'))+'">'+glassIcon('back')+'</button>' +
        '<div class="av" id="vc-chat-avatar" '+avStyle+'>'+avHtml+(info.online?'<span class="dot"></span>':'')+'</div>' +
        '<div class="ch-info"><div class="ch-nm" id="vc-chat-name">'+nm+'</div><small class="ch-st'+(info.online?' is-online':'')+'" id="vc-chat-presence">'+((info.online||info.last_seen)?h(chatPresenceText(info)):'')+'</small>'+profileTrustHtml(info.trust,false)+'</div>' +
        '<button type="button" class="chat-floating-gift vc-icon-glass" id="vc-chat-floating-gift" aria-label="'+h(t('chat_gift','Подарок'))+'" title="'+h(t('chat_gift','Подарок'))+'">'+glassIcon('gift')+'</button>' +
        '<button type="button" class="icon-btn vc-icon-glass" id="vc-chat-block" aria-label="'+h(t('chat_actions','Действия с чатом'))+'" title="'+h(t('chat_actions','Действия с чатом'))+'">'+glassIcon('more')+'</button>' +
      '</div>' +
      '<div id="vc-chat-context" aria-live="polite" hidden></div>' +
       '<div class="chat-thread" id="vc-chat-thread" role="log" aria-live="polite" aria-relevant="additions"><div class="spin"></div></div>' +
      '<div class="chat-attach-menu" id="vc-chat-attach-menu" role="menu" aria-label="'+h(t('attachments','Вложения'))+'" hidden>'+
        '<button type="button" data-chat-attach="photo" role="menuitem">'+glassIcon('camera')+'<span><strong>'+h(t('photo','Фото'))+'</strong><small>'+h(t('attach_photo_hint','Из галереи или камеры'))+'</small></span></button>'+
      '</div>'+
      
      '<div class="composer chat-composer">' +
        '<button type="button" class="c-add vc-icon-glass" id="vc-c-add" aria-label="'+h(t('attachments','Вложения'))+'" aria-haspopup="menu" aria-expanded="false">'+glassIcon('attach')+'</button>' +
        '<button type="button" class="c-express vc-icon-glass" id="vc-c-express" aria-label="'+h(t('emoji','Emoji'))+' · '+h(t('stickers','Стикеры'))+'" aria-haspopup="dialog">'+glassIcon('sticker')+'</button>' +
        '<div class="chat-compose-field">' +
          '<textarea id="vc-c-input" enterkeyhint="send" aria-describedby="vc-c-kbd-hint" aria-label="'+h(t('chat_msg_ph','Сообщение…'))+'" placeholder="'+h(t('chat_msg_ph','Сообщение…'))+'" rows="1"></textarea>' +
          '<small class="chat-kbd-hint" id="vc-c-kbd-hint">'+h(t('chat_kbd_hint','Enter — отправить · Shift+Enter — новая строка'))+'</small>' +
        '</div>' +
        '<button type="button" class="c-send vc-icon-glass" id="vc-c-send" aria-label="'+h(t('send','Отправить'))+'" disabled>'+glassIcon('send')+'</button>' +
      '</div>' +
      '<input type="file" id="vc-chat-image" accept="image/*,.heic,.heif" hidden>' +
    '</div>';
  var backBtn = document.getElementById('vc-chat-back'); if (backBtn) backBtn.addEventListener('click', function(){ navigate('/chats'); });
  var chatAvatar=document.getElementById('vc-chat-avatar');if(chatAvatar){chatAvatar.setAttribute('aria-label',t('open_profile','Открыть профиль'));bindActivation(chatAvatar,function(){openProfile(peerId);},'button');}
  var input = document.getElementById('vc-c-input'), send = document.getElementById('vc-c-send');
  var floatingGift=document.getElementById('vc-chat-floating-gift');if(floatingGift)floatingGift.addEventListener('click',function(){openGiftPicker(peerId);});
  var savedDraft=readChatDraft(peerId),savedStickerKey=savedDraft?vcStickerKeyFromText(savedDraft.text):'';if(savedDraft&&!savedStickerKey)input.value=savedDraft.text||'';
  var stickerDraftEl=null;
  function renderStickerDraft(key){
    if(stickerDraftEl&&stickerDraftEl.parentNode)stickerDraftEl.parentNode.removeChild(stickerDraftEl);stickerDraftEl=null;
    if(!vcStickerToken(key))return;
    var composer=document.querySelector('.chat-compact-view .chat-composer');if(!composer)return;
    stickerDraftEl=el('div',{class:'chat-sticker-draft'});
    stickerDraftEl.innerHTML='<button type="button" data-sticker-draft-send aria-label="'+h(t('retry','Повторить'))+' — '+h(t('sticker','Стикер'))+'"><img src="'+h(vcStickerAsset(key))+'" alt=""><span><strong>'+h(t('sticker','Стикер'))+'</strong><small>'+h(t('retry','Повторить'))+'</small></span></button><button type="button" data-sticker-draft-clear aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close')+'</button>';
    stickerDraftEl.querySelector('[data-sticker-draft-send]').addEventListener('click',function(){sendSticker(key);});
    stickerDraftEl.querySelector('[data-sticker-draft-clear]').addEventListener('click',function(){clearChatDraft(peerId);renderStickerDraft('');input.focus();});
    composer.appendChild(stickerDraftEl);
  }
  renderStickerDraft(savedStickerKey);
  setupChatScroll();
  function updateSend(){ var v = input.value.trim(); send.disabled = !v; }
  input.addEventListener('input', function(){
    updateSend(); input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    /* Persist the draft while typing so leaving the chat (Tab / back / another route) never loses it.
       Empty or sticker drafts clear the stored copy so no stale text is restored. */
    if (input.value.trim()) saveChatDraft(peerId, input.value); else clearChatDraft(peerId);
    if (state.chatTypingTimer) clearTimeout(state.chatTypingTimer);
    state.chatTypingTimer = setTimeout(function(){
      var now = Date.now();
      if (state.currentChat === peerId && input.value.trim() && now-state.chatLastTypingAt>2500){ state.chatLastTypingAt=now; api('client_typing',{virtual:peerId}).catch(function(){}); }
    }, 350);
  });
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); doSend(); } });
  send.addEventListener('click', doSend);
  updateSend();if(savedDraft)requestAnimationFrame(function(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px';});
  function appendPendingText(text){
    var thread=document.getElementById('vc-chat-thread');if(!thread)return null;
    var empty=thread.querySelector('.chat-empty');if(empty&&empty.parentNode)empty.parentNode.removeChild(empty);
    appendMessage({me:true,text:text,ts:Math.floor(Date.now()/1000),seen:false},thread);
    var wrap=thread.lastElementChild;if(!wrap)return null;wrap.classList.add('is-pending');var delivery=wrap.querySelector('.bub-delivery');if(delivery){delivery.textContent='◷';delivery.className='bub-delivery is-pending';delivery.setAttribute('aria-label',t('message_sending','Отправляется'));}scrollChatToBottom(true);return wrap;
  }
  function failPendingText(wrap,text,retryFn){
    if(!wrap)return;wrap.classList.remove('is-pending');wrap.classList.add('is-failed');var delivery=wrap.querySelector('.bub-delivery');if(delivery){delivery.textContent='!';delivery.className='bub-delivery is-failed';delivery.setAttribute('aria-label',t('message_failed','Не отправлено'));}
    var footer=wrap.querySelector('.bub-footer')||wrap,retry=el('button',{class:'bub-retry',type:'button'},t('retry','Повторить'));retry.addEventListener('click',function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);if(typeof retryFn==='function'){retryFn();return;}input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();});footer.appendChild(retry);
  }
  function completePendingText(pending,r){
    if(pending){pending.classList.remove('is-pending');if(r.msg_id)pending.dataset.msgId=String(r.msg_id);var delivery=pending.querySelector('.bub-delivery');if(delivery){delivery.textContent='✓';delivery.className='bub-delivery is-sent';delivery.setAttribute('aria-label',t('message_sent','Сообщение отправлено'));}}vcMarkFirstMessage();
    clearChatDraft(peerId);renderStickerDraft('');syncFreeOpener(r);updateSend();scrollChatToBottom(true);refreshLiveStateSoon(200);pollChat();
  }
  function doSend(existingRequestId){
    var text = input.value.trim(); if (!text || state.chatSending) return;
    var requestId=typeof existingRequestId==='string'&&existingRequestId?existingRequestId:vcClientRequestId('msg');
    state.chatSending = true; send.disabled = true;
    var destruct=0;
    input.value='';input.style.height='auto';var pending=appendPendingText(text);
    api('send', {virtual: peerId, text: text, self_destruct_sec:destruct,request_id:requestId}).then(function(r){
      state.chatSending = false;
      if (r && r.ok){
        completePendingText(pending,r);
      } else if(r&&(r.err==='low_balance'||r.err==='insufficient'||r.err==='insufficient_balance')){if(pending&&pending.parentNode)pending.parentNode.removeChild(pending);saveChatDraft(peerId,text,destruct);input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));openChatContinuePaywall(peerId,text,destruct,requestId);}
      else { failPendingText(pending,text,function(){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));doSend(requestId);});handleApiError(r, t('send_failed','Не удалось отправить')); updateSend(); }
    }).catch(function(){ state.chatSending = false;failPendingText(pending,text,function(){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));doSend(requestId);});toast(t('network_error','Ошибка сети'), 'error'); updateSend(); });
  }
  function sendSticker(key,existingRequestId){
    var text=vcStickerToken(key);if(!text||state.chatSending)return;
    var requestId=typeof existingRequestId==='string'&&existingRequestId?existingRequestId:vcClientRequestId('sticker');
    renderStickerDraft('');state.chatSending=true;send.disabled=true;var pending=appendPendingText(text);
    api('send',{virtual:peerId,text:text,self_destruct_sec:0,request_id:requestId}).then(function(r){
      state.chatSending=false;
      if(r&&r.ok){completePendingText(pending,r);}
      else if(r&&(r.err==='low_balance'||r.err==='insufficient'||r.err==='insufficient_balance')){if(pending&&pending.parentNode)pending.parentNode.removeChild(pending);saveChatDraft(peerId,text,0);renderStickerDraft(key);openChatContinuePaywall(peerId,text,0,requestId);updateSend();}
      else if(r&&r.err==='sticker_pack_locked'){failPendingText(pending,text);if(state.stickerPackAccess)state.stickerPackAccess.legend=false;toast(t('sticker_pack_locked_item','Откройте premium-набор, чтобы отправить этот стикер'),'error');openStickerPicker(peerId,sendSticker);updateSend();}
      else{failPendingText(pending,text,function(){sendSticker(key,requestId);});handleApiError(r,t('send_failed','Не удалось отправить'));updateSend();}
    }).catch(function(){state.chatSending=false;failPendingText(pending,text,function(){sendSticker(key,requestId);});toast(t('network_error','Ошибка сети'),'error');updateSend();});
  }
  var imageInput = document.getElementById('vc-chat-image');
  var addBtn=document.getElementById('vc-c-add'),expressBtn=document.getElementById('vc-c-express'),attachMenu=document.getElementById('vc-chat-attach-menu');
  function setAttachMenu(open){attachMenu.hidden=!open;addBtn.setAttribute('aria-expanded',open?'true':'false');addBtn.classList.toggle('is-open',open);}
  addBtn.addEventListener('click',function(e){e.stopPropagation();var attachItems=$$('[data-chat-attach]',attachMenu);if(attachItems.length===1){setAttachMenu(false);attachItems[0].click();return;}var open=attachMenu.hidden;setAttachMenu(open);if(open)setTimeout(function(){document.addEventListener('click',function(){setAttachMenu(false);},{once:true});},0);});
  $$('[data-chat-attach]',attachMenu).forEach(function(btn){btn.addEventListener('click',function(){setAttachMenu(false);if(btn.dataset.chatAttach==='photo')imageInput.click();});});
  if(expressBtn)expressBtn.addEventListener('click',function(){setAttachMenu(false);openChatExpressionPicker(peerId,input,expressBtn,sendSticker,'emoji');});
  imageInput.addEventListener('change', function(){
    var file=imageInput.files&&imageInput.files[0]; imageInput.value='';
    if (!file) return;
    if (!isImageFileCandidate(file)){ toast(t('bad_type','Неподдерживаемый формат'), 'error'); return; }
    var destruct=0;
    imageFileToDataUrl(file,8*1024*1024,2048).then(function(data){ return sendChatMedia(peerId,{img:data,text:input.value.trim(),self_destruct_sec:destruct},function(){ input.value=''; updateSend(); }); }).catch(function(e){ toast(e.message==='too_big'?t('photo_too_big','\u0424\u043e\u0442\u043e \u0431\u043e\u043b\u044c\u0448\u0435 8 \u041c\u0411'):(e.message==='heic_unsupported'?t('heic_unsupported','Это HEIC-фото не поддерживается этой версией iOS. Выберите фото из медиатеки или обновите Safari.'):t('read_failed','Не удалось прочитать файл')),'error'); });
  });
  document.getElementById('vc-chat-block').addEventListener('click',function(){openChatActions(peerId,info);});
  api('thread', {virtual: peerId, limit: 50, mark_seen:chatCanMarkSeen()?1:0}).then(function(r){
    var thread = document.getElementById('vc-chat-thread');
    if (!thread) return;
    if (r && r.ok && r.messages){
      applyChatMeta(r);
      thread.innerHTML = '';
      var lastDate = '';
      for (var i=0;i<r.messages.length;i++){
        var m = r.messages[i];
        var d = new Date((m.ts||0)*1000);
        var dStr = d.toDateString();
        if (dStr !== lastDate){ lastDate = dStr; thread.appendChild(dateSep(d)); }
        appendMessage(m, thread);
        if (m.id && m.id > state.chatLastMsgId) state.chatLastMsgId = m.id;
      }
      if (!r.messages.length)thread.innerHTML=chatEmptyStateHtml(r);
      markChatLocallyRead(peerId);
      scrollChatToBottom(true);
    } else renderLoadError(thread,localizedErrorText(r&&r.err,t('network_error','Ошибка сети')),function(){reloadChatThread(peerId);});
  }).catch(function(){ var thread = document.getElementById('vc-chat-thread'); if (thread) renderLoadError(thread,t('network_error','Ошибка сети'),function(){reloadChatThread(peerId);}); })
    .then(function(){ if (state.currentChat === peerId) startChatPoll(); });
}
function openChatActions(peerId,fallback){
  var p=(state.chatMeta&&state.chatMeta.partner)||fallback||{};
  var html='<div class="vc-chat-action-menu"><button type="button" data-chat-menu="watch"><span>'+glassIcon('bell')+'</span><div><strong>'+h(t('online_watch_on','Сообщить, когда онлайн'))+'</strong><small>'+h(t('online_watch_hint','Получите одно уведомление о появлении'))+'</small></div></button><button type="button" data-chat-menu="report"><span>'+glassIcon('report')+'</span><div><strong>'+h(t('report','Пожаловаться'))+'</strong><small>'+h(t('report_safe','Жалоба попадёт в поддержку'))+'</small></div></button></div>';
  vcModal({title:t('chat_actions','Действия с чатом'),icon:'more',tone:'sheet',html:html,cancelText:false,confirmText:t('close','Закрыть'),onReady:function(card,close){
    var watch=card.querySelector('[data-chat-menu="watch"]');if(watch)watch.addEventListener('click',function(){setBusy(watch,true);api('online_watch_toggle',{virtual:peerId}).then(function(r){setBusy(watch,false);if(r&&r.ok){close(false);toast(r.armed?t('online_watch_enabled','Уведомление включено'):t('online_watch_disabled','Уведомление выключено'),'success');}else handleApiError(r,'Error');}).catch(function(){setBusy(watch,false);toast(t('network_error','Ошибка сети'),'error');});});
    var report=card.querySelector('[data-chat-menu="report"]');if(report)report.addEventListener('click',function(){close(false);openProfileReport({id:peerId,name:p.name||''});});
  }});
}
function isChatNearBottom(thread,threshold){
  if(!thread)return true;return thread.scrollHeight-thread.scrollTop-thread.clientHeight<=(threshold||72);
}
function updateChatDownButton(forceShow){
  var thread=document.getElementById('vc-chat-thread'),btn=document.getElementById('vc-chat-down');if(!thread||!btn)return;
  var atBottom=isChatNearBottom(thread);if(atBottom){state.chatAutoScroll=true;state.chatNewBelow=0;}
  btn.hidden=atBottom&&!forceShow;
  var label=btn.querySelector('small');if(label)label.textContent=state.chatNewBelow?(state.chatNewBelow+' '+t('new_messages_short','нов.')):'';
}
function scrollChatToBottom(force,behavior){
  var thread=document.getElementById('vc-chat-thread');if(!thread)return;
  if(!force&&!state.chatAutoScroll)return;
  state.chatAutoScroll=true;state.chatNewBelow=0;
  requestAnimationFrame(function(){if(!document.documentElement.contains(thread))return;try{thread.scrollTo({top:thread.scrollHeight,behavior:behavior||'auto'});}catch(e){thread.scrollTop=thread.scrollHeight;}updateChatDownButton(false);});
  if(force)setTimeout(function(){if(document.documentElement.contains(thread)&&state.chatAutoScroll){thread.scrollTop=thread.scrollHeight;updateChatDownButton(false);}},90);
}
function setupChatScroll(){
  var thread=document.getElementById('vc-chat-thread'),btn=document.getElementById('vc-chat-down'),composer=document.querySelector('.chat-compact-view .composer'),view=document.querySelector('.chat-compact-view');if(!thread)return;
  thread.addEventListener('scroll',function(){state.chatAutoScroll=isChatNearBottom(thread);if(state.chatAutoScroll)state.chatNewBelow=0;updateChatDownButton(false);},{passive:true});
  if(btn)btn.addEventListener('click',function(){scrollChatToBottom(true,'smooth');});
  if(window.ResizeObserver&&composer&&view){var ro=new ResizeObserver(function(){view.style.setProperty('--chat-composer-height',Math.ceil(composer.getBoundingClientRect().height)+'px');if(state.chatAutoScroll)scrollChatToBottom(true);});ro.observe(composer);view._composerObserver=ro;}
}
function updateChatPartner(partner, presence){
  if (!partner) return;
  var nameEl = document.getElementById('vc-chat-name');
  if (nameEl) nameEl.textContent = localizedPersonName(partner.name || partner.fullname || 'User');
  var infoEl=nameEl&&nameEl.parentNode;if(infoEl){var oldTrust=infoEl.querySelector('.vc-profile-trust-badge');if(oldTrust)oldTrust.remove();var trustHtml=profileTrustHtml(partner.trust,false);if(trustHtml)infoEl.insertAdjacentHTML('beforeend',trustHtml);}
  var presEl = document.getElementById('vc-chat-presence');
  var online = presence && (presence.online === true || parseInt(presence.online,10) === 1);
  var typing = presence && (presence.typing === true || parseInt(presence.typing,10) === 1);
  var presenceInfo=presence||{};presenceInfo.online=online?1:0;
  if (presEl){presEl.textContent = typing ? t('typing','печатает...') : chatPresenceText(presenceInfo);presEl.classList.toggle('is-online',online||typing);}
  var avEl = document.getElementById('vc-chat-avatar');
  if (avEl){
    var photo = partner.photo || partner.avatar || '';
    avEl.innerHTML = photo ? '<img'+vcThumbSrc(photo)+' alt="">' : h(initials(localizedPersonName(partner.name||partner.fullname||'?')));
    avEl.style.background = photo ? '' : avatarBg(partner.name||partner.fullname||'?');
    if (online) avEl.appendChild(el('span', {class:'dot'}));
  }
}
function applyChatMeta(r){
  if (!r || !r.ok) return;
  state.chatMeta = r;
  if (r.partner) updateChatPartner(r.partner,r.presence);
  if (state.me && r.balance != null) state.me.balance = r.balance;
  markChatLocallyRead(state.currentChat);
  refreshEconomyDisplay();
  renderChatCompactContext(r);
}
function chatPill(text,color,iconName){return '<span class="vc-chat-status-pill" style="background:'+color+'">'+(iconName?semanticGlassIcon(iconName,'vc-chat-status-icon'):'')+'<span>'+h(text)+'</span></span>';}
function renderChatContext(meta){
  var box=document.getElementById('vc-chat-context'); if(!box||!meta)return;
  var parts=[];
  var streak=meta.streak||{}, flirt=meta.flirt||{}, partner=meta.partner||{};
  
  
  if(partner.reply_time&&partner.reply_time.label)parts.push(chatPill(partner.reply_time.label,'rgba(69,141,255,.24)','timer'));
  if(meta.attention&&meta.attention.active)parts.push(chatPill(t('attention_now','Сейчас ей активно пишут')+' · '+(meta.attention.rivals||0),'rgba(255,95,100,.24)','activity'));
  var flirtLevel=Math.max(0,Math.min(100,parseInt(flirt.level,10)||0)),chatView=document.querySelector('.chat-view');
  if(chatView){chatView.style.setProperty('--flirt-level',flirtLevel);chatView.classList.toggle('flirt-warm',flirtLevel>=30);chatView.classList.toggle('flirt-hot',flirtLevel>=80);}
  if(flirtLevel>0) parts.push('<div class="chat-flirt-scale" title="'+h(t('flirt_scale','Шкала флирта'))+'"><span>'+h(t('flirt','Флирт'))+'</span><i><em style="width:'+flirtLevel+'%"></em></i><b>'+flirtLevel+'%</b></div>');
  var ownProfile=(state.me&&state.me.profile)||state.profile||{};
  if(VC_DESIRE_UI_ENABLED&&parseInt(ownProfile.sex||ownProfile.gender,10)!==2) parts.push('<button data-ca="offer_create" style="padding:6px 9px;border:0;border-radius:9px;background:rgba(69,141,255,.16);color:#8db8ff;cursor:pointer">'+h(t('offer_create','Предложить действие'))+'</button>');
  var offers=meta.offers||[];
  for(var i=0;i<offers.length&&i<2;i++){
    var of=offers[i], amount=of.final_amount!=null?of.final_amount:(of.counter_amount!=null?of.counter_amount:of.amount);
    var actions='';
    if(of.is_sender){
      if(of.status==='pending'||of.status==='countered')actions+='<button data-offer-action="cancel" data-offer-id="'+h(of.id)+'">'+h(t('cancel','Отменить'))+'</button>';
      if(of.status==='countered')actions+='<button data-offer-action="accept_counter" data-offer-id="'+h(of.id)+'">'+h(t('accept','Принять'))+'</button><button data-offer-action="refuse_counter" data-offer-id="'+h(of.id)+'">'+h(t('decline','Отклонить'))+'</button>';
      if(of.status==='accepted')actions+='<button data-offer-action="complete" data-offer-id="'+h(of.id)+'">'+h(t('offer_complete','Выполнено'))+'</button>';
      if((of.status==='accepted'||of.status==='completed')&&!of.dispute)actions+='<button data-offer-action="dispute" data-offer-id="'+h(of.id)+'">'+h(t('offer_dispute','Спор'))+'</button>';
    }else if(of.status==='pending'){
      actions+='<button data-offer-action="accept" data-offer-id="'+h(of.id)+'">'+h(t('accept','Принять'))+'</button><button data-offer-action="reject" data-offer-id="'+h(of.id)+'">'+h(t('decline','Отклонить'))+'</button><button data-offer-action="counter" data-offer-id="'+h(of.id)+'">'+h(t('counter_offer','Контроффер'))+'</button>';
    }
    parts.push('<span style="padding:7px 9px;border-radius:11px;background:rgba(69,141,255,.24);font-size:11px;color:#fff">'+h(of.description)+' · '+vibeAmount(amount)+' · '+h(of.status)+(of.counter_comment?' · '+h(of.counter_comment):'')+(actions?'<span style="display:flex;gap:5px;margin-top:6px">'+actions+'</span>':'')+'</span>');
  }
  box.innerHTML=parts.join(''); box.style.display=parts.length?'flex':'none';
  $$('[data-ca]',box).forEach(function(btn){ btn.addEventListener('click',function(){ chatContextAction(btn.dataset.ca); }); });
  $$('[data-offer-action]',box).forEach(function(btn){btn.addEventListener('click',function(){chatOfferAction(btn.dataset.offerAction,parseInt(btn.dataset.offerId,10));});});
}
function renderChatCompactContext(meta){
  var box=document.getElementById('vc-chat-context');if(!box||!meta)return;
  var contextSignature=JSON.stringify([meta.offers||[],meta.free_opener||null,meta.chat_access||null]);
  if(box.dataset.contextSignature===contextSignature)return;
  box.dataset.contextSignature=contextSignature;
  var chatView=document.querySelector('.chat-view');
  if(chatView){chatView.style.removeProperty('--flirt-level');chatView.classList.remove('flirt-warm','flirt-hot');}
  var ownProfile=(state.me&&state.me.profile)||state.profile||{},seller=parseInt(ownProfile.sex||ownProfile.gender,10)===2;
  var actions=!seller&&VC_DESIRE_UI_ENABLED?'<button type="button" class="chat-quick-action wish" data-ca="offer_create">'+glassIcon('wish')+'<strong>'+h(t('offer_action','Желание'))+'</strong></button>':'';
  var offers=meta.offers||[],offersHtml='';
  for(var oi=0;oi<offers.length&&oi<2;oi++){
    var of=offers[oi],amount=of.final_amount!=null?of.final_amount:(of.counter_amount!=null?of.counter_amount:of.amount),offerActions='';
    if(of.is_sender){
      if(of.status==='pending'||of.status==='countered')offerActions+='<button data-offer-action="cancel" data-offer-id="'+h(of.id)+'">'+h(t('cancel','Отменить'))+'</button>';
      if(of.status==='countered')offerActions+='<button data-offer-action="accept_counter" data-offer-id="'+h(of.id)+'">'+h(t('accept','Принять'))+'</button><button data-offer-action="refuse_counter" data-offer-id="'+h(of.id)+'">'+h(t('decline','Отклонить'))+'</button>';
      if(of.status==='accepted')offerActions+='<button data-offer-action="complete" data-offer-id="'+h(of.id)+'">'+h(t('offer_complete','Выполнено'))+'</button>';
      if((of.status==='accepted'||of.status==='completed')&&!of.dispute)offerActions+='<button data-offer-action="dispute" data-offer-id="'+h(of.id)+'">'+h(t('offer_dispute','Спор'))+'</button>';
    }else if(of.status==='pending')offerActions+='<button data-offer-action="accept" data-offer-id="'+h(of.id)+'">'+h(t('accept','Принять'))+'</button><button data-offer-action="reject" data-offer-id="'+h(of.id)+'">'+h(t('decline','Отклонить'))+'</button><button data-offer-action="counter" data-offer-id="'+h(of.id)+'">'+h(t('counter_offer','Контроффер'))+'</button>';
    offersHtml+='<div class="chat-compact-offer"><span>'+glassIcon('wish')+'</span><div><strong>'+h(of.description||t('offer_action','Предложение'))+' · '+vibeAmount(amount||0)+'</strong><small>'+h(of.status||'')+(of.counter_comment?' · '+h(of.counter_comment):'')+'</small>'+(offerActions?'<div class="chat-compact-offer-actions">'+offerActions+'</div>':'')+'</div></div>';
  }
  var accessLine='',chatInfo=(meta.chat_access||{});if(chatInfo.enabled){var leftMsgs=Math.max(0,parseInt(chatInfo.pair_remaining,10)||0);if(leftMsgs<=0){accessLine='<button type="button" class="chat-compact-access is-empty" data-access-store><span>'+semanticGlassIcon('wallet','vc-chat-access-icon')+'</span><div><strong>'+h(t('not_enough_vibes','Недостаточно средств на балансе'))+'</strong><small>'+h(t('open_store','Перейти к оплате'))+'</small></div></button>';}}var hasContent=!!(accessLine||actions||offersHtml);box.innerHTML=accessLine+(actions?'<div class="chat-quick-actions">'+actions+'</div>':'')+(offersHtml?'<div class="chat-compact-offers">'+offersHtml+'</div>':'');
  box.hidden=!hasContent;
  $$('[data-ca]',box).forEach(function(btn){btn.addEventListener('click',function(){chatContextAction(btn.dataset.ca);});});
  $$('[data-offer-action]',box).forEach(function(btn){btn.addEventListener('click',function(){chatOfferAction(btn.dataset.offerAction,parseInt(btn.dataset.offerId,10));});});
  var accessStoreBtn=box.querySelector('[data-access-store]');if(accessStoreBtn)accessStoreBtn.addEventListener('click',function(){navigate('/store');});
}
function chatEmptyStateHtml(meta){
  return contextCtaHtml({tone:'purple',compact:true,centered:true,className:'chat-empty',icon:'message',title:t('chat_empty_title','Начните разговор'),copy:t('chat_empty_copy','Напишите сообщение, чтобы начать разговор.')});
}
async function chatContextAction(action){
  var meta=state.chatMeta||{}, peer=state.currentChat; if(!peer)return;
  if(action==='offer_create'&&VC_DESIRE_UI_ENABLED){ openOfferComposer(peer,(meta.partner&&meta.partner.name)||'');return; }
}
async function chatOfferAction(action,id){
  if(!id||!state.currentChat)return;
  var apiAction='',data={offer_id:id};
  if(action==='accept'||action==='reject'){apiAction='offer_respond';data.accept=action==='accept'?1:0;}
  else if(action==='complete')apiAction='offer_complete';
  else if(action==='cancel')apiAction='offer_cancel';
  else if(action==='accept_counter')apiAction='offer_accept_counter';
  else if(action==='refuse_counter')apiAction='offer_refuse_counter';
  else if(action==='dispute')apiAction='offer_dispute';
  else if(action==='counter'){var values=await vcModal({title:t('counter_offer','Контроффер'),icon:'↔',message:t('counter_offer_copy','Предложите другую сумму и поясните условия.'),fields:[{name:'amount',type:'number',label:t('offer_amount','Сумма, €'),value:'1.00',min:.1,max:200,step:.1,required:true},{name:'comment',type:'textarea',label:t('counter_comment','Комментарий к контрофферу'),maxlength:500,required:true}],confirmText:t('send_offer','Отправить')});if(!values)return;var amount=unitsFromEuroInput(values.amount);if(amount<5)return;apiAction='offer_counter';data.amount=amount;data.comment=String(values.comment||'');}
  else return;
  var actionLabels={accept:t('accept_offer','Принять предложение'),reject:t('reject_offer','Отклонить предложение'),complete:t('offer_complete','Подтвердить выполнение'),cancel:t('cancel_offer','Отменить предложение'),accept_counter:t('accept_counter','Принять контроффер'),refuse_counter:t('refuse_counter','Отклонить контроффер'),dispute:t('offer_dispute','Открыть спор')};
  if(action!=='counter'&&!await vcConfirm(t('confirm_action','Подтвердить действие?'),{title:actionLabels[action]||t('offer_action','Действие с предложением'),tone:(action==='reject'||action==='cancel'||action==='dispute')?'danger':'',icon:action==='dispute'?'report':'wish',confirmText:actionLabels[action]||t('confirm','Подтвердить')}))return;
  api(apiAction,data).then(function(r){if(r&&r.ok){toast(t('done','Готово'),'success');if(state.me&&r.balance!=null)state.me.balance=r.balance;renderTopbar();reloadChatThread(state.currentChat);}else handleApiError(r,'Error');}).catch(function(){toast(t('network_error','Ошибка сети'),'error');});
}
function renderChatMessages(messages){
  var thread=document.getElementById('vc-chat-thread'); if(!thread)return;
  thread.innerHTML=''; state.chatLastMsgId=0;
  if(!messages||!messages.length){thread.innerHTML=chatEmptyStateHtml(state.chatMeta||{});return;}
  var lastDate='';
  for(var i=0;i<messages.length;i++){
    var m=messages[i], d=new Date((m.ts||0)*1000), ds=d.toDateString();
    if(ds!==lastDate){lastDate=ds;thread.appendChild(dateSep(d));}
    appendMessage(m,thread);
  }
  scrollChatToBottom(true);
}
function reloadChatThread(peerId){
  peerId=peerId||state.currentChat; if(!peerId)return Promise.resolve(null);
  return api('thread',{virtual:peerId,limit:60,mark_seen:chatCanMarkSeen()?1:0}).then(function(r){
    if(state.currentChat!==peerId)return r;
    if(r&&r.ok){applyChatMeta(r);renderChatMessages(r.messages||[]);} else handleApiError(r,'Error');
    return r;
  }).catch(function(){toast(t('network_error','Ошибка сети'),'error');return null;});
}
function vcMarkFirstMessage(){try{if(!localStorage.getItem('vc_first_msg_at')){localStorage.setItem('vc_first_msg_at',String(Date.now()));setTimeout(vcOfferPush,1500);}}catch(e){}}
async function vcOfferPush(){
  try{
    if(!state.pushSupported||!('Notification' in window)||Notification.permission!=='default'||state.pushSub||localStorage.getItem('vc_push_offer'))return;
    localStorage.setItem('vc_push_offer',String(Date.now()));
    var ok=await vcConfirm(t('push_offer_text','Включите уведомления, чтобы узнавать об ответах, даже когда приложение закрыто.'),{title:t('push_offer_title','Не пропустите ответ'),icon:'bell',confirmText:t('push_offer_yes','Включить'),cancelText:t('push_offer_no','Не сейчас')});
    if(ok)enablePush('after_first_message');
  }catch(e){}
}
function sendChatMedia(peerId,payload,onSuccess){
  if(state.chatSending)return Promise.resolve(null);
  state.chatSending=true;payload=payload||{};if(!payload.request_id)payload.request_id=vcClientRequestId('media');
  var thread=document.getElementById('vc-chat-thread'),pending=null;
  if(thread){appendMessage({me:true,text:payload.text||'',img:payload.img||'',audio:payload.audio||'',type:payload.audio?2:1,ts:Math.floor(Date.now()/1000),seen:false},thread);pending=thread.lastElementChild;if(pending){pending.classList.add('is-pending');var pd=pending.querySelector('.bub-delivery');if(pd){pd.textContent='◷';pd.className='bub-delivery is-pending';pd.setAttribute('aria-label',t('message_sending','Отправляется'));}scrollChatToBottom(true);}}
  function failMedia(){if(!pending)return;pending.classList.remove('is-pending');pending.classList.add('is-failed');var pd=pending.querySelector('.bub-delivery');if(pd){pd.textContent='!';pd.className='bub-delivery is-failed';pd.setAttribute('aria-label',t('message_failed','Не отправлено'));}var retry=el('button',{class:'bub-retry',type:'button'},t('retry','Повторить'));retry.addEventListener('click',function(){if(pending.parentNode)pending.parentNode.removeChild(pending);sendChatMedia(peerId,payload,onSuccess);});(pending.querySelector('.bub-footer')||pending).appendChild(retry);}
  return api('send',Object.assign({virtual:peerId},payload||{})).then(function(r){
    state.chatSending=false;
    if(r&&r.ok){if(pending){pending.classList.remove('is-pending');if(r.msg_id)pending.dataset.msgId=String(r.msg_id);var pd=pending.querySelector('.bub-delivery');if(pd){pd.textContent='✓';pd.className='bub-delivery is-sent';pd.setAttribute('aria-label',t('message_sent','Отправлено'));}}if(typeof onSuccess==='function')onSuccess(r);if(state.me&&r.balance!=null)state.me.balance=r.balance;vcMarkFirstMessage();pollChat();}
    else{failMedia();handleApiError(r,'Send failed');}
    return r;
  }).catch(function(){state.chatSending=false;failMedia();toast(t('network_error','Ошибка сети'),'error');return null;});
}
function openChatExpressionPicker(peerId,input,trigger,onSticker,mode,panelRect){
  if(mode==='sticker'){openStickerPicker(peerId,onSticker,{target:input,trigger:trigger,panelRect:panelRect});return;}
  if(!window.VCEmojiPicker){openStickerPicker(peerId,onSticker,{target:input,trigger:trigger,panelRect:panelRect});return;}
  window.VCEmojiPicker.open({target:input,trigger:trigger,focusTarget:input,panelRect:panelRect,title:t('emoji','Emoji'),stickersLabel:t('stickers','Стикеры'),emojiIconHtml:glassIcon('ideas'),stickerIconHtml:glassIcon('sticker'),onOpenStickers:function(nextRect){openChatExpressionPicker(peerId,input,trigger,onSticker,'sticker',nextRect);}});
}
function openStickerPicker(peerId,onSelect,expressionOptions){
  expressionOptions=expressionOptions||{};
  var expressionTarget=expressionOptions.target||document.getElementById('vc-c-input'),expressionTrigger=expressionOptions.trigger||document.getElementById('vc-c-express'),panelRect=expressionOptions.panelRect||null;
  var packs=vcStickerPacksForUser(),pack=vcDefaultStickerPack(),title=t('choose_sticker','Выберите стикер'),tabs='';
  packs.forEach(function(packKey){var meta=VC_STICKER_PACK_META[packKey],classes=[];if(meta.accent)classes.push('is-flirt');if(meta.premium)classes.push('is-premium');tabs+='<button type="button"'+(classes.length?' class="'+classes.join(' ')+'"':'')+' role="tab" data-sticker-pack="'+h(packKey)+'"><img class="vc-sticker-pack-preview" src="'+h(vcStickerAsset(meta.preview))+'" alt="" aria-hidden="true">'+(meta.premium?'<span class="vc-sticker-tab-lock" aria-hidden="true">♛</span>':'')+'<span>'+h(vcStickerPackLabel(packKey))+'</span></button>';});
  var ov=el('div',{class:'vc-sticker-layer',role:'dialog','aria-modal':'true','aria-labelledby':'vc-sticker-title'});
  ov.innerHTML='<section class="vc-sticker-picker" role="document">'+
    '<div class="vc-sticker-head"><div><span>'+glassIcon('sticker')+'</span><div><strong id="vc-sticker-title">'+h(title)+'</strong><small>'+h(t('stickers_for_profile','Наборы подобраны для вашего профиля'))+'</small></div></div><button type="button" class="vc-icon-glass" data-sticker-close aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close')+'</button></div>'+
    '<div class="vc-expression-switch" role="tablist" aria-label="'+h(t('emoji','Emoji'))+' · '+h(t('stickers','Стикеры'))+'"><button type="button" role="tab" data-expression-emoji aria-selected="false">'+glassIcon('smile')+'<span>'+h(t('emoji','Emoji'))+'</span></button><button type="button" role="tab" class="is-active" aria-selected="true">'+glassIcon('sticker')+'<span>'+h(t('stickers','Стикеры'))+'</span></button></div>'+
    '<div class="vc-sticker-tabs" role="tablist" aria-label="'+h(t('sticker_pack','Набор стикеров'))+'">'+tabs+'</div><div class="vc-sticker-premium-banner" id="vc-sticker-premium-banner" hidden></div><div class="vc-sticker-grid" id="vc-sticker-grid" role="list"></div></section>';
  document.body.appendChild(ov);var pickerPanel=ov.querySelector('.vc-sticker-picker');if(panelRect&&pickerPanel){ov.classList.add('is-chat-expression');pickerPanel.style.left=Math.round(panelRect.left)+'px';pickerPanel.style.top=Math.round(panelRect.top)+'px';pickerPanel.style.width=Math.round(panelRect.width)+'px';pickerPanel.style.height=Math.round(panelRect.height)+'px';pickerPanel.setAttribute('data-placement',panelRect.placement||'above');}setupDialogA11y(ov);
  function close(){document.removeEventListener('keydown',onKey);if(state.stickerPickerClose===close)state.stickerPickerClose=null;if(ov.parentNode)ov.parentNode.removeChild(ov);}
  if(state.stickerPickerClose)state.stickerPickerClose();state.stickerPickerClose=close;
  function onKey(e){if(e.key==='Escape')close();}
  async function unlockStickerPack(){
    var meta=VC_STICKER_PACK_META[pack]||{},price=parseInt(meta.price,10)||99;
    var ok=await vcPurchase({title:t('sticker_pack_unlock','Открыть premium-набор'),icon:'♛',price:price,html:'<p>'+h(t('sticker_pack_unlock_copy','Один раз откройте набор из 9 премиальных стикеров для общения.'))+'</p><p class="vc-sticker-price-note">'+h(t('sticker_pack_one_time','Одноразовая покупка'))+' · ≈ $'+(meta.priceUsd||1.99).toFixed(2)+'</p>',confirmText:t('buy','Купить'),resume:{action:'sticker_pack_buy',data:{pack:pack,expected_price:price},route:state.route||('/chat/'+peerId),title:t('sticker_pack_unlocked','Премиум-набор открыт')}});
    if(!ok)return;
    var r=await api('sticker_pack_buy',{pack:pack,expected_price:price});
    if(r&&r.ok){if(!state.stickerPackAccess)state.stickerPackAccess={};state.stickerPackAccess[pack]=true;if(state.me&&r.balance!=null)state.me.balance=r.balance;renderTopbar();render();await vcNotice(t('sticker_pack_unlocked','Премиум-набор открыт'),t('sticker_pack_unlocked_copy','Теперь все стикеры из набора доступны в чате.'),'success');}
    else handleApiError(r,'Error');
  }
  function render(){
    var meta=VC_STICKER_PACK_META[pack]||{},locked=!!meta.premium&&!vcStickerPackUnlocked(pack),banner=ov.querySelector('#vc-sticker-premium-banner');
    $$('[data-sticker-pack]',ov).forEach(function(btn){var active=btn.dataset.stickerPack===pack,buttonMeta=VC_STICKER_PACK_META[btn.dataset.stickerPack]||{};btn.classList.toggle('is-active',active);btn.setAttribute('aria-selected',active?'true':'false');btn.tabIndex=active?0:-1;btn.setAttribute('aria-label',vcStickerPackLabel(btn.dataset.stickerPack)+(buttonMeta.premium?' · '+t('sticker_pack_premium','Премиум'):''));});
    if(banner){banner.hidden=!locked;banner.innerHTML=locked?'<div><strong>♛ '+h(t('sticker_pack_premium','Премиум'))+'</strong><small>'+h(t('sticker_pack_unlock_copy','Один раз откройте набор из 9 премиальных стикеров для общения.'))+'</small></div><button type="button" data-sticker-unlock>'+h(t('sticker_pack_unlock','Открыть набор'))+' · '+vibeAmount(meta.price||99)+'</button>':'';if(locked){var buy=banner.querySelector('[data-sticker-unlock]');if(buy)buy.addEventListener('click',function(){unlockStickerPack();});}}
    var grid=ov.querySelector('#vc-sticker-grid');grid.innerHTML='';
    (VC_STICKER_PACKS[pack]||[]).forEach(function(mood,index){
      var key=pack+'-'+mood,btn=el('button',{type:'button',class:'vc-sticker-option'+(locked?' is-locked':''),'data-sticker':key,role:'listitem','aria-label':locked?t('sticker_pack_locked_item','Откройте premium-набор, чтобы отправить этот стикер'):vcStickerAlt(key)});
      if(locked){btn.disabled=true;btn.setAttribute('aria-disabled','true');}
      btn.innerHTML='<img src="'+h(vcStickerAsset(key))+'" alt="" aria-hidden="true" loading="eager" decoding="async">';
      if(!locked)btn.addEventListener('click',function(){close();if(typeof onSelect==='function')onSelect(key);});grid.appendChild(btn);
    });
  }
  ov.querySelector('[data-sticker-close]').addEventListener('click',close);
  var emojiTab=ov.querySelector('[data-expression-emoji]');if(emojiTab)emojiTab.addEventListener('click',function(){var rect=pickerPanel&&pickerPanel.getBoundingClientRect(),nextRect=rect?{left:rect.left,top:rect.top,width:rect.width,height:rect.height,placement:pickerPanel.getAttribute('data-placement')||'above'}:null;close();openChatExpressionPicker(peerId,expressionTarget,expressionTrigger,onSelect,'emoji',nextRect);});
  ov.addEventListener('click',function(e){if(e.target===ov)close();});
  $$('[data-sticker-pack]',ov).forEach(function(btn){btn.addEventListener('click',function(){pack=btn.dataset.stickerPack;try{localStorage.setItem('vc_sticker_pack',pack);}catch(e){}render();});});
  document.addEventListener('keydown',onKey);render();
  if(packs.indexOf('legend')>=0)vcRefreshStickerPackState('legend').then(function(){if(ov.parentNode)render();});
  requestAnimationFrame(function(){var active=ov.querySelector('[data-sticker-pack].is-active');if(active)active.focus();});
}
function openGiftPicker(peerId){
  var giftTitle=t('chat_gift','Подарок'),giftList=null,giftSession='gift_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),giftActiveMs=0,giftTickAt=Date.now(),giftEngagedSent=false,giftCheckoutSent=false,giftCompleted=false,giftEndSent=false,giftTimer=null,ov=el('div',{class:'lightbox','aria-label':giftTitle,style:'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px'});
  ov.innerHTML='<div class="vc-gift-picker"><div class="vc-gift-picker-head"><strong>'+glassIcon('gift')+'<span>'+h(giftTitle)+'</span></strong><button class="vc-icon-glass" data-close aria-label="'+h(t('close','Закрыть'))+'">'+semanticGlassIcon('close')+'</button></div><p class="vc-gift-picker-copy">'+h(t('gift_picker_copy','Выберите знак внимания. Личное сообщение сделает подарок особенным.'))+'</p><input id="vc-gift-msg" maxlength="500" placeholder="'+h(t('gift_message','Сообщение к подарку'))+'"><label class="vc-gift-anon"><span class="vc-gift-anon-copy"><span class="vc-gift-anon-visual">'+semanticGlassIcon('lock','vc-gift-anon-icon')+'</span><span><strong>'+h(t('gift_anonymous','Анонимно'))+'</strong><small id="vc-gift-anon-hint">'+h(t('gift_anonymous_hint','Получатель не увидит ваше имя'))+'</small></span></span><input type="checkbox" id="vc-gift-anon" aria-describedby="vc-gift-anon-hint"><span class="vc-gift-anon-switch" aria-hidden="true"><i></i></span></label><div id="vc-gift-grid"><div class="spin"></div></div></div>';
  document.body.appendChild(ov);
  function giftIntentContext(extra){var out={profile_id:peerId,gift_session:giftSession,surface:'gift_picker'};Object.keys(extra||{}).forEach(function(key){out[key]=extra[key];});return out;}
  function stopGiftTimer(){if(giftTimer){clearInterval(giftTimer);giftTimer=null;}}
  function markGiftCheckout(gift){
    if(giftCheckoutSent)return;giftCheckoutSent=true;stopGiftTimer();
    funnelTrack('gift_checkout_started',giftIntentContext({gift_id:parseInt(gift.id,10)||0,gift_cost:parseInt(gift.cost,10)||0,active_seconds:Math.floor(giftActiveMs/1000)}),giftSession);
  }
  function finishGiftIntent(outcome){
    if(giftEndSent)return;giftEndSent=true;
    funnelTrack('gift_picker_closed',giftIntentContext({outcome:String(outcome||'closed'),stage:giftCheckoutSent?'checkout':'picker',completed:giftCompleted?1:0,active_seconds:Math.floor(giftActiveMs/1000)}),giftSession);
  }
  function startGiftTimer(){
    if(giftTimer||giftEngagedSent||giftCheckoutSent)return;giftTickAt=Date.now();
    giftTimer=setInterval(function(){
      var now=Date.now(),elapsed=Math.max(0,Math.min(1500,now-giftTickAt));giftTickAt=now;
      if(document.visibilityState==='visible'&&ov.parentNode&&!giftCheckoutSent)giftActiveMs+=elapsed;
      if(!giftEngagedSent&&giftActiveMs>=15000){giftEngagedSent=true;stopGiftTimer();funnelTrack('gift_picker_engaged',giftIntentContext({active_seconds:15}),giftSession);}
    },500);
  }
  function close(outcome){
    stopGiftTimer();finishGiftIntent(typeof outcome==='string'?outcome:(giftCompleted?'sent':(giftCheckoutSent?'checkout_closed':'dismissed')));
    document.removeEventListener('keydown',onGiftKey);window.removeEventListener('hashchange',onGiftRouteExit);window.removeEventListener('pagehide',onGiftPageHide);
    if(ov.parentNode)ov.parentNode.removeChild(ov);
  }
  function onGiftKey(e){if(e.key==='Escape'){e.preventDefault();close('dismissed');}}
  function onGiftRouteExit(){close('route_change');}
  function onGiftPageHide(){close('page_hidden');}
  ov.querySelector('[data-close]').addEventListener('click',function(){close('dismissed');});ov.addEventListener('click',function(e){if(e.target===ov)close('dismissed');});
  document.addEventListener('keydown',onGiftKey);window.addEventListener('hashchange',onGiftRouteExit);window.addEventListener('pagehide',onGiftPageHide);
  function render(gifts){
    giftList=gifts||[];
    var grid=ov.querySelector('#vc-gift-grid');if(!grid)return;
    var shown=giftList;
    if(!shown.length){grid.innerHTML='<span class="muted">'+h(t('no_gifts','Подарки недоступны'))+'</span>';return;}
    var html='';for(var i=0;i<shown.length;i++){var g=shown[i];html+='<button class="vc-gift-item" data-id="'+h(g.id)+'" aria-label="'+vibeAmount(g.cost)+'">'+(g.img?'<img src="'+h(g.img)+'" alt="" loading="lazy" decoding="async">':glassIcon('gift','vc-gift-fallback-icon'))+'<div>'+vibeAmount(g.cost)+'</div></button>';}
    grid.innerHTML=html;startGiftTimer();$$('.vc-gift-item',grid).forEach(function(b){b.addEventListener('click',async function(){
      var giftId=parseInt(b.dataset.id,10),gift=giftList.filter(function(x){return x.id===giftId;})[0];if(!gift)return;
      var giftMessage=ov.querySelector('#vc-gift-msg').value.trim(),giftAnon=ov.querySelector('#vc-gift-anon').checked?1:0,giftData={virtual:peerId,gift:giftId,message:giftMessage,anon:giftAnon,expected_price:parseInt(gift.cost,10)||0,request_id:vcClientRequestId('gift')};var ok=await vcPurchase({title:t('send_gift','Отправить подарок'),icon:'gift',price:gift.cost,html:(gift.img?'<img class="vc-gift-preview" src="'+h(gift.img)+'" alt="">':'')+'<p>'+h(giftMessage||t('gift_without_message','Без сообщения'))+'</p>',confirmText:t('send','Отправить'),onConfirm:function(){markGiftCheckout(gift);},cardIntent:{kind:'gift',gift_id:giftId,virtual_id:peerId},resume:{action:'gift_send',data:giftData,route:'/chat/'+peerId,title:t('gift_sent','Подарок отправлен')}});if(!ok)return;b.disabled=true;
      api('gift_send',giftData).then(function(r){if(r&&r.ok){giftCompleted=true;vcNotice(t('gift_sent','Подарок отправлен'),t('gift_sent_copy','Подарок уже появился в диалоге.'),'success');if(state.me&&r.balance!=null)state.me.balance=r.balance;renderTopbar();close('sent');reloadChatThread(peerId);}else{b.disabled=false;handleApiError(r,'Error');}}).catch(function(){b.disabled=false;toast(t('network_error','Ошибка сети'),'error');});
    });});
  }
  if(state.gifts)render(state.gifts);else api('gifts_list').then(function(r){if(r&&r.ok){state.gifts=r.gifts||[];render(state.gifts);}else{handleApiError(r,'Error');close();}}).catch(function(){toast(t('network_error','Ошибка сети'),'error');close();});
}
function appendMessage(m, container){
  var thread = container || document.getElementById('vc-chat-thread');
  if (!thread) return;
  var empty = thread.querySelector('.chat-empty');
  if (empty && empty.parentNode) empty.parentNode.removeChild(empty);
  var isMe = m.me === true || parseInt(m.me,10) === 1 || m.outgoing || (m.from_id === state.uid) || (m.sender === 'me');
  var stickerKey=(!m.img&&!m.audio&&parseInt(m.type,10)!==4)?vcStickerKeyFromText(m.text||m.body||''):'';
  var bub = el('div', {class: 'bub ' + (isMe ? 'me' : 'them')+(stickerKey?' chat-sticker-bubble':'')});
  if (parseInt(m.type,10) === 4){
    var giftCard = el('div',{class:'chat-gift-card'});
    giftCard.innerHTML = '' +
      (m.img ? '<img src="'+h(m.img)+'" alt="'+h(t('chat_gift','Подарок'))+'" loading="lazy">' : '<span class="chat-gift-fallback" aria-hidden="true">'+glassIcon('gift')+'</span>') +
      '<strong>'+h(t('chat_gift','Подарок'))+'</strong>';
    bub.appendChild(giftCard);
  } else if(stickerKey){
    var sticker=el('img',{src:vcStickerAsset(stickerKey),alt:vcStickerAlt(stickerKey),loading:'lazy',decoding:'async',class:'chat-sticker',draggable:'false'});
    sticker.dataset.stickerKey=stickerKey;bub.appendChild(sticker);
  } else if (m.img){
    var pic = el('img', {src:m.img, alt:t('chat_photo','Фото в чате'), loading:'lazy',class:'chat-photo-open',role:'button',tabindex:'0','aria-label':t('open_photo','Открыть фото')});
    pic.style.cssText = 'display:block;max-width:100%;border-radius:10px;margin-bottom:'+(m.text?'7px':'0');
    pic.addEventListener('click',function(){openMediaViewer([m.img],0,t('chat_photo','Фото в чате'));});pic.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openMediaViewer([m.img],0,t('chat_photo','Фото в чате'));}});
    bub.appendChild(pic);
  }
  if (m.audio){
    var audio = el('audio', {src:m.audio, controls:'controls', preload:'metadata'});
    audio.style.maxWidth = '100%'; bub.appendChild(audio);
  }
  if (m.text&&!stickerKey) bub.appendChild(document.createTextNode(m.text));
  else if (m.body&&!stickerKey) bub.appendChild(document.createTextNode(m.body));
  else if (!m.img && !m.audio && m.attachment) bub.innerHTML = '<div class="attach">'+h(m.attachment.type || 'file')+'</div>';
  var wrap = el('div', {class: 'msg-wrap ' + (isMe ? 'me' : 'them')+(stickerKey?' is-sticker':'')});
  if(m.id)wrap.dataset.msgId=String(m.id);
  if(m.ts)wrap.dataset.ts=String(m.ts);
  if(isMe)wrap.dataset.seen=m.seen?'1':'0';
  wrap.appendChild(bub);
  var footer=el('div',{class:'bub-footer'});
  if (m.ts){
    var ts = el('div', {class: 'bub-ts'});
    ts.textContent = fmtMessageClock(m.ts);
    footer.appendChild(ts);
  }
  if(isMe){var delivery=el('span',{class:'bub-delivery '+(m.seen?'is-seen':'is-sent'),'aria-label':m.seen?t('message_read','Прочитано'):t('message_sent','Отправлено')});delivery.textContent=m.seen?'✓✓':'✓';footer.appendChild(delivery);}
  if(footer.childNodes.length)wrap.appendChild(footer);
  if(m.self_destruct_at){
    wrap.dataset.selfDestructAt=String(m.self_destruct_at);var sd=el('div',{class:'bub-ts self-destruct-countdown'},Math.max(0,m.self_destruct_at-Math.floor(Date.now()/1000))+' '+t('time_sec_short','с')); wrap.appendChild(sd);
  }
  thread.appendChild(wrap);
  var prevWrap=wrap.previousElementSibling;
  if(prevWrap&&prevWrap.classList.contains('msg-wrap')&&prevWrap.classList.contains(isMe?'me':'them')&&wrap.dataset.ts&&prevWrap.dataset.ts&&Math.abs(parseInt(wrap.dataset.ts,10)-parseInt(prevWrap.dataset.ts,10))<=120)prevWrap.classList.add('is-grouped');
  if (m.id && m.id > state.chatLastMsgId) state.chatLastMsgId = m.id;
  var media=wrap.querySelectorAll('img,audio');for(var mi=0;mi<media.length;mi++)media[mi].addEventListener(media[mi].tagName==='IMG'?'load':'loadedmetadata',function(){if(state.chatAutoScroll)scrollChatToBottom(true);});
  scheduleSelfDestructTick();
}
function scheduleSelfDestructTick(){
  if(state.chatSelfDestructTimer)clearTimeout(state.chatSelfDestructTimer);
  var nodes=$$('#vc-chat-thread .msg-wrap[data-self-destruct-at]');if(!nodes.length){state.chatSelfDestructTimer=null;return;}
  var now=Math.floor(Date.now()/1000),active=false;
  nodes.forEach(function(wrap){var left=(parseInt(wrap.dataset.selfDestructAt,10)||0)-now,count=wrap.querySelector('.self-destruct-countdown');if(left<=0){wrap.classList.add('is-expiring');setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap);},180);}else{active=true;if(count)count.textContent=left+' '+t('time_sec_short','с');}});
  state.chatSelfDestructTimer=active?setTimeout(scheduleSelfDestructTick,1000):null;
}
function updateMessageDelivery(m){
  if(!m||!m.id)return;var wrap=document.querySelector('#vc-chat-thread .msg-wrap.me[data-msg-id="'+parseInt(m.id,10)+'"]');if(!wrap)return;
  var seen=m.seen===true||parseInt(m.seen,10)===1,delivery=wrap.querySelector('.bub-delivery');wrap.dataset.seen=seen?'1':'0';
  if(delivery){delivery.className='bub-delivery '+(seen?'is-seen':'is-sent');delivery.textContent=seen?'✓✓':'✓';delivery.setAttribute('aria-label',seen?t('message_read','Прочитано'):t('message_sent','Отправлено'));}
}
function chatDateKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dateSep(d){
  var today = new Date(), yest = new Date(); yest.setDate(today.getDate()-1);
  var label = t('chat_today','Сегодня');
  if (d.toDateString() === yest.toDateString()) label = t('chat_yesterday','Вчера');
  else if (d.toDateString() !== today.toDateString()) label = d.toLocaleDateString(state.lang||undefined,{day:'numeric',month:'long',year:d.getFullYear()===today.getFullYear()?undefined:'numeric'});
  var note=el('div', {class:'daynote'}, label);note.dataset.day=chatDateKey(d);return note;
}
function startChatPoll(){
  if (state.chatPollTimer) clearTimeout(state.chatPollTimer);
  if (!state.currentChat) return;
  state.chatPollTimer = setTimeout(pollChat, 3500);
}
function chatCanMarkSeen(){return document.visibilityState==='visible'&&(typeof document.hasFocus!=='function'||document.hasFocus());}
function pollChat(){
  if (!state.currentChat) return;
  if (state.chatPollTimer) clearTimeout(state.chatPollTimer);
  if(document.visibilityState!=='visible'){state.chatPollTimer=setTimeout(pollChat,15000);return;}
  if (state.chatPollBusy){ state.chatPollTimer = setTimeout(pollChat, 1000); return; }
  var peerId = state.currentChat;
  state.chatPollBusy = true;
  api('thread', {virtual: peerId, limit: 60, mark_seen:chatCanMarkSeen()?1:0}).then(function(r){
    if (state.currentChat !== peerId) return;
    if (r && r.ok){
      applyChatMeta(r);
    }
    if (r && r.ok && r.messages && r.messages.length){
      var thread = document.getElementById('vc-chat-thread');
      if (thread){
        var wasAtBottom=isChatNearBottom(thread),added=0;
        for (var i=0;i<r.messages.length;i++){
          var m = r.messages[i];
          updateMessageDelivery(m);
          var existing=m.id&&document.querySelector('#vc-chat-thread .msg-wrap[data-msg-id="'+parseInt(m.id,10)+'"]');if(existing){if(m.id>state.chatLastMsgId)state.chatLastMsgId=m.id;continue;}
          if (m.id && m.id <= state.chatLastMsgId) continue;
           var lastTimed=thread.querySelector('.msg-wrap[data-ts]:last-of-type'),lastTs=lastTimed?(parseInt(lastTimed.dataset.ts,10)||0):0;
           if(m.ts&&(!lastTs||chatDateKey(new Date(lastTs*1000))!==chatDateKey(new Date(m.ts*1000))))thread.appendChild(dateSep(new Date(m.ts*1000)));
           appendMessage(m, thread);
          added++;
          if (m.id && m.id > state.chatLastMsgId) state.chatLastMsgId = m.id;
        }
        if(added){if(wasAtBottom||state.chatAutoScroll)scrollChatToBottom(true);else{state.chatNewBelow+=added;updateChatDownButton(true);}}
      }
    }
  }, function(){}).then(function(){
    state.chatPollBusy = false;
    if (state.currentChat === peerId) state.chatPollTimer = setTimeout(pollChat, 3500);
  },function(){
    state.chatPollBusy = false;
    if (state.currentChat === peerId) state.chatPollTimer = setTimeout(pollChat, 3500);
  });
}
window.addEventListener('focus',function(){if(state.currentChat)pollChat();});
function findChat(pid){
  var chats = state.chats || (state.me ? state.me.inbox : []) || [];
  for (var i=0;i<chats.length;i++){ if ((chats[i].peer_id||chats[i].id||0) === pid) return chats[i]; }
  return null;
}

/* ===== View: Store ===== */
function isChatterRescuePromo(promo){
  return !!(promo&&promo.template_key==='chatter_rescue_10_messages_10m'&&promo.benefit_kind==='fixed_price');
}
function promoMoney(promo,key){
  var amount=parseInt(promo&&promo[key],10),scale=Math.max(0,parseInt(promo&&promo.currency_scale,10)||0);
  if(!Number.isFinite(amount))return '';
  return '€'+(amount/Math.pow(10,scale)).toFixed(scale);
}
function precisePromoRemaining(expiresAt){
  var left=Math.max(0,(parseInt(expiresAt,10)||0)-(Math.floor(Date.now()/1000)+(state.storeServerOffset||0)));
  return String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
}
function removeRescueOfferBanner(){
  var node=document.getElementById('vc-rescue-offer');if(node&&node.parentNode)node.parentNode.removeChild(node);
  if(state.rescueOfferTimer){clearInterval(state.rescueOfferTimer);state.rescueOfferTimer=null;}
}
function renderRescueOfferBanner(){
  var promo=state.storePromo,now=Math.floor(Date.now()/1000)+(state.storeServerOffset||0);
  var existing=document.getElementById('vc-rescue-offer');
  if(isChatterRescuePromo(promo)&&parseInt(promo.expires_at,10)>now&&state.route!=='/store'
    && existing&&existing.getAttribute('data-promo-id')===(promo.public_id||''))return;
  removeRescueOfferBanner();
  if(!isChatterRescuePromo(promo)||parseInt(promo.expires_at,10)<=now||state.route==='/store')return;
  var node=el('aside',{class:'vc-rescue-offer',id:'vc-rescue-offer'});
  node.setAttribute('data-promo-id',promo.public_id||'');
  node.setAttribute('role','status');node.setAttribute('aria-live','polite');
  node.innerHTML='<div class="vc-rescue-offer-icon">'+semanticGlassIcon('bolt')+'</div>'+
    '<div class="vc-rescue-offer-copy"><span>'+h(t('rescue_offer_eyebrow','Только сейчас'))+'</span><strong>'+h(t('rescue_offer_title','Продолжить чат за €4,99'))+'</strong><small><s>'+h(promoMoney(promo,'base_amount_minor'))+'</s> · '+h(t('rescue_offer_hint','цена сохранится при открытии оплаты'))+'</small></div>'+
    '<div class="vc-rescue-offer-time"><span>'+h(t('promo_expires_in','Закончится через'))+'</span><strong id="vc-rescue-offer-time">'+h(precisePromoRemaining(promo.expires_at))+'</strong></div>'+
    '<button type="button">'+h(t('rescue_offer_cta','Забрать за €4,99'))+'</button>';
  document.body.appendChild(node);
  node.querySelector('button').addEventListener('click',function(){
    funnelTrack('promo_click',{placement:'rescue_banner',promo_id:promo.public_id||'',channel:promo.channel||'crypto'});
    removeRescueOfferBanner();navigate('/store');
  });
  function tick(){
    var clock=document.getElementById('vc-rescue-offer-time'),current=Math.floor(Date.now()/1000)+(state.storeServerOffset||0);
    if(!clock||!state.storePromo||parseInt(state.storePromo.expires_at,10)<=current){
      removeRescueOfferBanner();
      if(state.storePromo&&parseInt(state.storePromo.expires_at,10)<=current){state.storePromo=null;state.cryptoPacks=null;}
      return;
    }
    clock.textContent=precisePromoRemaining(state.storePromo.expires_at);
  }
  tick();state.rescueOfferTimer=setInterval(tick,1000);
}
function syncLivePromotion(promo,serverTime){
  var previous=state.storePromo&&state.storePromo.public_id||'',next=promo&&promo.public_id||'';
  if(serverTime)state.storeServerOffset=parseInt(serverTime,10)-Math.floor(Date.now()/1000);
  state.storePromo=promo||null;
  if(previous!==next){
    if(next)funnelTrack('promo_view',{placement:'live_offer',promo_id:next,channel:promo.channel||''},'live:'+next);
    if(state.route==='/store')viewStore();
  }
  renderRescueOfferBanner();
}
function activeStorePromoForVibes(vibes,channel){
  var promo=state.storePromo,now=Math.floor(Date.now()/1000)+(state.storeServerOffset||0);
  if(!promo||parseInt(promo.expires_at,10)<=now||parseInt(promo.base_vibes,10)!==parseInt(vibes,10))return null;
  if(channel&&promo.channel&&promo.channel!=='any'&&promo.channel!==channel)return null;
  return promo;
}
function storePromoRemaining(expiresAt){
  var left=Math.max(0,(parseInt(expiresAt,10)||0)-(Math.floor(Date.now()/1000)+(state.storeServerOffset||0)));
  if(left<=0)return t('promo_expired','Предложение завершилось');
  var totalMinutes=Math.max(1,Math.ceil(left/60)),hours=Math.floor(totalMinutes/60),minutes=totalMinutes%60;
  if(hours>0)return hours+' '+t('hours_short','ч')+(minutes?' '+minutes+' '+t('minutes_short','мин.'):'');
  return minutes+' '+t('minutes_short','мин.');
}
function armStorePromoCountdown(){
  if(state.storePromoTimer){clearInterval(state.storePromoTimer);state.storePromoTimer=null;}
  if(!state.storePromo||state.route!=='/store')return;
  function tick(){
    var node=document.getElementById('vc-store-promo-time');
    if(!node||state.route!=='/store'){clearInterval(state.storePromoTimer);state.storePromoTimer=null;return;}
    var now=Math.floor(Date.now()/1000)+(state.storeServerOffset||0),expires=parseInt(state.storePromo&&state.storePromo.expires_at,10)||0;
    if(expires<=now){clearInterval(state.storePromoTimer);state.storePromoTimer=null;state.storePromo=null;state.cryptoPacks=null;viewStore();return;}
    node.textContent=isChatterRescuePromo(state.storePromo)?precisePromoRemaining(expires):storePromoRemaining(expires);
  }
  tick();state.storePromoTimer=setInterval(tick,1000);
}
function viewStore(){
  var body = document.getElementById('vc-main-body');
  if (!body) return;
  if(state.storeVisitKey){
    funnelTrack('store_opened',storeSignalContext({entry:state.storeAttribution?'chat_paywall':'navigation'}),state.storeVisitKey);
  }
  requestStoreCatalog();
  var bal = (state.me && state.me.balance != null) ? state.me.balance : 0;
  var packs = state.cryptoPacks || [];
  var packsHtml = '',walletPacksHtml='';
  if (state.cryptoPacks === null) packsHtml = '<div style="padding:16px;text-align:center;color:var(--text3)"><div class="spin"></div></div>';
  else if (!state.cryptoEnabled || !packs.length) packsHtml = '<div style="padding:16px;text-align:center;color:var(--text3)">'+h(t('store_crypto_unavailable','Крипто временно недоступно'))+'</div>';
  for (var i=0;i<packs.length;i++){
    var p = packs[i];
    var isWalletPack=p.fulfillment==='wallet',packPromo=isWalletPack?null:activeStorePromoForVibes(p.vibes,'crypto'),packEffective=packPromo?parseInt(packPromo.effective_vibes,10):parseInt(p.vibes,10),chatCount=Math.max(1,parseInt(p.chats,10)||1);
    var regularPrice=Number(p.eur!=null?p.eur:p.usd||0),offerPrice=packPromo&&packPromo.offer_amount_minor!=null?Number(packPromo.offer_amount_minor)/Math.pow(10,parseInt(packPromo.currency_scale,10)||0):regularPrice;
    var fixedOffer=!!(packPromo&&packPromo.benefit_kind==='fixed_price'&&offerPrice<regularPrice),savingPct=fixedOffer?Math.round((1-offerPrice/regularPrice)*100):0;
    var packName=isWalletPack?(vibeAmount(p.vibes)+' '+t('to_account_balance','на баланс')):chatCountLabel(chatCount);
    var packTag=fixedOffer?'<div class="pack-tag promo">−'+savingPct+'%</div>':(packPromo?'<div class="pack-tag promo">+'+vibeAmount(packEffective-p.vibes)+'</div>':(!isWalletPack&&p.vibes===350?'<div class="pack-tag">START</div>':''));
    var packPrice=vcCryptoDirectPrices()?'<div class="pack-price is-offer is-crypto"><s>€'+regularPrice.toFixed(2)+'</s><strong>'+h(vcUsdt(offerPrice))+'</strong></div>':(fixedOffer?'<div class="pack-price is-offer"><s>€'+regularPrice.toFixed(2)+'</s><strong>€'+offerPrice.toFixed(2)+'</strong></div>':'<div class="pack-price">€'+regularPrice.toFixed(2)+'</div>');
    var packRow='<div class="pack'+(!isWalletPack&&p.vibes===350?' best':'')+(packPromo?' has-promo':'')+'" data-pack="'+h(p.pack_id)+'" role="button" tabindex="0" aria-label="'+h(t('store_buy','Купить'))+' '+packName+'">' +
      '<div class="pack-ico">'+semanticGlassIcon(isWalletPack?'wallet':'chat','vc-store-pack-icon')+'</div>' +
      '<div class="pack-info"><div class="pack-nm">'+packName+'</div>'+(isWalletPack?'<small>'+h(t('wallet_pack_for','Для фото, подарков и функций профиля'))+'</small>':'')+'</div>' +
      packTag+packPrice+
    '</div>';
    if(isWalletPack)walletPacksHtml+=packRow;else packsHtml+=packRow;
  }
  var cryptoReady=state.cryptoPacks!==null&&!!state.cryptoEnabled&&packs.length>0;
  var cryptoNetworkHtml='';
  if(vcCryptoLive() && state.cryptoChains.length){
    for(var ni=0;ni<state.cryptoChains.length;ni++){
      var nw=state.cryptoChains[ni],nk=String(nw.key||nw.chain||'');
      cryptoNetworkHtml+='<button type="button" class="crypto-network'+(state.cryptoNetwork===nk?' is-selected':'')+'" data-network="'+h(nk)+'"><strong>'+h(nw.label||nk)+'</strong><small>'+h(state.cryptoProvider==='direct'?(nw.network||nw.asset||''):(nw.asset||''))+'</small></button>';
    }
  }
  var cardSource=packs.filter(function(p){return p.fulfillment!=='wallet';});
  if(!cardSource.length)cardSource=VC_STORE_PACKS;
  var cardHtml='';for(var cp=0;cp<cardSource.length;cp++){var cardPack=cardSource[cp];cardHtml+=storePayPackCard(Math.max(1,parseInt(cardPack.chats,10)||1),Number(cardPack.eur!=null?cardPack.eur:cardPack.usd||0),parseInt(cardPack.vibes,10)===350);}
  var promo=state.storePromo,promoHtml='';
  if(promo&&activeStorePromoForVibes(promo.base_vibes)){
    var promoBonus=Math.max(0,(parseInt(promo.effective_vibes,10)||0)-(parseInt(promo.base_vibes,10)||0));
    var promoChannel=promo.channel==='crypto'?t('store_crypto','Криптовалюта'):t('bank_card','Банковская карта');
    if(promo.benefit_kind==='fixed_price'){
      promoHtml='<article class="store-live-promo is-rescue" aria-live="polite"><div class="store-live-promo-icon">'+semanticGlassIcon('bolt')+'</div><div class="store-live-promo-copy"><span>'+h(t('rescue_offer_eyebrow','Только сейчас'))+'</span><strong>'+h(t('rescue_offer_title','Продолжить чат за €4,99'))+'</strong><small><s>'+h(promoMoney(promo,'base_amount_minor'))+'</s> · '+h(t('rescue_offer_store_hint','скидка закрепится при создании оплаты'))+'</small></div><div class="store-live-promo-clock"><span>'+h(t('promo_expires_in','Закончится через'))+'</span><strong id="vc-store-promo-time">'+h(precisePromoRemaining(promo.expires_at))+'</strong></div></article>';
    }else{
      promoHtml='<article class="store-live-promo" aria-live="polite"><div class="store-live-promo-icon">'+semanticGlassIcon('star')+'</div><div class="store-live-promo-copy"><span>'+h(t('promo_personal_offer','Персональное предложение'))+'</span><strong>'+h(t('promo_same_price','Больше общения по специальной цене'))+'</strong><small>'+h(promoChannel)+'</small></div><div class="store-live-promo-clock"><span>'+h(t('promo_expires_in','Закончится через'))+'</span><strong id="vc-store-promo-time">'+h(storePromoRemaining(promo.expires_at))+'</strong></div></article>';
    }
  }
  body.innerHTML = '<div class="store-view store-launch">' + '<div class="topbar left vis-m"><h1>'+h(t('v4_nav_store','Пакеты и баланс'))+'</h1></div>' +
    '<div class="store-hero"><div class="sh-bal"><span class="sh-star">'+semanticGlassIcon('wallet')+'</span>'+vibeAmount(bal)+'</div><div class="sh-label">'+h(t('account_balance','Баланс аккаунта'))+'</div>'+(state.testPayments?'<span class="vc-test-badge">'+h(t('test_mode','Тестовый режим'))+'</span>':'')+'<div class="store-anchor"><strong>1 чат · €7</strong></div></div>' +
    promoHtml +
    vcStoreBuyHtml() +
    '<div class="store-section store-payment-stack"><div class="ss-title">'+h(t('payment_methods_title','Способы оплаты'))+'<span class="ss-sub">'+h(t('store_section_sub','Чаты отдельно, баланс отдельно: пакеты чатов открывают переписки, баланс — для фото и подарков'))+'</span></div>'+
       (state.testPayments?'<section class="store-method is-test"><div class="store-method-head"><span>'+semanticGlassIcon('check')+'</span><div><strong>'+h(t('test_payment','Тестовая оплата'))+'</strong><small>'+h(t('test_payment_method_copy','Работает, пока не подключены реальные платёжные системы. Деньги не списываются.'))+'</small></div><em>'+h(t('test_mode','Тестовый режим'))+'</em></div></section>':'')+'<section class="store-method is-unavailable"><div class="store-method-head"><span>'+semanticGlassIcon('wallet')+'</span><div><strong>'+h(t('bank_card','Банковская карта'))+'</strong><small>'+h(t('card_payment_soon','Оплата картой готовится. Минимальный пакет — €7.'))+'</small></div><em>'+h(t('coming_soon','Скоро'))+'</em></div>'+vcCardBrandsHtml()+'<div class="store-pay-grid">'+cardHtml+'</div><div class="store-pack-why" id="vc-pack-why">'+h(t('packs_unavailable_why','Пакеты станут доступны после подключения оплаты. Сейчас покупки работают из чата.'))+'</div></section>'+ 
      '<section class="store-method crypto-checkout-card'+(cryptoReady?' is-primary':' is-unavailable')+'"><div class="store-method-head"><span>'+glassIcon('store')+'</span><div><strong>'+h(t('store_crypto','Криптовалюта'))+'</strong><small>'+h(cryptoReady?(vcCryptoDirectPrices()?t('crypto_direct_copy','Платите в USDT — выгоднее: цена в USDT ниже, чем в евро. Выберите сеть и пакет, зачисление автоматическое.'):t('crypto_checkout_copy','Выберите пакет и сеть — оплата откроется на защищённой странице.')):t('store_crypto_off_copy','Оплата криптовалютой временно недоступна. Ничего не списывается.'))+'</small></div><em>'+h(cryptoReady?(vcCryptoDirectPrices()?t('crypto_discount_badge','Выгоднее'):t('secure_label','Защищено')):t('unavailable','Недоступно'))+'</em></div>'+(vcCryptoLive()?'<div class="crypto-network-title">'+h(t('crypto_choose_network','Сеть оплаты'))+'</div><div class="crypto-network-grid">'+cryptoNetworkHtml+'</div>':'')+(cryptoReady||state.cryptoPacks===null?'<div class="store-pack-group">'+(cryptoReady?'<div class="store-pack-group-title"><strong>'+h(t('chat_packages','Пакеты чатов'))+'</strong></div>':'')+'<div class="packs-list">'+packsHtml+'</div></div>':'')+(walletPacksHtml?'<div class="store-pack-group"><div class="store-pack-group-title"><strong>'+h(t('purchase_balance','Баланс для покупок'))+'</strong><small>'+h(t('purchase_balance_copy','Для фото, подарков и функций профиля'))+'</small></div><div class="packs-list">'+walletPacksHtml+'</div></div>':'')+'</section>'+ 
    '</div>' +
  '</div>';
  var storeAnchor=document.querySelector('.store-anchor');
  var cryptoNotice=document.querySelector('.crypto-checkout-card .packs-list > div');
  if(cryptoNotice && state.cryptoPacks !== null && (!state.cryptoEnabled || !packs.length)) cryptoNotice.classList.add('store-inline-notice','store-inline-notice-danger');
  if(storeAnchor) storeAnchor.innerHTML='<span>'+h(t('store_anchor_label','Стартовый пакет'))+'</span><strong>1 чат · €7</strong>';
  $$('#vc-main-body .pack').forEach(function(p){bindActivation(p,function(){buyVibes(parseInt(p.dataset.pack,10));},'button');});
  $$('#vc-main-body .crypto-network').forEach(function(btn){btn.addEventListener('click',function(){state.cryptoNetwork=String(btn.dataset.network||'');$$('#vc-main-body .crypto-network').forEach(function(x){x.classList.toggle('is-selected',x===btn);});});});
  armStorePromoCountdown();
  wireStoreBuy(body);
  var storeView=document.querySelector('#vc-main-body .store-view');
  if(storeView&&!document.getElementById('vc-store-history')){
    var histHost=document.createElement('section');
    histHost.className='store-method store-history-card';
    histHost.innerHTML='<div id="vc-store-history"></div>';
    storeView.appendChild(histHost);
  }
  requestPurchaseHistory();
  renderPurchaseHistory();
}
function requestStoreCatalog(){
  if (state.cryptoPacks !== null) return Promise.resolve(state.cryptoPacks);
  if (state.storeCatalogLoading && state.storeCatalogPromise) return state.storeCatalogPromise;
  state.storeCatalogLoading = true;
  state.storeCatalogPromise = authApi('crypto_packs').then(function(r){
    state.storeCatalogLoading = false;
    var out = [];
    state.storeCatalog = r && r.catalog ? r.catalog : null;
    state.storePromo = r && r.active_promo ? r.active_promo : null;
    if(state.storePromo)funnelTrack('promo_view',{placement:'store',promo_id:state.storePromo.public_id||state.storePromo.id||'',channel:state.storePromo.channel||''},'store:'+(state.storePromo.public_id||state.storePromo.id||'active'));
    state.storeServerOffset = r && r.server_time ? (parseInt(r.server_time,10)-Math.floor(Date.now()/1000)) : 0;
    var chains = r && Array.isArray(r.chains) ? r.chains : [];
    state.cryptoProvider = String((r&&r.crypto_provider)||'unavailable');
    state.cryptoEnabled = !!(r && r.ok && (r.crypto_enabled === true || parseInt(r.crypto_enabled,10) === 1));
    state.cryptoChains = chains;
    state.testPayments = !!(r && r.ok && r.test_payments);
    state.storeTopup = r && r.topup ? r.topup : null;
    if(vcCryptoLive() && chains.length && !chains.some(function(x){return String(x.key||x.chain||'')===state.cryptoNetwork;})) state.cryptoNetwork=String(chains[0].key||chains[0].chain||'');
    if (r && r.packs){
      for (var key in r.packs){
        if (!Object.prototype.hasOwnProperty.call(r.packs,key)) continue;
        var item = r.packs[key];
        if (item && item.type === 'vibes') out.push({pack_id:parseInt(item.pack_id||key,10),vibes:parseInt(item.vibes,10)||0,fulfillment:String(item.fulfillment||'chat_slots'),chats:parseInt(item.chats,10)||0,messages_per_chat:parseInt(item.messages_per_chat,10)||10,eur:Number(item.eur!=null?item.eur:item.usd)||0,title:item.title||''});
      }
      out.sort(function(a,b){ return a.vibes-b.vibes; });
    }
    /* Test payments sell the same catalog packs, so the pack list no longer depends on the crypto channel. */
    state.storePacks = out;
    state.cryptoPacks = state.cryptoEnabled ? out : [];
    if (state.route === '/store') viewStore();
    return state.cryptoPacks;
  }).catch(function(){ state.storeCatalogLoading = false; state.cryptoEnabled=false; state.cryptoProvider='unavailable'; state.cryptoChains=[]; state.cryptoPacks = []; state.storePacks=[]; state.testPayments=false; state.storeTopup=null; state.storeCatalog=null;state.storePromo=null;if (state.route === '/store') viewStore(); return []; });
  return state.storeCatalogPromise;
}
function purchaseHistoryAmount(it){
  if(it.amount_minor!=null&&it.currency_scale!=null&&it.currency){
    var v=Number(it.amount_minor)/Math.pow(10,parseInt(it.currency_scale,10)||0);
    return h(String(it.currency)+' '+v.toFixed(parseInt(it.currency_scale,10)||0));
  }
  return h(vibeAmount(parseInt(it.vibes,10)||0));
}
function purchaseHistoryTitle(it){
  var chats=parseInt(it.chats,10)||0;
  if(chats>0)return chatCountLabel(chats);
  if(it.kind==='wallet')return t('hist_wallet','\u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u0431\u0430\u043b\u0430\u043d\u0441\u0430');
  return t('hist_legacy','\u0421\u0442\u0430\u0440\u0430\u044f \u043f\u043e\u043a\u0443\u043f\u043a\u0430');
}
function purchaseHistoryProvider(it){
  if(it.test)return t('test_payment','Тестовая оплата');
  if(it.channel==='crypto')return t('store_crypto','\u041a\u0440\u0438\u043f\u0442\u043e\u0432\u0430\u043b\u044e\u0442\u0430');
  if(it.channel==='card')return t('bank_card','\u0411\u0430\u043d\u043a\u043e\u0432\u0441\u043a\u0430\u044f \u043a\u0430\u0440\u0442\u0430');
  return '';
}
function renderPurchaseHistory(){
  var host=document.getElementById('vc-store-history');if(!host)return;
  var data=state.purchaseHistory;
  var head='<div class="store-pack-group-title"><strong>'+h(t('purchase_history','\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043f\u043e\u043a\u0443\u043f\u043e\u043a'))+'</strong></div>';
  if(data===undefined||data===null){host.innerHTML=head+'<div style="padding:16px;text-align:center;color:var(--text3)"><div class="spin"></div></div>';return;}
  if(!Array.isArray(data)){host.innerHTML=head+'<div style="padding:16px;text-align:center;color:var(--text3)">'+h(localizedErrorText(data.err))+'</div>';return;}
  if(!data.length){host.innerHTML=head+'<div style="padding:16px;text-align:center;color:var(--text3)">'+h(t('purchase_history_empty','\u0423 \u0432\u0430\u0441 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043e\u043f\u043b\u0430\u0447\u0435\u043d\u043d\u044b\u0445 \u043f\u043e\u043a\u0443\u043f\u043e\u043a.'))+'</div>';return;}
  var html=head+'<div class="packs-list">';
  for(var i=0;i<data.length;i++){
    var it=data[i]||{},prov=purchaseHistoryProvider(it);
    var meta=h(fmtTime(parseInt(it.date,10)||0))+(it.ref?(' · #'+h(String(it.ref).slice(0,8))):'')+(prov?(' · '+h(prov)):'');
    html+='<div class="pack hist-row"><div class="pack-info"><div class="pack-nm">'+h(purchaseHistoryTitle(it))+'</div><small>'+meta+'</small>'+(it.ref?'<a class="vc-order-help" href="#/support?order='+encodeURIComponent(String(it.ref))+'">'+h(t('order_help','Помощь с заказом'))+'</a>':'')+'</div><div class="pack-price">'+purchaseHistoryAmount(it)+'<small>'+h(vibeAmount(parseInt(it.vibes,10)||0))+'</small></div></div>';
  }
  host.innerHTML=html+'</div>';
}
function requestPurchaseHistory(){
  if(state.purchaseHistory!==undefined||state.purchaseHistoryLoading)return;
  state.purchaseHistoryLoading=true;
  api('purchase_history').then(function(r){
    state.purchaseHistoryLoading=false;
    state.purchaseHistory=(r&&r.ok&&Array.isArray(r.items))?r.items:{err:(r&&r.err)||'Error'};
    if(state.route==='/store')renderPurchaseHistory();
  }).catch(function(){ state.purchaseHistoryLoading=false; state.purchaseHistory={err:'network_error'}; if(state.route==='/store')renderPurchaseHistory(); });
}
async function buyVibes(packId){
  if(state.storeCheckoutBusy)return;
  if (packId && state.testPayments && !vcCryptoLive()) return vcStoreBuyPack(packId);
  if (!packId || !vcCryptoLive()){ toast(t('store_crypto_unavailable','Крипто временно недоступно'),'error'); return; }
  if(guestNeedsProfileGate()){
    showGuestProfileGate(null,function(){buyVibes(packId);},{action:'purchase'});
    return;
  }
  var pack=null;for(var i=0;i<(state.cryptoPacks||[]).length;i++){if(parseInt(state.cryptoPacks[i].pack_id,10)===packId){pack=state.cryptoPacks[i];break;}}
  var isWalletPack=!!(pack&&pack.fulfillment==='wallet'),packPromo=pack&&!isWalletPack?activeStorePromoForVibes(pack.vibes,'crypto'):null,packReceive=packPromo?parseInt(packPromo.effective_vibes,10):(pack?pack.vibes:0);
  var checkoutChats=Math.max(1,parseInt(pack&&pack.chats,10)||1),checkoutChatLabel=chatCountLabel(checkoutChats),checkoutReceive=isWalletPack?(vibeAmount(packReceive)+' '+t('to_account_balance','на баланс')):checkoutChatLabel;
  var regularAmount=Number(pack&&(pack.eur!=null?pack.eur:pack.usd)||0),checkoutAmount=packPromo&&packPromo.offer_amount_minor!=null?Number(packPromo.offer_amount_minor)/Math.pow(10,parseInt(packPromo.currency_scale,10)||0):regularAmount;
  var fixedOffer=!!(packPromo&&packPromo.benefit_kind==='fixed_price'&&checkoutAmount<regularAmount);
  if(packPromo)funnelTrack('promo_click',{placement:'store_pack',promo_id:packPromo.public_id||packPromo.id||'',channel:'crypto'});
  var promoNote=fixedOffer?'<p class="vc-promo-modal-note">'+h(t('rescue_offer_checkout_note','Цена €4,99 будет зафиксирована в созданном счёте.'))+'</p>':(packPromo?'<p class="vc-promo-modal-note">+'+vibeAmount(packReceive-pack.vibes)+' · '+h(t('promo_applied_at_payment','Бонус начислится, если предложение активно в момент оплаты.'))+'</p>':'');
  state.storeCheckoutBusy=true;
  if(!await vcModal({title:t('store_crypto_title','Оплата криптовалютой'),icon:'◇',html:'<div class="vc-purchase-summary"><div><span>'+h(t('you_receive','Вы получите'))+'</span><strong>'+checkoutReceive+'</strong>'+(isWalletPack?'<small>'+h(t('wallet_available_immediately','Можно использовать сразу после подтверждения оплаты'))+'</small>':'')+'</div><div><span>'+h(t('amount','Сумма'))+'</span><strong>'+vcCryptoPriceHtml(regularAmount,checkoutAmount,fixedOffer)+'</strong></div></div>'+promoNote+'<p>'+h(t('crypto_network_copy','Платёж откроется в выбранной сети. Всегда проверяйте сеть, адрес и точную сумму перед отправкой.'))+'</p>',confirmText:t('create_invoice','Создать счёт')})){state.storeCheckoutBusy=false;return;}
  var checkoutContext=storeSignalContext({provider:'crypto',pack_id:packId,vibes:packReceive,eur:checkoutAmount,promo_id:packPromo&&packPromo.public_id||''});
  funnelTrack('checkout_started',checkoutContext);
  state.storeCheckoutActive={stage:'checkout_started',pack_id:packId,provider:'crypto',started_at:Math.floor(Date.now()/1000)};
  ensureTosAccepted().then(function(ok){
    if(!ok){
      funnelTrack('checkout_failed',storeSignalContext({provider:'crypto',pack_id:packId,reason:'tos_required'}));
      state.storeCheckoutActive=null;
      state.storeCheckoutBusy=false;
      return;
    }
    toast(t('store_buying','Создаём платёж...'));
    var checkoutNetwork=state.cryptoNetwork||'usdt_trc20';
    var intentKey='vc_crypto_intent_'+packId+'_'+checkoutNetwork+'_'+String(packPromo&&packPromo.public_id||'none'),intentData=null;
    try{intentData=JSON.parse(sessionStorage.getItem(intentKey)||'null');}catch(e){}
    if(!intentData||!intentData.id||Date.now()-(parseInt(intentData.at,10)||0)>1800000){
      intentData={id:(window.crypto&&crypto.randomUUID?crypto.randomUUID():('ci_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14))),at:Date.now()};
      try{sessionStorage.setItem(intentKey,JSON.stringify(intentData));}catch(e){}
    }
    authApi('crypto_invoice', {pack_id:packId,network:checkoutNetwork,promo_id:packPromo&&packPromo.public_id||'',profile_id:parseInt(state.storeAttribution&&state.storeAttribution.profile_id,10)||0,intent_id:intentData.id}).then(function(r){
      state.storeCheckoutBusy=false;
      if (r && r.ok) {
        state.storeCheckoutActive={stage:'invoice_created',pid:parseInt(r.pid||0,10)||0,provider:'crypto',started_at:state.storeCheckoutActive&&state.storeCheckoutActive.started_at||Math.floor(Date.now()/1000)};
        showCheckoutInvoice(r,{intent_key2:intentKey});
      } else if(r&&r.err==='profile_required'){
        state.storeCheckoutActive=null;
        showGuestProfileGate(null,function(){buyVibes(packId);},{action:'purchase'});
      } else if(r&&r.err==='offer_expired'){
        vcClearCryptoIntentKey(intentKey);
        state.storeCheckoutActive=null;
        funnelTrack('checkout_failed',storeSignalContext({provider:'crypto',pack_id:packId,reason:'offer_expired'}));
        state.storePromo=null;state.cryptoPacks=null;viewStore();toast(t('promo_expired','Предложение завершилось'),'error');
      } else {
        if(r&&r.err==='invoice_closed')vcClearCryptoIntentKey(intentKey);
        state.storeCheckoutActive=null;
        funnelTrack('checkout_failed',storeSignalContext({provider:'crypto',pack_id:packId,reason:(r&&r.err)||'invoice_failed'}));
        toast(localizedErrorText(r&&r.err,t('store_pay_unavailable','Пополнение временно недоступно')), 'error');
      }
    }).catch(function(){
      state.storeCheckoutBusy=false;
      state.storeCheckoutActive=null;
      funnelTrack('checkout_failed',storeSignalContext({provider:'crypto',pack_id:packId,reason:'network'}));
      toast(t('network_error','Ошибка сети'), 'error');
    });
  });
}
/* ===== Direct crypto checkout: USDT on the chosen network, own addresses, automatic credit ===== */
function vcCryptoLive(){return !!state.cryptoEnabled&&(state.cryptoProvider==='cryptomus'||state.cryptoProvider==='direct');}
function vcCryptoDirect(){return !!state.cryptoEnabled&&state.cryptoProvider==='direct';}
function vcCryptoDirectPrices(){return vcCryptoDirect()&&!state.testPayments;}
function vcUsdt(n){var v=Number(n)||0,whole=Math.abs(v-Math.round(v))<0.005;return (whole?String(Math.round(v)):v.toFixed(2))+' USDT';}
function vcCryptoPriceHtml(regular,charged,promo){
  if(vcCryptoDirectPrices())return '<s>€'+Number(regular).toFixed(2)+'</s> '+h(vcUsdt(charged));
  return (promo?'<s>€'+Number(regular).toFixed(2)+'</s> ':'')+'€'+Number(charged).toFixed(2);
}
var VC_PAY_BRANDS=[['visa','Visa'],['mastercard','Mastercard'],['mir','МИР'],['unionpay','UnionPay']];
function vcCardBrandsHtml(){
  var items='';
  for(var i=0;i<VC_PAY_BRANDS.length;i++)items+='<span class="vc-pay-brand" role="listitem"><img src="/app/assets/pay/'+VC_PAY_BRANDS[i][0]+'.svg" alt="'+h(VC_PAY_BRANDS[i][1])+'" width="54" height="35" loading="lazy" decoding="async"></span>';
  return '<div class="vc-pay-brands" role="list" aria-label="'+h(t('card_brands_label','Принимаются карты'))+'">'+items+'</div><p class="vc-pay-brands-note">'+h(t('card_brands_note','Карты российских и зарубежных банков: Visa, Mastercard, МИР'))+'</p>';
}
function vcCopyText(text){
  function fallback(){try{var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.appendChild(ta);ta.select();var ok=document.execCommand('copy');document.body.removeChild(ta);return ok;}catch(e){return false;}}
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).then(function(){return true;},function(){return fallback();});
  return Promise.resolve(fallback());
}
function vcLoadQr(){
  if(window.qrcode)return Promise.resolve(window.qrcode);
  if(state.qrLoading)return state.qrLoading;
  state.qrLoading=new Promise(function(resolve){var s=document.createElement('script');s.src='/app/qr.js?v=1';s.async=true;s.onload=function(){resolve(window.qrcode||null);};s.onerror=function(){state.qrLoading=null;resolve(null);};document.head.appendChild(s);});
  return state.qrLoading;
}
function vcQrSvg(text){
  return vcLoadQr().then(function(qr){if(!qr)return '';try{var q=qr(0,'M');q.addData(String(text));q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true});}catch(e){return '';}});
}
function closeDirectInvoice(){
  var c=state.directInvoice;if(!c)return;
  if(c.poll)clearInterval(c.poll);if(c.tick)clearInterval(c.tick);
  if(c.ov&&c.ov.parentNode)c.ov.parentNode.removeChild(c.ov);
  state.directInvoice=null;
}
function showCheckoutInvoice(invoice,ctx){
  if(invoice&&invoice.provider==='direct')return showDirectInvoice(invoice,ctx);
  return showCryptomusInvoice(invoice);
}
function showDirectInvoice(inv,ctx){
  ctx=ctx||{};
  var pid=parseInt(inv&&inv.pid,10)||0;if(!pid)return false;
  if(state.directInvoice&&state.directInvoice.pid===pid&&state.directInvoice.ov.parentNode)return true;
  closeDirectInvoice();
  var graceUntil=parseInt(inv.grace_until,10)||((parseInt(inv.expires_at,10)||0)+1800);
  state.storeCheckoutActive={stage:'provider_opened',pid:pid,provider:'direct',started_at:state.storeCheckoutActive&&state.storeCheckoutActive.started_at||Math.floor(Date.now()/1000)};
  if(!ctx.resumed)funnelTrack('provider_opened',storeSignalContext({provider:'direct',payment_id:pid,order_id:inv.order_public_id||''}),'provider:'+pid);
  try{
    var rec={pid:pid,at:Date.now(),expires_at:graceUntil,direct:1,coins:parseInt(inv.effective_coins||inv.coins,10)||0,fulfillment:String(inv.fulfillment||''),chat_count:parseInt(inv.chat_count,10)||0};
    if(ctx.intent_scope)rec.intent_scope=ctx.intent_scope;if(ctx.intent_key2)rec.intent_key2=ctx.intent_key2;
    sessionStorage.setItem('vc_pending_crypto_payment',JSON.stringify(rec));
  }catch(e){}
  var chats=parseInt(inv.chat_count,10)||0,isWallet=inv.fulfillment==='wallet'||chats<=0,isBinance=inv.network==='binance_pay';
  var receive=isWallet?(vibeAmount(inv.effective_coins||inv.coins||0)+' '+t('to_account_balance','на баланс')):chatCountLabel(chats);
  var eur=Number(inv.amount_eur!=null?inv.amount_eur:inv.amount_usd)||0,netLabel=isBinance?'Binance Pay':String(inv.network_name||inv.label||'USDT');
  function field(key,label,value,cls){return '<div class="vc-cdx-field'+(cls?' '+cls:'')+'"><span>'+h(label)+'</span><div class="vc-cdx-copy"><code id="vc-cdx-'+key+'">'+h(value)+'</code><button type="button" class="vc-cdx-copy-btn" data-cdx-copy="'+h(value)+'">'+h(t('cdx_copy','Копировать'))+'</button></div></div>';}
  var ov=el('div',{class:'lightbox vc-cdx-modal'});
  ov.innerHTML='<div class="vc-cdx-card" role="dialog" aria-modal="true" aria-label="'+h(t('store_crypto_title','Оплата криптовалютой'))+'">'+
    '<div class="vc-cdx-head"><div><span class="eyebrow">'+h(inv.label||'USDT')+'</span><strong>'+h(t('store_crypto_title','Оплата криптовалютой'))+'</strong></div><button type="button" class="vc-icon-glass vc-overlay-close" data-cdx-close aria-label="'+h(t('close','Закрыть'))+'">×</button></div>'+
    '<div class="vc-purchase-summary"><div><span>'+h(t('you_receive','Вы получите'))+'</span><strong>'+receive+'</strong></div><div><span>'+h(t('to_pay','К оплате'))+'</span><strong><s class="vc-cdx-eur">€'+eur.toFixed(2)+'</s>'+h(inv.amount_crypto)+' USDT</strong></div></div>'+
    '<div class="vc-cdx-warn">'+h(t('cdx_network_warn','Отправляйте только USDT в сети {net}. Другие монеты и сети не зачисляются.').replace('{net}',netLabel))+'</div>'+
    field('amount',t('cdx_amount','Сумма перевода'),String(inv.amount_crypto),'vc-cdx-amount')+
    '<p class="vc-cdx-exact">'+h(t('cdx_exact','Переведите ровно эту сумму — по ней мы находим ваш платёж'))+'</p>'+
    field('address',isBinance?t('cdx_pay_id','Binance Pay ID'):t('cdx_address','Адрес кошелька'),String(inv.address))+
    (isBinance?'':'<div class="vc-cdx-qr" id="vc-cdx-qr" aria-hidden="true"></div>')+
    '<div class="vc-cdx-status" id="vc-cdx-status" role="status" aria-live="polite"><span class="vc-cdx-pulse"></span><div><strong id="vc-cdx-status-title"></strong><small id="vc-cdx-status-text"></small></div><b id="vc-cdx-timer"></b></div>'+
    '<a class="vc-cdx-link" id="vc-cdx-explorer" target="_blank" rel="noopener noreferrer" hidden></a>'+
    '<p class="vc-cdx-note">'+h(t('cdx_note','Ничего подтверждать вручную не нужно: как только сеть подтвердит перевод, покупка появится в аккаунте.'))+'</p></div>';
  document.body.appendChild(ov);
  var cx={pid:pid,ov:ov,poll:null,tick:null};state.directInvoice=cx;
  function q(sel){return ov.querySelector(sel);}
  function stop(){if(cx.poll){clearInterval(cx.poll);cx.poll=null;}if(cx.tick){clearInterval(cx.tick);cx.tick=null;}}
  function paint(){
    var now=Math.floor(Date.now()/1000)+(state.storeServerOffset||0),left=(parseInt(inv.expires_at,10)||0)-now,st=String(inv.status||'pending');
    var box=q('#vc-cdx-status'),title,text,timer='';
    if(st==='confirmed'){box.className='vc-cdx-status is-done';title=t('cdx_paid','Оплата получена');text=t('cdx_paid_text','Зачисление выполнено автоматически');}
    else if(st==='confirming'){box.className='vc-cdx-status is-confirming';title=t('cdx_confirming','Перевод найден');text=(parseInt(inv.confirmations,10)>0&&inv.network==='usdt_bep20')?t('cdx_confirmations','Подтверждения сети: {n}').replace('{n}',String(inv.confirmations)):t('cdx_confirming_text','Ждём подтверждения сети — это занимает пару минут');}
    else if(st==='failed'||st==='expired'){box.className='vc-cdx-status is-failed';title=t('cdx_expired','Счёт закрыт');text=t('cdx_expired_text','Время ожидания истекло. Если вы уже отправили перевод, напишите в поддержку и укажите номер платежа #{pid}.').replace('{pid}',String(pid));}
    else if(st==='review'){box.className='vc-cdx-status is-failed';title=t('cdx_review','Платёж на проверке');text=t('cdx_review_text','Перевод получен, но нужна ручная проверка. Напишите в поддержку и укажите номер платежа #{pid}.').replace('{pid}',String(pid));}
    else if(left>0){box.className='vc-cdx-status is-waiting';title=t('cdx_waiting','Ждём перевод');text=t('cdx_waiting_text','Зачисление автоматическое — обычно 1–3 минуты после отправки');timer=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');}
    else{box.className='vc-cdx-status is-waiting';title=t('cdx_late_window','Время на оплату вышло');text=t('cdx_late_text','Если вы уже отправили перевод, он будет зачислен автоматически в течение 30 минут — ничего делать не нужно');timer='—';}
    q('#vc-cdx-status-title').textContent=title;q('#vc-cdx-status-text').textContent=text;q('#vc-cdx-timer').textContent=timer;
    var link=q('#vc-cdx-explorer');if(link){if(inv.explorer_url){link.hidden=false;link.href=inv.explorer_url;link.textContent=t('cdx_explorer','Смотреть транзакцию');}else link.hidden=true;}
  }
  function poll(){
    authApi('crypto_status',{pid:pid}).then(function(r){
      if(!r||!r.ok||state.directInvoice!==cx)return;
      inv=Object.assign({},inv,r);paint();
      if(r.status==='confirmed'){stop();setTimeout(function(){if(state.directInvoice===cx){closeDirectInvoice();reconcilePendingCryptoPayment();}},1600);}
      else if(r.status==='failed'||r.status==='expired'||r.status==='review')stop();
    }).catch(function(){});
  }
  paint();cx.tick=setInterval(paint,1000);cx.poll=setInterval(poll,4000);setTimeout(poll,1500);
  q('[data-cdx-close]').addEventListener('click',function(){closeDirectInvoice();reconcilePendingCryptoPayment();});
  ov.addEventListener('click',function(e){if(e.target===ov){closeDirectInvoice();reconcilePendingCryptoPayment();}});
  $$('[data-cdx-copy]',ov).forEach(function(btn){btn.addEventListener('click',function(){var label=btn.textContent;vcCopyText(btn.getAttribute('data-cdx-copy')||'').then(function(ok){btn.textContent=ok?t('cdx_copied','Скопировано'):t('cdx_copy_failed','Выделите и скопируйте вручную');setTimeout(function(){btn.textContent=label;},1800);});});});
  if(!isBinance)vcQrSvg(inv.address).then(function(svg){var box=q('#vc-cdx-qr');if(!box)return;if(svg)box.innerHTML=svg;else box.hidden=true;});
  return true;
}
function showCryptomusInvoice(invoice){
  var ov=el('div',{class:'lightbox vc-crypto-hosted-modal'}),invoiceChats=parseInt(invoice.chat_count,10)||0,isWalletInvoice=invoice.fulfillment==='wallet'||invoiceChats<=0,invoiceReceive=isWalletInvoice?(vibeAmount(invoice.effective_coins||invoice.coins||0)+' '+t('to_account_balance','на баланс')):chatCountLabel(invoiceChats);
  ov.innerHTML='<div class="vc-crypto-hosted-card"><div class="vc-crypto-hosted-head"><div><span class="eyebrow">SECURE CHECKOUT</span><strong>'+h(t('store_crypto_title','Оплата криптовалютой'))+'</strong></div><button type="button" class="vc-icon-glass vc-overlay-close" aria-label="'+h(t('close','Закрыть'))+'">×</button></div><div class="vc-purchase-summary"><div><span>'+h(t('you_receive','Вы получите'))+'</span><strong>'+invoiceReceive+'</strong></div><div><span>'+h(t('amount','Сумма'))+'</span><strong>€'+Number(invoice.amount_eur!=null?invoice.amount_eur:invoice.amount_usd||0).toFixed(2)+'</strong></div></div><div class="crypto-hosted-network"><span>'+h(t('crypto_network','Сеть'))+'</span><strong>'+h(invoice.label||invoice.network||'')+'</strong></div><p>'+h(t('crypto_hosted_copy','На следующем шаге откроется защищённая страница оплаты. После подтверждения покупка появится в аккаунте автоматически.'))+'</p><button type="button" class="vc-primary-cta" id="vc-crypto-open">'+h(t('continue_to_payment','Перейти к оплате'))+' →</button><small class="vc-crypto-trust">'+h(t('crypto_webhook_copy','Зачисление после подтверждения платежа'))+'</small></div>';
  document.body.appendChild(ov);var close=function(){if(ov.parentNode)ov.parentNode.removeChild(ov);};ov.querySelector('.vc-overlay-close').addEventListener('click',close);ov.addEventListener('click',function(e){if(e.target===ov)close();});
  ov.querySelector('#vc-crypto-open').addEventListener('click',function(){
    state.storeCheckoutActive={stage:'provider_opened',pid:parseInt(invoice.pid||0,10)||0,provider:'cryptomus',started_at:state.storeCheckoutActive&&state.storeCheckoutActive.started_at||Math.floor(Date.now()/1000)};
    funnelTrack('provider_opened',storeSignalContext({provider:'cryptomus',payment_id:parseInt(invoice.pid||0,10)||0,order_id:invoice.order_public_id||''}),'provider:'+(parseInt(invoice.pid||0,10)||0));
    try{sessionStorage.setItem('vc_pending_crypto_payment',JSON.stringify({pid:invoice.pid,at:Date.now(),expires_at:parseInt(invoice.expires_at,10)||0,coins:parseInt(invoice.effective_coins||invoice.coins,10)||0,intent_key2:'vc_crypto_intent_'+packId+'_'+checkoutNetwork+'_'+String(packPromo&&packPromo.public_id||'none')}));}catch(e){}window.location.href=invoice.payment_url;
  });
}
/* ===== View: Profile ===== */
function viewProfile(){
  var body = document.getElementById('vc-main-body');
  if (!body) return;
  var p = (state.me && state.me.profile) || state.profile || {};
  var rawName = ownDisplayName(p.fullname || p.name || '') || t('nav_profile','Профиль');
  var nm = h(rawName);
  var age = p.u_age || p.age || '';
  var city = h(localizedCity(p.city || p.location || ''));
  var bio = h(p.bio || '');
  var photo = p.photo || p.avatar || '';
  var photoStyle = photo ? 'background-image:url('+h(photo)+'),'+avatarBg(p.fullname||p.name||'') : '';
  var zodiacInfo = p.zodiac_info || {};
  var statusInfo = p.daily_status_info || {};
  var zodiac = profileZodiacText(zodiacInfo,p.zodiac);
  var status = profileDailyStatusText(statusInfo,p.daily_status);
  var completeRaw = p.profile_complete != null ? p.profile_complete : (p.profile_pct || 0);
  var completeInfo=(completeRaw&&typeof completeRaw==='object')?completeRaw:{pct:completeRaw,missing:[]};
  var complete=Math.max(0,Math.min(100,parseInt(completeInfo.pct,10)||0));
  var missing=Array.isArray(completeInfo.missing)?completeInfo.missing:[];
  var likesCount=Math.max(0,parseInt((state.me&&state.me.likes_cnt)||p.likes_cnt||0,10)||0);
  var auth=state.auth||{},accountEmail=String(auth.email||p.email||(state.me&&state.me.email)||'').trim();
  var accountCopy=accountEmail?t('email_saved_profile','Email сохранён для следующего входа.'):t('secure_account_copy','Добавьте email и пароль, чтобы не потерять профиль и переписки.');
  var balance=parseInt(state.me&&state.me.balance,10)||0;
  var ints = p.interests || p.tags || [];
  var nextSteps=[];
  if(!photo)nextSteps.push({key:'photo',title:t('next_step_photo','Добавьте фото')});
  if(!age)nextSteps.push({key:'age',title:t('next_step_age','Укажите возраст')});
  if(!city)nextSteps.push({key:'city',title:t('next_step_city','Укажите город')});
  if(!bio)nextSteps.push({key:'bio',title:t('next_step_bio','Расскажите о себе')});
  if(!ints.length)nextSteps.push({key:'interests',title:t('next_step_interests','Выберите интересы')});
  if(!status)nextSteps.push({key:'status',title:t('next_step_status','Выберите статус дня')});
  var nextStep=missing.length?(nextSteps[0]||{key:'edit',title:t('complete_profile','Заполнить профиль')}):null;
  var intsHtml = ints.length ? ints.map(function(it){ return '<span class="chip">'+h(localizedInterest(it))+'</span>'; }).join('') : '<p class="own-profile-empty-note">'+h(t('interests_empty_note','Интересы пока не добавлены'))+'</p>';
  var managedGallery = Array.isArray(p.gallery) ? p.gallery.slice() : [];
  var photos = (p.gallery || p.photos || []).slice ? (p.gallery || p.photos || []).slice() : [];
  if (photo && photos.indexOf(photo) < 0) photos.unshift(photo);
  var galHtml = '';
  for (var i=0;i<photos.length;i++){
    var managed=managedGallery.indexOf(photos[i])>=0, isMain=(photos[i]===photo||(!photo&&i===0));
    galHtml += '<div class="pcell vc-own-photo" role="button" tabindex="0" data-photo-index="'+i+'" data-managed="'+(managed?1:0)+'" data-url="'+h(photos[i])+'" aria-label="'+h(t('open_photo','Открыть фото')+' '+(i+1))+'" style="background-image:url('+h(photos[i])+');position:relative">' +
      (isMain?'<span class="vc-pf-main-badge">'+h(t('main_photo','Главное'))+'</span>':(managed?'<button class="vc-photo-main vc-icon-glass" aria-label="'+h(t('make_main_photo','Сделать главным'))+'" title="'+h(t('make_main_photo','Сделать главным'))+'">'+semanticGlassIcon('star','vc-photo-action-icon')+'</button>':'')) +
      (managed?'<button class="vc-photo-del vc-icon-glass" aria-label="'+h(t('delete_photo','Удалить фото'))+'" title="'+h(t('delete_photo','Удалить фото'))+'">'+semanticGlassIcon('trash','vc-photo-action-icon')+'</button>':'')+'</div>';
  }
  if(!galHtml)galHtml='<button type="button" class="own-profile-photo-empty" id="vc-photo-empty"><span>'+semanticGlassIcon('camera','vc-profile-empty-icon')+'</span><b>'+h(t('add_photo','Добавить фото'))+'</b></button>';
  var factsHtml=(zodiac?'<div class="vc-pf-fact"><span>'+h(t('prof_zodiac','Знак зодиака'))+'</span><strong class="vc-profile-symbol">'+profileMetaGlassIcon('zodiac',zodiacInfo,p.zodiac)+h(zodiac)+'</strong></div>':'')+(status?'<div class="vc-pf-fact"><span>'+h(t('prof_daily_status','Статус дня'))+'</span><strong class="vc-profile-symbol">'+profileMetaGlassIcon('status',statusInfo,p.daily_status)+h(status)+'</strong></div>':'');
  var completionHtml=missing.length?'<button type="button" class="profile-missing own-profile-completion" id="vc-profile-missing" data-next-step="'+h(nextStep.key)+'">'+semanticGlassIcon('edit','vc-profile-status-icon')+'<span><b>'+h(t('next_step','Следующий шаг'))+': '+h(nextStep.title)+'</b><small>'+h(missing.length>1?t('next_step_left','Ещё')+': '+missing.slice(1).join(' · '):t('next_step_last','Последний шаг до 100%'))+'</small></span><em>'+complete+'%</em></button>':'<div class="profile-complete-ok own-profile-completion">'+semanticGlassIcon('check','vc-profile-status-icon')+'<span>'+h(t('profile_complete_done','Профиль заполнен'))+'</span><em>100%</em></div>';
  /* Profile v2 (2026-10-10): a sticky identity card on the left, compact panels on the right; purchases live in the
     left menu (desktop) and in the wallet card (mobile, where there is no left menu). */
  body.innerHTML = '<div class="profile-view own-profile-view vc-pf">' +
    '<header class="own-profile-page-head"><div><span class="own-profile-eyebrow">'+h(t('your_profile','ВАША АНКЕТА'))+'</span><h1>'+h(t('nav_profile','Профиль'))+'</h1><p>'+likesCount+' '+h(t('profile_likes','лайков анкеты'))+'</p></div><button class="own-profile-edit" id="vc-prof-edit" aria-label="'+h(t('prof_edit','Редактировать'))+'">'+semanticGlassIcon('edit','vc-profile-edit-icon')+'<span>'+h(t('prof_edit','Редактировать'))+'</span></button></header>' +
    '<div class="own-profile-layout vc-pf-layout">' +
      '<article class="vc-pf-wallet"><div class="vc-pf-wallet-copy"><span>'+h(t('account_balance','Баланс аккаунта'))+'</span><strong id="vc-pf-balance">'+h(vibeAmount(balance))+'</strong></div><div class="vc-pf-wallet-actions"><button type="button" class="vc-pf-topup" id="vc-pf-topup">'+h(t('top_up_short','Пополнить'))+'</button><button type="button" class="vc-pf-purchases" id="vc-prof-store">'+h(t('purchases','Покупки'))+'</button></div></article>' +
      '<article class="own-profile-preview vc-pf-identity">' +
        '<div class="own-profile-cover'+(photo?'':' is-empty')+'" style="'+photoStyle+'"><span class="own-profile-progress-pill">'+h(t('profile_preview_label','Так вас видят другие'))+'</span></div>' +
        '<div class="vc-pf-who"><div class="own-profile-avatar" style="'+photoStyle+'">'+(!photo?'<span class="own-profile-avatar-initials">'+h(initials(rawName))+'</span>':'')+'<button type="button" class="vc-pf-avatar-btn" id="vc-pf-avatar-btn" aria-label="'+h(t('add_photo','Добавить фото'))+'">'+semanticGlassIcon('camera','vc-pf-avatar-icon')+'</button></div>' +
        '<div class="own-profile-copy"><div class="vp-nm">'+nm+(age?', '+h(age):'')+'</div>'+(city?'<div class="vp-loc">'+semanticGlassIcon('location','vc-profile-location-icon')+'<span>'+city+'</span></div>':'')+'</div></div>' +
        (bio?'<p class="vp-bio">'+bio+'</p>':'') +
        '<div class="ints">'+intsHtml+'</div>' +
        (factsHtml?'<div class="vc-pf-facts">'+factsHtml+'</div>':'') +
        completionHtml +
        '<div class="own-profile-actions"><button class="own-profile-action" id="vc-prof-likes">'+glassIcon('activity','vc-profile-action-icon')+'<span>'+h(t('activity','Активность'))+'</span></button><button class="own-profile-action" id="vc-prof-open-settings">'+glassIcon('settings','vc-profile-action-icon')+'<span>'+h(t('nav_settings','Настройки'))+'</span></button></div>' +
      '</article>' +
      '<section class="own-profile-panels vc-pf-panels">' +
        (accountEmail?'':'<article class="own-profile-account"><div class="own-profile-card-icon">'+semanticGlassIcon('lock')+'</div><div><strong>'+h(t('secure_account_title','Профиль не защищён'))+'</strong><p>'+h(accountCopy)+'</p></div><button id="vc-prof-settings">'+h(t('secure_account','Защитить аккаунт'))+'</button></article>') +
        '<article class="vp-section own-profile-gallery"><div class="own-profile-card-head"><div><span class="own-profile-eyebrow">'+h(t('prof_photos','Фото'))+' · '+photos.length+'</span><h2>'+h(t('your_gallery','Ваша галерея'))+'</h2></div><button id="vc-photo-add" class="vc-profile-add-photo" aria-label="'+h(t('add_photo','Добавить фото'))+'">'+semanticGlassIcon('camera','vc-profile-add-icon')+'<span>'+h(t('add_photo','Добавить фото'))+'</span></button></div><div class="pgrid">'+galHtml+'</div><input type="file" id="vc-profile-photo-input" accept="image/*,.heic,.heif" hidden></article>' +
      '</section>' +
    '</div>' +
  '</div>';
  var editBtn = document.getElementById('vc-prof-edit'); if (editBtn) editBtn.addEventListener('click', toggleProfileEdit);
  var missingBtn=document.getElementById('vc-profile-missing');if(missingBtn)missingBtn.addEventListener('click',function(){vcProfileNextStep(missingBtn.getAttribute('data-next-step'));});
  wireProfilePhotos();
  var storeBtn = document.getElementById('vc-prof-store');if(storeBtn)storeBtn.addEventListener('click',function(){navigate('/store');});
  var topupBtn=document.getElementById('vc-pf-topup');if(topupBtn)topupBtn.addEventListener('click',function(){openTopUp({source:'profile'});});
  var avatarBtn=document.getElementById('vc-pf-avatar-btn');if(avatarBtn)avatarBtn.addEventListener('click',function(e){e.stopPropagation();var add=document.getElementById('vc-photo-add');if(add)add.click();});
  var likesBtn = document.getElementById('vc-prof-likes');
  if (likesBtn) likesBtn.addEventListener('click', function(){
    navigate('/activity');
  });
  var setBtn = document.getElementById('vc-prof-settings');
  if (setBtn)setBtn.addEventListener('click', function(){ navigate('/settings'); });
  var openSettings=document.getElementById('vc-prof-open-settings');if(openSettings)openSettings.addEventListener('click',function(){navigate('/settings');});
}
function wireProfilePhotos(){
  var add=document.getElementById('vc-photo-add'), empty=document.getElementById('vc-photo-empty'), input=document.getElementById('vc-profile-photo-input');
  if(empty&&add)empty.addEventListener('click',function(){add.click();});
  if(add&&input){add.disabled=$$('.vc-own-photo[data-managed="1"]').length>=9;add.addEventListener('click',function(){input.click();});input.addEventListener('change',function(){
    var file=input.files&&input.files[0];input.value='';if(!file)return;
    if(!isImageFileCandidate(file)){toast(t('bad_type','Неподдерживаемый формат'),'error');return;}
    add.disabled=true;imageFileToDataUrl(file,8*1024*1024,2048).then(function(data){return api('add_photo',{img:data});}).then(function(r){if(r&&r.ok){toast(t('photo_added','Фото добавлено'),'success');loadMe().then(viewProfile);}else{add.disabled=false;handleApiError(r,'Error');}}).catch(function(e){add.disabled=false;toast(e.message==='too_big'?t('photo_too_big','\u0424\u043e\u0442\u043e \u0431\u043e\u043b\u044c\u0448\u0435 8 \u041c\u0411'):(e.message==='heic_unsupported'?t('heic_unsupported','Это HEIC-фото не поддерживается этой версией iOS. Выберите фото из медиатеки или обновите Safari.'):t('read_failed','Не удалось прочитать файл')),'error');});
  });}
  var ownCells=$$('.vc-own-photo'),ownPhotos=ownCells.map(function(cell){return cell.dataset.url||'';}).filter(Boolean),ownName=localizedPersonName(state.me&&state.me.profile&&state.me.profile.name||state.me&&state.me.name||'');
  ownCells.forEach(function(cell){function openOwnPhoto(e){if(e&&e.target&&e.target.closest&&e.target.closest('button'))return;var idx=parseInt(cell.dataset.photoIndex,10)||0;openMediaViewer(ownPhotos,idx,ownName);}cell.addEventListener('click',openOwnPhoto);cell.addEventListener('keydown',function(e){if(e.target!==cell)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();openOwnPhoto(e);}});});
  $$('.vc-photo-main').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();var cell=btn.closest('.vc-own-photo'),url=cell&&cell.dataset.url;if(!url)return;btn.disabled=true;api('main_photo',{url:url}).then(function(r){if(r&&r.ok){toast(t('main_photo_set','Главное фото обновлено'),'success');loadMe().then(viewProfile);}else{btn.disabled=false;handleApiError(r,'Error');}}).catch(function(){btn.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});});
  $$('.vc-photo-del').forEach(function(btn){btn.addEventListener('click',async function(e){e.stopPropagation();var cell=btn.closest('.vc-own-photo'),url=cell&&cell.dataset.url;if(!url||!await vcConfirm(t('delete_photo_confirm','Удалить это фото?'),{title:t('delete_photo','Удалить фото'),tone:'danger',icon:'trash',html:'<img class="vc-photo-delete-preview" src="'+h(url)+'" alt="">',confirmText:t('delete','Удалить')}))return;btn.disabled=true;api('del_photo',{url:url}).then(function(r){if(r&&r.ok){toast(t('photo_deleted','Фото удалено'),'success');loadMe().then(viewProfile);}else{btn.disabled=false;handleApiError(r,'Error');}}).catch(function(){btn.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});});
}
/* The single "next step" button of the own profile: photos open the picker, other steps open the editor on the right field. */
function vcProfileNextStep(key){
  if(key==='photo'){var add=document.getElementById('vc-photo-add');if(add&&!add.disabled){add.click();return;}}
  var fieldId={age:'vc-pe-age',city:'vc-pe-city',bio:'vc-pe-bio',interests:'vc-pe-int-search',status:'vc-pe-status'}[key]||'';
  toggleProfileEdit();
  if(fieldId)setTimeout(function(){var f=document.getElementById(fieldId);if(!f)return;try{f.scrollIntoView({block:'center'});}catch(e){}try{f.focus({preventScroll:true});}catch(e2){f.focus();}},40);
}
async function toggleProfileEdit(){
  if (state.profileEdit){ state.profileEdit = false; viewProfile(); return; }
  state.profileEdit = true;
  var body = document.getElementById('vc-main-body'); if (!body) return;
  var p = (state.me && state.me.profile) || {};
  var editInts = Array.isArray(p.interests) ? p.interests : [];
  var zodiacVal=parseInt(p.zodiac_id!=null?p.zodiac_id:p.zodiac,10)||0;
  body.innerHTML = '<div class="profile-edit">' +
    '<div class="pe-head"><button type="button" class="chat-back vc-icon-glass" id="vc-pe-cancel" aria-label="'+h(t('cancel','Отмена'))+'">'+glassIcon('back')+'</button><div class="pe-h">'+h(t('prof_edit','Редактировать'))+'</div></div>' +
    '<label>'+h(t('name','Имя'))+'<input id="vc-pe-name" maxlength="80" autocomplete="given-name" value="'+h(p.fullname||p.name||'')+'"></label>' +
    '<label>'+h(t('city','Город'))+'<div class="city-picker-row"><div class="city-picker"><input id="vc-pe-city" maxlength="60" value="'+h(p.city||'')+'" autocomplete="address-level2"><div class="city-suggest" role="listbox" hidden></div></div><button type="button" class="set-btn vc-labelled-glass-button" id="vc-pe-geo">'+semanticGlassIcon('location')+'<span>'+h(t('detect','Определить'))+'</span></button></div></label>' +
    '<label>'+h(t('age','Возраст'))+'<input id="vc-pe-age" type="number" min="18" max="80" inputmode="numeric" value="'+h(p.age||p.u_age||'')+'"></label>' +
    '<label>'+h(t('looking_for','Кого ищете'))+'<select id="vc-pe-look"><option value="0">'+h(t('not_selected','Не выбрано'))+'</option><option value="2"'+(parseInt(p.look,10)===2?' selected':'')+'>'+h(t('women','Девушек'))+'</option><option value="1"'+(parseInt(p.look,10)===1?' selected':'')+'>'+h(t('men','Парней'))+'</option><option value="3"'+(parseInt(p.look,10)===3?' selected':'')+'>'+h(t('everyone','Всех'))+'</option></select></label>' +
    '<label>'+h(t('prof_zodiac','Знак зодиака'))+'<select id="vc-pe-zodiac">'+zodiacOptions(zodiacVal)+'</select></label>' +
    '<label>'+h(t('prof_daily_status','Статус дня'))+'<select id="vc-pe-status">'+dailyStatusOptions(parseInt(p.daily_status,10)||0)+'</select></label>' +
    '<label>'+h(t('profile_story','О себе'))+'<textarea id="vc-pe-bio" maxlength="500" rows="4" placeholder="'+h(t('bio_placeholder','Пара фраз о себе: чем увлекаешься, что ищешь'))+'">'+h(p.bio||'')+'</textarea><small class="pe-count" id="vc-pe-bio-count"></small></label>' +
    '<div class="pe-interests" role="group" aria-labelledby="vc-pe-int-label"><span id="vc-pe-int-label">'+h(t('prof_interests','Интересы'))+'</span><input id="vc-pe-int-search" type="search" autocomplete="off" placeholder="'+h(t('interests_search','Найти интерес'))+'" aria-label="'+h(t('interests_search','Найти интерес'))+'"><div class="vc-int-chips" id="vc-pe-int-chips"></div><label>'+h(t('interests_custom','Свои интересы через запятую'))+'<input id="vc-pe-ints" value="'+h(editInts.join(', '))+'" placeholder="'+h(t('interests_placeholder','Через запятую: музыка, кофе, путешествия'))+'"></label></div>' +
    '<div class="pe-actions"><button class="pe-save" id="vc-pe-save">'+h(t('prof_save','Сохранить'))+'</button></div>' +
  '</div>';
  var peRoot=document.getElementById('vc-main-body').querySelector('.profile-edit'),peDirty=false,peGuard=function(e){if(peDirty){e.preventDefault();e.returnValue='';}};
  if(peRoot){peRoot.addEventListener('input',function(){peDirty=true;});peRoot.addEventListener('change',function(){peDirty=true;});window.addEventListener('beforeunload',peGuard);var peObs=new MutationObserver(function(){if(!peRoot.isConnected){window.removeEventListener('beforeunload',peGuard);peObs.disconnect();}});peObs.observe(body,{childList:true});}
  var peCancel=document.getElementById('vc-pe-cancel');if(peCancel)peCancel.addEventListener('click',async function(){if(peDirty&&!await vcConfirm(t('unsaved_changes_text','Изменения не сохранены. Выйти без сохранения?'),{title:t('unsaved_changes','Несохранённые изменения'),icon:'!',confirmText:t('discard','Выйти без сохранения'),cancelText:t('keep_editing','Продолжить редактирование')}))return;state.profileEdit=false;viewProfile();});
  var peBio=document.getElementById('vc-pe-bio'),peBioCount=document.getElementById('vc-pe-bio-count');function peBioSync(){if(peBioCount)peBioCount.textContent=(peBio.value.length)+' / 500';}if(peBio){peBio.addEventListener('input',peBioSync);peBioSync();}
  (function(){
    var intInput=document.getElementById('vc-pe-ints'),chipBox=document.getElementById('vc-pe-int-chips'),intSearch=document.getElementById('vc-pe-int-search');if(!intInput||!chipBox)return;
    var base=['фитнес','спорт','музыка','путешествия','книги','кофе','фотография','кино','йога','искусство','море','кулинария','горы','животные','бег','литература','рисование','танцы','языки','вино','театр','психология','игры','дизайн','природа','прогулки','джаз','архитектура','сноуборд','серфинг'];
    function cur(){return intInput.value.split(',').map(function(x){return x.trim();}).filter(Boolean);}
    function idx(list,v){var k=String(v).toLowerCase();for(var i=0;i<list.length;i++)if(String(list[i]).toLowerCase()===k)return i;return -1;}
    function draw(){
      var list=cur(),q=intSearch?intSearch.value.trim().toLowerCase():'',all=base.slice();
      list.forEach(function(x){if(idx(all,x)<0)all.unshift(x);});
      var html='';all.forEach(function(x){var label=localizedInterest(x),on=idx(list,x)>=0;if(q&&label.toLowerCase().indexOf(q)<0&&String(x).toLowerCase().indexOf(q)<0)return;html+='<button type="button" class="vc-int-chip'+(on?' is-on':'')+'" data-int="'+h(x)+'" aria-pressed="'+(on?'true':'false')+'">'+h(label)+'</button>';});
      chipBox.innerHTML=html||'<span class="sr-sub">'+h(t('interests_none','Ничего не найдено — добавьте через запятую'))+'</span>';
    }
    chipBox.addEventListener('click',function(e){
      var b=e.target.closest?e.target.closest('[data-int]'):null;if(!b)return;
      var list=cur(),v=b.dataset.int,i=idx(list,v);
      if(i>=0)list.splice(i,1);else{if(list.length>=8){toast(t('interests_limit','Не больше 8 интересов'),'error');return;}list.push(v);}
      intInput.value=list.join(', ');intInput.dispatchEvent(new Event('input',{bubbles:true}));draw();
    });
    if(intSearch)intSearch.addEventListener('input',draw);intInput.addEventListener('input',draw);draw();
  })();
  var profileCityInput=document.getElementById('vc-pe-city');vcCityPicker(profileCityInput,{initialKey:vcCityKeyForName(p.city||'')});
  var geo=document.getElementById('vc-pe-geo');if(geo)geo.addEventListener('click',function(){
    if(!navigator.geolocation){toast(t('geo_unavailable','Геолокация недоступна'),'error');return;}geo.disabled=true;
    navigator.geolocation.getCurrentPosition(function(pos){api('geocode',{lat:pos.coords.latitude,lng:pos.coords.longitude}).then(function(r){geo.disabled=false;if(r&&r.ok&&r.city){document.getElementById('vc-pe-city').value=r.city;toast(t('city_detected','Город определён'),'success');}else handleApiError(r,t('geo_not_found','Не удалось определить город'));}).catch(function(){geo.disabled=false;toast(t('network_error','Ошибка сети'),'error');});},function(){geo.disabled=false;toast(t('geo_denied','Нет доступа к геолокации'),'error');},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});
  });
  var save = document.getElementById('vc-pe-save');
  if (save) save.addEventListener('click', function(){
    var interests = document.getElementById('vc-pe-ints').value.split(',').map(function(s){return s.trim();}).filter(Boolean);
    var age=parseInt(document.getElementById('vc-pe-age').value,10)||0,city=document.getElementById('vc-pe-city').value.trim(),look=parseInt(document.getElementById('vc-pe-look').value,10)||0,zodiac=parseInt(document.getElementById('vc-pe-zodiac').value,10)||0;
    if(age<18||age>80){toast(t('age_18_99','Возраст должен быть от 18 до 80'),'error');return;}if(!city){toast(t('city_required','Укажите город'),'error');return;}
    var localData = {
      name: document.getElementById('vc-pe-name').value.trim(),
      city:city,age:age,look:look,zodiac:zodiac,bio:(peBio?peBio.value.trim():(p.bio||'')),
      daily_status: parseInt(document.getElementById('vc-pe-status').value,10) || 0,
      interests: interests
    };
    var data = {
      name: localData.name,
      surname: p.surname || '',
      age: age,
      city: city,
      sex: parseInt(p.sex,10) || 0,
      look: look,
      bio: localData.bio,
      zodiac: zodiac,
      daily_status: localData.daily_status,
      interests: JSON.stringify(interests)
    };
    save.disabled = true;
    api('save_profile', data).then(function(r){
      if (r && r.ok){
        if (state.me && state.me.profile){
          Object.assign(state.me.profile, localData);
          if (r.profile_complete != null) state.me.profile.profile_complete = r.profile_complete;
        }
        toast(t('prof_saved','Сохранено!'),'success');state.profileEdit=false;return loadMe().then(function(){viewProfile();renderTopbar();});
      }
      throw new Error((r && r.err) || 'Error');
    }).catch(function(){ toast(t('save_failed','Не удалось сохранить профиль. Попробуйте ещё раз.'), 'error'); }).then(function(){ save.disabled = false; });
  });
}
function zodiacOptions(selected){var out='<option value="0"'+(selected===0?' selected':'')+'>— '+h(t('not_selected','Не выбрано'))+' —</option>';for(var i=1;i<PROFILE_ZODIAC_META.length;i++){var meta=PROFILE_ZODIAC_META[i];out+='<option value="'+i+'"'+(selected===i?' selected':'')+'>'+h(t(meta.key,meta.fallback))+'</option>';}return out;}
function dailyStatusOptions(selected){
  var out='<option value="0"'+(selected===0?' selected':'')+'>— '+h(t('not_selected','Не выбрано'))+' —</option>';
  for(var i=1;i<PROFILE_STATUS_META.length;i++){var meta=PROFILE_STATUS_META[i];out+='<option value="'+i+'"'+(selected===i?' selected':'')+'>'+h(t(meta.key,meta.fallback))+'</option>';}
  return out;
}

/* ===== View: Settings ===== */
function viewSettings(){
  var body = document.getElementById('vc-main-body');
  if (!body) return;
  var p = (state.me && state.me.profile) || {};
  var auth = state.auth || {};
  var email = auth.email || p.email || (state.me && state.me.email) || '';
  var hasPass = auth.has_password === true || parseInt(auth.has_password,10) === 1;
  var isFemale = parseInt(p.sex||p.gender,10) === 2;
  var pushOn = !!state.pushSub;
  var canUpgrade = auth.can_upgrade_email === true || parseInt(auth.can_upgrade_email,10) === 1;
  /* Ukrainian is temporarily hidden from the picker (owner request 2026-10-02);
     the uk dictionary stays shipped for when it returns. */
  var langs = [{k:'ru',l:'Русский'}];
  var langHtml = '';
  for (var i=0;i<langs.length;i++) langHtml += '<option value="'+langs[i].k+'"'+(state.lang===langs[i].k?' selected':'')+'>'+h(langs[i].l)+'</option>';
  body.innerHTML = '<div class="settings-view">' +
    premiumPageHead({eyebrow:t('account','Аккаунт'),title:t('settings','Настройки'),subtitle:t('set_page_sub','Вход, уведомления, оформление, приватность и помощь'),tone:'purple'})+
    '<div class="set-section" id="vc-settings-account"><div class="set-h">'+h(t('set_group_access','Вход и доступ'))+'</div>' +
      '<div class="set-row"><div class="sr-lbl">'+h(t('set_email','Email'))+'</div><div class="sr-val">'+(email?h(email):'\u2014')+'</div></div>' +
      (canUpgrade ? '<div class="vc-premium-account-note"><strong>'+h(t('secure_account_title','Профиль не защищён'))+'</strong><small>'+h(t('secure_account_copy','Добавьте email и пароль, чтобы не потерять профиль и переписки.'))+'</small><button type="button" class="set-btn vc-labelled-glass-button" id="vc-set-secure">'+semanticGlassIcon('lock')+'<span>'+h(t('secure_account','Защитить аккаунт'))+'</span></button></div>' : '') +
      (hasPass ? '<div class="set-row"><button class="set-btn vc-labelled-glass-button" id="vc-set-pass">'+semanticGlassIcon('lock')+'<span>'+h(t('set_change_password','Сменить пароль'))+'</span></button></div>' : '') +
    '</div>' +
    /* Occupation section */
    '<div class="set-section" hidden><div class="set-h">'+h(t('set_occupation','Профессия'))+'</div>' +
      '<div class="set-row"><select id="vc-set-occupation">' +
        '<option value="">— Не указано —</option>' +
        '<option value="Студентка">Студентка</option>' +
        '<option value="Работает в офисе">Работает в офисе</option>' +
        '<option value="Фрилансер">Фрилансер</option>' +
        '<option value="Бизнес-леди">Бизнес-леди</option>' +
        '<option value="Домохозяйка">Домохозяйка</option>' +
        '<option value="Творческая профессия">Творческая профессия</option>' +
        '<option value="В поиске себя">В поиске себя</option>' +
        '<option value="Модель">Модель</option>' +
        '<option value="Дизайнер">Дизайнер</option>' +
        '<option value="Маркетолог">Маркетолог</option>' +
        '<option value="Учитель">Учитель</option>' +
        '<option value="Врач">Врач</option>' +
        '<option value="Психолог">Психолог</option>' +
        '<option value="Бариста">Бариста</option>' +
        '<option value="SMM-менеджер">SMM-менеджер</option>' +
        '<option value="Архитектор">Архитектор</option>' +
        '<option value="Фотограф">Фотограф</option>' +
        '<option value="Стилист">Стилист</option>' +
        '<option value="Переводчик">Переводчик</option>' +
        '<option value="Адвокат">Адвокат</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="set-section"><div class="set-h">'+h(t('set_push','Уведомления'))+'</div>' +
      '<div class="set-row"><button class="set-btn vc-labelled-glass-button" id="vc-set-push">'+glassIcon('bell')+'<span>'+(pushOn ? h(t('set_push_disable','Выключить пуш-уведомления')) : h(t('set_push_enable','Включить пуш-уведомления')))+'</span></button></div>' +
      (pushOn ? '<div class="set-row"><button class="set-btn vc-labelled-glass-button" id="vc-set-push-test">'+glassIcon('bell')+'<span>'+h(t('set_push_test','Тестовое уведомление'))+'</span></button></div>' : '') +
      '<div id="vc-notif-prefs" style="padding:8px 0;color:var(--text2)"><div class="spin"></div></div>' +
    '</div>' +
    '<div class="set-section"><div class="set-h">'+h(t('privacy','Приватность и безопасность'))+'</div>' +
      '<div class="set-row"><button class="set-btn vc-labelled-glass-button" id="vc-set-blocked">'+glassIcon('block')+'<span>'+h(t('blocked_users','Заблокированные пользователи'))+'</span></button></div><div id="vc-blocked-list"></div>' +
      '<div class="set-row"><button class="set-btn vc-labelled-glass-button" id="vc-set-tos">'+semanticGlassIcon('check')+'<span>'+h(t('tos','Условия использования'))+'</span></button><div class="sr-sub" id="vc-tos-status"></div><div class="vc-settings-legal"><a href="'+h(legalUrl('tos'))+'" target="_blank" rel="noopener">'+h(t('terms','Условия'))+'</a><a href="'+h(legalUrl('privacy'))+'" target="_blank" rel="noopener">'+h(t('privacy_policy','Конфиденциальность'))+'</a><a href="'+h(legalUrl('eu-terms'))+'" target="_blank" rel="noopener">'+h(t('eu_consumer_terms','Условия ЕС'))+'</a><a href="'+h(legalUrl('withdrawal-eu'))+'" target="_blank" rel="noopener">'+h(t('withdrawal_eu','Отказ от покупки (ЕС)'))+'</a><a href="'+h(legalUrl('privacy-gdpr'))+'" target="_blank" rel="noopener">'+h(t('privacy_gdpr','Уведомление о GDPR'))+'</a><a href="'+h(legalUrl('community-guidelines'))+'" target="_blank" rel="noopener">'+h(t('community_rules','Правила сообщества'))+'</a></div></div>' +
    '</div>' +
    (isFemale?'<div class="set-section"><div class="set-h vc-settings-heading-icon">'+semanticGlassIcon('wallet')+'<span>'+h(t('earnings','Заработок'))+'</span></div><div id="vc-seller-economy"><div class="spin"></div></div></div>':'') +
    '<div class="set-section"><div class="set-h">'+h(t('set_group_help','Помощь'))+'</div><div class="sr-sub">'+h(t('support_intro','Опишите вопрос — мы ответим здесь. Тексты переписок к обращению не прикладываются.'))+'</div>' +
      '<button type="button" class="set-btn vc-labelled-glass-button" id="vc-support-open"><span>'+h(t('support_open','Открыть страницу поддержки'))+'</span></button>' +
    '</div>' +
    '<div class="set-section"><div class="set-h">'+h(t('set_install','Установить приложение'))+'</div>' +
      '<div class="set-row"><button class="set-btn vc-labelled-glass-button" id="vc-set-install" '+((window.VC_INSTALL&&window.VC_INSTALL.isInstalled())?'disabled aria-disabled="true"':'')+'>'+semanticGlassIcon('download')+'<span>'+h(t('set_install','Установить'))+'</span></button><div class="sr-sub">'+h(t('set_install_sub','Добавить на главный экран'))+'</div></div>' +
    '</div>' +
    '' +
    '<div class="set-section vc-appearance-section"><div class="set-h">'+h(t('set_group_look','Внешний вид и язык'))+'</div><div class="vc-theme-switch" role="radiogroup" aria-label="'+h(t('theme','Тема'))+'">'+
      '<button type="button" data-vc-theme="light" role="radio" aria-checked="'+(state.theme==='light'?'true':'false')+'" class="'+(state.theme==='light'?'is-active':'')+'"><span>'+semanticGlassIcon('theme-light')+'</span><strong>'+h(t('theme_light','Светлая'))+'</strong></button>'+
      '<button type="button" data-vc-theme="dark" role="radio" aria-checked="'+(state.theme==='dark'?'true':'false')+'" class="'+(state.theme==='dark'?'is-active':'')+'"><span>'+semanticGlassIcon('theme-dark')+'</span><strong>'+h(t('theme_dark','Тёмная'))+'</strong></button>'+
      '<button type="button" data-vc-theme="system" role="radio" aria-checked="'+(state.theme==='system'?'true':'false')+'" class="'+(state.theme==='system'?'is-active':'')+'"><span>'+semanticGlassIcon('theme-system')+'</span><strong>'+h(t('theme_system','Как в системе'))+'</strong></button></div><div class="sr-sub">'+h(t('theme_system_hint','Системная тема автоматически следует настройкам устройства.'))+'</div><label class="vc-set-lang-row"><span class="sr-lbl">'+h(t('set_language','Язык'))+'</span><select id="vc-set-lang">'+langHtml+'</select></label></div>' +
    '<div class="set-section vc-account-zone"><div class="set-h">'+h(t('set_group_about','Об аккаунте'))+'</div><div class="set-row"><button class="set-logout vc-labelled-glass-button" id="vc-set-logout">'+semanticGlassIcon('logout')+'<span>'+h(t('set_logout','Выйти'))+'</span></button></div>' +
      '<div class="set-row vc-danger-zone"><div class="sr-sub">'+h(t('delete_account_hint','Аккаунт деактивируется на 30 дней — за это время его можно восстановить входом.'))+'</div><button class="set-logout vc-labelled-glass-button vc-danger-btn" id="vc-delete-account">'+semanticGlassIcon('trash')+'<span>'+h(t('delete_account','Удалить аккаунт'))+'</span></button></div></div>' +
  '</div>';
  var passBtn = document.getElementById('vc-set-pass');
  if (passBtn) passBtn.addEventListener('click', async function(){
    var values=await vcModal({title:t('set_change_password','Сменить пароль'),icon:'lock',fields:[{name:'old',type:'password',label:t('current_password','Текущий пароль'),required:false},{name:'newpass',type:'password',label:t('new_password','Новый пароль'),minlength:8,required:true},{name:'repeat',type:'password',label:t('repeat_password','Повторите новый пароль'),minlength:8,required:true}],confirmText:t('save','Сохранить')});if(!values)return;
    if(String(values.newpass||'').length<8){toast(t('login_err_weak_password','Пароль слишком короткий'),'error');return;}if(values.newpass!==values.repeat){toast(t('passwords_mismatch','Пароли не совпадают'),'error');return;}
    setBusy(passBtn,true);authApi('change_password', {old:values.old||'',new:values.newpass}).then(function(r){setBusy(passBtn,false);if (r && r.ok) vcNotice(t('password_changed','Пароль изменён'),t('password_changed_copy','Используйте новый пароль при следующем входе.'),'success'); else vcNotice(t('password_not_changed','Не удалось изменить пароль'),localizedErrorText(r&&r.err),'error');}).catch(function(){setBusy(passBtn,false);toast(t('network_error','Ошибка сети'),'error');});
  });
  var secureBtn = document.getElementById('vc-set-secure');
  if(secureBtn)secureBtn.addEventListener('click',async function(){setBusy(secureBtn,true);await secureCurrentAccount({source:'settings'});if(state.route==='/settings')viewSettings();});
  var pushBtn = document.getElementById('vc-set-push');
  if (pushBtn) pushBtn.addEventListener('click', function(){
    if(state.pushMutationBusy)return;state.pushMutationBusy=true;setBusy(pushBtn,true);
    var job=state.pushSub?disablePush():enablePush();Promise.resolve(job).then(function(){state.pushMutationBusy=false;if(pushBtn.isConnected)setBusy(pushBtn,false);},function(){state.pushMutationBusy=false;if(pushBtn.isConnected)setBusy(pushBtn,false);});
  });
  var ptestBtn = document.getElementById('vc-set-push-test');
  if (ptestBtn) ptestBtn.addEventListener('click', function(){
    if(ptestBtn.disabled)return;setBusy(ptestBtn,true);
    authApi('push_test', {}).then(function(r){
      setBusy(ptestBtn,false);
      if (r && r.ok) toast('\u2713', 'success'); else toast(localizedErrorText(r&&r.err), 'error');
    }).catch(function(){setBusy(ptestBtn,false);toast(t('network_error','Ошибка сети'),'error');});
  });
  loadSettingsExtras();
  var instBtn = document.getElementById('vc-set-install');
  if (instBtn) instBtn.addEventListener('click', function(){ promptInstall(); });
  
  var themeChoices=$$('[data-vc-theme]',body),themeGroup=body.querySelector('.vc-theme-switch');
  themeChoices.forEach(function(themeButton){themeButton.addEventListener('click',function(){applyTheme(normalizeTheme(themeButton.dataset.vcTheme),true);toast(t('theme_updated','Тема обновлена'),'success');});});
  if(themeGroup)themeGroup.addEventListener('keydown',function(e){
    if(!/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End)$/.test(e.key))return;
    var choices=$$('[data-vc-theme]',themeGroup),current=Math.max(0,choices.indexOf(document.activeElement)),next=current;
    if(e.key==='Home')next=0;else if(e.key==='End')next=choices.length-1;else next=(current+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+choices.length)%choices.length;
    e.preventDefault();if(choices[next]){choices[next].focus();choices[next].click();}
  });
  syncThemeControls(state.theme||'system',state.resolvedTheme||resolvedTheme(state.theme||'system'));
  /* Occupation — load current value and wire change */
  var occSel = document.getElementById('vc-set-occupation');
  if (occSel) {
    authApi('profile_ext_get', {key: 'occupation'}).then(function(r){
      if (r && r.ok && r.value) { occSel.value = r.value; state.occupation = r.value; }
      else state.occupation = '';
    });
    occSel.addEventListener('change', function(){
      var v = occSel.value,previous=state.occupation||'';
      state.occupation = v;occSel.disabled=true;
      authApi('profile_ext_set', {key: 'occupation', value: v}).then(function(r){
        occSel.disabled=false;
        if (r && r.ok) toast('✓', 'success'); else{state.occupation=previous;occSel.value=previous;handleApiError(r,'Error');}
      }).catch(function(){occSel.disabled=false;state.occupation=previous;occSel.value=previous;toast(t('network_error','Ошибка сети'),'error');});
    });
  }
  var langSel = document.getElementById('vc-set-lang');
  if (langSel) langSel.addEventListener('change', function(){
    var l = langSel.value,previous=state.lang;langSel.disabled=true;
    authApi('set_lang', {lang: l}).then(function(r){
      langSel.disabled=false;
      if(!r||!r.ok){langSel.value=previous;toast(localizedErrorText(r&&r.err,t('language_not_saved','Не удалось сохранить язык')),'error');return;}
      applyAppLanguage(l,'manual',true);
      /* Server-localized payload (profile hints) must follow the new language. */
      state.meLoading=null;loadMe().then(function(){if(state.route==='/settings'||state.route==='/profile')router();}).catch(function(){});
      toast(t('language_saved','Язык сохранён'), 'success');
    }).catch(function(){langSel.disabled=false;langSel.value=previous;toast(t('network_error','Ошибка сети'),'error');});
  });
  var lo = document.getElementById('vc-set-logout');
  if (lo) lo.addEventListener('click', async function(){
    var loAuth=state.auth||{},loUnsecured=!(loAuth.has_password===true||parseInt(loAuth.has_password,10)===1)&&!String(loAuth.email||'').trim();
    if(loUnsecured){
      /* A guest without email/password cannot sign back in: offer to secure the profile first. */
      var loAnyway=false,loChoice=await vcModal({title:t('set_logout','Выйти'),icon:'lock',tone:'error',html:'<p>'+h(t('logout_guest_warning','У профиля нет email и пароля. После выхода вернуться в него, к балансу и перепискам будет нельзя.'))+'</p><button type="button" class="vc-modal-danger-link" data-logout-anyway>'+h(t('logout_anyway','Всё равно выйти'))+'</button>',cancelText:t('cancel','Отмена'),confirmText:t('secure_account','Защитить аккаунт'),onReady:function(card){var b=card.querySelector('[data-logout-anyway]');if(b)b.addEventListener('click',function(){loAnyway=true;var x=card.querySelector('.vc-modal-x');if(x)x.click();});}});
      if(loChoice){secureCurrentAccount();return;}
      if(!loAnyway)return;
    }else if (!await vcConfirm(t('set_logout_confirm','Выйти из аккаунта?'),{title:t('set_logout','Выйти'),icon:'↪',confirmText:t('set_logout','Выйти')})) return;
    var sub=state.pushSub;setBusy(lo,true);
    authApi('logout', {endpoint:sub?sub.endpoint:''}).then(function(r){
      if(!r||!r.ok){setBusy(lo,false);toast(localizedErrorText(r&&r.err,t('logout_failed','Не удалось выйти')),'error');return null;}
      return sub?sub.unsubscribe().catch(function(){return false;}):true;
    }).then(function(serverLoggedOut){
      if(serverLoggedOut===null)return;
      setGuestAccessMarker(0);clearAllChatDrafts();state.guestRecoveryNeeded=false;state.pushSub=null;state.uid = 0; state.me = null; state.auth = null; state.isGuest = false; navigate('/onboarding');
    }).catch(function(){setBusy(lo,false);toast(t('network_error','Ошибка сети'),'error');});
  });
  var del=document.getElementById('vc-delete-account');
  if(del)del.addEventListener('click',async function(){
    var delAuth=state.auth||{},delHasPass=delAuth.has_password===true||parseInt(delAuth.has_password,10)===1;
    var values=await vcModal({title:t('delete_account','Удалить аккаунт'),icon:'!',tone:'danger',html:'<p>'+h(t('delete_account_confirm','Аккаунт будет деактивирован. В течение 30 дней его можно восстановить обычным входом.'))+'</p><ul class="vc-danger-list"><li>'+h(t('delete_lost_matches','Анкета сразу исчезнет из поиска'))+'</li><li>'+h(t('delete_lost_profile','Сессии и уведомления будут отключены'))+'</li><li>'+h(t('delete_lost_balance','Переписки и баланс сохранятся для восстановления'))+'</li></ul>',fields:[{name:'word',type:'text',label:t('delete_account_type','Для подтверждения введите DELETE'),placeholder:'DELETE',required:true}].concat(delHasPass?[{name:'password',type:'password',autocomplete:'current-password',label:t('delete_account_password','Введите пароль для подтверждения'),required:true}]:[]),confirmText:t('deactivate_account','Деактивировать'),dismiss:false});if(!values)return;
    if(String(values.word||'').trim().toUpperCase()!=='DELETE'){toast(t('delete_account_mismatch','Подтверждение не совпало'),'error');return;}
    del.disabled=true;var delPayload={confirm:'DELETE'};if(delHasPass)delPayload.password=String(values.password||'');api('delete_account',delPayload).then(function(r){if(r&&r.ok){var sub=state.pushSub;return (sub?sub.unsubscribe().catch(function(){return false;}):Promise.resolve()).then(function(){setGuestAccessMarker(0);clearAllChatDrafts();state.pushSub=null;state.uid=0;state.me=null;state.auth=null;toast(t('account_deactivated','Аккаунт деактивирован на 30 дней'),'success');navigate('/onboarding');});}del.disabled=false;if(r&&r.err==='bad_credentials'){toast(t('delete_account_bad_password','Неверный пароль'),'error');return;}handleApiError(r,'Error');}).catch(function(){del.disabled=false;toast(t('network_error','Ошибка сети'),'error');});
  });
}
function loadSettingsExtras(){
  loadNotifPrefs(); loadTosStatus();
  if(document.getElementById('vc-seller-economy'))loadSellerEconomy();
  var blocked=document.getElementById('vc-set-blocked');if(blocked)blocked.addEventListener('click',loadBlockedUsers);
  var tos=document.getElementById('vc-set-tos');if(tos)tos.addEventListener('click',acceptTosIfNeeded);
  var support=document.getElementById('vc-support-open');if(support)support.addEventListener('click',function(){navigate('/support');});
}
function loadNotifPrefs(){
  api('get_notif_prefs').then(function(r){
    var box=document.getElementById('vc-notif-prefs');if(!box)return;
    if(!r||!r.ok){box.textContent=localizedErrorText(r&&r.err);return;}
    var prefs=r.prefs||{}, labels={msg:t('notif_msg','Сообщения'),like:t('notif_like','Лайки'),guest:t('notif_guest','Гости профиля'),sound:t('notif_sound','Звуки уведомлений'),sound_msg:t('notif_sound_msg','Звук сообщений'),sound_like:t('notif_sound_like','Звук лайков'),sound_guest:t('notif_sound_guest','Звук просмотров'),online:t('notif_online','Анкеты, за которыми вы следите'),money:t('notif_money','Баланс и акции'),sound_online:t('notif_sound_online','Звук онлайн-оповещений'),sound_money:t('notif_sound_money','Звук пополнений')},html='<div class="vc-notif-pref-group"><small>'+h(t('notification_events','События'))+'</small>';
    ['msg','like','guest','online','money'].forEach(function(k){html+='<label><span><i class="vcn-dot" data-kind="'+({msg:'message',like:'like',guest:'guest',online:'online',money:'topup'})[k]+'"></i>'+h(labels[k])+'</span><input type="checkbox" data-pref="'+k+'"'+(prefs[k]?' checked':'')+'></label>';});
    html+='</div><div class="vc-notif-pref-group"><small>'+h(t('notification_sounds','Звуки'))+'</small>';
    html+='<label><span>'+h(labels.sound)+'</span><input type="checkbox" data-pref="sound"'+(prefs.sound?' checked':'')+'></label><details class="vc-notif-details"><summary>'+h(t('notif_sound_more','Звуки по типам'))+'</summary>';
    ['sound_msg','sound_like','sound_guest','sound_online','sound_money'].forEach(function(k){html+='<label><span>'+h(labels[k])+'</span><input type="checkbox" data-pref="'+k+'"'+(prefs[k]?' checked':'')+'></label>';});
    var localQh=vcQuietHoursLocal();
    var serverQh={on:!!prefs.quiet_on,from:/^\d{1,2}:\d{2}$/.test(prefs.quiet_from)?prefs.quiet_from:'22:00',to:/^\d{1,2}:\d{2}$/.test(prefs.quiet_to)?prefs.quiet_to:'08:00'};
    var serverIsDefault=!serverQh.on&&serverQh.from==='22:00'&&serverQh.to==='08:00';
    var localIsDefault=!localQh.on&&localQh.from==='22:00'&&localQh.to==='08:00';
    var qh=serverQh;
    if(serverIsDefault&&!localIsDefault){
      qh=localQh;
      try{api('set_notif_prefs',{prefs:JSON.stringify({quiet_on:localQh.on?1:0,quiet_from:localQh.from,quiet_to:localQh.to})}).then(function(rr){if(rr&&rr.ok){state.notifPrefs=rr.prefs||state.notifPrefs;}}).catch(function(){});}catch(e){}
      try{localStorage.setItem('vc_quiet_hours',JSON.stringify(localQh));}catch(e){}
    }else{
      try{localStorage.setItem('vc_quiet_hours',JSON.stringify(serverQh));}catch(e){}
    }
    html+='</details></div><div class="vc-notif-pref-group vc-quiet-group"><small>'+h(t('notif_quiet','Тихие часы'))+'</small><label><span>'+h(t('notif_quiet_on','Включить тихие часы'))+'</span><input type="checkbox" id="vc-quiet-on"'+(qh.on?' checked':'')+'></label><div class="vc-quiet-times"><label><span>'+h(t('notif_quiet_from','С'))+'</span><input type="time" id="vc-quiet-from" value="'+h(('0'+qh.from).slice(-5))+'"></label><label><span>'+h(t('notif_quiet_to','До'))+'</span><input type="time" id="vc-quiet-to" value="'+h(('0'+qh.to).slice(-5))+'"></label></div><div class="vc-quiet-summary" id="vc-quiet-summary" aria-live="polite"></div><div class="sr-sub">'+h(t('notif_quiet_hint','В это время — без звука и без всплывающих лайков и просмотров. Сообщения приходят без звука.'))+'</div>';
    box.innerHTML=html+'</div>';state.notifPrefs=prefs;
    $$('input[type="checkbox"]',box).forEach(function(i){i.setAttribute('role','switch');});
    var qOn=document.getElementById('vc-quiet-on'),qFrom=document.getElementById('vc-quiet-from'),qTo=document.getElementById('vc-quiet-to');
    function saveQuiet(){var qd={on:qOn.checked,from:qFrom.value||'22:00',to:qTo.value||'08:00'};try{localStorage.setItem('vc_quiet_hours',JSON.stringify(qd));}catch(e){toast(t('save_failed','Не удалось сохранить'),'error');return;}try{api('set_notif_prefs',{prefs:JSON.stringify({quiet_on:qd.on?1:0,quiet_from:qd.from,quiet_to:qd.to})}).then(function(rr){if(rr&&rr.ok){state.notifPrefs=rr.prefs||state.notifPrefs;toast(t('saved','Сохранено'),'success');}else{handleApiError(rr,'Error');}}).catch(function(){toast(t('network_error','Ошибка сети'),'error');});}catch(e){toast(t('saved','Сохранено'),'success');}}
    var quietSummary=document.getElementById('vc-quiet-summary'),quietTimer=0;
    function quietSync(){var on=qOn.checked;qFrom.disabled=!on;qTo.disabled=!on;var wrap=qFrom.closest?qFrom.closest('.vc-quiet-times'):null;if(wrap)wrap.classList.toggle('is-off',!on);if(quietSummary){var a=qFrom.value||'22:00',b=qTo.value||'08:00';quietSummary.textContent=!on?t('quiet_off','Тихие часы выключены'):(a===b?t('quiet_same','Начало и конец совпадают — тихие часы не действуют'):t('quiet_every_day','Каждый день')+', '+a+'–'+b);}}
    function quietQueueSave(){clearTimeout(quietTimer);quietTimer=setTimeout(saveQuiet,450);}
    [qOn,qFrom,qTo].forEach(function(x){if(x)x.addEventListener('change',function(){quietSync();quietQueueSave();});});
    quietSync();
    $$('[data-pref]',box).forEach(function(ch){ch.addEventListener('change',function(){
      var controls=$$('[data-pref]',box),previous=Object.assign({},state.notifPrefs||{}),data={};
      controls.forEach(function(x){data[x.dataset.pref]=x.checked?1:0;x.disabled=true;});box.style.opacity='.55';box.setAttribute('aria-busy','true');
      function restore(){controls.forEach(function(x){x.disabled=false;x.checked=!!previous[x.dataset.pref];});box.style.opacity='';box.removeAttribute('aria-busy');}
      api('set_notif_prefs',{prefs:JSON.stringify(data)}).then(function(rr){
        controls.forEach(function(x){x.disabled=false;});box.style.opacity='';box.removeAttribute('aria-busy');
        if(rr&&rr.ok){state.notifPrefs=data;try{var np=rr.prefs||data;var lq=vcQuietHoursLocal();if(np.quiet_on!==undefined||np.quiet_from!==undefined){state.notifPrefs.quiet_on=(np.quiet_on!==undefined)?(np.quiet_on?1:0):((previous.quiet_on!==undefined)?previous.quiet_on:(lq.on?1:0));state.notifPrefs.quiet_from=np.quiet_from||previous.quiet_from||lq.from;state.notifPrefs.quiet_to=np.quiet_to||previous.quiet_to||lq.to;}}catch(e){}toast(t('saved','Сохранено'),'success');}else{restore();handleApiError(rr,'Error');}
      }).catch(function(){restore();toast(t('network_error','Ошибка сети'),'error');});
    });});
  }).catch(function(){});
}
function loadBlockedUsers(){
  var box=document.getElementById('vc-blocked-list');if(!box)return;box.innerHTML='<div class="spin"></div>';
  api('blocked_list').then(function(r){if(!r||!r.ok){box.textContent=localizedErrorText(r&&r.err);return;}var items=r.items||[];if(!items.length){box.innerHTML='<div class="sr-sub">'+h(t('blocked_empty','Список пуст'))+'</div>';return;}var html='';for(var i=0;i<items.length;i++){var x=items[i];html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0"><span>'+h(localizedPersonName(x.name||x.fullname||('#'+x.id)))+'</span><button class="set-btn vc-unblock" data-id="'+h(x.id||x.user_id||0)+'">'+h(t('unblock','Разблокировать'))+'</button></div>';}box.innerHTML=html;$$('.vc-unblock',box).forEach(function(b){b.addEventListener('click',function(){b.disabled=true;api('block_toggle',{virtual:parseInt(b.dataset.id,10)}).then(function(rr){if(rr&&rr.ok&&!rr.blocked){toast(t('unblocked','Пользователь разблокирован'),'success');loadBlockedUsers();}else{b.disabled=false;handleApiError(rr,'Error');}}).catch(function(){b.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});});}).catch(function(){box.textContent=t('network_error','Ошибка сети');});
}
function loadReferralInfo(){
  api('ref_info').then(function(r){
    var box=document.getElementById('vc-ref-info');if(!box)return;
    if(!r||!r.ok){box.textContent=localizedErrorText(r&&r.err);return;}
    var payout='';
    if(!r.is_female){
      payout='<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)"><div style="font-size:12px;color:var(--text2)">'+h(t('withdrawable','Доступно к выводу'))+': '+h(vibeAmount(r.withdrawable||0))+' · min '+h(vibeAmount(r.min_payout||0))+'</div><input id="vc-ref-wallet" value="'+h(r.wallet||'')+'" placeholder="'+h(t('wallet_id_placeholder','Кошелёк или платёжный идентификатор'))+'" style="width:100%;margin-top:7px"><select id="vc-ref-method" style="width:100%;margin-top:7px"><option value="USDT"'+(String(r.method).toUpperCase()==='USDT'?' selected':'')+'>USDT</option><option value="TRC20"'+(String(r.method).toUpperCase()==='TRC20'?' selected':'')+'>USDT · TRC20</option><option value="ERC20"'+(String(r.method).toUpperCase()==='ERC20'?' selected':'')+'>USDT · ERC20</option><option value="PAYPAL"'+(String(r.method).toUpperCase()==='PAYPAL'?' selected':'')+'>PayPal</option></select><div style="display:flex;gap:8px;margin-top:8px"><button class="set-btn" id="vc-ref-save">'+h(t('save_wallet','Сохранить кошелёк'))+'</button><button class="set-btn" id="vc-ref-withdraw"'+((r.withdrawable||0)<(r.min_payout||0)?' disabled':'')+'>'+h(t('withdraw','Вывести'))+'</button></div></div>';
    }else payout='<div class="sr-sub" style="margin-top:9px">'+h(t('ref_routed_earnings','Реферальный доход учтён в разделе заработка'))+': '+h(vibeAmount(r.ref_in_earnings||0))+'</div>';
    box.innerHTML='<div style="font-size:13px;color:var(--text2)">'+h(t('invited','Приглашено'))+': '+h(r.invited||0)+' · '+h(t('active','Активных'))+': '+h(r.active||0)+' · '+h(t('earned','Заработано'))+': '+h(vibeAmount(r.lifetime||0))+'</div><input id="vc-ref-link" readonly value="'+h(r.link||'')+'" style="width:100%;margin-top:8px"><div style="display:flex;gap:8px;margin-top:8px"><button class="set-btn" id="vc-ref-copy">'+h(t('copy','Копировать'))+'</button><button class="set-btn" id="vc-ref-share">'+h(t('share','Поделиться'))+'</button></div>'+payout;
    var inp=document.getElementById('vc-ref-link');
    document.getElementById('vc-ref-copy').addEventListener('click',function(){if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(inp.value).then(function(){toast(t('copied','Скопировано'),'success');},function(){inp.select();});else inp.select();});
    document.getElementById('vc-ref-share').addEventListener('click',function(){if(navigator.share)navigator.share({title:'Откровенно',url:inp.value}).catch(function(){});else{inp.select();toast(t('copy_manual','Скопируйте ссылку'));}});
    var save=document.getElementById('vc-ref-save');
    if(save)save.addEventListener('click',function(){var wallet=document.getElementById('vc-ref-wallet').value.trim(),method=document.getElementById('vc-ref-method').value;if(!wallet){toast(t('wallet_required','Укажите кошелёк'),'error');return;}save.disabled=true;api('ref_set_wallet',{wallet:wallet,method:method}).then(function(rr){if(rr&&rr.ok){toast(t('saved','Сохранено'),'success');loadReferralInfo();}else{save.disabled=false;handleApiError(rr,'Error');}}).catch(function(){save.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});
    var withdraw=document.getElementById('vc-ref-withdraw');
    if(withdraw)withdraw.addEventListener('click',async function(){var amount=vibeAmount(r.withdrawable||0);if(!await vcConfirm(t('withdraw_confirm','Создать заявку на вывод доступной суммы?'),{title:t('withdraw','Вывести средства'),icon:'↗',html:'<div class="vc-purchase-summary"><div><span>'+h(t('amount','Сумма'))+'</span><strong>'+h(amount)+'</strong></div><div><span>'+h(t('method','Метод'))+'</span><strong>'+h(r.method||'USDT')+'</strong></div></div>',confirmText:t('create_request','Создать заявку')}))return;withdraw.disabled=true;api('ref_withdraw').then(function(rr){if(rr&&rr.ok){vcNotice(t('withdraw_created','Заявка на вывод создана'),vibeAmount(rr.amount||0)+' · '+h(t('withdraw_processing','Статус можно отслеживать в этом разделе.')),'success');loadMe().then(function(){renderTopbar();loadReferralInfo();});}else{withdraw.disabled=false;handleApiError(rr,'Error');}}).catch(function(){withdraw.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});
  }).catch(function(){});
}
function loadTosStatus(){api('tos_check').then(function(r){var s=document.getElementById('vc-tos-status');if(r&&r.ok)state.tosAccepted=!!r.accepted;if(s&&r&&r.ok)s.textContent=r.accepted?t('tos_accepted','Принято'):t('tos_not_accepted','Требуется согласие');}).catch(function(){});}
function acceptTosIfNeeded(){ensureTosAccepted().then(function(ok){if(ok){toast(t('tos_accepted','Условия приняты'),'success');loadTosStatus();}});}
function supportStatusText(value){var key=String(value||'').trim();return key?t('support_status_'+key):'';}
function loadSupportTickets(){var box0=document.getElementById('vc-support-list');if(box0)box0.setAttribute('aria-busy','true');api('support_list').then(function(r){var box=document.getElementById('vc-support-list');if(!box)return;box.removeAttribute('aria-busy');if(!r||!r.ok){renderLoadError(box,localizedErrorText(r&&r.err,t('support_load_failed','Не удалось загрузить обращения')),loadSupportTickets);return;}var items=r.items||[];if(!items.length){box.innerHTML='<div class="sr-sub">'+h(t('support_empty','Обращений пока нет'))+'</div>';return;}var html='<div class="set-h vc-support-h">'+h(t('support_my_tickets','Мои обращения'))+'</div>';for(var i=0;i<items.length&&i<8;i++){var x=items[i];html+='<button type="button" class="vc-support-ticket" data-id="'+h(x.id)+'"><strong>#'+h(x.id)+' · '+h(x.category)+' · <span class="vc-support-status is-'+h(x.status)+'">'+h(supportStatusText(x.status))+'</span></strong><div>'+h(x.description)+'</div>'+(x.admin_comment?'<div class="vc-support-answer">'+h(x.admin_comment)+'</div>':'')+'</button>';}box.innerHTML=html;$$('.vc-support-ticket',box).forEach(function(btn){btn.addEventListener('click',function(){openSupportTicket(parseInt(btn.dataset.id,10));});});}).catch(function(){var box=document.getElementById('vc-support-list');if(box){box.removeAttribute('aria-busy');renderLoadError(box,t('network_error','Ошибка сети'),loadSupportTickets);}});}
function openSupportTicket(id){if(!id)return;api('support_detail',{id:id}).then(function(r){if(!r||!r.ok){handleApiError(r,'Error');return;}var ticket=r.ticket||{},messages=r.messages||[],mh='';for(var i=0;i<messages.length;i++){var m=messages[i],messageText=m.message||(m.status_change?supportStatusText(m.status_change):'');mh+='<div style="padding:8px;margin-top:6px;border-radius:9px;background:'+(m.role==='user'?'rgba(69,141,255,.12)':'rgba(52,212,120,.1)')+'"><strong>'+h(m.role==='user'?t('you','Вы'):t('support_section','Поддержка'))+'</strong><div>'+h(messageText)+'</div></div>';}var ov=el('div',{class:'lightbox',style:'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px'});ov.innerHTML='<div role="dialog" aria-modal="true" aria-label="'+h('#'+ticket.id)+'" style="background:#1d1924;border-radius:18px;max-width:500px;width:100%;max-height:85vh;overflow:auto;padding:18px"><div style="display:flex;justify-content:space-between;gap:10px"><strong>#'+h(ticket.id)+' · '+h(ticket.category)+' · '+h(supportStatusText(ticket.status))+'</strong><button type="button" data-close aria-label="'+h(t('close','Закрыть'))+'" style="border:0;background:none;color:#fff;font-size:22px;min-width:44px;min-height:44px">×</button></div><p style="color:var(--text2)">'+h(ticket.description||'')+'</p>'+mh+(ticket.status!=='closed'?'<textarea id="vc-support-reply" maxlength="2000" rows="3" placeholder="'+h(t('support_reply','Добавить сообщение'))+'" style="width:100%;margin-top:10px"></textarea><button class="set-btn" id="vc-support-reply-send" style="margin-top:7px">'+h(t('send','Отправить'))+'</button>':'')+'</div>';document.body.appendChild(ov);function onKey(e){if(e.key==='Escape')close();}function close(){document.removeEventListener('keydown',onKey);if(ov.parentNode)ov.parentNode.removeChild(ov);}document.addEventListener('keydown',onKey);ov.querySelector('[data-close]').addEventListener('click',close);ov.addEventListener('click',function(e){if(e.target===ov)close();});var send=ov.querySelector('#vc-support-reply-send');if(send)send.addEventListener('click',function(){var msg=ov.querySelector('#vc-support-reply').value.trim();if(!msg)return;send.disabled=true;api('support_comment',{id:id,message:msg}).then(function(rr){if(rr&&rr.ok){close();toast(t('sent','Отправлено'),'success');openSupportTicket(id);loadSupportTickets();}else{send.disabled=false;handleApiError(rr,'Error');}}).catch(function(){send.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});}).catch(function(){toast(t('network_error','Ошибка сети'),'error');});}
function supportContextLines(){var route=String(state.route||'/').split('?')[0];return 'Контекст: страница='+route+'; язык='+(state.lang||'')+'; экран='+window.innerWidth+'x'+window.innerHeight+'; браузер='+String(navigator.userAgent||'').replace(/[^\x20-\x7e]/g,'').slice(0,120)+'; время='+new Date().toISOString();}
function supportBuildDescription(){
  var v=function(id){var n=document.getElementById(id);return n?String(n.value||'').trim():'';},tech=document.getElementById('vc-support-tech'),lines=[v('vc-support-text')],order=v('vc-support-order').replace(/[^A-Za-z0-9_.#-]/g,'').slice(0,40),code=v('vc-support-code').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,60);
  if(order)lines.push('Order: '+order);if(code)lines.push('Error code: '+code);if(tech&&tech.checked)lines.push(supportContextLines());
  return lines.join('\n');
}
function supportSyncPreview(){var box=document.getElementById('vc-support-preview-text');if(box)box.textContent=supportBuildDescription();}
/* Support draft: category, order, error code and text survive a reload or an accidental screen change (this tab and account only; chat text is never stored). */
function vcSupportDraftKey(){return 'vc_support_draft:'+(state.uid||0);}
function vcSupportDraftClear(){try{sessionStorage.removeItem(vcSupportDraftKey());}catch(e){}var s=document.getElementById('vc-support-draft');if(s)s.textContent='';}
function vcSupportDraftInit(){
  var ids=['vc-support-category','vc-support-order','vc-support-code','vc-support-text','vc-support-tech'],node={},saved=null,status=document.getElementById('vc-support-draft'),timer=0;
  ids.forEach(function(id){node[id]=document.getElementById(id);});
  try{saved=JSON.parse(sessionStorage.getItem(vcSupportDraftKey())||'null');}catch(e){saved=null;}
  if(saved&&typeof saved==='object'){
    var prefilled=!!((node['vc-support-order']&&node['vc-support-order'].value)||(node['vc-support-code']&&node['vc-support-code'].value));
    if(typeof saved.text==='string'&&node['vc-support-text'])node['vc-support-text'].value=saved.text.slice(0,1400);
    if(!prefilled){
      if(typeof saved.order==='string'&&node['vc-support-order'])node['vc-support-order'].value=saved.order.slice(0,40);
      if(typeof saved.code==='string'&&node['vc-support-code'])node['vc-support-code'].value=saved.code.slice(0,60);
      var catKey=String(saved.category||'').replace(/[^a-z]/g,'');
      if(catKey&&node['vc-support-category']&&node['vc-support-category'].querySelector('option[value="'+catKey+'"]'))node['vc-support-category'].value=catKey;
    }
    if(typeof saved.tech==='boolean'&&node['vc-support-tech'])node['vc-support-tech'].checked=saved.tech;
    if(status&&(saved.text||saved.order||saved.code))status.textContent=t('support_draft_restored','Черновик восстановлен');
  }
  function save(){
    var val=function(id){return node[id]?String(node[id].value||''):'';};
    var data={category:val('vc-support-category'),order:val('vc-support-order'),code:val('vc-support-code'),text:val('vc-support-text'),tech:node['vc-support-tech']?!!node['vc-support-tech'].checked:true};
    try{
      if(data.text.trim()||data.order.trim()||data.code.trim()){sessionStorage.setItem(vcSupportDraftKey(),JSON.stringify(data));if(status)status.textContent=t('support_draft_saved','Черновик сохранён');}
      else{sessionStorage.removeItem(vcSupportDraftKey());if(status)status.textContent='';}
    }catch(e){}
  }
  function queue(){clearTimeout(timer);timer=setTimeout(save,400);}
  ids.forEach(function(id){var n=node[id];if(!n)return;n.addEventListener('input',queue);n.addEventListener('change',queue);});
}
function viewSupport(){
  var body=document.getElementById('vc-main-body');if(!body)return;
  var q=state.routeQuery,order=String(q&&q.get('order')||'').replace(/[^A-Za-z0-9_.#-]/g,'').slice(0,40),code=String(q&&q.get('code')||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,60),le=state.lastError;
  if(!code&&le&&Date.now()-le.at<900000)code=le.code;
  var cat=order?'payment':(code?'bug':'general'),cats=[['general','support_general','Общий вопрос'],['payment','support_payment','Оплата и баланс'],['profile','support_profile','Профиль'],['chat','support_chat','Чат'],['bug','support_bug','Ошибка'],['other','support_other','Другое']],opts='';
  cats.forEach(function(c){opts+='<option value="'+c[0]+'"'+(c[0]===cat?' selected':'')+'>'+h(t(c[1],c[2]))+'</option>';});
  body.innerHTML='<div class="profile-edit vc-support-page"><div class="pe-head"><button type="button" class="chat-back vc-icon-glass" id="vc-support-back" aria-label="'+h(t('back','Назад'))+'">'+glassIcon('back')+'</button><h1 class="pe-h">'+h(t('support_page_title','Поддержка'))+'</h1></div>'+
    '<p class="sr-sub">'+h(t('support_intro','Опишите вопрос — мы ответим здесь. Тексты переписок к обращению не прикладываются.'))+'</p>'+
    '<label>'+h(t('support_category','Тема обращения'))+'<select id="vc-support-category">'+opts+'</select></label>'+
    '<label>'+h(t('support_order','Номер заказа (если вопрос про оплату)'))+'<input id="vc-support-order" maxlength="40" autocomplete="off" value="'+h(order)+'"></label>'+
    '<label>'+h(t('support_code','Код ошибки (если он показан)'))+'<input id="vc-support-code" maxlength="60" autocomplete="off" value="'+h(code)+'"></label>'+
    '<label>'+h(t('support_describe','Опишите проблему'))+'<textarea id="vc-support-text" maxlength="1400" rows="4"></textarea></label>'+
    '<small class="vc-support-draft" id="vc-support-draft" role="status" aria-live="polite"></small>'+
    '<label class="vc-support-tech"><input type="checkbox" id="vc-support-tech" checked> <span>'+h(t('support_tech','Приложить технические данные (без переписок и паролей)'))+'</span></label>'+
    '<div class="vc-support-preview" role="region" aria-label="'+h(t('support_preview','Будет отправлено'))+'"><small>'+h(t('support_preview','Будет отправлено'))+'</small><pre id="vc-support-preview-text"></pre></div>'+
    '<button class="pe-save" id="vc-support-send">'+h(t('support_send','Отправить'))+'</button><div id="vc-support-done" class="sr-sub" role="status"></div><div id="vc-support-list" style="margin-top:14px"></div></div>';
  $$('#vc-support-category,#vc-support-order,#vc-support-code,#vc-support-text,#vc-support-tech',body).forEach(function(n){n.addEventListener('input',supportSyncPreview);n.addEventListener('change',supportSyncPreview);});
  vcSupportDraftInit();
  supportSyncPreview();
  document.getElementById('vc-support-back').addEventListener('click',function(){navigate('/settings');});
  document.getElementById('vc-support-send').addEventListener('click',createSupportTicket);
  loadSupportTickets();
}
function createSupportTicket(){var btn=document.getElementById('vc-support-send'),textEl=document.getElementById('vc-support-text'),cat=document.getElementById('vc-support-category');if(!btn||!textEl||!cat)return;var text=textEl.value.trim();if(!text){toast(t('support_describe','Опишите проблему'),'error');return;}if(btn.disabled)return;var orderEl=document.getElementById('vc-support-order'),order=orderEl?orderEl.value.trim().replace(/[^A-Za-z0-9_.#-]/g,'').slice(0,40):'',payload={category:cat.value,description:supportBuildDescription()};if(order){payload.related_type='order';if(/^\d+$/.test(order))payload.related_id=order;}setBusy(btn,true);api('support_create',payload).then(function(r){setBusy(btn,false);if(r&&r.ok){textEl.value='';vcSupportDraftClear();supportSyncPreview();var done=document.getElementById('vc-support-done');if(done)done.textContent=t('support_created','Обращение создано')+' #'+r.id+'. '+t('support_created_info','Ответ появится в списке ниже — статус и история сохраняются.');toast(t('support_created','Обращение создано')+' #'+r.id,'success');loadSupportTickets();}else handleApiError(r,'Error');}).catch(function(){setBusy(btn,false);toast(t('network_error','Ошибка сети'),'error');});}
function loadSellerEconomy(){
  var host=document.getElementById('vc-seller-economy');if(!host)return;
  api('earn_info').then(function(er){if(!host.parentNode)return;if(!er||!er.ok){host.textContent=localizedErrorText(er&&er.err);return;}var e=er.earn||{};
    host.innerHTML='<div style="font-size:13px;color:var(--text2)">'+h(t('available','Доступно'))+': '+h(vibeAmount(e.available||0))+' · '+h(t('pending','На удержании'))+': '+h(vibeAmount(e.pending||0))+(e.reserved?' · '+h(t('reserved_for_payout','На выплате'))+': '+h(vibeAmount(e.reserved||0)):'')+' · '+h(t('lifetime','За всё время'))+': '+h(vibeAmount(e.lifetime||0))+'</div><label style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><span>'+h(t('monetization','Монетизация'))+'</span><input type="checkbox" id="vc-earn-on"'+(e.monet_on?' checked':'')+'></label><input id="vc-earn-wallet" value="'+h(e.wallet||'')+'" placeholder="'+h(t('wallet_id_placeholder','Кошелёк или платёжный идентификатор'))+'" style="width:100%;margin-top:8px"><select id="vc-earn-method" style="width:100%;margin-top:7px"><option value="USDT"'+(String(e.method).toUpperCase()==='USDT'?' selected':'')+'>USDT</option><option value="TRC20"'+(String(e.method).toUpperCase()==='TRC20'?' selected':'')+'>USDT · TRC20</option><option value="ERC20"'+(String(e.method).toUpperCase()==='ERC20'?' selected':'')+'>USDT · ERC20</option><option value="PAYPAL"'+(String(e.method).toUpperCase()==='PAYPAL'?' selected':'')+'>PayPal</option></select><div style="display:flex;gap:8px;margin-top:8px"><button class="set-btn" id="vc-earn-save">'+h(t('save','Сохранить'))+'</button><button class="set-btn" id="vc-earn-withdraw"'+((e.available||0)<(e.min_payout||0)?' disabled':'')+'>'+h(t('withdraw','Вывести'))+' · min '+h(vibeAmount(e.min_payout||0))+'</button></div>';
    var autoReply=el('label',{class:'vc-auto-reply-row',html:'<span><strong>'+h(t('auto_reply_like','Автоответ после лайка'))+'</strong><small>'+h(t('auto_reply_like_copy','Новому совпадению сразу уйдёт дружелюбное приветствие.'))+'</small></span><input type="checkbox" id="vc-auto-reply-like"'+(parseInt(state.me&&state.me.auto_reply_like,10)?' checked':'')+'>'});host.insertBefore(autoReply,host.firstChild);var autoReplyInput=autoReply.querySelector('input');autoReplyInput.addEventListener('change',function(){autoReplyInput.disabled=true;api('set_auto_reply',{auto_reply:autoReplyInput.checked?1:0}).then(function(ar){autoReplyInput.disabled=false;if(ar&&ar.ok){if(state.me)state.me.auto_reply_like=autoReplyInput.checked?1:0;toast(t('saved','Сохранено'),'success');}else{autoReplyInput.checked=!autoReplyInput.checked;handleApiError(ar,'Error');}}).catch(function(){autoReplyInput.disabled=false;autoReplyInput.checked=!autoReplyInput.checked;toast(t('network_error','Ошибка сети'),'error');});});
    var earnMethod=document.getElementById('vc-earn-method');if(earnMethod){earnMethod.options[1].value='USDT';earnMethod.options[1].textContent='USDT';if(String(e.method).toUpperCase()==='USDT')earnMethod.value='USDT';}
    var save=document.getElementById('vc-earn-save');save.addEventListener('click',function(){var wallet=document.getElementById('vc-earn-wallet').value.trim(),method=document.getElementById('vc-earn-method').value,on=document.getElementById('vc-earn-on').checked?1:0;if(on&&!wallet){toast(t('wallet_required','Укажите кошелёк'),'error');return;}save.disabled=true;api('earn_monet',{on:on,wallet:wallet,method:method}).then(function(r){if(r&&r.ok){toast(t('saved','Сохранено'),'success');loadSellerEconomy();}else{save.disabled=false;handleApiError(r,'Error');}}).catch(function(){save.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});
    var withdraw=document.getElementById('vc-earn-withdraw');withdraw.addEventListener('click',async function(){if(!await vcConfirm(t('withdraw_confirm','Создать заявку на вывод доступной суммы?'),{title:t('withdraw','Вывести средства'),icon:'↗',html:'<div class="vc-purchase-summary"><div><span>'+h(t('amount','Сумма'))+'</span><strong>'+h(vibeAmount(e.available||0))+'</strong></div><div><span>'+h(t('method','Метод'))+'</span><strong>'+h(e.method||'USDT')+'</strong></div></div>',confirmText:t('create_request','Создать заявку')}))return;withdraw.disabled=true;api('earn_withdraw').then(function(r){if(r&&r.ok){vcNotice(t('withdraw_created','Заявка на вывод создана'),vibeAmount(r.amount||0),'success');loadSellerEconomy();}else{withdraw.disabled=false;handleApiError(r,'Error');}}).catch(function(){withdraw.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});
  }).catch(function(){host.textContent=t('network_error','Ошибка сети');});
}
function enablePush(trigger){
  trigger=typeof trigger==='string'?trigger:'settings';
  if (!state.pushSupported||!('Notification' in window)||!navigator.serviceWorker){toast(t('push_not_supported','Пуш-уведомления не поддерживаются'),'error');return Promise.resolve(false);}
  funnelTrack('push_prompt',{trigger:trigger},trigger);
  var subscription=null;
  return Notification.requestPermission().then(function(perm){if(perm!=='granted'){toast(t('push_perm_denied','Разрешение отклонено'),'error');return null;}return authApi('vapid_public',{});}).then(function(r){
     if(!r)return null;if(!r.ok||!r.public_key)throw new Error((r&&r.err)||'push_subscribe_failed');
    return navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(r.public_key)});});
  }).then(function(sub){if(!sub)return false;subscription=sub;return persistPushSubscription(sub);}).then(function(rr){
     if(rr===false)return false;if(!rr||!rr.ok)throw new Error((rr&&rr.err)||'push_subscribe_failed');
    state.pushSub=subscription;funnelTrack('push_subscribed',{trigger:trigger},'subscribed');toast(t('set_push_enabled','Пуш-уведомления включены'),'success');if(state.route==='/settings')viewSettings();return true;
   }).catch(function(error){toast(localizedErrorText(error&&error.message,t('network_error','Ошибка сети')),'error');return false;});
}
function persistPushSubscription(sub){
  if(!sub||!state.uid)return Promise.resolve(null);
  var j=typeof sub.toJSON==='function'?sub.toJSON():sub,keys=j&&j.keys||{};
  if(!j||!j.endpoint||!keys.p256dh||!keys.auth)return Promise.resolve(null);
  return authApi('push_subscribe',{endpoint:j.endpoint,p256dh:keys.p256dh,auth:keys.auth});
}
function wireServiceWorkerMessages(){
  if(!navigator.serviceWorker||state._swMessagesWired)return;state._swMessagesWired=true;
  navigator.serviceWorker.addEventListener('message',function(event){
    var data=event&&event.data||{};
    if(data.type!=='pushsubscriptionchange')return;
    if(data.subscription){
      state.pushSub=data.subscription;state.pushHydrated=true;
      persistPushSubscription(data.subscription).then(function(r){if(r&&r.ok&&state.route==='/settings')viewSettings();}).catch(function(){});
    }else if(data.error){state.pushSub=null;state.pushHydrated=true;if(state.route==='/settings')viewSettings();}
  });
}
function hydratePushSubscription(){
  if(!state.pushSupported||state.pushHydrated||!navigator.serviceWorker)return Promise.resolve(null);
  return navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription();}).then(function(sub){
    state.pushSub=sub||null;state.pushHydrated=true;if(sub&&state.uid)persistPushSubscription(sub).catch(function(){});
    if(state.route==='/settings')viewSettings();
    return sub;
  }).catch(function(){state.pushHydrated=true;return null;});
}
function disablePush(){
  if (!state.pushSub) return Promise.resolve(false);
  var ep = state.pushSub.endpoint;
  var sub=state.pushSub;return authApi('push_unsubscribe', {endpoint: ep}).then(function(r){
     if(!r||!r.ok)throw new Error((r&&r.err)||'push_unsubscribe_failed');
    return sub.unsubscribe().catch(function(){return false;}).then(function(){state.pushSub=null;toast(t('set_push_disabled','Пуш-уведомления выключены'),'success');if(state.route==='/settings')viewSettings();return true;});
   }).catch(function(error){toast(localizedErrorText(error&&error.message,t('network_error','Ошибка сети')),'error');return false;});
}
function urlBase64ToUint8Array(base64String){
  var padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(base64);
  var arr = new Uint8Array(raw.length);
  for (var i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
function maybePromptInstall(){
  if (!state.installPrompt) return;
  if (state._installPrompted) return;
  state._installPrompted = true;
  setTimeout(function(){
    vcModal({title:t('install_prompt','Установить приложение'),icon:'download',message:t('install_copy','otkrovenno.online будет открываться с главного экрана, работать быстрее и сообщать о новых событиях.'),cancelText:t('later','Позже'),confirmText:t('install','Установить')}).then(function(ok){if(ok)promptInstall();});
  }, 1500);
}
function promptInstall(){
  /* Apple does not expose beforeinstallprompt. On iOS the shared installer opens
     the localized Add to Home Screen guide from this explicit user action. */
  if(window.VC_INSTALL&&window.VC_INSTALL.isIOS()){
    var iosResult=window.VC_INSTALL.openManual('settings');
    if(iosResult==='installed')toast(t('installed_toast','Установлено'),'success');
    return;
  }
  if (!state.installPrompt){
    var manualResult=window.VC_INSTALL?window.VC_INSTALL.openManual('settings'):false;
    if(manualResult==='installed'){toast(t('installed_toast','Установлено'),'success');return;}
    /* No native prompt (desktop Firefox/Safari, already dismissed, in-app browsers): explain the browser menu path. */
    if(!manualResult)vcNotice(t('install_manual_title','Установить otkrovenno.online'),t('install_manual_copy','Откройте меню браузера (⋮ или «Поделиться») и выберите «Установить приложение» или «На экран «Домой»». otkrovenno.online откроется как отдельное приложение.'),'success');
    return;
  }
  state.installPrompt.prompt();
  state.installPrompt.userChoice.then(function(){
    state.installPrompt = null;
  });
}

/* >>> v4 stage 4 screens (tools/v4/screens.js) >>> */
/* ===== v4 screens — stage 4 (2026-10-14): the prototype markup (site-prototype-20261014) on every screen =====
 * Built into app.js by tools/build_app.py between the "v4 stage 4" markers. Helpers mirror the prototype:
 * topbar = tbBack/tbRoot (phones), v4Head = pageHead (desktop), v4Sheet = openSheet, v4Menu = menuSheet. */
var V4_INT_ICON={'кулинария':'chef','готовка':'chef','природа':'leaf','путешествия':'globe','искусство':'palette','музыка':'music','книги':'book','чтение':'book','море':'wave','танцы':'dance','животные':'paw','спорт':'run','фитнес':'run','фото':'camera','фотография':'camera','йога':'lotus','кофе':'cup','кино':'film','фильмы':'film','сериалы':'film','игры':'gamepad','психология':'brain','астрология':'sparkles','мода':'star','шопинг':'star'};
var V4_NAV=[];
function v4IntIcon(name){return v4Icon(V4_INT_ICON[String(name||'').toLowerCase().trim()]||'sparkles');}
function v4Plural(n,one,few,many){n=Math.abs(parseInt(n,10)||0);if(String(state.lang||'ru').slice(0,2)==='en')return n===1?one:many;var a=n%10,b=n%100;return (a===1&&b!==11)?one:((a>=2&&a<=4&&(b<10||b>=20))?few:many);}
function v4Tb(title,opt){
  opt=opt||{};
  var back=opt.back?'<button type="button" class="ibtn" data-v4-back="'+h(opt.back)+'" aria-label="'+h(t('back','Назад'))+'">'+v4Icon('back')+'</button>':'';
  return '<div class="topbar v4tb vis-m'+(opt.back?'':' left')+'">'+back+'<h1>'+h(title)+'</h1>'+(opt.right||(opt.back?'<span class="sp"></span>':''))+'</div>';
}
function v4Head(title,sub,actions){return '<div class="vis-d v4-head"><div class="row-between"><div><h1 class="page-h">'+h(title)+'</h1>'+(sub?'<p class="page-sub">'+h(sub)+'</p>':'')+'</div>'+(actions||'')+'</div></div>';}
function v4Back(fallback){
  if(V4_NAV.length>1&&history.length>1){V4_NAV.pop();history.back();return;}
  navigate(fallback||'/');
}
function v4WireBack(root){$$('[data-v4-back]',root||document).forEach(function(b){if(b.dataset.bound)return;b.dataset.bound='1';b.addEventListener('click',function(){v4Back(b.dataset.v4Back);});});}
function v4TrackNav(route){var n=V4_NAV.length;if(n>1&&V4_NAV[n-2]===route)V4_NAV.pop();else if(V4_NAV[n-1]!==route)V4_NAV.push(route);if(V4_NAV.length>40)V4_NAV.shift();}
/* Phones: screens the prototype opens without the bottom tabs (nav: null) */
function v4NoNavRoute(route){return route.indexOf('/profile/')===0||route.indexOf('/chat/')===0||route==='/notifications'||route==='/activity'||route==='/search'||route==='/profile/edit'||route==='/purchases'||route.indexOf('/checkout')===0||route.indexOf('/support/')===0;}
function v4Sheet(o){
  v4CloseSheet();
  var host=document.createElement('div');host.className='v4 v4-sheet-host';
  host.innerHTML='<div class="backdrop" id="v4-sheet"><div class="sheet '+(o.cls||'')+'" role="dialog" aria-modal="true"><div class="grab"></div>'+
    (o.title!==false?'<div class="sh"><h3>'+h(o.title||'')+'</h3><button type="button" class="ibtn ghost" data-close aria-label="'+h(t('close','Закрыть'))+'">'+v4Icon('x')+'</button></div>':'')+
    '<div class="sb">'+o.body+'</div>'+(o.footer?'<div class="sf">'+o.footer+'</div>':'')+'</div></div>';
  document.body.appendChild(host);
  var bd=host.firstChild;
  bd.addEventListener('click',function(e){if(e.target===bd||(e.target.closest&&e.target.closest('[data-close]')))v4CloseSheet();});
  host._esc=function(e){if(e.key==='Escape')v4CloseSheet();};document.addEventListener('keydown',host._esc);
  if(o.after)o.after(bd);
  var f=bd.querySelector('.sheet button,.sheet input,.sheet textarea');if(f&&f.focus)try{f.focus({preventScroll:true});}catch(e){}
  return bd;
}
function v4CloseSheet(){$$('.v4-sheet-host').forEach(function(host){if(host._esc)document.removeEventListener('keydown',host._esc);host.remove();});}
function v4Menu(items){
  v4Sheet({title:false,body:'<div class="menu">'+items.map(function(it,i){return '<button type="button" data-mi="'+i+'" class="'+(it.danger?'danger':'')+'">'+v4Icon(it.icon)+h(it.label)+'</button>';}).join('')+'</div>',
    after:function(b){$$('[data-mi]',b).forEach(function(x){x.addEventListener('click',function(){v4CloseSheet();items[+x.dataset.mi].fn();});});}});
}
function v4Avatar(photo,name,cls,online){
  var nm=String(name||'');
  if(!photo)return '<div class="avatar navy '+(cls||'')+'" style="background:'+avatarBg(nm||'?')+'">'+h(initials(nm||'?'))+(online?'<i class="on"></i>':'')+'</div>';
  var thumb=vcPhotoCopy(photo,240)||photo;
  return '<div class="avatar '+(cls||'')+'" style="background-image:url('+h(thumb)+')">'+(online?'<i class="on"></i>':'')+'</div>';
}
function v4DeckById(id){
  id=parseInt(id,10)||0;
  var pools=[state.deckAll||[],(state.me&&state.me.virtuals)||[],state.deck||[]];
  for(var p=0;p<pools.length;p++)for(var i=0;i<pools[p].length;i++)if((parseInt(pools[p][i].id||pools[p][i].user_id,10)||0)===id)return pools[p][i];
  return null;
}
function v4HasChat(id){
  id=parseInt(id,10)||0;var list=state.chats||(state.me&&state.me.inbox)||[];
  for(var i=0;i<list.length;i++)if((parseInt(list[i].peer_id||list[i].id,10)||0)===id)return true;
  return false;
}
function v4ChatsLeft(){var m=state.me||{},v=m.chat_slots!=null?m.chat_slots:(m.chats_left!=null?m.chats_left:(m.chat_access&&m.chat_access.unassigned_chats));return v==null?null:(parseInt(v,10)||0);}
function v4Clock(ts){var d=new Date((parseInt(ts,10)||0)*1000);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function v4DayLabel(ts){
  var d=new Date((parseInt(ts,10)||0)*1000),now=new Date(),a=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),b=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),days=Math.round((a-b)/86400000);
  if(days<=0)return t('today','Сегодня');if(days===1)return t('yesterday','Вчера');
  var lang=String(state.lang||'ru').slice(0,2);
  try{return d.toLocaleDateString(lang==='uk'?'uk-UA':(lang==='en'?'en-GB':'ru-RU'),{day:'numeric',month:'long'});}catch(e){return d.toDateString();}
}
function v4ChatTime(ts){if(!ts)return '';var lab=v4DayLabel(ts);return lab===t('today','Сегодня')?v4Clock(ts):lab;}

/* ---------- Симпатии (prototype V.likes) ---------- */
function v4ViewLikes(){
  var title=t('v4_nav_likes','Симпатии');
  var body=v4Page(v4Tb(title,{right:v4BalancePill()})+'<div class="wrap">'+v4Head(title,t('v4_likes_sub2','Кто вам понравился и кому понравились вы'))+'<div id="v4-likes"><div class="sk" style="height:46px;border-radius:999px;max-width:420px"></div><div class="grid2 mt16"><div class="sk" style="aspect-ratio:3/4;border-radius:20px"></div><div class="sk" style="aspect-ratio:3/4;border-radius:20px"></div></div></div></div>','v4-likes');
  if(!body)return;
  var routeAtLoad=state.route;
  Promise.all([api('likes_list').catch(function(){return null;}),api('my_likes').catch(function(){return null;})]).then(function(all){
    var host=document.getElementById('v4-likes');if(!host||state.route!==routeAtLoad)return;
    function items(r){return (r&&r.ok&&Array.isArray(r.items))?r.items:[];}
    var inc=items(all[0]),mine=items(all[1]),mineIds={},incIds={};
    mine.forEach(function(x){mineIds[parseInt(x.id||x.user_id,10)||0]=1;});inc.forEach(function(x){incIds[parseInt(x.id||x.user_id,10)||0]=1;});
    var mutual=inc.filter(function(x){return mineIds[parseInt(x.id||x.user_id,10)||0];});
    var lists={'in':inc,out:mine,mutual:mutual};
    var tab=state.v4LikesTab&&lists[state.v4LikesTab]?state.v4LikesTab:(inc.length||!mine.length?'in':'out');
    function card(n){
      var id=parseInt(n.id||n.user_id,10)||0,deck=v4DeckById(id)||{},nm=localizedPersonName(n.name||n.fullname||deck.name||''),age=parseInt(n.age||deck.age,10)||0,city=vcDynamicProfileCity(String(n.city||deck.city||'').split(',')[0]),photo=n.photo||deck.photo||'';
      var online=!!deck.online,both=mineIds[id]&&incIds[id];
      return '<a class="pcard" href="#/profile/'+id+'" data-route="/profile/'+id+'">'+(photo?'<img'+vcThumbSrc(photo).replace(' src=',' loading="lazy" src=')+' alt="">':'')+'<div class="g"></div>'+
        (online?'<span class="st"><i></i>'+h(t('online_status','в сети'))+'</span>':'')+(both?'<span class="tag">'+h(t('v4_mutual','Взаимно'))+'</span>':'')+
        '<div class="t"><b>'+h(nm)+(age?', '+age:'')+'</b>'+(city?'<span>'+h(city)+'</span>':'')+'</div>'+
        '<button type="button" class="act2" data-quick="'+id+'" aria-label="'+h(t('send_message','Написать'))+'">'+v4Icon('chat')+'</button></a>';
    }
    function render(){
      var list=lists[tab]||[];
      var tabs=[['in',t('v4_likes_in','Вам понравились'),inc.length],['out',t('v4_likes_out','Ваши лайки'),mine.length],['mutual',t('v4_mutual','Взаимно'),mutual.length]];
      var empties={'in':[t('v4_likes_in_empty','Пока никто не поставил лайк'),t('v4_likes_in_empty_sub','Заполните профиль и добавьте фото — анкеты с фото получают в 3 раза больше симпатий.'),'<button type="button" class="btn btn-dark" data-route="/profile">'+h(t('v4_fill_profile','Заполнить профиль'))+'</button>'],
        out:[t('v4_likes_out_empty','Вы ещё никому не поставили лайк'),t('v4_likes_out_empty_sub','Листайте анкеты в поиске — лайк бесплатный.'),'<button type="button" class="btn btn-dark" data-route="/">'+h(t('v4_to_profiles','К анкетам'))+'</button>'],
        mutual:[t('v4_mutual_empty','Взаимных симпатий пока нет'),t('v4_mutual_empty_sub','Ответьте на входящие лайки — при взаимности откроется чат.'),'<button type="button" class="btn btn-dark" data-lt="in">'+h(t('v4_likes_in_btn','Входящие лайки'))+'</button>']}[tab];
      host.innerHTML='<div class="tabs" role="tablist">'+tabs.map(function(x){return '<button type="button" role="tab" class="tab'+(tab===x[0]?' on':'')+'" aria-selected="'+(tab===x[0]?'true':'false')+'" data-lt="'+x[0]+'">'+h(x[1])+(x[2]?' <span class="n">'+x[2]+'</span>':'')+'</button>';}).join('')+'</div>'+
        (tab==='in'&&list.length?'<div class="note coral" style="margin-bottom:12px">'+v4Icon('heartf')+'<div>'+h(t('v4_likes_note','Ответьте взаимностью — она уже ждёт вашего сообщения.'))+'</div></div>':'')+
        (list.length?'<div class="grid2">'+list.map(card).join('')+'</div>':'<div class="empty"><div class="em">'+v4Icon('heart')+'</div><b>'+h(empties[0])+'</b><div>'+h(empties[1])+'</div>'+empties[2]+'</div>');
      $$('[data-lt]',host).forEach(function(b){b.addEventListener('click',function(){tab=state.v4LikesTab=b.dataset.lt;render();});});
      $$('[data-quick]',host).forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();navigate('/chat/'+b.dataset.quick);});});
      $$('[data-route]',host).forEach(function(a){a.addEventListener('click',function(e){if(e.target.closest('[data-quick]'))return;e.preventDefault();navigate(a.dataset.route);});});
    }
    render();
    if((parseInt(state.me&&state.me.likes_new,10)||0)>0){api('mark_seen',{kind:'likes'}).then(function(res){if(res&&res.ok&&state.me){state.me.likes_new=0;updateChatsBadge();}}).catch(function(){});}
  }).catch(function(){var host=document.getElementById('v4-likes');if(host)host.innerHTML='<div class="empty"><div class="em">'+v4Icon('refresh')+'</div><b>'+h(t('load_failed','Не удалось загрузить данные'))+'</b></div>';});
}

/* ---------- Анкета (prototype V.profile + profileBody) ---------- */
function v4RenderProfileDetail(p){
  var body=document.getElementById('vc-main-body');if(!body)return;
  var name=localizedPersonName(p.name||p.fullname||''),city=vcDynamicProfileCity(p.city||p.location||''),age=parseInt(p.age,10)||0;
  var pid=parseInt(p.id||p.user_id,10)||0,gallery=Array.isArray(p.gallery)?p.gallery.slice():[],photos=[],photoMap=[];
  if(p.photo){photos.push(p.photo);photoMap.push(-1);}
  for(var g=0;g<gallery.length;g++){if(gallery[g]&&photos.indexOf(gallery[g])<0){photos.push(gallery[g]);photoMap.push(g);}}
  if(!photos.length){photos=[''];photoMap=[-1];}
  p._photoIndexMap=photoMap;markChatProfilePhotosSeen(pid,photos.length);
  var ph=Math.min(parseInt(state.profileDetailPhoto,10)||0,photos.length-1);
  var online=!!(p.presence&&p.presence.online),lastSeen=p.presence&&p.presence.last_seen?relativePresenceTime(p.presence.last_seen):'';
  var presence=online?t('v4_online','В сети'):(lastSeen?(t('last_seen','была')+' '+lastSeen):t('offline_short','не в сети'));
  var counts=p.photo_like_counts||{},likedPhotos=p.photo_liked||{};
  function cnt(ref){return Math.max(0,parseInt(counts[String(ref)],10)||0);}
  function plk(ref){return parseInt(likedPhotos[String(ref)],10)===1;}
  var segs=photos.length>1?'<div class="segs">'+photos.map(function(_,i){return '<i class="'+(i===ph?'on':'')+'"></i>';}).join('')+'</div>':'';
  var cta=v4HasChat(pid)?t('v4_open_chat','Открыть чат'):t('send_message','Написать');
  var sticky='<div class="stickybar"><button type="button" class="hrt'+(p.liked?' on':'')+'" data-plike aria-pressed="'+(p.liked?'true':'false')+'" aria-label="'+h(t('like','Нравится'))+'">'+v4Icon('heartf')+'</button><button type="button" class="btn btn-primary btn-lg cta" data-pmsg>'+v4Icon('chat')+h(cta)+'</button><button type="button" class="ibtn" style="width:56px;height:56px" data-pgift aria-label="'+h(t('gift','Подарок'))+'">'+v4Icon('gift')+'</button></div>';
  var gal='<div class="gal" id="v4-gal"><img id="v4-gal-img" src="'+h(photos[ph])+'" alt="'+h(name)+'" draggable="false"><div class="grad-t"></div><div class="grad-b"></div>'+segs+
    '<div class="bar"><button type="button" class="ibtn" id="pp-back" aria-label="'+h(t('back','Назад'))+'">'+v4Icon('back')+'</button><span class="sp"></span><button type="button" class="ibtn" id="pp-share" aria-label="'+h(t('share','Поделиться'))+'">'+v4Icon('share')+'</button><button type="button" class="ibtn" id="v4-pp-more" aria-label="'+h(t('more','Ещё'))+'">'+v4Icon('more')+'</button></div>'+
    (photos.length>1?'<div class="tapzones"><button type="button" data-pv aria-label="'+h(t('prev_photo','Предыдущее фото'))+'"></button><button type="button" data-nx aria-label="'+h(t('next_photo','Следующее фото'))+'"></button></div>':'')+
    '<div class="state'+(online?'':' off')+'"><i></i>'+h(presence)+'</div>'+
    '<button type="button" class="glike'+(plk(photoMap[ph])?' on':'')+'" id="pp-hero-photo-like" data-pp-photo-like="'+h(String(photoMap[ph]))+'" aria-label="'+h(t('like','Лайк'))+'">'+v4Icon('heartf')+'<span>'+cnt(photoMap[ph])+'</span></button>'+
    '<div class="nm"><b>'+h(name)+(age?', '+age:'')+'</b><span>'+(city?v4Icon('pin')+h(city)+' · ':'')+'<em id="v4-gal-n">'+(ph+1)+'/'+photos.length+'</em></span></div></div>';
  var thumbs=photos.length>1?'<div class="thumbs mt16">'+photos.map(function(u,i){return '<button type="button" data-th="'+i+'" class="'+(i===ph?'on':'')+'" aria-label="'+h(t('photo','Фото')+' '+(i+1))+'"><img'+vcThumbSrc(u).replace(' src=',' loading="lazy" src=')+' alt=""><span class="lk'+(plk(photoMap[i])?' on':'')+'" data-pp-photo-like="'+h(String(photoMap[i]))+'" role="button" aria-label="'+h(t('like','Лайк'))+'">'+v4Icon('heartf')+'<i>'+cnt(photoMap[i])+'</i></span></button>';}).join('')+'</div>':'';
  var ext=p.profile_ext||{},facts=[];
  var stt=profileDailyStatusText(p.daily_status,p.daily_status&&p.daily_status.id);if(stt)facts.push([t('v4_fact_status','Статус'),stt]);
  ['relationship_goal','occupation','employment','smoking','alcohol','children','pets','marital_status','music'].forEach(function(k){var v=ext[k];if(v==null||v==='')return;var r=profileEnumText(k,v);facts.push([r.label,r.value]);});
  var zt=profileZodiacText(p.zodiac,p.zodiac&&p.zodiac.id);if(zt)facts.push([t('v4_fact_zodiac','Знак'),zt]);
  var myInts=((state.me&&state.me.profile&&state.me.profile.interests)||[]).map(function(x){return String(x).toLowerCase();}),common=0;
  var chips=(p.interests||[]).map(function(x){var m=myInts.indexOf(String(x).toLowerCase())>=0;if(m)common++;return '<span class="chip'+(m?' match':'')+'">'+v4IntIcon(x)+h(localizedInterest(x))+'</span>';}).join('');
  var qs=vcIcebreakerQuestions(),q=qs[(parseInt(state.icebreakerIdx,10)||0)%Math.max(1,qs.length)]||'';
  var gifts=p.received_gifts||[];
  var giftsHtml=gifts.length?'<div class="giftstrip">'+gifts.map(function(x){x=x||{};return '<div>'+(x.gift_img?'<img src="'+h(x.gift_img)+'" alt="">':v4Icon('gift'))+h(x.sender_name?localizedPersonName(x.sender_name):t('anonymous','Анонимно'))+'</div>';}).join('')+'</div>'
    :'<div class="note">'+v4Icon('gift')+'<div>'+h(t('v4_gifts_empty','Подарков пока нет. Подарок виден в её анкете — к нему можно добавить сообщение.'))+' <button type="button" class="v4-link" data-pgift>'+h(t('gift_empty_cta','Подарить подарок'))+'</button></div></div>';
  var bio=String(p.bio||'').trim();
  var desk='<div class="vis-d"><div class="row-between"><div><div class="pp-dname">'+h(name)+(age?', '+age:'')+'</div><div class="muted pp-dmeta">'+(online?'<i class="online-dot"></i>':'')+h(presence)+(city?' · '+h(city):'')+'</div></div><button type="button" class="ibtn" data-pmore aria-label="'+h(t('more','Ещё'))+'">'+v4Icon('more')+'</button></div>'+thumbs+sticky+'</div>';
  var main=desk+
    '<h2 class="sec">'+h(t('prof_bio','О себе'))+'</h2><p class="pp-bio-v4">'+(bio?h(bio):'<span class="muted">'+h(t('profile_no_bio_copy','Иногда лучший способ узнать человека — задать вопрос лично.'))+'</span>')+'</p>'+
    (facts.length?'<h2 class="sec">'+h(t('v4_facts','Коротко'))+'</h2><div class="facts">'+facts.slice(0,6).map(function(f){return '<div><span>'+h(f[0])+'</span><b>'+h(f[1])+'</b></div>';}).join('')+'</div>':'')+
    (chips?'<h2 class="sec">'+h(t('prof_interests','Интересы'))+(common?' <span class="pill coral">'+common+' '+h(v4Plural(common,t('v4_common_1','общий'),t('v4_common_2','общих'),t('v4_common_5','общих')))+'</span>':'')+'</h2><div class="chips">'+chips+'</div>':'')+
    (q?'<h2 class="sec">'+h(t('v4_start_with','С чего начать'))+'</h2><div class="qcard"><small>'+h(t('v4_q_small','Вопрос для первого сообщения'))+'</small><p id="v4-pp-q">«'+h(q)+'»</p><button type="button" class="btn btn-block" data-ask>'+v4Icon('send')+h(t('v4_send_question','Отправить этот вопрос'))+'</button></div>':'')+
    '<h2 class="sec">'+h(t('v4_gifts','Подарки'))+'</h2>'+giftsHtml+
    (p.trust?'<div class="v4-trust mt16">'+profileTrustHtml(p.trust,true)+'</div>':'')+
    '<div class="safety">'+h(t('v4_profile_safety','Анкета приватна: распространение материалов и публикация переписки без согласия запрещены. Часть анкет ведут виртуальные собеседницы — подробнее в'))+' <a href="/community-guidelines/" target="_blank" rel="noopener">'+h(t('v4_rules_link','правилах'))+'</a>.</div>';
  v4Page('<div class="prof">'+gal+'<div class="pbody" id="pbody">'+main+'</div></div><div class="vis-m">'+sticky+'</div>','pp-v4');
  v4WireProfileDetail(p,photos,photoMap,ph);
}
function v4WireProfileDetail(p,photos,photoMap,ph){
  var root=document.querySelector('.pp-v4');if(!root)return;
  var pid=parseInt(p.id||p.user_id,10)||0,name=localizedPersonName(p.name||'');
  var counts=p.photo_like_counts=p.photo_like_counts||{},likedPhotos=p.photo_liked=p.photo_liked||{};
  function track(surface,idx){
    var gi=photoMap[idx];funnelTrack('profile_photo_viewed',{profile_id:pid,surface:surface,photo_idx:gi==null?idx:gi});
    var key='gallery:'+pid;if(!state.profileInterestSent[key]){state.profileInterestSent[key]=1;api('profile_interest',{virtual:pid,dwell:15,source:'gallery'}).catch(function(){});}
  }
  function syncLike(ref){
    $$('[data-pp-photo-like]',root).forEach(function(b){if(String(b.dataset.ppPhotoLike)!==String(ref))return;var on=parseInt(likedPhotos[String(ref)],10)===1,n=Math.max(0,parseInt(counts[String(ref)],10)||0);b.classList.toggle('on',on);var c=b.querySelector('span,i');if(c)c.textContent=String(n);});
  }
  function setPhoto(i,surface){
    var n=photos.length;ph=((i%n)+n)%n;state.profileDetailPhoto=ph;
    var img=document.getElementById('v4-gal-img');if(img)img.src=photos[ph];
    $$('.segs i',root).forEach(function(x,k){x.classList.toggle('on',k===ph);});
    $$('[data-th]',root).forEach(function(x){x.classList.toggle('on',parseInt(x.dataset.th,10)===ph);});
    var num=document.getElementById('v4-gal-n');if(num)num.textContent=(ph+1)+'/'+n;
    var gl=document.getElementById('pp-hero-photo-like');if(gl){gl.dataset.ppPhotoLike=String(photoMap[ph]);syncLike(photoMap[ph]);}
    if(surface)track(surface,ph);
  }
  var back=document.getElementById('pp-back');if(back)back.addEventListener('click',function(){var to=state.profileDetailReturn||'/';if(to.indexOf('/profile/')===0)to='/';navigate(to);});
  var share=document.getElementById('pp-share');if(share)share.addEventListener('click',function(){var url=location.origin+location.pathname+'#/profile/'+pid;if(navigator.share)navigator.share({title:(p.name||'Откровенно'),url:url}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){toast(t('copied','Ссылка скопирована'),'success');});});
  function more(){
    var items=[{icon:'bell',label:(p._watch&&p._watch.armed)?t('online_watch_off','Не уведомлять о появлении'):t('online_watch_on','Сообщить, когда онлайн'),fn:function(){api('online_watch_toggle',{virtual:pid}).then(function(r){if(r&&r.ok){p._watch={armed:!!r.armed};toast(r.armed?t('online_watch_enabled','Уведомление включено'):t('online_watch_disabled','Уведомление выключено'),'success');}else handleApiError(r,'Error');}).catch(function(){toast(t('network_error','Ошибка сети'),'error');});}}];
    if(typeof VC_DESIRE_UI_ENABLED!=='undefined'&&VC_DESIRE_UI_ENABLED)items.push({icon:'star',label:t('offer_action','Желание'),fn:function(){openOfferComposer(pid,p.name||'');}});
    items.push({icon:'flag',label:t('report','Пожаловаться'),danger:true,fn:function(){openProfileReport(p);}});
    v4Menu(items);
  }
  $$('#v4-pp-more,[data-pmore]',root).forEach(function(b){b.addEventListener('click',more);});
  $$('[data-pv]',root).forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();setPhoto(ph-1,'tap');});});
  $$('[data-nx]',root).forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();setPhoto(ph+1,'tap');});});
  $$('[data-th]',root).forEach(function(b){b.addEventListener('click',function(e){if(e.target.closest('[data-pp-photo-like]'))return;setPhoto(parseInt(b.dataset.th,10)||0,'thumbnail');});});
  var galEl=document.getElementById('v4-gal'),x0=null;
  if(galEl){
    galEl.addEventListener('pointerdown',function(e){x0=e.clientX;});
    galEl.addEventListener('pointerup',function(e){if(x0==null)return;var d=e.clientX-x0;x0=null;if(Math.abs(d)>50)setPhoto(ph+(d<0?1:-1),'swipe');});
    var img=document.getElementById('v4-gal-img');if(img)img.addEventListener('click',function(){track('hero',ph);openMediaViewer(photos,ph,name);});
  }
  $$('[data-pp-photo-like]',root).forEach(function(btn){btn.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();if(btn.dataset.busy)return;var ref=parseInt(btn.dataset.ppPhotoLike,10);btn.dataset.busy='1';
    api('photo_like',{virtual:pid,photo_idx:ref}).then(function(r){delete btn.dataset.busy;if(!r||!r.ok){handleApiError(r,'Error');return;}likedPhotos[String(ref)]=r.liked?1:0;counts[String(ref)]=parseInt(r.count,10)||0;syncLike(ref);}).catch(function(){delete btn.dataset.busy;toast(t('network_error','Ошибка сети'),'error');});
  });});
  function doLike(){
    var btns=$$('[data-plike]',root);btns.forEach(function(b){b.disabled=true;});
    api('profile_like',{virtual:pid}).then(function(r){btns.forEach(function(b){b.disabled=false;});if(!r||!r.ok){handleApiError(r,'Error');return;}p.liked=!!r.liked;if(r.profile_like_count!=null)p.profile_like_count=parseInt(r.profile_like_count,10)||0;btns.forEach(function(b){b.classList.toggle('on',p.liked);b.classList.toggle('pop',p.liked);b.setAttribute('aria-pressed',p.liked?'true':'false');});if(p.liked)showLikeSuccess(p);}).catch(function(){btns.forEach(function(b){b.disabled=false;});toast(t('network_error','Ошибка сети'),'error');});
  }
  $$('[data-plike]',root).forEach(function(b){b.addEventListener('click',function(){if(!p.liked&&guestNeedsProfileGate()){showGuestProfileGate(p,doLike);return;}doLike();});});
  $$('[data-pmsg]',root).forEach(function(b){b.addEventListener('click',function(){navigate('/chat/'+pid);});});
  $$('[data-pgift]',root).forEach(function(b){b.addEventListener('click',function(){openGiftPicker(pid);});});
  $$('[data-ask]',root).forEach(function(b){b.addEventListener('click',function(){var qEl=document.getElementById('v4-pp-q'),text=qEl?String(qEl.textContent||'').replace(/^[«\s]+|[»\s]+$/g,''):'';if(text)saveChatDraft(pid,text);navigate('/chat/'+pid);});});
}

/* ---------- Уведомления (prototype V.notifications) — the notification centre rendered inline ---------- */
function v4NotificationsChrome(body){
  var wrap=body.querySelector('.vcn-page-wrap');if(!wrap)return;
  body.classList.add('v4-view');
  var page=document.createElement('div');page.className='v4 v4-page v4-ntf';
  page.innerHTML=v4Tb(t('notifications','Уведомления'),{back:'/profile',right:'<button type="button" class="ibtn" data-v4-readall aria-label="'+h(t('ntf_mark_all','Прочитать все'))+'">'+v4Icon('check')+'</button>'})+
    '<div class="wrap">'+v4Head(t('notifications','Уведомления'),t('v4_ntf_sub','Сообщения, лайки, гости и выход в сеть тех, за кем вы следите'),'<button type="button" class="btn btn-light btn-sm" data-v4-readall>'+v4Icon('check')+h(t('ntf_mark_all','Прочитать все'))+'</button>')+
    '<div class="v4-ntf-host"></div><div class="note mt24">'+v4Icon('gear')+'<div>'+h(t('v4_ntf_settings_note','Какие уведомления получать и когда — в'))+' <a href="#/settings/notifications" data-v4-go="/settings/notifications">'+h(t('v4_settings_link','настройках'))+'</a>.</div></div></div>';
  body.insertBefore(page,wrap);page.querySelector('.v4-ntf-host').appendChild(wrap);
  v4WireBack(page);
  $$('[data-v4-readall]',page).forEach(function(b){b.addEventListener('click',function(){var ra=page.querySelector('[data-vcn="readall"]');if(ra)ra.click();});});
  $$('[data-v4-go]',page).forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();navigate(a.dataset.v4Go);});});
}
function v4NtfGroups(c,shown){
  var KIND={message:['msg','chat'],offer:['msg','chat'],photo:['msg','image'],gift:['like','gift'],like:['like','heartf'],match:['like','heartf'],guest:['view','eye'],online:['online','zap'],topup:['promo','wallet'],promo:['promo','star']};
  var html='',day=null,open=false;
  for(var i=0;i<shown.length;i++){
    var n=shown[i],k=KIND[n.kind]||['promo','bell'],lab=n.at?v4DayLabel(n.at):t('ntf_group_earlier','Ранее');
    if(lab!==day){if(open)html+='</div>';day=lab;html+='<h2 class="sec">'+h(lab)+'</h2><div class="list" role="list">';open=true;}
    c.rows.push(n);
    var nm=localizedPersonName(n.name||''),photo=n.photo||'',av=photo?'<div class="avatar" style="background-image:url('+h(vcPhotoCopy(photo,240)||photo)+')"><i class="k '+k[0]+'">'+v4Icon(k[1])+'</i></div>':'<div class="avatar navy">'+v4Icon(k[1])+'</div>';
    html+='<div class="nrow vcn-row'+(n.unread?' unread is-unread':'')+'" data-kind="'+h(n.kind)+'" data-i="'+(c.rows.length-1)+'" role="listitem" tabindex="0">'+av+'<div class="tx"><b>'+h(n.title||nm||vcnKindInfo(n.kind).label)+'</b>'+(n.body?'<p>'+h(n.body)+'</p>':'')+'</div><span class="tm">'+(n.at?h(v4Clock(n.at)):'')+'</span></div>';
  }
  if(open)html+='</div>';
  return html;
}
function v4OnlineSuggestions(chats){
  var have={},seen={},out=[];
  (chats||[]).forEach(function(c){have[parseInt(c.peer_id||c.id,10)||0]=1;});
  [state.deckAll||[],(state.me&&state.me.virtuals)||[]].forEach(function(pool){pool.forEach(function(p){var id=parseInt(p.id||p.user_id,10)||0;if(!id||have[id]||seen[id]||!p.online)return;seen[id]=1;out.push(p);});});
  return out;
}
/* <<< v4 stage 4 screens <<< */

/* ===== Start ===== */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
