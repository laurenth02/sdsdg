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
