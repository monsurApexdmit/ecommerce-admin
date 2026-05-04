import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { colors } from "@/constants/theme";
import { playIncomingSupportMessageSound } from "@/lib/message-sound";
import { presentSupportMessageNotification } from "@/lib/mobile-notifications";
import { subscribeToSupportTicket } from "@/lib/reverb";
import {
  getTicket,
  replyToTicket,
  updateTicketStatus,
} from "@/services/support";
import type {
  SupportAttachment,
  SupportMessage,
  SupportTicket,
  SupportUploadAttachment,
  TicketStatus,
} from "@/services/support";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  return new Date(dateStr).toLocaleDateString();
}

function formatRecordingTime(durationMillis: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatFileSize(sizeBytes?: number): string {
  if (!sizeBytes || sizeBytes < 1024) return sizeBytes ? `${sizeBytes} B` : "Attachment";
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ComposerAttachment = {
  key: string;
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  isImage: boolean;
  isAudio: boolean;
};

const STATUS_META: Record<TicketStatus, { bg: string; text: string; dot: string; label: string; icon: any }> = {
  open:        { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6", label: "Open",        icon: "ellipse-outline" },
  in_progress: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b", label: "In Progress", icon: "time-outline" },
  resolved:    { bg: "#dcfce7", text: "#166534", dot: "#22c55e", label: "Resolved",    icon: "checkmark-circle-outline" },
  closed:      { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8", label: "Closed",      icon: "close-circle-outline" },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "#ef4444", medium: "#f97316", low: "#94a3b8",
};

const STATUS_FLOW: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [ticket, setTicket]       = useState<SupportTicket | null>(null);
  const [loading, setLoading]     = useState(true);
  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const [statusVisible, setStatusVisible] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);

  const ticketId = Number(id);
  const canReply = ticket && ticket.status !== "closed" && ticket.status !== "resolved";
  const hasReplyContent = reply.trim().length > 0 || attachments.length > 0;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const t = await getTicket(ticketId);
      setTicket(t);
      navigation.setOptions({ title: `#${t.ticketNumber}` });
    } finally {
      setLoading(false);
    }
  }, [ticketId, navigation]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!ticketId || Number.isNaN(ticketId)) return;
    return subscribeToSupportTicket(ticketId, {
      onMessageSent: (incomingTicketId, message) => {
        if (incomingTicketId !== ticketId) return;
        if (message.senderType === "customer") {
          void playIncomingSupportMessageSound(message.id);
          void presentSupportMessageNotification({
            ticketId: incomingTicketId,
            messageId: message.id,
            senderName: message.senderName,
            body: message.body,
          });
        }
        setTicket((prev) => {
          if (!prev) return prev;
          if (prev.messages.some((item) => item.id === message.id)) return prev;
          return { ...prev, messages: [...prev.messages, message] };
        });
      },
      onStatusUpdated: (incomingTicketId, status) => {
        if (incomingTicketId !== ticketId) return;
        setTicket((prev) => (prev ? { ...prev, status } : prev));
      },
      onPriorityUpdated: (incomingTicketId, priority) => {
        if (incomingTicketId !== ticketId) return;
        setTicket((prev) => (prev ? { ...prev, priority } : prev));
      },
    });
  }, [ticketId]);

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  useEffect(() => { if (ticket?.messages.length) scrollToBottom(); }, [ticket?.messages.length]);

  useEffect(() => {
    return () => { if (recorderState.isRecording) recorder.pause(); };
  }, [recorder, recorderState.isRecording]);

  const appendComposerAttachments = useCallback((incoming: ComposerAttachment[]) => {
    setAttachments((prev) => {
      const next = [...prev];
      for (const item of incoming) {
        if (next.length >= 5) break;
        if (!next.some((e) => e.uri === item.uri && e.name === item.name)) next.push(item);
      }
      return next;
    });
  }, []);

  const handlePickAttachments = useCallback(async () => {
    if (!canReply || picking) return;
    try {
      setPicking(true);
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: ["image/*", "audio/*", "application/pdf", "text/plain", "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      });
      if (result.canceled || !result.assets?.length) return;
      appendComposerAttachments(result.assets.map((asset, i) => {
        const mimeType = asset.mimeType || "application/octet-stream";
        return {
          key: `${asset.uri}-${asset.lastModified}-${i}`,
          uri: asset.uri, name: asset.name, mimeType,
          sizeBytes: asset.size,
          isImage: mimeType.startsWith("image/"),
          isAudio: mimeType.startsWith("audio/"),
        };
      }));
    } catch {
      Alert.alert("Attachment failed", "Could not select files right now.");
    } finally {
      setPicking(false);
    }
  }, [appendComposerAttachments, canReply, picking]);

  const handleStartRecording = useCallback(async () => {
    if (!canReply || recorderState.isRecording || recordingBusy) return;
    try {
      setRecordingBusy(true);
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone needed", "Allow microphone access to send a voice message.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert("Recording failed", "Could not start the microphone.");
    } finally {
      setRecordingBusy(false);
    }
  }, [canReply, recorder, recorderState.isRecording, recordingBusy]);

  const handleStopRecording = useCallback(async () => {
    if (!recorderState.isRecording || recordingBusy) return;
    try {
      setRecordingBusy(true);
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        appendComposerAttachments([{
          key: `${uri}-${Date.now()}`, uri,
          name: `voice-message-${Date.now()}.m4a`,
          mimeType: "audio/mp4", isImage: false, isAudio: true,
        }]);
      }
    } catch {
      Alert.alert("Recording failed", "Could not save the voice message.");
    } finally {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setRecordingBusy(false);
    }
  }, [appendComposerAttachments, recorder, recorderState.isRecording, recordingBusy]);

  const removeComposerAttachment = useCallback((key: string) => {
    setAttachments((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const handleSend = async () => {
    const body = reply.trim();
    if ((!body && attachments.length === 0) || !ticket || !canReply) return;
    const draftAttachments = attachments;
    setSending(true);
    setReply("");
    setAttachments([]);
    try {
      const uploadAttachments: SupportUploadAttachment[] = draftAttachments.map((a) => ({
        uri: a.uri, name: a.name, type: a.mimeType,
      }));
      const updated = await replyToTicket(ticket.id, { body, attachments: uploadAttachments });
      setTicket(updated);
      scrollToBottom();
    } catch {
      setReply(body);
      setAttachments(draftAttachments);
      Alert.alert("Send failed", "Could not send the reply right now.");
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async (status: TicketStatus) => {
    if (!ticket) return;
    setStatusVisible(false);
    const updated = await updateTicketStatus(ticket.id, status);
    setTicket(updated);
  };

  if (loading || !ticket) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <View style={s.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      </SafeAreaView>
    );
  }

  const sm = STATUS_META[ticket.status];
  const priorityColor = PRIORITY_COLOR[ticket.priority] ?? "#94a3b8";
  const customerInitial = (ticket.customerName || "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>

      {/* ── Info bar ─────────────────────────────────────── */}
      <View style={s.infoBar}>
        {/* Avatar */}
        <View style={s.avatar}>
          <Text style={s.avatarText}>{customerInitial}</Text>
        </View>

        {/* Details */}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.subject} numberOfLines={1}>{ticket.subject}</Text>
          <View style={s.infoMetaRow}>
            <Ionicons name="person-outline" size={11} color={colors.muted} />
            <Text style={s.infoMeta} numberOfLines={1}>
              {ticket.customerName || "Unknown"}
              {ticket.customerEmail ? `  ·  ${ticket.customerEmail}` : ""}
            </Text>
          </View>
          <View style={s.infoMetaRow}>
            <View style={[s.priorityDot, { backgroundColor: priorityColor }]} />
            <Text style={[s.infoMeta, { color: priorityColor, fontWeight: "700" }]}>
              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} priority
            </Text>
            <Text style={s.infoDot}>·</Text>
            <Text style={s.infoMeta}>{ticket.category}</Text>
          </View>
        </View>

        {/* Status button */}
        <Pressable style={[s.statusBtn, { backgroundColor: sm.bg }]} onPress={() => setStatusVisible(true)}>
          <View style={[s.statusDot, { backgroundColor: sm.dot }]} />
          <Text style={[s.statusBtnText, { color: sm.text }]}>{sm.label}</Text>
          <Ionicons name="chevron-down" size={11} color={sm.text} />
        </Pressable>
      </View>

      {/* ── Messages ─────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={s.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {ticket.messages.length === 0 ? (
          <View style={s.emptyMessages}>
            <View style={s.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.primaryDark} />
            </View>
            <Text style={s.emptyTitle}>No messages yet</Text>
            <Text style={s.emptySubtitle}>Be the first to reply to this ticket</Text>
          </View>
        ) : (
          ticket.messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
      </ScrollView>

      {/* ── Reply bar ────────────────────────────────────── */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        {canReply ? (
          <View style={s.inputBar}>
            {(attachments.length > 0 || recorderState.isRecording) ? (
              <View style={s.composerTop}>
                {attachments.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.attachmentDraftRow}>
                    {attachments.map((a) => (
                      <DraftAttachmentChip key={a.key} attachment={a} onRemove={() => removeComposerAttachment(a.key)} />
                    ))}
                  </ScrollView>
                ) : null}
                {recorderState.isRecording ? (
                  <View style={s.recordingPill}>
                    <View style={s.recordingDot} />
                    <Text style={s.recordingText}>Recording {formatRecordingTime(recorderState.durationMillis)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={s.inputRow}>
              <Pressable
                style={[s.inputIconBtn, picking && s.inputIconBtnDisabled]}
                onPress={() => void handlePickAttachments()}
                disabled={picking || sending || recorderState.isRecording}
              >
                <Ionicons name="attach" size={20} color={colors.primaryDark} />
              </Pressable>
              <Pressable
                style={[s.inputIconBtn, recorderState.isRecording && s.recordingIconBtn, (recordingBusy || sending) && s.inputIconBtnDisabled]}
                onPress={() => void (recorderState.isRecording ? handleStopRecording() : handleStartRecording())}
                disabled={recordingBusy || sending}
              >
                <Ionicons
                  name={recorderState.isRecording ? "stop-circle" : "mic-outline"}
                  size={20}
                  color={recorderState.isRecording ? "#fff" : colors.primaryDark}
                />
              </Pressable>
              <TextInput
                style={s.input}
                value={reply}
                onChangeText={setReply}
                placeholder="Type a reply…"
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={2000}
              />
              <Pressable
                style={[s.sendBtn, (!hasReplyContent || sending || recordingBusy) && s.sendBtnDisabled]}
                onPress={() => void handleSend()}
                disabled={!hasReplyContent || sending || recordingBusy}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={18} color="#fff" />
                }
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[s.closedBar, { backgroundColor: sm.bg }]}>
            <Ionicons name={sm.icon as any} size={15} color={sm.dot} />
            <Text style={[s.closedText, { color: sm.text }]}>
              Ticket is {sm.label.toLowerCase()} — replies disabled
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Status picker ────────────────────────────────── */}
      {statusVisible && (
        <Pressable style={s.overlay} onPress={() => setStatusVisible(false)}>
          <Pressable style={s.statusSheet} onPress={() => undefined}>
            <View style={s.sheetHandle} />
            <Text style={s.statusSheetTitle}>Change Status</Text>
            {STATUS_FLOW.map((st) => {
              const m = STATUS_META[st];
              const active = ticket.status === st;
              return (
                <Pressable
                  key={st}
                  style={[s.statusOption, active && { backgroundColor: m.bg }]}
                  onPress={() => void handleStatus(st)}
                >
                  <View style={[s.statusOptionDot, { backgroundColor: m.dot }]} />
                  <Text style={[s.statusOptionText, active && { color: m.text, fontWeight: "800" }]}>{m.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={m.dot} style={{ marginLeft: "auto" }} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ── MessageBubble ──────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: SupportMessage }) {
  const isStaff = msg.senderType === "staff";
  const initial = (msg.senderName || (isStaff ? "S" : "C")).charAt(0).toUpperCase();

  return (
    <View style={[s.bubbleRow, isStaff ? s.bubbleRowStaff : s.bubbleRowCustomer]}>
      {!isStaff && (
        <View style={[s.bubbleAvatar, { backgroundColor: "#e0f2fe" }]}>
          <Text style={[s.bubbleAvatarText, { color: "#0284c7" }]}>{initial}</Text>
        </View>
      )}
      <View style={{ flex: 1, gap: 3, alignItems: isStaff ? "flex-end" : "flex-start" }}>
        <Text style={[s.bubbleSender, isStaff && { color: colors.primaryDark }]}>
          {isStaff ? (msg.senderName || "Support Team") : (msg.senderName || "Customer")}
        </Text>
        <View style={[s.bubbleInner, isStaff ? s.bubbleInnerStaff : s.bubbleInnerCustomer]}>
          {msg.body ? (
            <Text style={[s.bubbleBody, isStaff && s.bubbleBodyStaff]}>{msg.body}</Text>
          ) : null}
          {msg.attachments.length > 0 ? (
            <View style={s.bubbleAttachments}>
              {msg.attachments.map((a) => (
                <MessageAttachmentCard key={a.id} attachment={a} isStaff={isStaff} />
              ))}
            </View>
          ) : null}
        </View>
        <Text style={[s.bubbleTime, isStaff && { textAlign: "right" }]}>{relativeTime(msg.createdAt)}</Text>
      </View>
      {isStaff && (
        <View style={[s.bubbleAvatar, { backgroundColor: colors.primaryDark + "22" }]}>
          <Text style={[s.bubbleAvatarText, { color: colors.primaryDark }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

// ── MessageAttachmentCard ──────────────────────────────────────────

function MessageAttachmentCard({ attachment, isStaff }: { attachment: SupportAttachment; isStaff: boolean }) {
  if (attachment.isImage) {
    return (
      <Pressable onPress={() => void Linking.openURL(attachment.url)} style={s.attachmentImageWrap}>
        <Image source={{ uri: attachment.url }} style={s.attachmentImage} resizeMode="cover" />
        <View style={s.attachmentImageOverlay}>
          <Ionicons name="expand-outline" size={16} color="#fff" />
        </View>
      </Pressable>
    );
  }
  if (attachment.isAudio) {
    return <AudioAttachmentCard attachment={attachment} isStaff={isStaff} />;
  }
  return (
    <Pressable
      style={[s.fileCard, isStaff && s.fileCardStaff]}
      onPress={() => void Linking.openURL(attachment.url)}
    >
      <View style={[s.fileCardIcon, isStaff && s.fileCardIconStaff]}>
        <Ionicons name="document-text-outline" size={18} color={isStaff ? colors.primaryDark : "#fff"} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[s.fileName, isStaff && s.fileNameStaff]} numberOfLines={1}>{attachment.name}</Text>
        <Text style={[s.fileSize, isStaff && s.fileSizeStaff]}>{formatFileSize(attachment.sizeBytes)}</Text>
      </View>
      <Ionicons name="download-outline" size={16} color={isStaff ? "rgba(255,255,255,0.6)" : colors.muted} />
    </Pressable>
  );
}

// ── AudioAttachmentCard ────────────────────────────────────────────

function AudioAttachmentCard({ attachment, isStaff }: { attachment: SupportAttachment; isStaff: boolean }) {
  const player = useAudioPlayer(attachment.url);
  const status = useAudioPlayerStatus(player);

  const handlePress = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      // Restart from beginning if finished
      if (status.didJustFinish || (!status.playing && status.currentTime > 0)) {
        player.seekTo(0);
      }
      player.play();
    }
  }, [player, status]);

  const durationSec = status.duration ? Math.floor(status.duration) : 0;
  const currentSec  = status.currentTime ? Math.floor(status.currentTime) : 0;
  const progress    = durationSec > 0 ? Math.min(currentSec / durationSec, 1) : 0;

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const bgColor    = isStaff ? "rgba(255,255,255,0.14)" : "#e0f2fe";
  const trackColor = isStaff ? "rgba(255,255,255,0.25)" : "#bae6fd";
  const fillColor  = isStaff ? "#fff" : colors.primaryDark;
  const textColor  = isStaff ? "rgba(255,255,255,0.85)" : colors.text;
  const mutedColor = isStaff ? "rgba(255,255,255,0.55)" : colors.muted;

  return (
    <View style={[s.audioCard, { backgroundColor: bgColor }]}>
      <Pressable style={[s.audioPlayBtn, { backgroundColor: isStaff ? "#fff" : colors.primaryDark }]} onPress={handlePress}>
        <Ionicons
          name={status.playing ? "pause" : "play"}
          size={15}
          color={isStaff ? colors.primaryDark : "#fff"}
          style={{ marginLeft: status.playing ? 0 : 1 }}
        />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        {/* Waveform progress bar */}
        <View style={[s.audioTrack, { backgroundColor: trackColor }]}>
          <View style={[s.audioFill, { width: `${progress * 100}%`, backgroundColor: fillColor }]} />
        </View>
        <View style={s.audioTimeRow}>
          <Text style={[s.audioTimeText, { color: mutedColor }]}>{fmt(currentSec)}</Text>
          <Text style={[s.audioLabel, { color: textColor }]}>
            {status.playing ? "Playing…" : "Voice message"}
          </Text>
          {durationSec > 0 && (
            <Text style={[s.audioTimeText, { color: mutedColor }]}>{fmt(durationSec)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── DraftAttachmentChip ────────────────────────────────────────────

function DraftAttachmentChip({ attachment, onRemove }: { attachment: ComposerAttachment; onRemove: () => void }) {
  return (
    <View style={s.draftChip}>
      {attachment.isImage ? (
        <Image source={{ uri: attachment.uri }} style={s.draftImage} resizeMode="cover" />
      ) : (
        <View style={s.draftIcon}>
          <Ionicons name={attachment.isAudio ? "mic-outline" : "document-outline"} size={16} color={colors.primaryDark} />
        </View>
      )}
      <View style={s.draftMeta}>
        <Text style={s.draftName} numberOfLines={1}>{attachment.name}</Text>
        <Text style={s.draftSize}>{formatFileSize(attachment.sizeBytes)}</Text>
      </View>
      <Pressable hitSlop={8} onPress={onRemove}>
        <Ionicons name="close-circle" size={18} color="#94a3b8" />
      </Pressable>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Info bar
  infoBar: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryDark + "18",
    alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  avatarText: { color: colors.primaryDark, fontSize: 16, fontWeight: "800" },
  subject: { color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  infoMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoMeta: { color: colors.muted, fontSize: 11, flexShrink: 1, textTransform: "capitalize" },
  infoDot: { color: colors.muted, fontSize: 11 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  statusBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 2,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusBtnText: { fontSize: 11, fontWeight: "700" },

  // Messages
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingVertical: 16, gap: 14 },
  emptyMessages: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryDark + "12",
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  emptySubtitle: { color: colors.muted, fontSize: 13 },

  // Bubble rows
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "88%" },
  bubbleRowStaff: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  bubbleRowCustomer: { alignSelf: "flex-start" },
  bubbleAvatar: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  bubbleAvatarText: { fontSize: 12, fontWeight: "800" },
  bubbleSender: { color: colors.muted, fontSize: 11, fontWeight: "600", paddingHorizontal: 4 },
  bubbleInner: { borderRadius: 18, padding: 12, gap: 6 },
  bubbleInnerStaff: { backgroundColor: colors.primaryDark, borderBottomRightRadius: 4 },
  bubbleInnerCustomer: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleBody: { color: colors.text, fontSize: 14, lineHeight: 21 },
  bubbleBodyStaff: { color: "#fff" },
  bubbleAttachments: { gap: 8 },
  bubbleTime: { color: colors.muted, fontSize: 10, paddingHorizontal: 4 },

  // Input bar
  inputBar: {
    gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  composerTop: { gap: 8 },
  attachmentDraftRow: { gap: 8 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  inputIconBtn: {
    width: 40, height: 40, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center", justifyContent: "center",
  },
  inputIconBtnDisabled: { opacity: 0.4 },
  recordingIconBtn: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 18, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.background,
    paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 14,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.35 },

  // Draft chips
  draftChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    width: 200, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.background, padding: 8,
  },
  draftImage: { width: 38, height: 38, borderRadius: 8 },
  draftIcon: {
    width: 38, height: 38, borderRadius: 8,
    backgroundColor: colors.primaryDark + "14",
    alignItems: "center", justifyContent: "center",
  },
  draftMeta: { flex: 1, gap: 1 },
  draftName: { color: colors.text, fontSize: 11, fontWeight: "700" },
  draftSize: { color: colors.muted, fontSize: 10 },

  // Recording pill
  recordingPill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    gap: 8, borderRadius: 999, backgroundColor: "#fee2e2",
    paddingHorizontal: 12, paddingVertical: 8,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  recordingText: { color: "#991b1b", fontSize: 12, fontWeight: "700" },

  // Closed bar
  closedBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  closedText: { fontSize: 13, fontWeight: "600" },

  // Status sheet
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  statusSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 4,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 },
  statusSheetTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 8 },
  statusOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14,
  },
  statusOptionDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { color: colors.text, fontSize: 15, fontWeight: "600", textTransform: "capitalize" },

  // Image attachment
  attachmentImageWrap: { borderRadius: 14, overflow: "hidden", alignSelf: "flex-start" },
  attachmentImage: { width: 200, height: 140, borderRadius: 14 },
  attachmentImageOverlay: {
    position: "absolute", bottom: 8, right: 8,
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },

  // File card
  fileCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, backgroundColor: "#f1f5f9",
    borderWidth: 1, borderColor: "#e2e8f0", padding: 10,
  },
  fileCardStaff: { backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.2)" },
  fileCardIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  fileCardIconStaff: { backgroundColor: "#fff" },
  fileName: { color: colors.text, fontSize: 12, fontWeight: "700" },
  fileNameStaff: { color: "#fff" },
  fileSize: { color: colors.muted, fontSize: 11 },
  fileSizeStaff: { color: "rgba(255,255,255,0.6)" },

  // Audio card
  audioCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, padding: 10, minWidth: 200,
  },
  audioPlayBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  audioTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  audioFill: { height: 4, borderRadius: 2 },
  audioTimeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  audioTimeText: { fontSize: 10, fontWeight: "600" },
  audioLabel: { fontSize: 11, fontWeight: "600" },
});
