import { useState, useEffect, useRef } from 'react';
import { getPokemonAscii, getFallbackSprite } from '../utils/ascii-sprite.js';

const SESSION_CACHE = new Map();

export function useAsciiSprite(pokemonId, opts = {}) {
  const { width = 32, height = 16, colored = true, variant = 'front' } = opts;
  const cacheKey = `${pokemonId}_${variant}_${width}x${height}_${colored}`;

  const [lines, setLines] = useState(() => {
    if (SESSION_CACHE.has(cacheKey)) return SESSION_CACHE.get(cacheKey);
    return getFallbackSprite(pokemonId);
  });
  const [loading, setLoading] = useState(!SESSION_CACHE.has(cacheKey));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (SESSION_CACHE.has(cacheKey)) return;
    setLoading(true);
    getPokemonAscii(pokemonId, { width, height, colored, variant })
      .then(result => {
        if (!mountedRef.current) return;
        SESSION_CACHE.set(cacheKey, result);
        setLines(result);
        setLoading(false);
      })
      .catch(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, [cacheKey]);

  return { lines, loading, error: null };
}

export function usePreloadSprites(pokemonIds, opts = {}) {
  useEffect(() => {
    const { width = 32, height = 16, colored = true } = opts;
    for (const id of pokemonIds) {
      const cacheKey = `${id}_front_${width}x${height}_${colored}`;
      if (!SESSION_CACHE.has(cacheKey)) {
        getPokemonAscii(id, { width, height, colored }).then(lines => SESSION_CACHE.set(cacheKey, lines)).catch(() => {});
      }
    }
  }, []);
}
