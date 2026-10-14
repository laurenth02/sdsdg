/* ---------- Профиль (prototype V.me) — markup of viewProfile, legacy ids kept for its wiring ---------- */
function v4MeHtml(c){
  var me=state.me||{},likes=Math.max(0,parseInt(me.likes_cnt,10)||0),guests=Math.max(0,parseInt(me.guests_cnt,10)||0),chats=((state.chats||me.inbox)||[]).length;
  var unread=parseInt(me.notice_unread,10)||0,chatWord=v4Plural(chats,t('v4_chat_1','чат'),t('v4_chat_2','чата'),t('v4_chat_5','чатов'));
  var right='<button type="button" class="ibtn" data-v4-go="/activity" aria-label="'+h(t('notifications','Уведомления'))+'">'+v4Icon('bell')+(unread?'<i class="dot"></i>':'')+'</button><button type="button" class="ibtn" data-v4-go="/settings" aria-label="'+h(t('nav_settings','Настройки'))+'">'+v4Icon('gear')+'</button>';
  var avatar=c.photo?'<div class="avatar xl" style="background-image:url('+h(vcPhotoCopy(c.photo,240)||c.photo)+')"></div>':'<div class="avatar navy xl">'+h(initials(c.rawName))+'</div>';
  var sub=[c.city,c.zodiac?h(c.zodiac):''].filter(Boolean).join(' · ');
  var miss=(c.missing||[]).slice(0,3).join(', ');
  var completion=c.missing&&c.missing.length?'<div class="card amber"><div class="row-between"><b>'+h(t('v4_profile_filled','Профиль заполнен на {n}%').replace('{n}',c.complete))+'</b><button type="button" class="v4-link b small" id="vc-profile-missing" data-next-step="'+h(c.nextStep?c.nextStep.key:'edit')+'" style="color:#B57A00;text-decoration:none">'+h(t('v4_profile_complete','Дополнить'))+'</button></div><div class="progress mt8"><i style="width:'+c.complete+'%"></i></div><div class="small mt8" style="color:#8A5B00">'+h((miss?t('v4_profile_add','Добавьте')+': '+miss.toLowerCase()+' — ':'')+t('v4_profile_more_replies','такие анкеты получают больше ответов.'))+'</div></div>':'';
  var cells='';
  for(var i=0;i<c.photos.length;i++){
    var u=c.photos[i],managed=c.managedGallery.indexOf(u)>=0,isMain=(u===c.photo||(!c.photo&&i===0));
    cells+='<div class="vc-own-photo" role="button" tabindex="0" data-photo-index="'+i+'" data-managed="'+(managed?1:0)+'" data-url="'+h(u)+'" aria-label="'+h(t('open_photo','Открыть фото')+' '+(i+1))+'"><img src="'+h(u)+'" alt="" loading="lazy">'+(isMain?'<span class="main">'+h(t('main_photo','Главное'))+'</span>':'')+
      '<span class="pg-acts">'+(managed&&!isMain?'<button type="button" class="vc-photo-main" aria-label="'+h(t('make_main_photo','Сделать главным'))+'" title="'+h(t('make_main_photo','Сделать главным'))+'">'+v4Icon('star')+'</button>':'')+(managed?'<button type="button" class="vc-photo-del" aria-label="'+h(t('delete_photo','Удалить фото'))+'" title="'+h(t('delete_photo','Удалить фото'))+'">'+v4Icon('trash')+'</button>':'')+'</span></div>';
  }
  cells+='<button type="button" class="add" id="vc-photo-add" aria-label="'+h(t('add_photo','Добавить фото'))+'">'+v4Icon('camera')+h(t('add_photo','Добавить фото'))+'</button>'+(c.photos.length?'':'<div>'+h(t('photo','Фото'))+' 2</div><div>'+h(t('photo','Фото'))+' 3</div>');
  var ints=(c.ints||[]).map(function(x){return '<span class="chip">'+v4IntIcon(x)+h(localizedInterest(x))+'</span>';}).join('');
  var rows=[['vc-prof-likes','/activity','bell','coral',t('notifications','Уведомления'),unread?unread+' '+t('v4_new_count','новых'):t('v4_no_new','Нет новых')],
    ['vc-prof-open-settings','/settings','gear','navy',t('nav_settings','Настройки'),t('v4_settings_sub','Вход, уведомления, тема, язык')],
    ['vc-prof-settings','/settings/account','lock','amber',t('v4_account_security','Защита аккаунта'),c.accountEmail?t('v4_email_set','Email и пароль заданы'):t('secure_account_copy','Добавьте email и пароль, чтобы не потерять профиль и переписки.')],
    ['','/support','help','green',t('v4_nav_support','Поддержка'),t('v4_support_sub','Частые вопросы и ваши заявки')],
    ['','@/community-guidelines/','shield','',t('v4_rules_safety','Правила и безопасность'),t('v4_rules_sub','Условия, конфиденциальность')]];
  var list='<div class="list mt12">'+rows.map(function(r){return '<button type="button" class="row"'+(r[0]?' id="'+r[0]+'"':'')+' data-v4-go="'+h(r[1])+'"><span class="ic '+r[3]+'">'+v4Icon(r[2])+'</span><span class="tx"><b>'+h(r[4])+'</b><span>'+h(r[5])+'</span></span>'+v4Icon('chev','chev')+'</button>';}).join('')+'</div>';
  var wallet='<div class="wallet"><div class="lab">'+h(t('account_balance','Баланс аккаунта'))+'</div><div class="amt" id="vc-pf-balance">'+h(vibeAmount(c.balance))+'</div><div class="sub"><div><b>'+chats+'</b><span>'+h(chatWord)+'</span></div><div><b>'+likes+'</b><span>'+h(t('v4_likes_word','лайков'))+'</span></div></div><div class="row2"><button type="button" class="btn" id="vc-prof-store">'+h(t('chat_packages','Пакеты чатов'))+'</button><button type="button" class="btn o" data-v4-go="/purchases">'+h(t('purchases','Покупки'))+'</button></div></div>';
  return '<div class="v4 v4-page v4-me">'+v4Tb(t('nav_profile','Профиль'),{right:right})+'<div class="wrap">'+
    v4Head(t('nav_profile','Профиль'),t('profile_preview_label','Так вас видят другие'),'<button type="button" class="btn btn-light" id="vc-prof-edit">'+v4Icon('edit')+h(t('prof_edit','Редактировать'))+'</button>')+
    '<div class="cols"><div>'+
      '<div class="card pad-lg"><div class="mehead">'+avatar+'<div class="tx"><b>'+h(c.rawName)+(c.age?', '+h(c.age):'')+'</b>'+(sub?'<span>'+sub+'</span>':'')+(c.status?'<span class="pill navy mt8">'+h(c.status)+'</span>':'')+'</div><button type="button" class="ibtn v4-avatar-cam" id="vc-pf-avatar-btn" aria-label="'+h(t('add_photo','Добавить фото'))+'">'+v4Icon('camera')+'</button></div>'+
      '<div class="kpi mt16"><div><b>'+likes+'</b><span>'+h(t('v4_likes_word','лайков'))+'</span></div><div><b>'+guests+'</b><span>'+h(t('v4_guests_word','гостей'))+'</span></div><div><b>'+chats+'</b><span>'+h(chatWord)+'</span></div></div>'+
      '<button type="button" class="btn btn-light btn-block mt16 vis-m v4-prof-edit">'+v4Icon('edit')+h(t('v4_edit_profile','Редактировать профиль'))+'</button></div>'+
      completion+
      '<h2 class="sec">'+h(t('prof_photos','Фото'))+' <button type="button" class="v4-link v4-prof-edit" style="text-decoration:none">'+h(t('v4_change','Изменить'))+'</button></h2><div class="photogrid">'+cells+'</div><input type="file" id="vc-profile-photo-input" accept="image/*,.heic,.heif" hidden>'+
      '<h2 class="sec">'+h(t('prof_bio','О себе'))+'</h2><div class="card"><p class="pp-bio-v4">'+(c.bio?c.bio:'<span class="muted">'+h(t('v4_bio_empty','Расскажите о себе — пару честных строк работают лучше списка достоинств.'))+'</span>')+'</p>'+(ints?'<div class="chips mt12">'+ints+'</div>':'')+'</div>'+
    '</div><div>'+wallet+list+'</div></div></div></div>';
}
function v4WireMe(body){
  document.body.classList.remove('v4-no-nav');body.classList.add('v4-view');
  $$('.v4-prof-edit',body).forEach(function(b){b.addEventListener('click',function(){toggleProfileEdit();});});
  $$('[data-v4-go]',body).forEach(function(b){if(b.id&&b.id!=='vc-prof-settings')return;b.addEventListener('click',function(e){e.stopImmediatePropagation();var to=b.dataset.v4Go;if(to.charAt(0)==='@'){window.open(to.slice(1),'_blank','noopener');return;}navigate(to);},true);});
}

/* ---------- Редактирование профиля (prototype V.meEdit) — markup of toggleProfileEdit, legacy field ids kept ---------- */
function v4EditHtml(c){
  var p=c.p,save='<button type="button" class="btn btn-sm btn-dark" data-v4-save>'+h(t('prof_save','Сохранить'))+'</button>';
  return '<div class="profile-edit v4 v4-page v4-edit">'+
    '<div class="topbar v4tb vis-m"><button type="button" class="ibtn" id="vc-pe-cancel" aria-label="'+h(t('cancel','Отмена'))+'">'+v4Icon('back')+'</button><h1>'+h(t('prof_edit','Редактировать'))+'</h1>'+save+'</div>'+
    '<div class="wrap">'+v4Head(t('v4_edit_profile','Редактировать профиль'),t('v4_edit_sub','Изменения видны сразу после сохранения'),'<div class="v4-head-acts"><button type="button" class="btn btn-light" data-v4-cancel>'+h(t('cancel','Отмена'))+'</button><button type="button" class="btn btn-dark" data-v4-save>'+h(t('prof_save','Сохранить'))+'</button></div>')+
    '<div class="cols narrow"><div>'+
      '<h2 class="sec">'+h(t('prof_photos','Фото'))+'</h2><div class="photogrid" id="v4-edit-photos"></div><input type="file" id="v4-edit-photo-input" accept="image/*,.heic,.heif" hidden><div class="hint">'+h(t('v4_photo_hint','JPG, PNG или HEIC до 8 МБ. Лицо должно быть видно — такие анкеты смотрят чаще.'))+'</div>'+
      '<h2 class="sec">'+h(t('v4_basic','Основное'))+'</h2><div class="card">'+
        '<label class="field"><span>'+h(t('name','Имя'))+'</span><input class="input" id="vc-pe-name" maxlength="80" autocomplete="given-name" value="'+h(p.fullname||p.name||'')+'"></label>'+
        '<div class="v4-grid2"><label class="field"><span>'+h(t('age','Возраст'))+'</span><input class="input" id="vc-pe-age" type="number" min="18" max="80" inputmode="numeric" value="'+h(p.age||p.u_age||'')+'"></label>'+
        '<label class="field"><span>'+h(t('city','Город'))+'</span><div class="city-picker-row"><div class="city-picker"><input class="input" id="vc-pe-city" maxlength="60" value="'+h(p.city||'')+'" autocomplete="address-level2"><div class="city-suggest" role="listbox" hidden></div></div><button type="button" class="ibtn" id="vc-pe-geo" aria-label="'+h(t('detect','Определить'))+'" title="'+h(t('detect','Определить'))+'">'+v4Icon('pin')+'</button></div></label></div>'+
        '<label class="field"><span>'+h(t('v4_status_today','Статус на сегодня'))+'</span><select class="select" id="vc-pe-status">'+dailyStatusOptions(parseInt(p.daily_status,10)||0)+'</select></label>'+
        '<label class="field" style="margin:0"><span>'+h(t('prof_zodiac','Знак зодиака'))+'</span><select class="select" id="vc-pe-zodiac">'+zodiacOptions(c.zodiacVal)+'</select></label>'+
      '</div>'+
      '<h2 class="sec">'+h(t('profile_story','О себе'))+'</h2><div class="card"><textarea class="textarea" id="vc-pe-bio" maxlength="500" rows="4" placeholder="'+h(t('v4_bio_placeholder','Пара честных строк: чем живёте, что цените, с чего начать разговор'))+'">'+h(p.bio||'')+'</textarea><small class="hint pe-count" id="vc-pe-bio-count"></small></div>'+
    '</div><div>'+
      '<h2 class="sec">'+h(t('prof_interests','Интересы'))+' <span class="muted small" style="font-weight:600">'+h(t('v4_pick_3_6','выберите 3–6'))+'</span></h2><div class="card pe-interests" role="group" aria-labelledby="vc-pe-int-label"><span id="vc-pe-int-label" hidden>'+h(t('prof_interests','Интересы'))+'</span><div class="input-wrap">'+v4Icon('search')+'<input class="input" id="vc-pe-int-search" type="search" autocomplete="off" placeholder="'+h(t('interests_search','Найти интерес'))+'" aria-label="'+h(t('interests_search','Найти интерес'))+'"></div><div class="vc-int-chips mt12" id="vc-pe-int-chips"></div><label class="field mt12" style="margin-bottom:0"><span>'+h(t('interests_custom','Свои интересы через запятую'))+'</span><input class="input" id="vc-pe-ints" value="'+h(c.editInts.join(', '))+'" placeholder="'+h(t('interests_placeholder','Через запятую: музыка, кофе, путешествия'))+'"></label></div>'+
      '<h2 class="sec">'+h(t('looking_for','Кого ищете'))+'</h2><div class="card"><select class="select" id="vc-pe-look" aria-label="'+h(t('looking_for','Кого ищете'))+'"><option value="0">'+h(t('not_selected','Не выбрано'))+'</option><option value="2"'+(parseInt(p.look,10)===2?' selected':'')+'>'+h(t('women','Девушек'))+'</option><option value="1"'+(parseInt(p.look,10)===1?' selected':'')+'>'+h(t('men','Парней'))+'</option><option value="3"'+(parseInt(p.look,10)===3?' selected':'')+'>'+h(t('everyone','Всех'))+'</option></select></div>'+
      '<div class="note mt16">'+v4Icon('eye')+'<div>'+h(t('v4_edit_note','Всё, что вы заполняете, видят собеседницы. Email и пароль никогда не показываются.'))+'</div></div>'+
      '<div class="pe-actions mt16"><button type="button" class="btn btn-primary btn-lg btn-block pe-save" id="vc-pe-save">'+h(t('prof_save','Сохранить'))+'</button></div>'+
    '</div></div></div></div>';
}
function v4RenderEditPhotos(){
  var host=document.getElementById('v4-edit-photos');if(!host)return;
  var p=(state.me&&state.me.profile)||{},main=p.photo||'',list=(Array.isArray(p.gallery)?p.gallery.slice():[]);
  if(main&&list.indexOf(main)<0)list.unshift(main);
  var html='';for(var i=0;i<6;i++){var u=list[i];html+=u?'<div><img src="'+h(u)+'" alt="" loading="lazy">'+(u===main||(!main&&i===0)?'<span class="main">'+h(t('main_photo','Главное'))+'</span>':'')+'</div>':'<button type="button" class="add" data-v4-addphoto>'+v4Icon('plus')+h(i===0?t('v4_main_photo','Главное фото'):t('v4_add','Добавить'))+'</button>';}
  host.innerHTML=html;
  var input=document.getElementById('v4-edit-photo-input');
  $$('[data-v4-addphoto]',host).forEach(function(b){b.addEventListener('click',function(){if(input)input.click();});});
  if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',function(){
    var file=input.files&&input.files[0];input.value='';if(!file)return;
    if(!isImageFileCandidate(file)){toast(t('bad_type','Неподдерживаемый формат'),'error');return;}
    imageFileToDataUrl(file,8*1024*1024,2048).then(function(data){return api('add_photo',{img:data});}).then(function(r){if(r&&r.ok){toast(t('photo_added','Фото добавлено'),'success');loadMe().then(v4RenderEditPhotos);}else handleApiError(r,'Error');}).catch(function(e){toast(e&&e.message==='too_big'?t('photo_too_big','Фото больше 8 МБ'):t('read_failed','Не удалось прочитать файл'),'error');});
  });}
}
function v4WireEdit(body){
  document.body.classList.add('v4-no-nav');body.classList.add('v4-view');
  v4RenderEditPhotos();
  $$('[data-v4-save]',body).forEach(function(b){b.addEventListener('click',function(){var s=document.getElementById('vc-pe-save');if(s)s.click();});});
  $$('[data-v4-cancel]',body).forEach(function(b){b.addEventListener('click',function(){var c=document.getElementById('vc-pe-cancel');if(c)c.click();});});
}

/* ---------- Пакеты и баланс (prototype V.store) — the same purchase entry point (vcStoreBuyPack) ---------- */
function v4ViewStore(){
  var body=document.getElementById('vc-main-body');if(!body)return;
  if(state.storeVisitKey)funnelTrack('store_opened',storeSignalContext({entry:state.storeAttribution?'chat_paywall':'navigation'}),state.storeVisitKey);
  requestStoreCatalog();
  var packs=state.cryptoPacks||[],chatPacks=packs.filter(function(p){return p.fulfillment!=='wallet';}),walletPacks=packs.filter(function(p){return p.fulfillment==='wallet';});
  var bal=parseInt(state.me&&state.me.balance,10)||0,mpc=(chatPacks[0]&&parseInt(chatPacks[0].messages_per_chat,10))||10,direct=vcCryptoDirectPrices();
  function eur(v){v=Number(v)||0;return '€'+(v%1?v.toFixed(2).replace('.',','):String(v));}
  function price(p){var reg=Number(p.eur!=null?p.eur:p.usd||0),promo=p.fulfillment==='wallet'?null:activeStorePromoForVibes(p.vibes,'crypto'),off=promo&&promo.offer_amount_minor!=null?Number(promo.offer_amount_minor)/Math.pow(10,parseInt(promo.currency_scale,10)||0):reg;return {reg:reg,off:off,fixed:!!(promo&&promo.benefit_kind==='fixed_price'&&off<reg)};}
  var bestIdx=-1,bestPer=1e9;chatPacks.forEach(function(p,i){var c=Math.max(1,parseInt(p.chats,10)||1),pr=price(p).off/c;if(c>1&&pr<bestPer-0.001){bestPer=pr;bestIdx=i;}});
  if(bestIdx>=0){var mids=chatPacks.map(function(p){return Math.max(1,parseInt(p.chats,10)||1);});var mid=mids.indexOf(3);if(mid>=0)bestIdx=mid;}
  var packsHtml;
  if(state.cryptoPacks===null)packsHtml='<div class="sk" style="height:84px;border-radius:20px"></div><div class="sk mt8" style="height:84px;border-radius:20px"></div>';
  else if(!chatPacks.length)packsHtml='<div class="note amber">'+v4Icon('info')+'<div>'+h(t('packs_unavailable_why','Пакеты станут доступны после подключения оплаты. Сейчас покупки работают из чата.'))+'</div></div>';
  else packsHtml=chatPacks.map(function(p,i){
    var c=Math.max(1,parseInt(p.chats,10)||1),pr=price(p),per=pr.off/c,best=i===bestIdx;
    var tag=pr.fixed?'<span class="tag">−'+Math.round((1-pr.off/pr.reg)*100)+'%</span>':(best?'<span class="tag">'+h(t('pack_popular','Выгодно'))+'</span>':'');
    var meta=t('chat_pack_meta','{n} сообщений в каждом чате').replace('{n}',String(parseInt(p.messages_per_chat,10)||mpc))+(c>1?' · '+(direct?vcUsdt(per):eur(Math.round(per*100)/100))+' '+t('per_chat','за чат'):'');
    return '<button type="button" class="pack'+(best?' best':'')+'" data-pack="'+h(p.pack_id)+'">'+tag+'<span class="n">'+c+'</span><span class="tx"><b>'+h(chatCountLabel(c))+'</b><span>'+h(meta)+'</span></span><span class="pr"><b>'+h(direct?vcUsdt(pr.off):eur(pr.off))+'</b><span>'+h(direct?eur(pr.reg):vcUsdt(pr.off))+'</span></span></button>';
  }).join('');
  var topup=walletPacks.length?'<div class="amts">'+walletPacks.map(function(p){return '<button type="button" data-pack="'+h(p.pack_id)+'">'+h(eur(price(p).reg))+'</button>';}).join('')+'</div>':'';
  if(state.testPayments)topup+='<div class="mt12">'+vcTopupFormHtml('v4-topup')+'</div>';
  if(!topup)topup='<p class="muted small">'+h(t('store_crypto_unavailable','Крипто временно недоступно'))+'</p>';
  var chains=(state.cryptoChains||[]).map(function(nw){var nk=String(nw.key||nw.chain||'');return '<button type="button" class="crypto-network chip'+(state.cryptoNetwork===nk?' on is-selected':'')+'" data-network="'+h(nk)+'">'+h(nw.label||nk)+'</button>';}).join('');
  var methods='<div class="card"><b>'+h(t('payment_methods_title','Способы оплаты'))+'</b>'+
    '<div class="method mt12" style="box-shadow:none;padding:8px 0"><span class="ic">₮</span><span class="tx"><b>USDT</b><span>'+h(vcCryptoLive()?t('v4_usdt_sub','Зачисление автоматическое, обычно за несколько минут'):t('store_crypto_off_copy','Оплата криптовалютой временно недоступна. Ничего не списывается.'))+'</span></span></div>'+
    (chains?'<div class="muted small mt8">'+h(t('crypto_choose_network','Сеть оплаты'))+'</div><div class="chips mt8 v4-networks">'+chains+'</div>':'')+
    '<div class="method off" style="box-shadow:none;padding:8px 0;margin-top:8px"><span class="ic">'+v4Icon('card')+'</span><span class="tx"><b>'+h(t('bank_card','Банковская карта'))+'</b><span>'+h(t('card_payment_soon','Оплата картой готовится. Минимальный пакет — €7.'))+'</span></span><span class="pill">'+h(t('coming_soon','Скоро'))+'</span></div><div class="v4-brands">'+vcCardBrandsHtml()+'</div></div>';
  var hist='<button type="button" class="ibtn" data-v4-go="/purchases" aria-label="'+h(t('purchase_history','История покупок'))+'">'+v4Icon('history')+'</button>';
  var chatsN=((state.chats||(state.me&&state.me.inbox))||[]).length;
  v4Page(v4Tb(t('v4_nav_store','Пакеты и баланс'),{back:'/profile',right:hist})+'<div class="wrap">'+
    v4Head(t('v4_nav_store','Пакеты и баланс'),t('v4_store_sub','Чаты оплачиваются пакетами, подарки — с баланса'),'<button type="button" class="btn btn-light" data-v4-go="/purchases">'+v4Icon('history')+h(t('purchase_history','История покупок'))+'</button>')+
    (state.testPayments?'<div class="note amber" style="margin-bottom:14px">'+v4Icon('info')+'<div>'+h(t('test_payment_method_copy','Работает, пока не подключены реальные платёжные системы. Деньги не списываются.'))+'</div></div>':'')+
    v4StorePromoHtml()+
    '<div class="cols"><div>'+
      '<div class="wallet"><div class="lab">'+h(t('account_balance','Баланс аккаунта'))+'</div><div class="amt">'+h(vibeAmount(bal))+'</div><div class="sub"><div><b>'+mpc+'</b><span>'+h(t('v4_msgs_in_chat','сообщений в чате'))+'</span></div><div><b>'+chatsN+'</b><span>'+h(t('v4_active_chats','переписок'))+'</span></div></div></div>'+
      '<h2 class="sec">'+h(t('chat_packages','Пакеты чатов'))+'</h2>'+packsHtml+
      '<div class="note mt12">'+v4Icon('info')+'<div>'+h(t('v4_store_note','Один чат — одна анкета и {n} ваших сообщений; ответы собеседницы лимит не расходуют. Цена видна до оплаты, ничего не списывается без подтверждения.').replace('{n}',String(mpc)))+'</div></div>'+
      '<h2 class="sec">'+h(t('top_up','Пополнить баланс'))+'</h2><div class="card"><p class="muted small" style="margin-bottom:12px">'+h(t('purchase_balance_copy','Для фото, подарков и функций профиля')+'. '+t('v4_no_chats_from_balance','Чаты с баланса не оплачиваются.'))+'</p>'+topup+'</div>'+
    '</div><div class="side-sticky">'+methods+
      '<div class="card mt12 green"><b>'+h(t('v4_why_packs','Почему пакеты, а не поминутно'))+'</b><p class="small mt8" style="color:#128A4C">'+h(t('v4_why_packs_text','Вы заранее знаете, сколько переписок у вас есть, и ничего не списывается незаметно. Цена видна до каждого действия.'))+'</p></div>'+
      '<div class="card mt12"><b>'+h(t('v4_pay_help','Нужна помощь с оплатой?'))+'</b><p class="muted small mt8">'+h(t('v4_pay_help_text','Платёж не пришёл или ошиблись сетью — напишите, разберёмся.'))+'</p><button type="button" class="btn btn-light btn-sm mt12" data-v4-go="/support/new?cat=payment">'+h(t('v4_write_support','Написать в поддержку'))+'</button></div>'+
    '</div></div></div>','v4-store');
  var page=body.querySelector('.v4-store');if(!page)return;
  v4WireBack(page);
  $$('[data-pack]',page).forEach(function(b){b.addEventListener('click',function(){vcStoreBuyPack(parseInt(b.dataset.pack,10));});});
  $$('.crypto-network',page).forEach(function(b){b.addEventListener('click',function(){state.cryptoNetwork=String(b.dataset.network||'');$$('.crypto-network',page).forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.classList.toggle('is-selected',on);});});});
  $$('[data-v4-go]',page).forEach(function(b){b.addEventListener('click',function(){navigate(b.dataset.v4Go);});});
  if(state.testPayments)wireTopupForm(page);
  armStorePromoCountdown();
}
function v4StorePromoHtml(){
  var promo=state.storePromo;if(!promo||!activeStorePromoForVibes(promo.base_vibes))return '';
  var fixed=promo.benefit_kind==='fixed_price';
  return '<div class="card soft v4-promo" style="margin-bottom:14px"><div class="row-between"><div><b>'+h(fixed?t('rescue_offer_title','Продолжить чат за €4,99'):t('promo_same_price','Больше общения по специальной цене'))+'</b><div class="small mt8 muted">'+h(fixed?t('rescue_offer_store_hint','скидка закрепится при создании оплаты'):t('promo_personal_offer','Персональное предложение'))+'</div></div><div style="text-align:right"><div class="small muted">'+h(t('promo_expires_in','Закончится через'))+'</div><b id="vc-store-promo-time">'+h(fixed?precisePromoRemaining(promo.expires_at):storePromoRemaining(promo.expires_at))+'</b></div></div></div>';
}
/* ---------- История покупок (prototype V.purchases) ---------- */
function v4ViewPurchases(){
  var body=v4Page(v4Tb(t('purchases','Покупки'),{back:'/store'})+'<div class="wrap">'+v4Head(t('purchase_history','История покупок'),t('v4_purchases_sub','Пакеты, пополнения и их статусы'))+'<div class="cols narrow"><div><div id="v4-purchases"><div class="sk" style="height:70px;border-radius:20px"></div><div class="sk mt8" style="height:70px;border-radius:20px"></div></div>'+
    '<div class="note mt16">'+v4Icon('info')+'<div>'+h(t('v4_purchases_note','Если оплата прошла, а покупка не появилась через 30 минут, напишите в поддержку и укажите номер заказа.'))+'</div></div></div>'+
    '<div><div class="card"><b>'+h(t('v4_pay_problem','Проблема с оплатой?'))+'</b><p class="muted small mt8">'+h(t('v4_pay_problem_text','Укажите номер заказа — мы проверим платёж вручную.'))+'</p><button type="button" class="btn btn-light btn-sm mt12" data-v4-go="/support/new?cat=payment">'+h(t('v4_to_support','В поддержку'))+'</button></div></div></div></div>','v4-purchases');
  if(!body)return;
  var page=body.querySelector('.v4-purchases');v4WireBack(page);
  function go(root){$$('[data-v4-go]',root).forEach(function(b){b.addEventListener('click',function(){navigate(b.dataset.v4Go);});});}
  go(page);
  api('purchase_history').then(function(r){
    var host=document.getElementById('v4-purchases');if(!host)return;
    var items=(r&&r.ok&&Array.isArray(r.items))?r.items:null;state.purchaseHistory=items||{err:(r&&r.err)||'Error'};
    if(!items){host.innerHTML='<div class="empty"><div class="em">'+v4Icon('refresh')+'</div><b>'+h(localizedErrorText(r&&r.err))+'</b></div>';return;}
    if(!items.length){host.innerHTML='<div class="empty"><div class="em">'+v4Icon('history')+'</div><b>'+h(t('v4_purchases_empty','Покупок пока нет'))+'</b><div>'+h(t('v4_purchases_empty_sub','Здесь появятся пакеты чатов и пополнения баланса.'))+'</div><button type="button" class="btn btn-dark" data-v4-go="/store">'+h(t('v4_to_packs','К пакетам'))+'</button></div>';go(host);return;}
    host.innerHTML='<div class="list">'+items.map(function(it){it=it||{};var title=purchaseHistoryTitle(it),prov=purchaseHistoryProvider(it),isPack=String(it.fulfillment||'')!=='wallet'&&!/баланс|баланс|balance/i.test(title);
      return '<div class="row"><span class="ic '+(isPack?'navy':'coral')+'">'+v4Icon(isPack?'chat':'wallet')+'</span><span class="tx"><b>'+h(title)+'</b><span>'+h(fmtTime(parseInt(it.date,10)||0))+(prov?' · '+h(prov):'')+(it.ref?' · #'+h(String(it.ref).slice(0,8)):'')+'</span></span><span style="text-align:right"><b>'+purchaseHistoryAmount(it)+'</b><span class="pill green" style="display:inline-flex;margin-top:4px">'+h(t('v4_paid','Оплачено'))+'</span></span></div>';}).join('')+'</div>';
  }).catch(function(){var host=document.getElementById('v4-purchases');if(host)host.innerHTML='<div class="empty"><div class="em">'+v4Icon('refresh')+'</div><b>'+h(t('network_error','Ошибка сети'))+'</b></div>';});
}

/* ---------- Настройки (prototype V.settings): the legacy sections, one section per page ---------- */
var V4_SETS=[['account','lock','v4_set_account','Вход и защита','v4_set_account_sub','Email, пароль, выход'],['notifications','bell','notifications','Уведомления','v4_set_ntf_sub','Push, события, звуки, тихие часы'],['appearance','sun','v4_set_look','Оформление и язык','v4_set_look_sub','Тема и язык интерфейса'],['privacy','shield','v4_set_privacy','Приватность','v4_set_privacy_sub','Заблокированные, правила, условия'],['app','download','v4_set_app','Приложение','v4_set_app_sub','Установить на главный экран'],['danger','trash','v4_set_danger','Удаление аккаунта','v4_set_danger_sub','Деактивация с возвратом 30 дней']];
function v4ViewSettings(sub){
  viewSettings();
  var body=document.getElementById('vc-main-body'),sv=body&&body.querySelector('.settings-view');if(!sv)return;
  var desk=!!(window.matchMedia&&window.matchMedia('(min-width:980px)').matches);
  var known={};V4_SETS.forEach(function(s){known[s[0]]=s;});
  var id=known[sub]?sub:(desk?(known[state.v4SetPage]?state.v4SetPage:'account'):'');if(known[sub])state.v4SetPage=sub;
  var meta=known[id];
  var list='<div class="list">'+V4_SETS.map(function(s){return '<button type="button" class="row'+(s[0]===id?' on':'')+'" data-set="'+s[0]+'"><span class="ic '+(s[0]==='danger'?'':'navy')+'">'+v4Icon(s[1])+'</span><span class="tx"><b>'+h(t(s[2],s[3]))+'</b><span>'+h(t(s[4],s[5]))+'</span></span>'+v4Icon('chev','chev')+'</button>';}).join('')+'</div><div class="muted small v4-ver">otkrovenno.online</div>';
  var page=document.createElement('div');page.className='v4 v4-page v4-sets';
  page.innerHTML=v4Tb(meta?t(meta[2],meta[3]):t('nav_settings','Настройки'),{back:(meta&&!desk)?'/settings':'/profile'})+'<div class="wrap">'+v4Head(t('nav_settings','Настройки'),t('v4_sets_sub','Вход, уведомления, оформление, приватность'))+
    (meta?'<div class="sets"><div class="setnav vis-d">'+list+'</div><div class="setbody"><h2 class="sec vis-d" style="margin-top:0">'+h(t(meta[2],meta[3]))+'</h2><div class="v4-set-host"></div></div></div>':list)+'</div>';
  body.innerHTML='';body.classList.add('v4-view');body.appendChild(page);
  if(meta){
    page.querySelector('.v4-set-host').appendChild(sv);
    var kind=function(sec){
      if(sec.id==='vc-settings-account')return 'account';
      if(sec.querySelector('#vc-notif-prefs,#vc-set-push'))return 'notifications';
      if(sec.querySelector('.vc-theme-switch,#vc-set-lang'))return 'appearance';
      if(sec.querySelector('#vc-set-blocked,#vc-set-tos'))return 'privacy';
      if(sec.querySelector('#vc-set-install'))return 'app';
      if(sec.querySelector('#vc-set-logout,#vc-delete-account'))return 'zone';
      if(sec.querySelector('#vc-support-open'))return 'help';
      return 'other';
    };
    $$('.set-section',sv).forEach(function(sec){
      var k=kind(sec),show=k===id||(id==='account'&&(k==='zone'||k==='other'))||(id==='danger'&&k==='zone');
      if(sec.style.display==='none'||sec.hidden&&!sec.classList.contains('v4-set-on'))show=show&&k!=='other';
      sec.hidden=!show;sec.classList.toggle('v4-set-on',show);
      if(k==='zone'){$$('.set-row',sec).forEach(function(row){var danger=row.classList.contains('vc-danger-zone');row.hidden=id==='account'?danger:!danger;});}
    });
    var head=sv.querySelector('.vc-page-head');if(head)head.hidden=true;
  }
  v4WireBack(page);
  $$('[data-set]',page).forEach(function(b){b.addEventListener('click',function(){navigate('/settings/'+b.dataset.set);});});
}

/* ---------- Поддержка (prototype V.support): частые вопросы, заявки, новая заявка, заявка ---------- */
var V4_FAQ=[['v4_faq_q1','Как работают пакеты чатов?','v4_faq_a1','Пакет открывает переписку с выбранной анкетой. В каждом чате — 10 сообщений от вас, ответы собеседницы лимит не расходуют. Цена видна до оплаты.'],
  ['v4_faq_q2','Для чего нужен баланс в евро?','v4_faq_a2','Баланс тратится на подарки, стикеры и функции профиля. Чаты оплачиваются отдельно пакетами — так вы всегда видите, сколько переписок осталось.'],
  ['v4_faq_q3','Оплата не пришла. Что делать?','v4_faq_a3','Зачисление USDT обычно занимает несколько минут после подтверждения сети. Если прошло больше 30 минут — создайте заявку и укажите номер заказа из истории покупок.'],
  ['v4_faq_q4','Кто ведёт анкеты?','v4_faq_a4','Часть анкет — виртуальные собеседницы: за ними стоят операторы и AI-ассистент. Это указано в правилах и в самих анкетах, мы этого не скрываем.'],
  ['v4_faq_q5','Как удалить аккаунт?','v4_faq_a5','Настройки → «Удаление аккаунта». Аккаунт деактивируется на 30 дней — за это время можно вернуться, просто войдя снова. Потом данные удаляются.']];
var V4_SUPPORT_CATS=[['general','support_general','Общий вопрос'],['payment','support_payment','Оплата и баланс'],['profile','support_profile','Профиль'],['chat','support_chat','Чат'],['bug','support_bug','Ошибка'],['other','support_other','Другое']];
function v4SupportPill(status){var s=String(status||'');return '<span class="pill '+(s==='closed'?'':(/answer|resolv|done/.test(s)?'green':'amber'))+'">'+h(supportStatusText(s)||s)+'</span>';}
function v4Go(root){$$('[data-v4-go]',root).forEach(function(b){if(b.dataset.goBound)return;b.dataset.goBound='1';b.addEventListener('click',function(){navigate(b.dataset.v4Go);});});}
function v4ViewSupport(sub){
  if(sub&&sub.indexOf('new')===0)return v4SupportNew();
  if(sub&&/^\d+$/.test(sub))return v4SupportTicket(parseInt(sub,10));
  var open=state.v4FaqOpen==null?0:state.v4FaqOpen;
  var faq=V4_FAQ.map(function(f,i){return '<div class="faq"><button type="button" class="faq-q'+(open===i?' on':'')+'" data-faq="'+i+'" aria-expanded="'+(open===i?'true':'false')+'">'+h(t(f[0],f[1]))+v4Icon('chevd')+'</button><div class="faq-a'+(open===i?' on':'')+'">'+h(t(f[2],f[3]))+'</div></div>';}).join('');
  var body=v4Page(v4Tb(t('v4_nav_support','Поддержка'),{back:'/profile'})+'<div class="wrap">'+v4Head(t('v4_nav_support','Поддержка'),t('v4_support_sub','Частые вопросы и ваши заявки'),'<button type="button" class="btn btn-dark" data-v4-go="/support/new">'+v4Icon('plus')+h(t('v4_new_ticket','Новая заявка'))+'</button>')+
    '<div class="cols"><div><h2 class="sec" style="margin-top:0">'+h(t('v4_faq','Частые вопросы'))+'</h2><div class="list">'+faq+'</div></div>'+
    '<div><h2 class="sec" style="margin-top:0">'+h(t('v4_your_tickets','Ваши заявки'))+'</h2><div id="v4-tickets"><div class="sk" style="height:64px;border-radius:20px"></div></div>'+
    '<button type="button" class="btn btn-primary btn-block mt16 vis-m" data-v4-go="/support/new">'+v4Icon('plus')+h(t('v4_new_ticket','Новая заявка'))+'</button>'+
    '<div class="note mt16">'+v4Icon('clock')+'<div>'+h(t('support_intro','Опишите вопрос — мы ответим здесь. Тексты переписок к обращению не прикладываются.'))+'</div></div></div></div></div>','v4-support');
  if(!body)return;
  var page=body.querySelector('.v4-support');v4WireBack(page);v4Go(page);
  $$('[data-faq]',page).forEach(function(b){b.addEventListener('click',function(){var i=+b.dataset.faq;state.v4FaqOpen=open=(open===i?-1:i);$$('[data-faq]',page).forEach(function(x){var on=+x.dataset.faq===open;x.classList.toggle('on',on);x.setAttribute('aria-expanded',on?'true':'false');x.nextElementSibling.classList.toggle('on',on);});});});
  api('support_list').then(function(r){
    var host=document.getElementById('v4-tickets');if(!host)return;
    if(!r||!r.ok){host.innerHTML='<div class="note amber">'+v4Icon('info')+'<div>'+h(localizedErrorText(r&&r.err,t('support_load_failed','Не удалось загрузить обращения')))+'</div></div>';return;}
    var items=r.items||[];
    if(!items.length){host.innerHTML='<div class="note">'+v4Icon('help')+'<div>'+h(t('support_empty','Обращений пока нет'))+'</div></div>';return;}
    host.innerHTML='<div class="list">'+items.slice(0,20).map(function(x){var title=String(x.description||'').split('\n')[0].slice(0,60)||('#'+x.id);return '<button type="button" class="row" data-v4-go="/support/'+h(x.id)+'"><span class="tx"><b>'+h(title)+'</b><span>#'+h(x.id)+' · '+h(x.category||'')+(x.created_at?' · '+h(fmtTime(parseInt(x.created_at,10)||0)):'')+'</span></span>'+v4SupportPill(x.status)+'</button>';}).join('')+'</div>';
    v4Go(host);
  }).catch(function(){var host=document.getElementById('v4-tickets');if(host)host.innerHTML='<div class="note amber">'+v4Icon('info')+'<div>'+h(t('network_error','Ошибка сети'))+'</div></div>';});
}
function v4SupportNew(){
  var q=state.routeQuery,order=String(q&&q.get('order')||'').replace(/[^A-Za-z0-9_.#-]/g,'').slice(0,40),code=String(q&&q.get('code')||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,60),le=state.lastError;
  if(!code&&le&&Date.now()-le.at<900000)code=le.code;
  var cat=String(q&&q.get('cat')||'').replace(/[^a-z]/g,'');if(!cat)cat=order?'payment':(code?'bug':'general');
  var body=v4Page(v4Tb(t('v4_new_ticket','Новая заявка'),{back:'/support'})+'<div class="wrap"><div class="authcard v4-ticket-card">'+v4Head(t('v4_new_ticket','Новая заявка'),t('support_intro','Опишите вопрос — мы ответим здесь. Тексты переписок к обращению не прикладываются.'))+
    '<div class="field"><span>'+h(t('v4_topic','Тема'))+'</span><div class="chips">'+V4_SUPPORT_CATS.map(function(c){return '<button type="button" class="chip'+(c[0]===cat?' on':'')+'" data-cat="'+c[0]+'">'+h(t(c[1],c[2]))+'</button>';}).join('')+'</div></div>'+
    '<label class="field" data-only="payment"'+(cat==='payment'?'':' hidden')+'><span>'+h(t('support_order','Номер заказа (если вопрос про оплату)'))+'</span><input class="input" id="v4-sup-order" maxlength="40" autocomplete="off" value="'+h(order)+'"></label>'+
    '<label class="field" data-only="bug"'+(cat==='bug'?'':' hidden')+'><span>'+h(t('support_code','Код ошибки (если он показан)'))+'</span><input class="input" id="v4-sup-code" maxlength="60" autocomplete="off" value="'+h(code)+'"></label>'+
    '<label class="field"><span>'+h(t('v4_what_happened','Что случилось'))+'</span><textarea class="textarea" id="v4-sup-text" maxlength="1400" placeholder="'+h(t('v4_sup_placeholder','Опишите по шагам: что делали, что ожидали, что произошло'))+'"></textarea></label>'+
    '<button type="button" class="check on" id="v4-sup-tech" aria-pressed="true"><span class="box">'+v4Icon('check')+'</span><span>'+h(t('v4_sup_tech','Приложить технические данные (браузер, версия приложения). Переписки и пароли не передаются.'))+'</span></button>'+
    '<button type="button" class="btn btn-primary btn-lg btn-block mt24" id="v4-sup-send">'+h(t('support_send','Отправить'))+'</button></div></div>','v4-support-new');
  if(!body)return;
  var page=body.querySelector('.v4-support-new');v4WireBack(page);
  $$('[data-cat]',page).forEach(function(b){b.addEventListener('click',function(){cat=b.dataset.cat;$$('[data-cat]',page).forEach(function(x){x.classList.toggle('on',x===b);});$$('[data-only]',page).forEach(function(f){f.hidden=f.dataset.only!==cat;});});});
  var tech=document.getElementById('v4-sup-tech');tech.addEventListener('click',function(){var on=!tech.classList.contains('on');tech.classList.toggle('on',on);tech.setAttribute('aria-pressed',on?'true':'false');});
  var send=document.getElementById('v4-sup-send');
  send.addEventListener('click',function(){
    var text=document.getElementById('v4-sup-text').value.trim();if(!text){toast(t('support_describe','Опишите проблему'),'error');return;}
    if(send.disabled)return;
    var ord=cat==='payment'?document.getElementById('v4-sup-order').value.trim().replace(/[^A-Za-z0-9_.#-]/g,'').slice(0,40):'',cd=cat==='bug'?document.getElementById('v4-sup-code').value.trim().replace(/[^A-Za-z0-9_.-]/g,'').slice(0,60):'';
    var lines=[text];if(ord)lines.push('Order: '+ord);if(cd)lines.push('Error code: '+cd);if(tech.classList.contains('on'))lines.push(supportContextLines());
    var payload={category:cat,description:lines.join('\n')};if(ord){payload.related_type='order';if(/^\d+$/.test(ord))payload.related_id=ord;}
    setBusy(send,true);
    api('support_create',payload).then(function(r){setBusy(send,false);if(r&&r.ok){try{vcSupportDraftClear();}catch(e){}toast(t('support_created','Обращение создано')+' #'+r.id,'success');navigate(r.id?'/support/'+r.id:'/support');}else handleApiError(r,'Error');}).catch(function(){setBusy(send,false);toast(t('network_error','Ошибка сети'),'error');});
  });
}
function v4SupportTicket(id){
  var body=v4Page(v4Tb('#'+id,{back:'/support'})+'<div class="wrap"><div class="authcard v4-ticket-card" id="v4-ticket"><div class="sk" style="height:120px;border-radius:20px"></div></div></div>','v4-support-ticket');
  if(!body)return;
  v4WireBack(body.querySelector('.v4-support-ticket'));
  api('support_detail',{id:id}).then(function(r){
    var host=document.getElementById('v4-ticket');if(!host)return;
    if(!r||!r.ok){host.innerHTML='<div class="empty"><div class="em">'+v4Icon('info')+'</div><b>'+h(localizedErrorText(r&&r.err,t('support_load_failed','Не удалось загрузить обращения')))+'</b></div>';return;}
    var tk=r.ticket||{},msgs=r.messages||[],title=String(tk.description||'').split('\n')[0].slice(0,80)||('#'+tk.id);
    var stack='<div class="tmsg"><small>'+h(t('you','Вы'))+(tk.created_at?' · '+h(fmtTime(parseInt(tk.created_at,10)||0)):'')+'</small>'+h(tk.description||'')+'</div>'+msgs.map(function(m){var sup=m.role!=='user',txt=m.message||(m.status_change?supportStatusText(m.status_change):'');if(!txt)return '';return '<div class="tmsg'+(sup?' sup':'')+'"><small>'+h(sup?t('support_section','Поддержка'):t('you','Вы'))+(m.created_at?' · '+h(fmtTime(parseInt(m.created_at,10)||0)):'')+'</small>'+h(txt)+'</div>';}).join('');
    host.innerHTML=v4Head(title,(tk.category||'')+' · #'+tk.id,v4SupportPill(tk.status))+'<div class="row-between vis-m" style="margin-bottom:12px"><b>'+h(title)+'</b>'+v4SupportPill(tk.status)+'</div><div class="stack">'+stack+'</div>'+
      (tk.status!=='closed'?'<div class="composer mt16" style="border:0;padding:0;background:none"><div class="inp"><textarea id="v4-tk-ta" rows="1" maxlength="2000" placeholder="'+h(t('support_reply','Добавить сообщение'))+'"></textarea></div><button type="button" class="send" id="v4-tk-send" aria-label="'+h(t('send','Отправить'))+'">'+v4Icon('send')+'</button></div>':'<div class="note mt16">'+v4Icon('check')+'<div>'+h(t('v4_ticket_closed','Заявка закрыта. Если проблема повторилась — создайте новую.'))+'</div></div>');
    var sb=document.getElementById('v4-tk-send');if(sb)sb.addEventListener('click',function(){var ta=document.getElementById('v4-tk-ta'),msg=ta.value.trim();if(!msg)return;sb.disabled=true;api('support_comment',{id:id,message:msg}).then(function(rr){if(rr&&rr.ok){toast(t('sent','Отправлено'),'success');v4SupportTicket(id);}else{sb.disabled=false;handleApiError(rr,'Error');}}).catch(function(){sb.disabled=false;toast(t('network_error','Ошибка сети'),'error');});});
  }).catch(function(){var host=document.getElementById('v4-ticket');if(host)host.innerHTML='<div class="empty"><div class="em">'+v4Icon('refresh')+'</div><b>'+h(t('network_error','Ошибка сети'))+'</b></div>';});
}
