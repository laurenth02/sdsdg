# Builds server/app/app.js for the stage-4 redesign:   python3 tools/build_app.py
# - inserts tools/v4/screens.js between the "v4 stage 4" markers (before "/* ===== Start ===== */"), replacing a previous copy;
# - adds the prototype icons missing from V4_ICONS;
# - one-time patches (router, chat list, notification centre, profile detail), each asserted and idempotent.
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'server', 'app', 'app.js')
PROTO = '/tmp/gwegwe/prototype/app.js'
BEGIN, END = '/* >>> v4 stage 4 screens (tools/v4/screens.js) >>> */', '/* <<< v4 stage 4 screens <<< */'

src = open(APP, encoding='utf-8').read()
import glob
block = '\n\n'.join(open(f, encoding='utf-8').read().rstrip('\n') for f in sorted(glob.glob(os.path.join(ROOT, 'tools', 'v4', 'screens*.js'))))

# 1) screens block
if BEGIN in src:
    a, b = src.index(BEGIN), src.index(END) + len(END)
    src = src[:a] + BEGIN + '\n' + block + '\n' + END + src[b:]
else:
    anchor = '/* ===== Start ===== */'
    assert src.count(anchor) == 1
    src = src.replace(anchor, BEGIN + '\n' + block + '\n' + END + '\n\n' + anchor)

# 2) icons from the prototype set (F: = filled -> "*" in the app)
ICONS = 'copy download play pause cake coin cup chef leaf music book wave dance paw run palette lotus film gamepad brain wifioff cloud'.split()
if 'v4-stage4-icons' not in src:
    proto = open(PROTO, encoding='utf-8').read().split('\n')
    pblock = '\n'.join(proto[52:127])
    add = []
    for name in ICONS:
        m = re.search(r"\b" + name + r"\s*:\s*'([^']*)'", pblock)
        assert m, name
        val = m.group(1)
        if val.startswith('F:'):
            val = '*' + val[2:]
        add.append("  %s:'%s'," % (name, val))
    anchor = 'var V4_ICONS={\n'
    assert src.count(anchor) == 1
    src = src.replace(anchor, anchor + '  /* v4-stage4-icons: prototype icons for interests, media and states */\n' + '\n'.join(add) + '\n')


def patch(old, new, count=1):
    global src
    if new in src:
        return
    n = src.count(old)
    assert n == count, ('patch anchor', old[:100], n)
    src = src.replace(old, new)


# 3) router: navigation stack, sheet cleanup, phone screens without tabs; new screens
patch("  closeRouteOverlays();\n  state.route = route;\n",
      "  closeRouteOverlays();\n  state.route = route;\n  v4TrackNav(route);v4CloseSheet();document.body.classList.toggle('v4-no-nav',v4NoNavRoute(route));\n")
patch("  if (route === '/likes') return viewLikes();", "  if (route === '/likes') return v4ViewLikes();")
patch("api('profile_view',{virtual:id}).catch(function(){});renderProfileDetail(p);", "api('profile_view',{virtual:id}).catch(function(){});v4RenderProfileDetail(p);")
patch("  body.innerHTML='<div class=\"vcn-page-wrap\"></div>';\n  vcnOpenCenter(body.firstChild);\n}",
      "  body.innerHTML='<div class=\"vcn-page-wrap\"></div>';\n  vcnOpenCenter(body.firstChild);v4NotificationsChrome(body);\n}")

# 4) notification centre, page mode: chips as prototype tabs, rows grouped by day
patch("class=\"vcn-chip'+(defs[i][0]===f?' is-active':'')+'\" data-vcn-filter=",
      "class=\"vcn-chip'+(defs[i][0]===f?' is-active':'')+(c.page?' tab'+(defs[i][0]===f?' on':''):'')+'\" data-vcn-filter=")
patch("  }else{\n    if(fresh.length)html+=group(t('ntf_group_new','Новые'),fresh);",
      "  }else if(c.page){html+=v4NtfGroups(c,fresh.concat(older).sort(function(a,b){return (b.at||0)-(a.at||0);}));\n  }else{\n    if(fresh.length)html+=group(t('ntf_group_new','Новые'),fresh);")

# 5) chat list: search behind the topbar icon, «Сейчас в сети» under the list, names with age, prototype times
patch("'</h1>'+v4BalancePill()+'</div>'+\n    (chats.length?'<label class=\"input-wrap mt12\">'",
      "'</h1>'+(chats.length?'<button type=\"button\" class=\"ibtn\" id=\"v4-chat-search-btn\" aria-expanded=\"false\" aria-controls=\"vc-chat-search\" aria-label=\"'+h(t('search_chats','Поиск по чатам'))+'\">'+v4Icon('search')+'</button>':'')+'</div>'+\n    (chats.length?'<label class=\"input-wrap mt12\" id=\"v4-chat-search-wrap\" hidden>'")
old_strip_start = "  var strip='';\n  if(chats.length){\n    strip='<div class=\"chat-match-scroller\">"
if 'sugg=v4OnlineSuggestions(chats)' not in src:
    a = src.index(old_strip_start)
    b = src.index("  var rows='';for(i=0;i<chats.length;i++)rows+=v4ChatRowHtml(chats[i],0);", a)
    new_strip = ("  var strip='',sugg=v4OnlineSuggestions(chats);\n"
                 "  if(sugg.length){\n"
                 "    strip='<h2 class=\"sec v4-online-h\">'+h(t('v4_online_now','Сейчас в сети'))+' <a href=\"#/\" data-v4-online-all>'+h(t('all','Все'))+'</a></h2><div class=\"chat-match-scroller\"><div class=\"faces\" id=\"vc-chat-match-strip\" tabindex=\"0\" aria-label=\"'+h(t('v4_online_now','Сейчас в сети'))+'\">';\n"
                 "    for(var si=0;si<sugg.length&&si<18;si++){var sm=sugg[si],sav=sm.photo||'',sn=localizedPersonName(sm.name||'');strip+='<button type=\"button\" class=\"face\" data-match-chat=\"'+(parseInt(sm.id,10)||0)+'\" aria-label=\"'+h(sn)+'\"><span class=\"chat-match-avatar avatar ring\" style=\"background:'+(sav?'url('+h(vcPhotoCopy(sav,240)||sav)+') center/cover,':'')+avatarBg(sn)+'\">'+(sav?'':h(initials(sn)))+'<i class=\"on\"></i></span><small>'+h(sn)+'</small></button>';}\n"
                 "    strip+='</div><button type=\"button\" class=\"chat-match-next ibtn\" id=\"vc-chat-match-next\" aria-label=\"'+h(t('next','Дальше'))+'\">'+glassIcon('back','vc-chat-next-icon vc-flip-horizontal')+'</button></div>';\n"
                 "  }\n")
    src = src[:a] + new_strip + src[b:]
patch("'<div class=\"sc\">'+strip+listHtml+'</div></div>", "'<div class=\"sc\">'+listHtml+strip+'</div></div>")
patch("  if(chatSearch)chatSearch.addEventListener('input',applyChatFilter);\n",
      "  if(chatSearch)chatSearch.addEventListener('input',applyChatFilter);\n"
      "  var v4sb=document.getElementById('v4-chat-search-btn'),v4sw=document.getElementById('v4-chat-search-wrap');\n"
      "  if(v4sb&&v4sw)v4sb.addEventListener('click',function(){var open=v4sw.hidden;v4sw.hidden=!open;v4sb.setAttribute('aria-expanded',open?'true':'false');if(open&&chatSearch)chatSearch.focus();else if(chatSearch){chatSearch.value='';applyChatFilter();}});\n"
      "  $$('[data-v4-online-all]',body).forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();navigate('/');setTimeout(function(){var cb=document.getElementById('vc-online-filter');if(cb&&!cb.checked){cb.checked=true;setDiscoverOnlineEnabled(true);}},350);});});\n")
patch("var tm=h(fmtTime(c.last_at||c.last_ts||c.ts)),unreadCount=parseInt(c.unread,10)||0;", "var tm=h(v4ChatTime(c.last_at||c.last_ts||c.ts)),unreadCount=parseInt(c.unread,10)||0;")
patch("'<div class=\"cinfo\"><div class=\"cnm\"><b>'+nm+'</b>", "'<div class=\"cinfo\"><div class=\"cnm\"><b>'+nm+(parseInt(c.age,10)?', '+parseInt(c.age,10):'')+'</b>")

# 7) batch 2: own profile + editor markup (legacy ids kept), store delegation, settings/support/purchases routes
if 'v4MeHtml({' not in src:
    a = src.index("  body.innerHTML = '<div class=\"profile-view own-profile-view vc-pf\">' +")
    b = src.index("  var editBtn = document.getElementById('vc-prof-edit'); if (editBtn) editBtn.addEventListener('click', toggleProfileEdit);", a)
    src = src[:a] + "  body.innerHTML = v4MeHtml({p:p,rawName:rawName,age:age,city:city,bio:bio,photo:photo,zodiac:zodiac,status:status,complete:complete,missing:missing,nextStep:nextStep,accountEmail:accountEmail,balance:balance,ints:ints,photos:photos,managedGallery:managedGallery});\n" + src[b:]
patch("navigate('/settings');});\n}\nfunction wireProfilePhotos(){", "navigate('/settings');});\n  v4WireMe(body);\n}\nfunction wireProfilePhotos(){")
if 'v4EditHtml({' not in src:
    a = src.index("  body.innerHTML = '<div class=\"profile-edit\">' +")
    b = src.index("  var peRoot=document.getElementById('vc-main-body').querySelector('.profile-edit')", a)
    src = src[:a] + "  body.innerHTML = v4EditHtml({p:p,editInts:editInts,zodiacVal:zodiacVal});\n  v4WireEdit(body);\n" + src[b:]
patch("  if (route === '/profile'){ viewProfile();v4AfterRender(v4ProfileExtras);return; }", "  if (route === '/profile'){ state.profileEdit=false;viewProfile();return; }")
patch("  if (route === '/settings'){ viewSettings();v4AfterRender(v4SettingsNav);return; }", "  if (route === '/settings' || route.indexOf('/settings/')===0){ v4ViewSettings(route.split('/')[2]||'');return; }")
patch("  if (route === '/support') return viewSupport();", "  if (route === '/support' || route.indexOf('/support/')===0) return v4ViewSupport(route.split('/')[2]||'');")
patch("  if (route === '/store') return viewStore();", "  if (route === '/purchases') return v4ViewPurchases();\n  if (route === '/store') return viewStore();")
patch("function viewStore(){\n  var body = document.getElementById('vc-main-body');\n  if (!body) return;\n  if(state.storeVisitKey){", "function viewStore(){return v4ViewStore();}\nfunction viewStoreLegacy(){\n  var body = document.getElementById('vc-main-body');\n  if (!body) return;\n  if(state.storeVisitKey){")

open(APP, 'w', encoding='utf-8', newline='\n').write(src)
print('app.js built:', len(src), 'chars')

# 6) redesign.css: the stage-4 section at the end, replaced on every build
CSS = os.path.join(ROOT, 'server', 'app', 'redesign.css')
CB, CE = '/* >>> v4 stage 4 css (tools/v4/stage4.css) >>> */', '/* <<< v4 stage 4 css <<< */'
css = open(CSS, encoding='utf-8').read()
part = open(os.path.join(ROOT, 'tools', 'v4', 'stage4.css'), encoding='utf-8').read().rstrip('\n')
if CB in css:
    css = css[:css.index(CB)] + CB + '\n' + part + '\n' + CE + css[css.index(CE) + len(CE):]
else:
    css = css.rstrip('\n') + '\n\n' + CB + '\n' + part + '\n' + CE + '\n'
open(CSS, 'w', encoding='utf-8', newline='\n').write(css)
print('redesign.css built:', len(css), 'chars')
