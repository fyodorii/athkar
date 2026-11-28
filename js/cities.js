// Cities to pick from when location access is off, with each one's usual calculation method.
export const CITIES = [
  ['مكة المكرمة', 'السعودية', 21.4225, 39.8262, 'Asia/Riyadh', 'umm_al_qura'],
  ['المدينة المنورة', 'السعودية', 24.4672, 39.6111, 'Asia/Riyadh', 'umm_al_qura'],
  ['الرياض', 'السعودية', 24.7136, 46.6753, 'Asia/Riyadh', 'umm_al_qura'],
  ['جدة', 'السعودية', 21.4858, 39.1925, 'Asia/Riyadh', 'umm_al_qura'],
  ['الدمام', 'السعودية', 26.4207, 50.0888, 'Asia/Riyadh', 'umm_al_qura'],
  ['الطائف', 'السعودية', 21.2703, 40.4158, 'Asia/Riyadh', 'umm_al_qura'],
  ['بريدة', 'السعودية', 26.3592, 43.9818, 'Asia/Riyadh', 'umm_al_qura'],
  ['تبوك', 'السعودية', 28.3838, 36.555, 'Asia/Riyadh', 'umm_al_qura'],
  ['حائل', 'السعودية', 27.5114, 41.7208, 'Asia/Riyadh', 'umm_al_qura'],
  ['أبها', 'السعودية', 18.2164, 42.5053, 'Asia/Riyadh', 'umm_al_qura'],
  ['جازان', 'السعودية', 16.8892, 42.5511, 'Asia/Riyadh', 'umm_al_qura'],
  ['نجران', 'السعودية', 17.4917, 44.1322, 'Asia/Riyadh', 'umm_al_qura'],
  ['الأحساء', 'السعودية', 25.3833, 49.5833, 'Asia/Riyadh', 'umm_al_qura'],
  ['ينبع', 'السعودية', 24.0895, 38.0618, 'Asia/Riyadh', 'umm_al_qura'],
  ['الكويت', 'الكويت', 29.3759, 47.9774, 'Asia/Kuwait', 'kuwait'],
  ['الدوحة', 'قطر', 25.2854, 51.531, 'Asia/Qatar', 'qatar'],
  ['المنامة', 'البحرين', 26.2285, 50.586, 'Asia/Bahrain', 'umm_al_qura'],
  ['أبوظبي', 'الإمارات', 24.4539, 54.3773, 'Asia/Dubai', 'gulf'],
  ['دبي', 'الإمارات', 25.2048, 55.2708, 'Asia/Dubai', 'gulf'],
  ['الشارقة', 'الإمارات', 25.3463, 55.4209, 'Asia/Dubai', 'gulf'],
  ['مسقط', 'عُمان', 23.588, 58.3829, 'Asia/Muscat', 'mwl'],
  ['صنعاء', 'اليمن', 15.3694, 44.191, 'Asia/Aden', 'mwl'],
  ['عدن', 'اليمن', 12.7855, 45.0187, 'Asia/Aden', 'mwl'],
  ['عمّان', 'الأردن', 31.9454, 35.9284, 'Asia/Amman', 'jordan'],
  ['القدس', 'فلسطين', 31.7683, 35.2137, 'Asia/Jerusalem', 'jordan'],
  ['غزة', 'فلسطين', 31.5017, 34.4668, 'Asia/Gaza', 'egypt'],
  ['دمشق', 'سوريا', 33.5138, 36.2765, 'Asia/Damascus', 'mwl'],
  ['حلب', 'سوريا', 36.2021, 37.1343, 'Asia/Damascus', 'mwl'],
  ['بيروت', 'لبنان', 33.8938, 35.5018, 'Asia/Beirut', 'mwl'],
  ['بغداد', 'العراق', 33.3152, 44.3661, 'Asia/Baghdad', 'mwl'],
  ['البصرة', 'العراق', 30.5085, 47.7804, 'Asia/Baghdad', 'mwl'],
  ['القاهرة', 'مصر', 30.0444, 31.2357, 'Africa/Cairo', 'egypt'],
  ['الإسكندرية', 'مصر', 31.2001, 29.9187, 'Africa/Cairo', 'egypt'],
  ['أسوان', 'مصر', 24.0889, 32.8998, 'Africa/Cairo', 'egypt'],
  ['الخرطوم', 'السودان', 15.5007, 32.5599, 'Africa/Khartoum', 'egypt'],
  ['طرابلس', 'ليبيا', 32.8872, 13.1913, 'Africa/Tripoli', 'egypt'],
  ['بنغازي', 'ليبيا', 32.1194, 20.0868, 'Africa/Tripoli', 'egypt'],
  ['تونس', 'تونس', 36.8065, 10.1815, 'Africa/Tunis', 'tunisia'],
  ['الجزائر', 'الجزائر', 36.7538, 3.0588, 'Africa/Algiers', 'algeria'],
  ['وهران', 'الجزائر', 35.6969, -0.6331, 'Africa/Algiers', 'algeria'],
  ['الرباط', 'المغرب', 34.0209, -6.8416, 'Africa/Casablanca', 'morocco'],
  ['الدار البيضاء', 'المغرب', 33.5731, -7.5898, 'Africa/Casablanca', 'morocco'],
  ['نواكشوط', 'موريتانيا', 18.0735, -15.9582, 'Africa/Nouakchott', 'mwl'],
  ['مقديشو', 'الصومال', 2.0469, 45.3182, 'Africa/Mogadishu', 'mwl'],
  ['جيبوتي', 'جيبوتي', 11.5721, 43.1456, 'Africa/Djibouti', 'mwl'],
  ['إسطنبول', 'تركيا', 41.0082, 28.9784, 'Europe/Istanbul', 'turkey'],
  ['أنقرة', 'تركيا', 39.9334, 32.8597, 'Europe/Istanbul', 'turkey'],
  ['طهران', 'إيران', 35.6892, 51.389, 'Asia/Tehran', 'mwl'],
  ['كابل', 'أفغانستان', 34.5553, 69.2075, 'Asia/Kabul', 'karachi'],
  ['إسلام آباد', 'باكستان', 33.6844, 73.0479, 'Asia/Karachi', 'karachi'],
  ['كراتشي', 'باكستان', 24.8607, 67.0011, 'Asia/Karachi', 'karachi'],
  ['لاهور', 'باكستان', 31.5204, 74.3587, 'Asia/Karachi', 'karachi'],
  ['دلهي', 'الهند', 28.6139, 77.209, 'Asia/Kolkata', 'karachi'],
  ['دكا', 'بنغلاديش', 23.8103, 90.4125, 'Asia/Dhaka', 'karachi'],
  ['كوالالمبور', 'ماليزيا', 3.139, 101.6869, 'Asia/Kuala_Lumpur', 'singapore'],
  ['جاكرتا', 'إندونيسيا', -6.2088, 106.8456, 'Asia/Jakarta', 'singapore'],
  ['سنغافورة', 'سنغافورة', 1.3521, 103.8198, 'Asia/Singapore', 'singapore'],
  ['لندن', 'بريطانيا', 51.5074, -0.1278, 'Europe/London', 'mwl'],
  ['مانشستر', 'بريطانيا', 53.4808, -2.2426, 'Europe/London', 'mwl'],
  ['باريس', 'فرنسا', 48.8566, 2.3522, 'Europe/Paris', 'france'],
  ['برلين', 'ألمانيا', 52.52, 13.405, 'Europe/Berlin', 'mwl'],
  ['أمستردام', 'هولندا', 52.3676, 4.9041, 'Europe/Amsterdam', 'mwl'],
  ['بروكسل', 'بلجيكا', 50.8503, 4.3517, 'Europe/Brussels', 'mwl'],
  ['ستوكهولم', 'السويد', 59.3293, 18.0686, 'Europe/Stockholm', 'mwl'],
  ['مدريد', 'إسبانيا', 40.4168, -3.7038, 'Europe/Madrid', 'mwl'],
  ['روما', 'إيطاليا', 41.9028, 12.4964, 'Europe/Rome', 'mwl'],
  ['موسكو', 'روسيا', 55.7558, 37.6173, 'Europe/Moscow', 'mwl'],
  ['نيويورك', 'أمريكا', 40.7128, -74.006, 'America/New_York', 'isna'],
  ['شيكاغو', 'أمريكا', 41.8781, -87.6298, 'America/Chicago', 'isna'],
  ['هيوستن', 'أمريكا', 29.7604, -95.3698, 'America/Chicago', 'isna'],
  ['لوس أنجلوس', 'أمريكا', 34.0522, -118.2437, 'America/Los_Angeles', 'isna'],
  ['تورنتو', 'كندا', 43.6532, -79.3832, 'America/Toronto', 'isna'],
  ['سيدني', 'أستراليا', -33.8688, 151.2093, 'Australia/Sydney', 'mwl'],
  ['جوهانسبرغ', 'جنوب أفريقيا', -26.2041, 28.0473, 'Africa/Johannesburg', 'mwl'],
  ['لاغوس', 'نيجيريا', 6.5244, 3.3792, 'Africa/Lagos', 'mwl'],
  ['داكار', 'السنغال', 14.7167, -17.4677, 'Africa/Dakar', 'mwl'],
].map(([name, country, lat, lng, tz, method]) => ({ name, country, lat, lng, tz, method }));

const R = Math.PI / 180;
export function distanceKm(a, b) {
  const h =
    Math.sin(((b.lat - a.lat) * R) / 2) ** 2 +
    Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(((b.lng - a.lng) * R) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearestCity(lat, lng) {
  let best = null;
  let bestKm = Infinity;
  for (const c of CITIES) {
    const km = distanceKm({ lat, lng }, c);
    if (km < bestKm) {
      best = c;
      bestKm = km;
    }
  }
  return { city: best, km: bestKm };
}
