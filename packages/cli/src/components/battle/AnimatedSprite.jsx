// packages/cli/src/components/battle/AnimatedSprite.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import PokemonSprite from '../PokemonSprite.jsx';

const AnimatedSprite = ({
  pokemonId,
  pokemonType = 'normal',
  width = 20,
  height = 10,
  variant = 'front',
  showBorder = true,
  label,
  animation = null,
  effects = []
}) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [flash, setFlash] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!animation) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    // 使用 setInterval 替代 requestAnimationFrame（兼容 CLI 环境）
    intervalRef.current = setInterval(() => {
      const { engine, id } = animation;
      if (!engine || !id) {
        clearInterval(intervalRef.current);
        return;
      }

      if (engine.isComplete(id)) {
        setOffset({ x: 0, y: 0 });
        setFlash(false);
        clearInterval(intervalRef.current);
        return;
      }

      // 更新动画 (33ms = 30fps)
      engine.update(id, 33);

      // 获取当前状态
      const newOffset = engine.getOffset(id);
      const newEffects = engine.getEffects(id);

      setOffset(newOffset);
      setFlash(newEffects.includes('flash'));
    }, 33);

    // 清理函数：组件卸载或 animation 变化时清除 interval
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Clean up animation if still active
      if (animation?.engine && animation?.id) {
        animation.engine.remove(animation.id);
      }
    };
  }, [animation]);

  return (
    <Box
      position="relative"
      flexDirection="column"
      minWidth={width}
      minHeight={height}
    >
      <Box
        position="absolute"
        top={Math.round(offset.y)}
        left={Math.round(offset.x)}
      >
        <PokemonSprite
          pokemonId={pokemonId}
          pokemonType={pokemonType}
          width={width}
          height={height}
          variant={variant}
          showBorder={showBorder}
          label={label}
          dim={flash}
        />
      </Box>
    </Box>
  );
};

export default AnimatedSprite;
