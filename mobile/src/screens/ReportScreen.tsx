/**
 * ReportScreen — render an audit as text/JSON, share or export to PDF.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '@/contexts/ThemeContext';
import { AuditResult } from '@/lib/api';
import { Annotation, getAnnotations } from '@/lib/offline';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { useAuth } from '@/contexts/AuthContext';

type ReportRoute = RouteProp<RootStackParamList, 'Report'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Format = 'markdown' | 'json';

function buildMarkdown(result: AuditResult, annotations: Annotation[], userName: string): string {
  const lines: string[] = [];
  lines.push(`# Audit Report — ${result.program_name}`);
  lines.push('');
  lines.push(`Generated: ${new Date(result.created_at).toLocaleString()}`);
  if (userName) lines.push(`Student: ${userName}`);
  lines.push(`Input type: ${result.input_type}`);
  if (result.original_filename) lines.push(`File: ${result.original_filename}`);
  lines.push('');

  lines.push('## Summary');
  lines.push(`- Total valid credits: ${result.total_valid_credits.toFixed(1)}`);
  lines.push(`- CGPA: ${result.cgpa.toFixed(2)}`);
  lines.push(`- On probation: ${result.on_probation ? 'YES' : 'no'}`);
  if (result.ocr_confidence !== null) {
    lines.push(`- OCR confidence: ${(result.ocr_confidence * 100).toFixed(0)}%`);
  }
  lines.push('');

  const totalMissing = Object.values(result.missing_courses).reduce(
    (a, c) => a + c.length,
    0,
  );
  lines.push(`## Missing courses (${totalMissing})`);
  if (totalMissing === 0) {
    lines.push('_All requirements met._');
  } else {
    Object.entries(result.missing_courses).forEach(([cat, codes]) => {
      if (codes.length === 0) return;
      lines.push(`### ${cat}`);
      codes.forEach((c) => lines.push(`- ${c}`));
    });
  }
  lines.push('');

  lines.push('## Course breakdown');
  lines.push('| Code | Name | Grade | Credits | Semester | Counted |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  result.credit_breakdown.forEach((row) => {
    lines.push(
      `| ${row.course_code} | ${row.course_name} | ${row.grade} | ${row.credits.toFixed(1)} | ${row.semester} | ${row.counted ? 'yes' : 'no'} |`,
    );
  });
  lines.push('');

  if (result.waived_courses.length > 0) {
    lines.push('## Waived courses');
    result.waived_courses.forEach((c) => lines.push(`- ${c}`));
    lines.push('');
  }

  if (annotations.length > 0) {
    lines.push('## My annotations');
    annotations.forEach((a) => {
      lines.push(
        `- [${a.flagColor.toUpperCase()}] ${a.courseCode}: ${a.note || '(no note)'}`,
      );
    });
  }

  return lines.join('\n');
}

function buildHtml(markdown: string, programName: string): string {
  // very small markdown-to-html: headings and lists.
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const lines = escaped.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('### ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h3>${line.slice(4)}</h3>`);
    } else if (line.startsWith('## ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h2>${line.slice(3)}</h2>`);
    } else if (line.startsWith('# ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h1>${line.slice(2)}</h1>`);
    } else if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${line.slice(2)}</li>`);
    } else if (line.startsWith('|')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (line.trim().match(/^\|\s*-+/)) {
        // skip separator
        continue;
      }
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (!inTable) {
        out.push('<table border="1" cellpadding="6" cellspacing="0">');
        out.push(
          `<tr>${cells.map((c) => `<th>${c}</th>`).join('')}</tr>`,
        );
        inTable = true;
      } else {
        out.push(`<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`);
      }
    } else {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      if (inTable) {
        out.push('</table>');
        inTable = false;
      }
      if (line.trim().length === 0) out.push('<br/>');
      else out.push(`<p>${line}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  if (inTable) out.push('</table>');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Audit Report — ${programName}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; padding: 32px; color: #1f2937; }
  h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }
  h2 { color: #1f2937; margin-top: 24px; }
  h3 { color: #4b5563; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
  th { background: #eef2ff; text-align: left; }
  td, th { border: 1px solid #d1d5db; padding: 6px; }
  ul { padding-left: 20px; }
  li { margin: 2px 0; }
</style></head><body>${out.join('\n')}</body></html>`;
}

export default function ReportScreen(): React.ReactElement {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ReportRoute>();
  const { result } = route.params;

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [format, setFormat] = useState<Format>('markdown');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getAnnotations(result.id).then((a) => {
      if (mounted) setAnnotations(a);
    });
    return () => {
      mounted = false;
    };
  }, [result.id]);

  const markdown = useMemo(
    () => buildMarkdown(result, annotations, user?.name ?? ''),
    [result, annotations, user],
  );

  const json = useMemo(
    () => JSON.stringify({ result, annotations }, null, 2),
    [result, annotations],
  );

  const previewText = format === 'markdown' ? markdown : json;

  async function handleShareText(): Promise<void> {
    setBusy('share');
    try {
      const fileName = `audit-${result.id}.${format === 'markdown' ? 'md' : 'json'}`;
      const file = new File(Paths.cache, fileName);
      file.write(previewText);
      const path = file.uri;
      const ok = await Sharing.isAvailableAsync();
      if (!ok) {
        Alert.alert('Sharing not supported on this device');
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType: format === 'markdown' ? 'text/markdown' : 'application/json',
        dialogTitle: 'Share audit report',
      });
    } catch (err) {
      Alert.alert('Share failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  async function handleExportPdf(): Promise<void> {
    setBusy('pdf');
    try {
      const html = buildHtml(markdown, result.program_name);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const ok = await Sharing.isAvailableAsync();
      if (!ok) {
        Alert.alert('PDF saved', `Saved to:\n${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share audit report',
      });
    } catch (err) {
      Alert.alert('Export failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy(): Promise<void> {
    setBusy('copy');
    try {
      await Clipboard.setStringAsync(previewText);
      Alert.alert('Copied', 'Report copied to clipboard.');
    } catch (err) {
      Alert.alert('Copy failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          Export report
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Format toggle */}
      <View
        style={[
          styles.toggle,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {(['markdown', 'json'] as Format[]).map((f) => {
          const active = format === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.toggleBtn,
                active && { backgroundColor: colors.accent },
              ]}
              onPress={() => setFormat(f)}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: active ? '#fff' : colors.textMuted },
                ]}
              >
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Preview */}
      <ScrollView
        style={[
          styles.preview,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.previewText,
            { color: colors.text },
          ]}
          selectable
        >
          {previewText}
        </Text>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleCopy}
          disabled={busy !== null}
        >
          {busy === 'copy' ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Ionicons name="copy-outline" size={18} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.accent }]}>Copy</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleShareText}
          disabled={busy !== null}
        >
          {busy === 'share' ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.accent }]}>Share</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
          onPress={handleExportPdf}
          disabled={busy !== null}
        >
          {busy === 'pdf' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={18} color="#fff" />
              <Text style={[styles.actionText, { color: '#fff' }]}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 16, fontWeight: '700' },
  toggle: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 10,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  preview: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
