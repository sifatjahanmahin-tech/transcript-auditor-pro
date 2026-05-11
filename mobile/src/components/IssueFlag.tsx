/**
 * IssueFlag — small flag button used on each course row.
 *
 * Tapping opens an Alert.prompt-style modal letting the user pick a
 * colour (red / yellow / green) and write an optional note.  The
 * annotation is persisted via offline.saveAnnotation.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import {
  Annotation,
  FlagColor,
  deleteAnnotation,
  getAnnotationFor,
  saveAnnotation,
} from '@/lib/offline';

interface IssueFlagProps {
  auditId: string;
  courseCode: string;
  size?: number;
}

export default function IssueFlag({
  auditId,
  courseCode,
  size = 18,
}: IssueFlagProps): JSX.Element {
  const { colors } = useTheme();
  const [open, setOpen] = useState<boolean>(false);
  const [annotation, setAnnotation] = useState<Annotation | null>(null);
  const [note, setNote] = useState<string>('');
  const [picked, setPicked] = useState<FlagColor>('yellow');

  useEffect(() => {
    let mounted = true;
    void getAnnotationFor(auditId, courseCode).then((a) => {
      if (!mounted) return;
      setAnnotation(a);
      if (a) {
        setNote(a.note);
        setPicked(a.flagColor);
      }
    });
    return () => {
      mounted = false;
    };
  }, [auditId, courseCode]);

  const flagColorMap: Record<FlagColor, string> = {
    red: colors.error,
    yellow: colors.warning,
    green: colors.success,
  };

  async function handleSave(): Promise<void> {
    await saveAnnotation(auditId, courseCode, note.trim(), picked);
    setAnnotation({
      auditId,
      courseCode,
      note: note.trim(),
      flagColor: picked,
      createdAt: new Date().toISOString(),
    });
    setOpen(false);
  }

  async function handleClear(): Promise<void> {
    await deleteAnnotation(auditId, courseCode);
    setAnnotation(null);
    setNote('');
    setPicked('yellow');
    setOpen(false);
  }

  const filled = annotation !== null;
  const tint = filled ? flagColorMap[annotation.flagColor] : colors.textMuted;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Flag course ${courseCode}`}
      >
        <Ionicons name={filled ? 'flag' : 'flag-outline'} size={size} color={tint} />
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => undefined}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              Flag {courseCode}
            </Text>

            <Text style={[styles.label, { color: colors.textMuted }]}>Severity</Text>
            <View style={styles.colorRow}>
              {(['red', 'yellow', 'green'] as FlagColor[]).map((c) => {
                const active = picked === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorChip,
                      {
                        backgroundColor: active ? flagColorMap[c] : 'transparent',
                        borderColor: flagColorMap[c],
                      },
                    ]}
                    onPress={() => setPicked(c)}
                  >
                    <Text
                      style={[
                        styles.colorText,
                        { color: active ? '#fff' : flagColorMap[c] },
                      ]}
                    >
                      {c.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>
              Note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note about this course"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                },
              ]}
            />

            <View style={styles.actionRow}>
              {filled ? (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.error }]}
                  onPress={handleClear}
                >
                  <Text style={styles.btnText}>Clear</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    { backgroundColor: colors.border },
                  ]}
                  onPress={() => setOpen(false)}
                >
                  <Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={handleSave}
              >
                <Text style={styles.btnText}>Save flag</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colorChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  colorText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 70,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
