import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { DrawingPath } from '../types';

const { width, height } = Dimensions.get('window');

interface AnnotationOverlayProps {
  paths: DrawingPath[];
  onPathsChange: (paths: DrawingPath[]) => void;
  enabled: boolean;
  color: string;
  strokeWidth: number;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  paths,
  onPathsChange,
  enabled,
  color,
  strokeWidth,
}) => {
  const [currentPath, setCurrentPath] = useState<DrawingPath | null>(null);

  const handleTouchStart = (e: any) => {
    if (!enabled) return;
    const { locationX, locationY } = e.nativeEvent;
    const newPath: DrawingPath = {
      points: [{ x: locationX, y: locationY, type: 'start' }],
      color: color,
      width: strokeWidth,
    };
    setCurrentPath(newPath);
  };

  const handleTouchMove = (e: any) => {
    if (!enabled || !currentPath) return;
    const { locationX, locationY } = e.nativeEvent;
    const updatedPath = {
      ...currentPath,
      points: [...currentPath.points, { x: locationX, y: locationY, type: 'draw' }],
    };
    setCurrentPath(updatedPath);
  };

  const handleTouchEnd = () => {
    if (!enabled || !currentPath) return;
    onPathsChange([...paths, currentPath]);
    setCurrentPath(null);
  };

  const renderPath = React.useCallback((path: DrawingPath, index: number) => {
    // ⚡ BOLT OPTIMIZATION: Replaced map().join() with a fast string builder loop.
    // This executes at 60Hz during active drawing for currentPath. Array allocation
    // overhead via map() caused GC pauses and micro-stutters during fast strokes.
    let d = '';
    for (let i = 0; i < path.points.length; i++) {
      const p = path.points[i];
      d += (p.type === 'start' ? 'M' : 'L') + p.x + ',' + p.y + ' ';
    }

    return (
      <Path
        key={index}
        d={d}
        stroke={path.color}
        strokeWidth={path.width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }, []);

  // ⚡ BOLT OPTIMIZATION: Memoize static paths rendering.
  // AnnotationOverlay re-renders ~10x/sec when currentTime updates from App.tsx.
  // We avoid rebuilding the entire SVG path tree for static annotations every frame.
  const renderedStaticPaths = useMemo(() => {
    return paths.map((p, _i) => renderPath(p, _i));
  }, [paths, renderPath]);

  return (
    <View 
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => enabled}
      onResponderGrant={handleTouchStart}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
    >
      <Svg style={StyleSheet.absoluteFill}>
        {renderedStaticPaths}
        {currentPath && renderPath(currentPath, 9999)}
      </Svg>
    </View>
  );
};
