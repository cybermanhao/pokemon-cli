/**
 * @typedef {Object} SpeciesData
 * @property {string} name
 * @property {number} num
 * @property {string} [inherit]
 * @property {Object} [baseStats] - { hp, atk, def, spa, spd, spe }
 * @property {string[]} [types]
 * @property {string[]} [abilities]
 * @property {string[]} [hiddenAbilities]
 * @property {Object} [evos]
 * @property {Object} [prevo]
 */

/**
 * @typedef {Object} MoveData
 * @property {string} name
 * @property {number} num
 * @property {string} type
 * @property {string} category - 'Physical', 'Special', 'Status'
 * @property {number} [pp]
 * @property {number} [power]
 * @property {number} [accuracy]
 * @property {number} [priority]
 * @property {Object} [target]
 * @property {string} [desc]
 */

/**
 * @typedef {Object} ItemData
 * @property {string} name
 * @property {number} num
 * @property {string} [desc]
 * @property {string} [spritenum]
 * @property {Function} [onModifySpA]
 * @property {Function} [onModifySpD]
 * @property {Function} [onAfterUse]
 * @property {Function} [onHit]
 * @property {Function} [onAfterHit]
 * @property {Function} [onTryHit]
 * @property {Function} [onSwitchIn]
 * @property {Function} [onStart]
 * @property {Function} [onResidual]
 * @property {Function} [onAfterMoveSecondarySelf]
 * @property {Function} [onHitField]
 * @property {Function} [onAfterBoost]
 * @property {Function} [onTryBoosts]
 * @property {Function} [onTryMove]
 * @property {Function} [onBasePower]
 * @property {Function} [onDamage]
 * @property {Function} [onTryUseItem]
 * @property {Function} [onUseItem]
 */

/**
 * @typedef {'dex' | 'items' | 'moves' | 'sprites' | 'learnset' | 'map'} EditorTab
 */

/**
 * @typedef {Object} ModData
 * @property {Object.<string, SpeciesData>} species
 * @property {Object.<string, MoveData>} moves
 * @property {string} items_raw
 */

/**
 * @typedef {'native' | 'jimp' | 'chafa' | 'jp2a'} AsciiEngine
 */

/**
 * @typedef {Object} AsciiConfig
 * @property {AsciiEngine} engine
 * @property {number} width
 * @property {string} charset - 'simple', 'blocks', 'braille', 'shades'
 * @property {boolean} colored
 * @property {boolean} invert
 * @property {number} contrast
 */

export {};
