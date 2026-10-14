/* ---------- Оболочка: строка профиля в меню (prototype sidebar: «Имя, возраст · Город · знак») ---------- */
function v4RailSub(){
  var p=(state.me&&state.me.profile)||{},city=p.city?(typeof localizedCity==='function'?localizedCity(p.city):p.city):'';
  var z=profileZodiacText(p.zodiac_info||{},p.zodiac);
  return [city,z].filter(Boolean).join(' · ');
}
