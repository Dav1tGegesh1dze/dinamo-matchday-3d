const KEY = 'dinamo-lang';

const strings = {
  ka: {
    title: 'დინამო: გზა გოლისკენ',
    namePlaceholder: 'სახელი / მეტსახელი',
    phonePlaceholder: 'მობილური ნომერი',
    emailPlaceholder: 'ელ-ფოსტა',
    errName: 'სახელი: 2–20 სიმბოლო',
    errPhone: 'მობილური: 9–15 ციფრი',
    errEmail: 'ელ-ფოსტა არასწორია',
    start: 'დაწყება',
    roomDressing: 'გასახდელი',
    roomPhysio: 'ფიზიო',
    roomShowers: 'საშხაპე',
    roomTunnel: 'გვირაბი',
    substitutedIn: 'შედიხარ თამაშში!',
    kitFirst: 'ჯერ მოემზადე!',
    stayOnBench: 'დარჩი სკამზე',
    tackled: 'წაგართვეს!',
    saved: 'მეკარემ დაიჭირა!',
    goal: 'გოოოლ!',
    yourTime: 'შენი დრო',
    outAt: 'თამაში დასრულდა',
    stage1: 'სკამზე დარჩი',
    stage2: 'პირველი მცველი',
    stage3: 'მეორე მცველი',
    stage4: 'მეკარე',
    leaderboard: 'საუკეთესო დროები',
    noScores: 'ჯერ არავის გაუტანია გოლი',
    confirmReset: 'წავშალოთ ყველა შედეგი?',
    retry: 'თავიდან',
    clickToStart: 'დააწკაპუნე დასაწყებად',
  },
  en: {
    title: 'Dinamo: Road to Goal',
    namePlaceholder: 'Name / nickname',
    phonePlaceholder: 'Mobile number',
    emailPlaceholder: 'E-mail',
    errName: 'Name: 2–20 characters',
    errPhone: 'Mobile: 9–15 digits',
    errEmail: 'E-mail looks wrong',
    start: 'Start',
    roomDressing: 'Dressing room',
    roomPhysio: 'Physio',
    roomShowers: 'Showers',
    roomTunnel: 'Tunnel',
    substitutedIn: 'You\'re on!',
    kitFirst: 'Get ready first!',
    stayOnBench: 'Stay on the bench',
    tackled: 'Tackled!',
    saved: 'Saved!',
    goal: 'GOAL!',
    yourTime: 'Your time',
    outAt: 'Game over',
    stage1: 'Stayed on the bench',
    stage2: 'Defender 1',
    stage3: 'Defender 2',
    stage4: 'Goalkeeper',
    leaderboard: 'Fastest goals',
    noScores: 'Nobody has scored yet',
    confirmReset: 'Delete all results?',
    retry: 'Play again',
    clickToStart: 'Click to start',
  },
};

let lang = localStorage.getItem(KEY) === 'en' ? 'en' : 'ka';

export function getLang() {
  return lang;
}

export function setLang(next) {
  lang = next;
  localStorage.setItem(KEY, lang);
}

export function t(key) {
  return strings[lang][key];
}
