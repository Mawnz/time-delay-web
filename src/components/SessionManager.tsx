import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert } from 'react-native';
import { Session } from '../types';
import { Database } from '../storage/db';

interface SessionManagerProps {
  visible: boolean;
  onClose: () => void;
  onSelectSession: (session: Session) => void;
  activeSessionId: string | null;
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  visible,
  onClose,
  onSelectSession,
  activeSessionId,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);

  const loadSessions = async () => {
    const data = await Database.getSessions();
    // Active (currently recording) session is excluded — can't delete a live session
    setSessions(data.filter(s => s.id !== activeSessionId));
  };

  useEffect(() => {
    if (visible) loadSessions();
  }, [visible, activeSessionId]);

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Session',
      `Delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await Database.deleteSession(id);
            loadSessions();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Sessions</Text>

          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.sessionItem}
                onPress={() => { onSelectSession(item); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionName}>{item.name}</Text>
                  <Text style={styles.sessionDate}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(item.id, item.name)}
                >
                  <Text style={styles.deleteText}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No completed sessions yet.</Text>
            }
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: 'rgba(28, 28, 30, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  sessionItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sessionInfo: { flex: 1 },
  sessionName: { color: 'white', fontSize: 15, fontWeight: '600' },
  sessionDate: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 3 },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,59,48,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.4)',
  },
  deleteText: { color: '#FF3B30', fontSize: 13, fontWeight: 'bold' },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginVertical: 30,
    fontSize: 14,
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  closeText: { color: 'white', fontWeight: '600', fontSize: 15 },
});
