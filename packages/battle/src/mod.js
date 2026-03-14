/**
 * 自定义 Mod 数据 — Pokemon CLI 的数据扩展入口
 *
 * 基于 @pkmn/dex 的 Mod 接口，所有修改在此集中定义。
 *
 * 使用 inherit: true 继承原有数据并只覆盖指定字段：
 *   Species: { 'Pikachu': { inherit: true, baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 120 } } }
 *
 * 添加全新精灵（num >= 10000 避开官方编号）：
 *   Species: { 'MyPokemon': { num: 10001, name: 'MyPokemon', types: ['Fire'], baseStats: { hp: 80, atk: 100, def: 70, spa: 90, spd: 70, spe: 95 }, abilities: { '0': 'Blaze' } } }
 *
 * 添加自定义技能：
 *   Moves: { 'CustomFlame': { num: 10001, name: 'Custom Flame', type: 'Fire', category: 'Special', basePower: 100, accuracy: 90, pp: 5 } }
 *
 * 添加带效果的道具：
 *   Items: { 'CustomItem': { num: 10001, name: 'Custom Item', desc: '...', onModifySpA: () => 1.2 } }
 */

export const MOD_ID = 'pokemon-cli';

export const MOD_DATA = {
  // 在这里添加自定义数据
};
