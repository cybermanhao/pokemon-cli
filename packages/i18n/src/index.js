// i18n package - Priority: 中文 → English → 日本語

const translations = {
  zh: {
    title: '宝可梦 CLI',
    newGame: '新游戏',
    continueGame: '继续',
    quit: '退出',
    selectStarter: '选择你的初始宝可梦',
    confirmStarter: '确认',
    back: '返回',
    types: {
      normal: '普通', fire: '火', water: '水', grass: '草', electric: '电',
      ice: '冰', fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行',
      psychic: '超能', bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙',
      dark: '恶', steel: '钢', fairy: '妖精',
    },
    menu: {
      explore: '探索',
      team: '队伍',
      bag: '背包',
      pokedex: '图鉴',
      save: '存档',
      quit: '退出',
    },
  },
  en: {
    title: 'Pokemon CLI',
    newGame: 'New Game',
    continueGame: 'Continue',
    quit: 'Quit',
    selectStarter: 'Choose your starter Pokemon',
    confirmStarter: 'Confirm',
    back: 'Back',
    types: {
      normal: 'Normal', fire: 'Fire', water: 'Water', grass: 'Grass', electric: 'Electric',
      ice: 'Ice', fighting: 'Fighting', poison: 'Poison', ground: 'Ground', flying: 'Flying',
      psychic: 'Psychic', bug: 'Bug', rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon',
      dark: 'Dark', steel: 'Steel', fairy: 'Fairy',
    },
    menu: {
      explore: 'Explore',
      team: 'Team',
      bag: 'Bag',
      pokedex: 'Pokedex',
      save: 'Save',
      quit: 'Quit',
    },
  },
};

let currentLanguage = 'zh';

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
  }
}

export function t(key) {
  const lang = translations[currentLanguage] || translations.en;
  const keys = key.split('.');
  let value = lang;
  for (const k of keys) {
    value = value?.[k];
  }
  return value || key;
}
