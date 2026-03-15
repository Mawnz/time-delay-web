import React, { memo } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#007AFF',
  secondary: '#FF3B30',
  background: '#000000',
  surface: 'rgba(28, 28, 30, 0.85)',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  border: 'rgba(255, 255, 255, 0.15)',
};

// --- Top HUD ---
interface TopHudProps {
  onOpenSessions: () => void;
  delay: number;
  onSetDelay: (d: number) => void;
  onSync: () => void;
  followPlayhead: boolean;
  onToggleFollow: () => void;
  cameraPosition: string;
  onToggleCamera: () => void;
}

export const TopHud = memo((props: TopHudProps) => (
  <View style={styles.topHud}>
    <TouchableOpacity style={styles.glassButton} onPress={props.onOpenSessions}>
      <Text style={styles.hudText}>SESSIONS</Text>
    </TouchableOpacity>
    
    <View style={styles.hudGroup}>
        <TouchableOpacity style={styles.hudControl} onPress={() => props.onSetDelay(Math.max(1, props.delay - 1))}>
            <Text style={styles.hudControlText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.hudValue}>{props.delay}s</Text>
        <TouchableOpacity style={styles.hudControl} onPress={() => props.onSetDelay(Math.min(60, props.delay + 1))}>
            <Text style={styles.hudControlText}>+</Text>
        </TouchableOpacity>
    </View>

    <TouchableOpacity style={[styles.glassButton, { backgroundColor: COLORS.primary }]} onPress={props.onSync}>
      <Text style={styles.hudText}>SYNC</Text>
    </TouchableOpacity>

    <TouchableOpacity style={[styles.glassButton, props.followPlayhead && styles.activeGlassButton]} onPress={props.onToggleFollow}>
      <Text style={styles.hudText}>{props.followPlayhead ? 'FOLLOWING' : 'FOLLOW'}</Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.glassButton} onPress={props.onToggleCamera}>
      <Text style={styles.hudText}>{props.cameraPosition.toUpperCase()}</Text>
    </TouchableOpacity>
  </View>
));

// --- Control Bar ---
interface ControlBarProps {
  loopEnabled: boolean;
  onToggleLoop: () => void;
  onClearPoints: () => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  playbackRate: number;
  onToggleSlowMo: () => void;
  isPaused: boolean;
  onTogglePlayback: () => void;
}

export const ControlBar = memo((props: ControlBarProps) => (
  <View style={styles.controls}>
    <View style={styles.mainButtonRow}>
      <TouchableOpacity style={[styles.roundButton, props.loopEnabled && styles.activeRoundButton]} onPress={props.onToggleLoop}>
        <Text style={styles.buttonLabel}>LOOP</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.roundButton} onPress={props.onClearPoints}>
        <Text style={styles.buttonLabel}>CLEAR</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.recordOuter, props.isRecording && styles.recordOuterActive]}
        onPress={props.onToggleRecording}
      >
          <View style={[styles.recordInner, props.isRecording && styles.recordInnerActive]} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.roundButton} onPress={props.onToggleSlowMo}>
        <Text style={styles.buttonLabel}>{props.playbackRate === 1.0 ? '1.0x' : '0.5x'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.roundButton} onPress={props.onTogglePlayback}>
        <Text style={styles.buttonLabel}>{props.isPaused ? 'PLAY' : 'PAUSE'}</Text>
      </TouchableOpacity>
    </View>
  </View>
));

// --- Zoom Controls ---
interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const ZoomControls = memo((props: ZoomControlsProps) => (
  <View style={styles.zoomHud}>
      <TouchableOpacity style={styles.zoomButton} onPress={props.onZoomIn}>
          <Text style={styles.zoomText}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.zoomButton} onPress={props.onZoomOut}>
          <Text style={styles.zoomText}>-</Text>
      </TouchableOpacity>
  </View>
));

const styles = StyleSheet.create({
  topHud: { position: 'absolute', top: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, zIndex: 100 },
  glassButton: { backgroundColor: COLORS.surface, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, minWidth: 60, alignItems: 'center' },
  activeGlassButton: { backgroundColor: COLORS.primary, borderColor: 'white' },
  hudGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 8, paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.border },
  hudControl: { padding: 8 },
  hudControlText: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  hudValue: { color: COLORS.text, fontWeight: 'bold', fontSize: 12, marginHorizontal: 4 },
  hudText: { color: COLORS.text, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  zoomHud: { position: 'absolute', right: 15, bottom: 240, backgroundColor: COLORS.surface, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, zIndex: 100 },
  zoomButton: { padding: 12, alignItems: 'center' },
  zoomText: { color: 'white', fontSize: 20, fontWeight: '300' },
  controls: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  mainButtonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '90%' },
  roundButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  activeRoundButton: { backgroundColor: COLORS.primary, borderColor: 'white' },
  buttonLabel: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  recordOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: 'white', justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  recordOuterActive: { borderColor: COLORS.secondary },
  recordInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white' },
  recordInnerActive: { backgroundColor: COLORS.secondary, borderRadius: 8, width: 30, height: 30 },
});
