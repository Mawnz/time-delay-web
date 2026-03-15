import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal } from 'react-native';
import { Session } from '../types';
import { Database } from '../storage/db';

interface SessionManagerProps {
  visible: boolean;
  onClose: () => void;
  onSelectSession: (session: Session) => void;
}

export const SessionManager: React.FC<SessionManagerProps> = ({ visible, onClose, onSelectSession }) => {
  const [sessions, setSessions] = useState<Session[]>([]);

  const loadSessions = async () => {
    const data = await Database.getSessions();
    setSessions(data);
  };

  useEffect(() => {
    if (visible) loadSessions();
  }, [visible]);

  const handleDelete = async (id: string) => {
    await Database.deleteSession(id);
    loadSessions();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Recording Sessions</Text>
          
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.sessionItem}>
                <TouchableOpacity 
                  style={styles.sessionInfo} 
                  onPress={() => onSelectSession(item)}
                >
                  <Text style={styles.sessionName}>{item.name}</Text>
                  <Text style={styles.sessionDate}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.deleteButton} 
                  onPress={() => handleDelete(item.id)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No sessions found.</Text>}
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  content: { backgroundColor: '#222', borderRadius: 15, padding: 20, maxHeight: '80%' },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sessionItem: { 
    flexDirection: 'row', 
    backgroundColor: '#333', 
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 10,
    alignItems: 'center'
  },
  sessionInfo: { flex: 1 },
  sessionName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sessionDate: { color: '#aaa', fontSize: 12, marginTop: 4 },
  deleteButton: { backgroundColor: '#ff4444', padding: 8, borderRadius: 5, marginLeft: 10 },
  deleteText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#888', textAlign: 'center', marginVertical: 20 },
  closeButton: { marginTop: 20, backgroundColor: '#555', padding: 15, borderRadius: 10, alignItems: 'center' },
  closeText: { color: 'white', fontWeight: 'bold' },
});
