/**
 * UploadScreen — pick CSV/image, choose program, run audit (or queue offline).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';

import { useTheme } from '@/contexts/ThemeContext';
import {
  AuditResult,
  OcrPreview,
  Program,
  auditFromCSV,
  auditFromImage,
  extractApiError,
  fetchPrograms,
  ocrPreview,
} from '@/lib/api';
import { saveToOfflineQueue } from '@/lib/offline';
import OfflineBanner, { useIsOnline } from '@/components/OfflineBanner';
import { RootStackParamList } from '@/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface SelectedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  inputType: 'csv' | 'image';
}

function inferMimeFromName(name: string, fallback = 'application/octet-stream'): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'csv':
      return 'text/csv';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'pdf':
      return 'application/pdf';
    default:
      return fallback;
  }
}

export default function UploadScreen(): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const online = useIsOnline();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState<boolean>(true);
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [waivedCourses, setWaivedCourses] = useState<string>('');

  const [file, setFile] = useState<SelectedFile | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<OcrPreview | null>(null);
  const [ocrModalOpen, setOcrModalOpen] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const progs = await fetchPrograms();
        if (!mounted) return;
        setPrograms(progs);
        if (progs.length > 0 && !selectedProgram) setSelectedProgram(progs[0].name);
      } catch (err) {
        if (!mounted) return;
        setError(extractApiError(err, 'Could not load programs'));
      } finally {
        if (mounted) setProgramsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickCSV(): Promise<void> {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setFile({
      uri: asset.uri,
      name: asset.name ?? 'transcript.csv',
      type: 'text/csv',
      size: asset.size ?? undefined,
      inputType: 'csv',
    });
  }

  async function pickImage(): Promise<void> {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow access to your photos to upload a transcript image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const name = asset.fileName ?? `transcript_${Date.now()}.jpg`;
    setFile({
      uri: asset.uri,
      name,
      type: asset.mimeType ?? inferMimeFromName(name, 'image/jpeg'),
      size: asset.fileSize ?? undefined,
      inputType: 'image',
    });
  }

  async function takePhoto(): Promise<void> {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow camera access to scan a transcript.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setFile({
      uri: asset.uri,
      name: `transcript_scan_${Date.now()}.jpg`,
      type: 'image/jpeg',
      size: asset.fileSize ?? undefined,
      inputType: 'image',
    });
  }

  async function handleOcrPreview(): Promise<void> {
    if (!file || file.inputType !== 'image') return;
    setOcrLoading(true);
    setError(null);
    try {
      const preview = await ocrPreview({
        uri: file.uri,
        name: file.name,
        type: file.type,
      });
      setOcrResult(preview);
      setOcrModalOpen(true);
    } catch (err) {
      setError(extractApiError(err, 'OCR preview failed'));
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleQueueOffline(): Promise<void> {
    if (!file || !selectedProgram) return;
    const id = await Crypto.randomUUID();
    await saveToOfflineQueue({
      id,
      fileUri: file.uri,
      fileName: file.name,
      fileType: file.type,
      programName: selectedProgram,
      waivedCourses: waivedCourses.trim() || undefined,
      inputType: file.inputType,
      createdAt: new Date().toISOString(),
    });
    Alert.alert(
      'Saved offline',
      'This audit was queued and will run automatically when you reconnect.',
      [{ text: 'OK', onPress: () => setFile(null) }],
    );
  }

  async function runAudit(): Promise<void> {
    if (!file || !selectedProgram) {
      setError('Pick a file and a program first.');
      return;
    }
    if (!online) {
      Alert.alert(
        'You are offline',
        'Save this upload to the offline queue and run it later?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save offline', onPress: handleQueueOffline },
        ],
      );
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const filePart = { uri: file.uri, name: file.name, type: file.type };
      const waived = waivedCourses.trim() || undefined;
      const result: AuditResult =
        file.inputType === 'csv'
          ? await auditFromCSV(filePart, selectedProgram, waived)
          : await auditFromImage(filePart, selectedProgram, waived);
      navigation.navigate('Result', { result });
      setFile(null);
    } catch (err) {
      setError(extractApiError(err, 'Audit failed'));
    } finally {
      setUploading(false);
    }
  }

  const fileSizeKb = useMemo(
    () => (file?.size ? `${(file.size / 1024).toFixed(1)} KB` : null),
    [file],
  );

  const canSubmit = file !== null && selectedProgram !== '' && !uploading;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: colors.text }]}>Run Audit</Text>
        <Text style={[styles.subheading, { color: colors.textMuted }]}>
          Pick a transcript and choose your degree program.
        </Text>

        <Section label="Degree program" colors={colors}>
          {programsLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : programs.length === 0 ? (
            <Text style={{ color: colors.textMuted }}>No programs available.</Text>
          ) : (
            <View style={styles.programList}>
              {programs.map((p) => {
                const active = selectedProgram === p.name;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setSelectedProgram(p.name)}
                    style={[
                      styles.programItem,
                      {
                        backgroundColor: active ? colors.accentMuted : colors.card,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={active ? colors.accent : colors.textMuted}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.programText,
                          { color: active ? colors.accent : colors.text },
                        ]}
                      >
                        {p.name}
                      </Text>
                      <Text style={[styles.programCredits, { color: colors.textMuted }]}>
                        {p.total_required_credits} credits required
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Section>

        <Section label="Waived courses (optional)" colors={colors}>
          <TextInput
            value={waivedCourses}
            onChangeText={setWaivedCourses}
            placeholder="CSE115, MAT120, ..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Comma-separated course codes that should be considered already met.
          </Text>
        </Section>

        <Section label="Transcript file" colors={colors}>
          <View style={styles.uploadGrid}>
            <UploadTile
              icon="document-text-outline"
              label="Pick CSV"
              colors={colors}
              onPress={pickCSV}
            />
            <UploadTile
              icon="image-outline"
              label="Pick Image"
              colors={colors}
              onPress={pickImage}
            />
            <UploadTile
              icon="camera-outline"
              label="Take Photo"
              colors={colors}
              onPress={takePhoto}
            />
          </View>

          {file ? (
            <View
              style={[
                styles.fileCard,
                { backgroundColor: colors.card, borderColor: colors.accent },
              ]}
            >
              <Ionicons
                name={file.inputType === 'csv' ? 'document-text' : 'image'}
                size={22}
                color={colors.accent}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={[styles.fileMeta, { color: colors.textMuted }]}>
                  {file.type}
                  {fileSizeKb ? ` • ${fileSizeKb}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setFile(null)} hitSlop={10}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : null}

          {file?.inputType === 'image' ? (
            <TouchableOpacity
              onPress={handleOcrPreview}
              disabled={ocrLoading}
              style={[
                styles.ocrBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: ocrLoading ? 0.6 : 1,
                },
              ]}
            >
              {ocrLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={18} color={colors.accent} />
                  <Text style={[styles.ocrBtnText, { color: colors.accent }]}>
                    OCR preview
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </Section>

        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: `${colors.error}22`,
                borderColor: colors.error,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={runAudit}
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            { backgroundColor: colors.accent, opacity: canSubmit ? 1 : 0.45 },
          ]}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Run audit</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* OCR preview modal */}
      <Modal
        visible={ocrModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setOcrModalOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setOcrModalOpen(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => undefined}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>OCR preview</Text>
              <TouchableOpacity onPress={() => setOcrModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {ocrResult ? (
              <ScrollView style={{ maxHeight: 480 }}>
                <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
                  Confidence: {(ocrResult.confidence * 100).toFixed(0)}% • {ocrResult.entry_count} entries
                </Text>
                <Text style={[styles.ocrText, { color: colors.text, borderColor: colors.border }]}>
                  {ocrResult.raw_text || '(no text recognised)'}
                </Text>
                {ocrResult.parsed_entries.length > 0 ? (
                  <>
                    <Text style={[styles.modalLabel, { color: colors.textMuted, marginTop: 14 }]}>
                      Parsed entries
                    </Text>
                    {ocrResult.parsed_entries.slice(0, 30).map((entry, idx) => (
                      <View
                        key={idx}
                        style={[styles.entryRow, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.entryText, { color: colors.text }]}>
                          {JSON.stringify(entry)}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : null}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Section({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

function UploadTile({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}): React.ReactElement {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.uploadTile,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={26} color={colors.accent} />
      <Text style={[styles.uploadTileText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13, marginTop: 4 },
  section: { marginTop: 22 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  programList: { gap: 8 },
  programItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  programText: {
    fontSize: 14,
    fontWeight: '600',
  },
  programCredits: {
    fontSize: 11,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: {
    fontSize: 11,
    marginTop: 6,
  },
  uploadGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  uploadTile: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  uploadTileText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
  },
  fileMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  ocrBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  ocrBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  submitBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ocrText: {
    fontSize: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  entryRow: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
