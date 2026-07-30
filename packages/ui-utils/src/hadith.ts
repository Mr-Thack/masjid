/**
 * Curated hadith collection for the Mishkaat hadith frame
 * (docs/design-language.md §4 content rules, §7.5).
 *
 * Every entry is Arabic + English + source, drawn from the canonical
 * collections, and tagged so rotation can be context-seeded (Fajr virtues at
 * Fajr, Jumu'ah hadith on Friday) with zero admin work: the daily pick is a
 * pure function of the date.
 */

export type HadithTag =
  | 'general'
  | 'prayer'
  | 'fajr'
  | 'jumuah'
  | 'ramadan'
  | 'knowledge'
  | 'character'
  | 'community';

export interface HadithEntry {
  arabic: string;
  english: string;
  source: string;
  tags: HadithTag[];
}

export const HADITH_COLLECTION: HadithEntry[] = [
  {
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    english: 'Actions are but by intentions, and every person shall have only what they intended.',
    source: 'Sahih al-Bukhari 1',
    tags: ['general'],
  },
  {
    arabic: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
    english: 'Seeking knowledge is an obligation upon every Muslim.',
    source: 'Sunan Ibn Majah 224',
    tags: ['knowledge', 'general'],
  },
  {
    arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    english: 'The best of you are those who learn the Qur’an and teach it.',
    source: 'Sahih al-Bukhari 5027',
    tags: ['knowledge', 'general'],
  },
  {
    arabic: 'الطُّهُورُ شَطْرُ الْإِيمَانِ',
    english: 'Purity is half of faith.',
    source: 'Sahih Muslim 223',
    tags: ['general'],
  },
  {
    arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    english: 'The most beloved deeds to Allah are the most consistent, even if small.',
    source: 'Sahih al-Bukhari 6464',
    tags: ['general'],
  },
  {
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    english:
      'Whoever believes in Allah and the Last Day, let him speak good or remain silent.',
    source: 'Sahih al-Bukhari 6018',
    tags: ['character', 'general'],
  },
  {
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    english: 'None of you truly believes until he loves for his brother what he loves for himself.',
    source: 'Sahih al-Bukhari 13',
    tags: ['character', 'community'],
  },
  {
    arabic: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ',
    english:
      'The strong is not the one who overcomes people; the strong is the one who controls himself when angry.',
    source: 'Sahih al-Bukhari 6114',
    tags: ['character'],
  },
  {
    arabic: 'يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا',
    english: 'Make things easy and do not make them difficult; give glad tidings and do not drive people away.',
    source: 'Sahih al-Bukhari 69',
    tags: ['character', 'community'],
  },
  {
    arabic: 'إِنَّ اللَّهَ رَفِيقٌ يُحِبُّ الرِّفْقَ فِي الْأَمْرِ كُلِّهِ',
    english: 'Allah is Gentle and loves gentleness in all matters.',
    source: 'Sahih al-Bukhari 6927',
    tags: ['character', 'general'],
  },
  {
    arabic: 'مَنْ لَا يَرْحَمْ لَا يُرْحَمْ',
    english: 'Whoever does not show mercy will not be shown mercy.',
    source: 'Sahih al-Bukhari 6013',
    tags: ['character', 'community'],
  },
  {
    arabic: 'أَكْمَلُ الْمُؤْمِنِينَ إِيمَانًا أَحْسَنُهُمْ خُلُقًا',
    english: 'The most complete of the believers in faith are the best of them in character.',
    source: 'Sunan al-Tirmidhi 1162',
    tags: ['character'],
  },
  {
    arabic: 'مَا كَانَ الرِّفْقُ فِي شَيْءٍ إِلَّا زَانَهُ',
    english: 'Kindness is never present in a thing but that it beautifies it.',
    source: 'Sahih Muslim 2594',
    tags: ['character'],
  },
  {
    arabic: 'رَكْعَتَا الْفَجْرِ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا',
    english: 'The two rak’ahs of Fajr are better than the world and all it contains.',
    source: 'Sahih Muslim 725',
    tags: ['fajr', 'prayer'],
  },
  {
    arabic: 'أَوَّلُ مَا يُحَاسَبُ بِهِ الْعَبْدُ يَوْمَ الْقِيَامَةِ الصَّلَاةُ',
    english: 'The first thing the servant will be asked about on the Day of Judgment is the prayer.',
    source: 'Sunan al-Tirmidhi 413',
    tags: ['prayer'],
  },
  {
    arabic: 'وَجُعِلَتْ قُرَّةُ عَيْنِي فِي الصَّلَاةِ',
    english: 'And the coolness of my eyes was placed in prayer.',
    source: 'Sunan an-Nasa’i 3940',
    tags: ['prayer'],
  },
  {
    arabic: 'الصَّلَوَاتُ الْخَمْسُ كَفَّارَةٌ لِمَا بَيْنَهُنَّ',
    english: 'The five daily prayers are expiation for what is between them.',
    source: 'Sahih Muslim 233',
    tags: ['prayer'],
  },
  {
    arabic: 'أَقْرَبُ مَا يَكُونُ الْعَبْدُ مِنْ رَبِّهِ وَهُوَ سَاجِدٌ',
    english: 'The closest a servant is to his Lord is while he is in prostration.',
    source: 'Sahih Muslim 482',
    tags: ['prayer'],
  },
  {
    arabic: 'خَيْرُ يَوْمٍ طَلَعَتْ عَلَيْهِ الشَّمْسُ يَوْمُ الْجُمُعَةِ',
    english: 'The best day on which the sun rises is Friday.',
    source: 'Sahih Muslim 854',
    tags: ['jumuah'],
  },
  {
    arabic: 'مَنْ قَرَأَ سُورَةَ الْكَهْفِ يَوْمَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ',
    english:
      'Whoever recites Surah al-Kahf on Friday, a light shines for him between the two Fridays.',
    source: 'Sunan al-Kubra (al-Bayhaqi) 5996',
    tags: ['jumuah'],
  },
  {
    arabic: 'إِذَا جَاءَ رَمَضَانُ فُتِّحَتْ أَبْوَابُ الْجَنَّةِ وَغُلِّقَتْ أَبْوَابُ النَّارِ وَصُفِّدَتِ الشَّيَاطِينُ',
    english:
      'When Ramadan begins, the gates of Paradise are opened, the gates of the Fire are closed, and the devils are chained.',
    source: 'Sahih al-Bukhari 1899',
    tags: ['ramadan'],
  },
  {
    arabic: 'الصِّيَامُ جُنَّةٌ',
    english: 'Fasting is a shield.',
    source: 'Sahih al-Bukhari 1904',
    tags: ['ramadan'],
  },
  {
    arabic: 'مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ',
    english:
      'Whoever fasts Ramadan out of faith and in hope of reward, his previous sins are forgiven.',
    source: 'Sahih al-Bukhari 38',
    tags: ['ramadan'],
  },
  {
    arabic: 'مَنْ بَنَى لِلَّهِ مَسْجِدًا بَنَى اللَّهُ لَهُ بَيْتًا فِي الْجَنَّةِ',
    english: 'Whoever builds a mosque for Allah, Allah builds for him a house in Paradise.',
    source: 'Sahih al-Bukhari 450',
    tags: ['community'],
  },
];

/** Day of year (1–366) in the date's local time. */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/**
 * Deterministic hadith of the day. When `tags` are given and at least one
 * entry matches, the pick is seeded within that occasion pool (Jumu'ah
 * hadith on Friday, Fajr virtues at Fajr); otherwise the whole collection
 * rotates by day of year.
 */
export function getHadithOfTheDay(date: Date, tags: HadithTag[] = []): HadithEntry {
  const pool =
    tags.length > 0
      ? HADITH_COLLECTION.filter((h) => h.tags.some((t) => tags.includes(t)))
      : HADITH_COLLECTION;
  const effective = pool.length > 0 ? pool : HADITH_COLLECTION;
  return effective[dayOfYear(date) % effective.length]!;
}
