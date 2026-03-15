import React, { useState } from 'react';
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

  const renderPath = (path: DrawingPath, index: number) => {
    const d = path.points
      .map((p, i) => `${p.type === 'start' ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');

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
  };

  return (
    <View 
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => enabled}
      onResponderGrant={handleTouchStart}
      onResponderMove={handleTouchMove}
      onResponderRelease={handleTouchEnd}
    >
      <Svg style={StyleSheet.absoluteFill}>
        {paths.map((p, i) => renderPath(p, i))}
        {currentPath && renderPath(currentPath, 9999)}
      </Svg>
    </View>
  );
};
