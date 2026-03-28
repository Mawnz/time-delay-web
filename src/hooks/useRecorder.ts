import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera } from 'react-native-vision-camera';
import { recorderEngine } from '../engines/RecorderEngine';
import { Database } from '../storage/db';

export const useRecorder = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingTransition, setIsRecordingTransition] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null) as React.RefObject<Camera>;

  const checkPermissions = useCallback(async () => {
    const cameraStatus = Camera.getCameraPermissionStatus();
    const micStatus = Camera.getMicrophonePermissionStatus();
    
    if (cameraStatus === 'granted' && micStatus === 'granted') {
      setHasPermission(true);
    } else {
      const status = await Camera.requestCameraPermission();
      const micStatusReq = await Camera.requestMicrophonePermission();
      setHasPermission(status === 'granted' && micStatusReq === 'granted');
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  useEffect(() => {
    if (cameraRef.current) {
      recorderEngine.setCameraRef(cameraRef);
    }
  }, [cameraRef.current]);

  const startRecording = useCallback(async (delay: number) => {
    if (isRecordingTransition || isRecording) return;
    setIsRecordingTransition(true);
    try {
      const newSessionId = Date.now().toString();
      await Database.createSession(newSessionId, `Session ${new Date().toLocaleTimeString()}`);
      await recorderEngine.start({ sessionId: newSessionId, segmentDurationMs: 5000 });
      setSessionId(newSessionId);
      setIsRecording(true);
      return newSessionId;
    } catch (e) {
      console.error('Failed to start recording:', e);
    } finally {
      setIsRecordingTransition(false);
    }
  }, [isRecording, isRecordingTransition]);

  const stopRecording = useCallback(async () => {
    if (isRecordingTransition || !isRecording) return;
    setIsRecordingTransition(true);
    try {
      await recorderEngine.stop();
      setIsRecording(false);
    } catch (e) {
      console.error('Failed to stop recording:', e);
      setIsRecording(false); // Force reset on error
    } finally {
      setIsRecordingTransition(false);
    }
  }, [isRecording, isRecordingTransition]);

  return {
    hasPermission,
    isRecording,
    isRecordingTransition,
    sessionId,
    cameraRef,
    startRecording,
    stopRecording,
    checkPermissions
  };
};
