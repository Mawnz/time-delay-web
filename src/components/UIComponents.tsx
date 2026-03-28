/**
 * UIComponents.tsx — Phase 3 cleaned up
 *
 * Layout philosophy: the top bar has exactly TWO elements:
 *   Left  = StatusPill  (record toggle, shows transition states)
 *   Right = MenuButton  (⋯  opens SettingsMenu sheet)
 *
 * SettingsMenu houses everything that was previously overcrowding
 * the top row: delay, sync, follow, camera flip, focus lock, mute, sessions.
 *
 * ControlBar is trimmed back to the essential playback controls only.
 */

import React, { memo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  primary: '#007AFF',
  danger: '#FF3B30',
  amber: '#FF9F0A',
  bg: '#000000',
  surface: 'rgba(28, 28, 30, 0.88)',
  surfaceHigh: 'rgba(44, 44, 46, 0.95)',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.45)',
  border: 'rgba(255, 255, 255, 0.13)',
  borderBright: 'rgba(255,255,255,0.22)',
};

// ─── StatusPill ───────────────────────────────────────────────────────────────

interface StatusPillProps {
  isRecording: boolean;
  isTransition: boolean;
  onToggle: () => void;
}

export const StatusPill = memo(({ isRecording, isTransition, onToggle }: StatusPillProps) => {
  const label = isTransition
    ? isRecording ? 'STOPPING…' : 'STARTING…'
    : isRecording ? '● REC' : '○ READY';

  const bg = isRecording
    ? isTransition ? 'rgba(255,59,48,0.4)' : C.danger
    : C.surface;

  return (
    <TouchableOpacity
      style={[styles.statusPill, { backgroundColor: bg }]}
      onPress={onToggle}
      disabled={isTransition}
      activeOpacity={0.8}
    >
      <Text style={styles.statusPillText}>{label}</Text>
    </TouchableOpacity>
  );
});

// ─── MenuButton ───────────────────────────────────────────────────────────────

interface MenuButtonProps {
  onPress: () => void;
}

export const MenuButton = memo(({ onPress }: MenuButtonProps) => (
  <TouchableOpacity style={styles.menuButton} onPress={onPress} activeOpacity={0.8}>
    <Text style={styles.menuButtonText}>⋯</Text>
  </TouchableOpacity>
));

// ─── Settings Menu (bottom sheet modal) ──────────────────────────────────────

interface SettingsMenuProps {
  visible: boolean;
  onClose: () => void;
  // Delay
  delay: number;
  onSetDelay: (d: number) => void;
  // Sync / Follow
  onSync: () => void;
  followPlayhead: boolean;
  onToggleFollow: () => void;
  // Camera
  cameraPosition: string;
  onToggleCamera: () => void;
  // Focus / Mute
  isFocusLocked: boolean;
  onToggleFocusLock: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  // Sessions
  onOpenSessions: () => void;
}

export const SettingsMenu = memo((props: SettingsMenuProps) => (
  <Modal visible={props.visible} animationType="slide" transparent onRequestClose={props.onClose}>
    <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={props.onClose} />
    <View style={styles.menuSheet}>
      <View style={styles.menuHandle} />

      <Text style={styles.menuTitle}>Settings</Text>

      {/* Delay */}
      <View style={styles.menuRow}>
        <Text style={styles.menuRowLabel}>Delay</Text>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => props.onSetDelay(Math.max(1, props.delay - 1))}
          >
            <Text style={styles.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{props.delay}s</Text>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => props.onSetDelay(Math.min(60, props.delay + 1))}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sync */}
      <TouchableOpacity style={styles.menuRow} onPress={() => { props.onSync(); props.onClose(); }}>
        <Text style={styles.menuRowLabel}>Sync to Live</Text>
        <Text style={styles.menuRowAction}>SYNC →</Text>
      </TouchableOpacity>

      {/* Follow Playhead */}
      <View style={styles.menuRow}>
        <Text style={styles.menuRowLabel}>Follow Playhead</Text>
        <Switch
          value={props.followPlayhead}
          onValueChange={props.onToggleFollow}
          trackColor={{ false: C.border, true: C.primary }}
          thumbColor="white"
        />
      </View>

      {/* Camera */}
      <TouchableOpacity style={styles.menuRow} onPress={props.onToggleCamera}>
        <Text style={styles.menuRowLabel}>Camera</Text>
        <Text style={styles.menuRowAction}>{props.cameraPosition === 'back' ? 'REAR →' : 'FRONT →'}</Text>
      </TouchableOpacity>

      {/* Focus Lock */}
      <View style={styles.menuRow}>
        <Text style={styles.menuRowLabel}>Lock Focus & Exposure</Text>
        <Switch
          value={props.isFocusLocked}
          onValueChange={props.onToggleFocusLock}
          trackColor={{ false: C.border, true: C.amber }}
          thumbColor="white"
        />
      </View>

      {/* Mute */}
      <View style={styles.menuRow}>
        <Text style={styles.menuRowLabel}>Mute Audio</Text>
        <Switch
          value={props.isMuted}
          onValueChange={props.onToggleMute}
          trackColor={{ false: C.border, true: C.primary }}
          thumbColor="white"
        />
      </View>

      {/* Sessions */}
      <TouchableOpacity
        style={[styles.menuRow, styles.menuRowLast]}
        onPress={() => { props.onOpenSessions(); props.onClose(); }}
      >
        <Text style={styles.menuRowLabel}>Sessions</Text>
        <Text style={styles.menuRowAction}>VIEW →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuCloseBtn} onPress={props.onClose}>
        <Text style={styles.menuCloseBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  </Modal>
));

// ─── ControlBar ───────────────────────────────────────────────────────────────

interface ControlBarProps {
  loopEnabled: boolean;
  onToggleLoop: () => void;
  onClearPoints: () => void;
  isRecording: boolean;
  isTransition: boolean;
  onToggleRecording: () => void;
  playbackRate: number;
  onToggleSlowMo: () => void;
  isPaused: boolean;
  onTogglePlayback: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
}

export const ControlBar = memo((props: ControlBarProps) => (
  <View style={styles.controls}>
    <View style={styles.mainButtonRow}>
      {/* Loop */}
      <TouchableOpacity
        style={[styles.roundButton, props.loopEnabled && styles.activeRoundButton]}
        onPress={props.onToggleLoop}
      >
        <Text style={styles.btnLabel}>LOOP</Text>
      </TouchableOpacity>

      {/* Clear */}
      <TouchableOpacity style={styles.roundButton} onPress={props.onClearPoints}>
        <Text style={styles.btnLabel}>CLEAR</Text>
      </TouchableOpacity>

      {/* Step back */}
      <TouchableOpacity style={styles.stepButton} onPress={props.onStepBack}>
        <Text style={styles.stepIcon}>⏮</Text>
      </TouchableOpacity>

      {/* Record (large centre) */}
      <TouchableOpacity
        style={[styles.recordOuter, props.isRecording && styles.recordOuterActive]}
        onPress={props.onToggleRecording}
        disabled={props.isTransition}
      >
        <View style={[styles.recordInner, props.isRecording && styles.recordInnerActive]} />
      </TouchableOpacity>

      {/* Step forward */}
      <TouchableOpacity style={styles.stepButton} onPress={props.onStepForward}>
        <Text style={styles.stepIcon}>⏭</Text>
      </TouchableOpacity>

      {/* Speed */}
      <TouchableOpacity style={styles.roundButton} onPress={props.onToggleSlowMo}>
        <Text style={styles.btnLabel}>{props.playbackRate === 1.0 ? '1×' : '½×'}</Text>
      </TouchableOpacity>

      {/* Play/Pause */}
      <TouchableOpacity style={styles.roundButton} onPress={props.onTogglePlayback}>
        <Text style={styles.btnLabel}>{props.isPaused ? '▶' : '⏸'}</Text>
      </TouchableOpacity>
    </View>
  </View>
));

// ─── ZoomControls ─────────────────────────────────────────────────────────────

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const ZoomControls = memo(({ onZoomIn, onZoomOut }: ZoomControlsProps) => (
  <View style={styles.zoomHud}>
    <TouchableOpacity style={styles.zoomButton} onPress={onZoomIn}>
      <Text style={styles.zoomText}>+</Text>
    </TouchableOpacity>
    <View style={styles.zoomDivider} />
    <TouchableOpacity style={styles.zoomButton} onPress={onZoomOut}>
      <Text style={styles.zoomText}>−</Text>
    </TouchableOpacity>
  </View>
));

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // StatusPill
  statusPill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderBright,
    minWidth: 90,
    alignItems: 'center',
  },
  statusPillText: { color: C.text, fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  // MenuButton
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: { color: C.text, fontSize: 20, lineHeight: 22 },

  // SettingsMenu sheet
  menuBackdrop: { flex: 1 },
  menuSheet: {
    backgroundColor: 'rgba(22, 22, 24, 0.98)',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: C.border,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  menuTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuRowLabel: { color: C.text, fontSize: 15 },
  menuRowAction: { color: C.primary, fontSize: 13, fontWeight: '600' },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: { color: C.primary, fontSize: 18, fontWeight: '600' },
  stepperValue: { color: C.text, fontWeight: '700', fontSize: 14, minWidth: 36, textAlign: 'center' },

  menuCloseBtn: {
    marginTop: 20,
    backgroundColor: C.surface,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  menuCloseBtnText: { color: C.text, fontWeight: '600', fontSize: 15 },

  // ControlBar
  controls: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  mainButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '95%',
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  activeRoundButton: { backgroundColor: C.primary, borderColor: 'rgba(255,255,255,0.3)' },
  btnLabel: { color: C.text, fontSize: 10, fontWeight: '700' },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  stepIcon: { fontSize: 17, color: C.text },
  recordOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  recordOuterActive: { borderColor: C.danger },
  recordInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'white' },
  recordInnerActive: { backgroundColor: C.danger, borderRadius: 8, width: 26, height: 26 },

  // ZoomControls
  zoomHud: {
    position: 'absolute',
    right: 14,
    bottom: 240,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  zoomButton: { padding: 11, alignItems: 'center', width: 40 },
  zoomText: { color: C.text, fontSize: 20, fontWeight: '300' },
  zoomDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 6 },
});
