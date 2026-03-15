import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera } from 'react-native-vision-camera';
import { recorderEngine } from '../engines/RecorderEngine';
import { Database } from '../storage/db';

export const useRecorder = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);

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
    const newSessionId = Date.now().toString();
    setSessionId(newSessionId);
    
    await Database.createSession(newSessionId, `Session ${new Date().toLocaleTimeString()}`);
    await recorderEngine.start({ sessionId: newSessionId, segmentDurationMs: 5000 });
    
    setIsRecording(true);
    return newSessionId;
  }, []);

  const stopRecording = useCallback(async () => {
    await recorderEngine.stop();
    setIsRecording(false);
  }, []);

  return {
    hasPermission,
    isRecording,
    sessionId,
    cameraRef,
    startRecording,
    stopRecording,
    checkPermissions
  };
};
