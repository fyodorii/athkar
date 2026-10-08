// What is recommended right now: the sunnah prayer before or after the prayer whose time it
// is, Duha, the witr, the night prayer… It is self-contained (no imports) because the widget
// script carries a copy of it (widget.js writes sunnahNow.toString() into the script).
//
// times: { fajr, sunrise, duha, dhuhr, asr, maghrib, isha, midnight, lastThird } with `at`
// (ms or Date) for today; iqama: minutes after each adhan; friday: true on Fridays.
// Returns { key, title, sub, since: { name, minutes } | null }.

export function sunnahNow(times, now, iqama, friday) {
  const at = (k) => +times[k].at;
  const q = (k) => at(k) + ((iqama && iqama[k]) || 0) * 60000;
  const day = 86400000;
  const names = { fajr: 'الفجر', dhuhr: friday ? 'الجمعة' : 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
  const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  let last = null;
  for (const k of order) if (at(k) <= now) last = k;
  const since = last ? { key: last, name: names[last], minutes: Math.floor((now - at(last)) / 60000) } : null;
  const out = (key, title, sub) => ({ key, title, sub, since });

  if (now < at('fajr')) {
    if (now >= at('lastThird') - day) return out('qiyam', 'قيام الليل', 'الثلث الأخير — وقت النزول والاستجابة');
    if (now >= at('midnight') - day) return out('witr', 'الوتر', 'اجعل آخر صلاتك بالليل وتراً');
    return out('isha-after', 'سنة العشاء البعدية', 'ركعتان بعد الفريضة، ثم الوتر');
  }
  if (now < q('fajr')) return out('fajr-before', 'سنة الفجر', 'ركعتان قبل الفريضة، خير من الدنيا وما فيها');
  if (now < at('sunrise')) return out('morning', 'أذكار الصباح', 'من صلاة الفجر حتى طلوع الشمس');
  if (now < at('duha')) return out('sunrise', 'وقت الشروق', 'انتظر حتى ترتفع الشمس قيد رمح');
  if (now < at('dhuhr') - 10 * 60000) return out('duha', 'صلاة الضحى', 'ركعتان فأكثر، تجزئان عن صدقة كل مفاصلك');
  if (now < at('dhuhr')) return out('zawal', 'وقت النهي', 'قيام الشمس قبيل الظهر — لا نافلة');
  if (now < q('dhuhr')) return friday ? out('jumuah', 'صلاة الجمعة', 'التبكير والإنصات، وصلِّ ما كُتب لك') : out('dhuhr-before', 'سنة الظهر القبلية', 'أربع ركعات قبل الفريضة');
  if (now < at('asr')) return friday ? out('jumuah-after', 'سنة الجمعة البعدية', 'أربع في المسجد أو ركعتان في البيت') : out('dhuhr-after', 'سنة الظهر البعدية', 'ركعتان بعد الفريضة');
  if (now < q('asr')) return out('asr-before', 'أربع قبل العصر', '«رحم الله امرأً صلى قبل العصر أربعاً»');
  if (friday && now >= at('maghrib') - 3600000 && now < at('maghrib')) return out('jumuah-hour', 'ساعة الإجابة', 'آخر ساعة بعد العصر يوم الجمعة — أكثر من الدعاء');
  if (now < at('maghrib')) return out('evening', 'أذكار المساء', 'من العصر حتى غروب الشمس');
  if (now < q('maghrib')) return out('maghrib-before', 'ركعتان قبل المغرب', '«صلوا قبل صلاة المغرب… لمن شاء»');
  if (now < at('isha')) return out('maghrib-after', 'سنة المغرب البعدية', 'ركعتان بعد الفريضة');
  if (now < q('isha')) return out('isha-before', 'ركعتان قبل العشاء', '«بين كل أذانين صلاة»');
  if (now < at('midnight')) return out('isha-after', 'سنة العشاء البعدية', 'ركعتان بعد الفريضة، ثم الوتر');
  if (now < at('lastThird')) return out('witr', 'الوتر', 'اجعل آخر صلاتك بالليل وتراً');
  return out('qiyam', 'قيام الليل', 'الثلث الأخير — وقت النزول والاستجابة');
}

// "مضى على أذان الظهر ٥٧ دقيقة" (minutes as plain numbers; the caller formats the digits).
export function sinceText(since, num = String) {
  if (!since || since.minutes > 240) return '';
  const m = since.minutes;
  if (m < 1) return `أذان ${since.name} الآن`;
  if (m < 60) return `مضى على أذان ${since.name} ${num(m)} ${m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتان' : m <= 10 ? 'دقائق' : 'دقيقة'}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hours = h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${num(h)} ساعات`;
  return `مضى على أذان ${since.name} ${hours}${r ? ` و${num(r)} ${r <= 10 && r > 2 ? 'دقائق' : r === 1 ? 'دقيقة' : r === 2 ? 'دقيقتان' : 'دقيقة'}` : ''}`;
}
