// 属性类型
export const TYPES = {
  NORMAL: 'normal',
  FIRE: 'fire',
  WATER: 'water',
  ELECTRIC: 'electric',
  GRASS: 'grass',
  ICE: 'ice',
  FIGHTING: 'fighting',
  POISON: 'poison',
  GROUND: 'ground',
  FLYING: 'flying',
  PSYCHIC: 'psychic',
  BUG: 'bug',
  ROCK: 'rock',
  GHOST: 'ghost',
  DRAGON: 'dragon',
  DARK: 'dark',
  STEEL: 'steel',
  FAIRY: 'fairy',
};

// 宝可梦基础数据
export class Pokemon {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.types = data.types || [];
    this.stats = {
      hp: data.stats?.hp || 0,
      attack: data.stats?.attack || 0,
      defense: data.stats?.defense || 0,
      specialAttack: data.stats?.specialAttack || 0,
      specialDefense: data.stats?.specialDefense || 0,
      speed: data.stats?.speed || 0,
    };
    this.moves = data.moves || [];
    this.sprites = data.sprites || {};
    this.ascii = data.ascii || null;
  }
}

// 技能
export class Move {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.power = data.power || 0;
    this.accuracy = data.accuracy || 100;
    this.pp = data.pp || 20;
    this.maxPp = data.maxPp || data.pp || 20;
    this.category = data.category || 'physical'; // physical, special, status
  }
}

// 物品
export class Item {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description || '';
    this.type = data.type || 'general'; // pokeball, medicine, key
    this.price = data.price || 0;
  }
}

// 玩家
export class Player {
  constructor() {
    this.name = 'Player';
    this.money = 1000;
    this.team = [];
    this.pc = [];
    this.bag = [];
    this.pokedex = {};
    this.currentCity = 'start';
  }
}
