import { AppColors } from "@/constants/colors";
import { DelayEntry, Task } from "@/constants/tasks";
import { Entypo, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import PriorityDot from "./PriorityDot";
import LinkText from "./LinkText";

interface ExpandedTaskCardProps {
  task: Task;
  authToken?: string;
  onDelete?: () => void;
  onComplete?: () => void;
  onCollapse?: () => void;
  onSaveDelay?: (reason: string, attachmentLink?: string) => void;
  onEditDelay?: (delayId: string, newReason: string) => void;
  onDeleteDelay?: (delayId: string) => void;
  onEdit?: (newTitle: string) => void;
  onDrop?: () => void;
  onDelayFocus?: () => void;
  onForkDelay?: (delayId: string, delayReason: string) => void;
  onNavigateToParent?: (parentTaskId: string) => void;
  onRemind?: (dateTime: string) => void;
  dueDateLabel?: string; // YYYY-MM-DD — shown as a pill in all-pending mode
}

function formatDueDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Web-only thumbnail: fetches image via proxy with auth header, renders as blob URL
function WebThumb({ urlOrKey, fetchBlobUrl }: { urlOrKey: string; fetchBlobUrl: (k: string) => Promise<string> }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    fetchBlobUrl(urlOrKey).then(url => { if (!cancelled) setSrc(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [urlOrKey]);
  if (!src) return <View style={{ flex: 1, backgroundColor: "#e5e7eb" }} />;
  return <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6, pointerEvents: "none" }} />;
}

export default function ExpandedTaskCard({
  task,
  authToken,
  onDelete,
  onComplete,
  onCollapse,
  onSaveDelay,
  onEditDelay,
  onDeleteDelay,
  onEdit,
  onDrop,
  onDelayFocus,
  onForkDelay,
  onNavigateToParent,
  onRemind,
  dueDateLabel,
}: ExpandedTaskCardProps) {
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleText, setEditTitleText] = useState(task.title);
  const editTitleRef = useRef<TextInput>(null);

  const [delayReason, setDelayReason] = useState("");
  const hasDelayInput = delayReason.trim().length > 0;

  // Attachment state
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null); // local uri
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);     // stratus url
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);     // stratus object key
  const [uploading, setUploading] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null); // full-screen viewer
  // blob URLs for web — keyed by stratus key to avoid re-fetching
  const [blobCache, setBlobCache] = useState<Record<string, string>>({});


  const API_BASE = __DEV__
    ? (typeof window !== "undefined" && typeof document !== "undefined"
        ? "http://localhost:3004/server/track_everything_te_function"
        : "http://localhost:3004/server/track_everything_te_function")
    : "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function";

  // Extract Stratus object key from a stored URL or return key directly
  const getProxyUrl = (urlOrKey: string) => {
    let key: string;
    if (!urlOrKey.startsWith("http")) {
      key = urlOrKey;
    } else {
      // Full Stratus URL — extract everything after the bucket name, strip query params
      const match = urlOrKey.match(/\/trackeverything\/(.+?)(\?.*)?$/);
      key = match ? match[1] : urlOrKey;
    }
    return `${API_BASE}/proxyAttachment?key=${encodeURIComponent(key)}`;
  };

  // Fetch image via proxy and return a blob: URL (avoids <img> CORS/auth issues on web)
  const fetchBlobUrl = async (urlOrKey: string): Promise<string> => {
    const cacheKey = urlOrKey;
    if (blobCache[cacheKey]) return blobCache[cacheKey];
    const proxyUrl = getProxyUrl(urlOrKey);
    const res = await fetch(proxyUrl, { headers: { "X-TE-Token": authToken ?? "" } });
    if (!res.ok) throw new Error(`Image load failed: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    setBlobCache(prev => ({ ...prev, [cacheKey]: blobUrl }));
    return blobUrl;
  };

  // Open image viewer — fetch blob on web, use proxy URL on native
  const openImageViewer = async (urlOrKey: string) => {
    if (Platform.OS === "web") {
      try {
        const blobUrl = await fetchBlobUrl(urlOrKey);
        setImageViewerUrl(blobUrl);
      } catch (e) {
        Alert.alert("Failed to load image");
      }
    } else {
      setImageViewerUrl(getProxyUrl(urlOrKey));
    }
  };


  const handlePickAttachment = async () => {
    if (Platform.OS === "web") {
      // Create and click a temporary file input synchronously — must be
      // in the same call stack as the user gesture or browsers will block it.
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file: File = e.target.files?.[0];
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        setAttachmentUri(objectUrl);
        setUploadedUrl(null);
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append("file", file, file.name);
          const res = await fetch(`${API_BASE}/uploadAttachment`, {
            method: "POST",
            headers: { "X-TE-Token": authToken ?? "" },
            body: formData,
          });
          const json = await res.json();
          if (json.url) {
            setUploadedUrl(json.url);
            if (json.key) setUploadedKey(json.key);
          } else {
            throw new Error(json.error ?? "Upload failed");
          }
        } catch (err: any) {
          Alert.alert("Upload failed", err.message ?? "Could not upload image.");
          setAttachmentUri(null);
        } finally {
          setUploading(false);
        }
      };
      input.click();
      return;
    }
    try {
      const ImagePicker = require("expo-image-picker");

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow photo access to attach images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setAttachmentUri(asset.uri);
      setUploadedUrl(null);
      setUploading(true);

      try {
        const fileName = asset.uri.split("/").pop() ?? `photo_${Date.now()}.jpg`;
        const formData = new FormData();
        // On web, expo-image-picker provides asset.file (a native File/Blob)
        if (asset.file) {
          formData.append("file", asset.file, fileName);
        } else {
          formData.append("file", { uri: asset.uri, name: fileName, type: asset.mimeType ?? "image/jpeg" } as any);
        }

        const res = await fetch(`${API_BASE}/uploadAttachment`, {
          method: "POST",
          headers: { "X-TE-Token": authToken ?? "" },
          body: formData,
        });
        const json = await res.json();
        if (json.url) {
          setUploadedUrl(json.url);
          if (json.key) setUploadedKey(json.key);
        } else {
          throw new Error(json.error ?? "Upload failed");
        }
      } catch (err: any) {
        Alert.alert("Upload failed", err.message ?? "Could not upload image.");
        setAttachmentUri(null);
      } finally {
        setUploading(false);
      }
    } catch {
      Alert.alert("Not available", "Image picker requires a new app build.");
    }
  };

  const handleClearAttachment = () => {
    setAttachmentUri(null);
    setUploadedUrl(null);
    setUploadedKey(null);
  };

  // Task-level three-dot menu
  const [taskMenuOpen, setTaskMenuOpen] = useState(false);
  const [taskMenuPos, setTaskMenuPos] = useState({ x: 0, y: 0 });
  const taskMenuBtnRef = useRef<TouchableOpacity>(null);
  // Remind modal
  const [remindModalOpen, setRemindModalOpen] = useState(false);
  const [remindDate, setRemindDate] = useState("");
  const [remindTime, setRemindTime] = useState("");
  // Ref to focus delay input from the menu
  const delayInputRef = useRef<TextInput>(null);

  const openTaskMenu = () => {
    taskMenuBtnRef.current?.measure((_fx, _fy, _w, _h, px, py) => {
      setTaskMenuPos({ x: px, y: py + _h + 4 });
      setTaskMenuOpen(true);
    });
  };

  const openRemindModal = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setRemindDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    setRemindTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setRemindModalOpen(true);
  };

  const handleConfirmRemind = () => {
    if (!remindDate || !remindTime) return;
    const dt = `${remindDate}T${remindTime}`;
    const parsed = new Date(dt);
    if (isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      Alert.alert("Invalid time", "Please pick a future date and time.");
      return;
    }
    onRemind?.(dt);
    setRemindModalOpen(false);
  };

  // Editing state for delay history entries
  const [editingDelayId, setEditingDelayId] = useState<string | null>(null);
  const [menuOpenDelayId, setMenuOpenDelayId] = useState<string | null>(null);
  const [editingDelayText, setEditingDelayText] = useState("");
  const editInputRef = useRef<TextInput>(null);

  // ── Title edit handlers ──
  const handleStartTitleEdit = () => {
    setIsEditingTitle(true);
    setEditTitleText(task.title);
    setTimeout(() => editTitleRef.current?.focus(), 100);
  };

  const handleSaveTitleEdit = () => {
    if (editTitleText.trim() && onEdit) {
      onEdit(editTitleText.trim());
    }
    setIsEditingTitle(false);
    Keyboard.dismiss();
  };

  const handleCancelTitleEdit = () => {
    setIsEditingTitle(false);
    setEditTitleText(task.title);
    Keyboard.dismiss();
  };

  // ── Drop handler ──
  const handleDropTask = () => {
    if (Platform.OS === "web") {
      if (window.confirm(`Drop "${task.title}"? It will be moved to the Dropped section.`)) {
        onDrop?.();
      }
    } else {
      Alert.alert(
        "Drop Task",
        `Drop "${task.title}"? It will be moved to the Dropped section.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Drop", style: "destructive", onPress: () => onDrop?.() },
        ]
      );
    }
  };

  const handleDeleteTask = () => {
    if (Platform.OS === "web") {
      if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
        onDelete?.();
      }
    } else {
      Alert.alert(
        "Delete Task",
        `Are you sure you want to delete "${task.title}"?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
        ]
      );
    }
  };

  const handleSave = () => {
    if (hasDelayInput && onSaveDelay) {
      onSaveDelay(delayReason.trim(), uploadedKey ?? uploadedUrl ?? undefined);
      setDelayReason("");
      setAttachmentUri(null);
      setUploadedUrl(null);
      Keyboard.dismiss();
    }
  };

  const handleStartEdit = (delay: DelayEntry) => {
    setEditingDelayId(delay.id);
    setEditingDelayText(delay.reason);
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const handleSaveEdit = () => {
    if (editingDelayId && editingDelayText.trim() && onEditDelay) {
      onEditDelay(editingDelayId, editingDelayText.trim());
    }
    setEditingDelayId(null);
    setEditingDelayText("");
    Keyboard.dismiss();
  };

  const handleCancelEdit = () => {
    setEditingDelayId(null);
    setEditingDelayText("");
    Keyboard.dismiss();
  };

  const handleDeleteDelay = (delayId: string) => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to permanently delete this delay entry?")) {
        onDeleteDelay?.(delayId);
      }
    } else {
      Alert.alert(
        "Delete Delay",
        "Are you sure you want to permanently delete this delay entry?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => onDeleteDelay?.(delayId),
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-screen image viewer modal */}
      <Modal
        visible={imageViewerUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerUrl(null)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setImageViewerUrl(null)} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={34} color="#fff" />
          </TouchableOpacity>
          {imageViewerUrl && (
            Platform.OS === "web" ? (
              // imageViewerUrl is a blob: URL on web — no auth needed
              <img
                src={imageViewerUrl}
                style={{ maxWidth: "92%", maxHeight: "88%", objectFit: "contain", borderRadius: 10 }}
              />
            ) : (
              <Image
                source={{ uri: imageViewerUrl, headers: { "X-TE-Token": authToken ?? "" } }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            )
          )}
        </View>
      </Modal>

      {/* Top row */}
      <TouchableOpacity style={styles.topRow} onPress={onCollapse} activeOpacity={0.7}>
        <TouchableOpacity
          style={[styles.checkbox, { borderColor: AppColors.primarySolid }]}
          onPress={onComplete}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
        <View style={styles.content}>
          {isEditingTitle ? (
            <TextInput
              ref={editTitleRef}
              style={styles.editTitleInput}
              value={editTitleText}
              onChangeText={setEditTitleText}
              autoFocus
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleSaveTitleEdit}
            />
          ) : (
            <>
              <Text style={styles.title}>{task.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.date}>{task.date}</Text>
                {dueDateLabel && (
                  <View style={styles.dueDatePill}>
                    <Text style={styles.dueDateText}>{formatDueDate(dueDateLabel)}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
        <PriorityDot priority={task.priority} />
        {/* Three-dot task menu */}
        <TouchableOpacity
          ref={taskMenuBtnRef}
          style={styles.taskMenuDot}
          onPress={openTaskMenu}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Entypo name="dots-three-vertical" size={16} color={AppColors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Remind date/time modal */}
      <Modal
        visible={remindModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRemindModalOpen(false)}
      >
        <View style={styles.remindOverlay}>
          <View style={styles.remindSheet}>
            <Text style={styles.remindTitle}>Set Reminder</Text>
            <Text style={styles.remindTaskName} numberOfLines={2}>{task.title}</Text>
            <View style={styles.remindFields}>
              <View style={styles.remindField}>
                <Text style={styles.remindFieldLabel}>DATE</Text>
                <TextInput
                  style={styles.remindInput}
                  value={remindDate}
                  onChangeText={setRemindDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={AppColors.gray400}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.remindField}>
                <Text style={styles.remindFieldLabel}>TIME</Text>
                <TextInput
                  style={styles.remindInput}
                  value={remindTime}
                  onChangeText={setRemindTime}
                  placeholder="HH:MM"
                  placeholderTextColor={AppColors.gray400}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            <View style={styles.remindActions}>
              <TouchableOpacity style={styles.remindCancelBtn} onPress={() => setRemindModalOpen(false)} activeOpacity={0.7}>
                <Text style={styles.remindCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.remindConfirmBtn} onPress={handleConfirmRemind} activeOpacity={0.8}>
                <Ionicons name="alarm-outline" size={14} color={AppColors.textPrimary} />
                <Text style={styles.remindConfirmText}>Set Reminder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={taskMenuOpen}
        transparent
        animationType="none"
        onRequestClose={() => setTaskMenuOpen(false)}
      >
        <TouchableOpacity style={styles.taskMenuOverlay} activeOpacity={1} onPress={() => setTaskMenuOpen(false)}>
          <View style={[styles.taskMenuDropdown, { top: taskMenuPos.y, right: undefined, left: Math.max(taskMenuPos.x - 100, 8) }]}>
            {!isEditingTitle && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setTaskMenuOpen(false); handleStartTitleEdit(); }} activeOpacity={0.7}>
                <MaterialIcons name="edit" size={15} color={AppColors.textPrimary} />
                <Text style={styles.menuItemText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => { setTaskMenuOpen(false); handleDropTask(); }} activeOpacity={0.7}>
              <MaterialIcons name="block" size={15} color={AppColors.gray400} />
              <Text style={styles.menuItemText}>Drop</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setTaskMenuOpen(false); openRemindModal(); }} activeOpacity={0.7}>
              <Ionicons name="alarm-outline" size={15} color={AppColors.textPrimary} />
              <Text style={styles.menuItemText}>Remind</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={() => { setTaskMenuOpen(false); handleDeleteTask(); }} activeOpacity={0.7}>
              <MaterialIcons name="delete-outline" size={15} color={AppColors.red600} />
              <Text style={[styles.menuItemText, styles.menuItemDangerText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Expanded section */}
      <View style={styles.expandedSection}>
        {/* Forked-from parent indicator */}
        {task.forkedFromTaskId && (
          <TouchableOpacity
            style={styles.parentIndicator}
            onPress={() => onNavigateToParent?.(task.forkedFromTaskId!)}
            activeOpacity={0.7}
          >
            <Ionicons name="git-branch-outline" size={14} color={AppColors.primarySolid} />
            <Text style={styles.parentIndicatorText}>
              Forked from: {task.forkedFromTaskTitle || "Parent Task"}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={AppColors.gray400} />
          </TouchableOpacity>
        )}
        {/* Title edit confirmation actions */}
        {isEditingTitle && (
          <View style={styles.titleEditActions}>
            <TouchableOpacity
              style={styles.titleSaveButton}
              onPress={handleSaveTitleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={14} color={AppColors.white} />
              <Text style={styles.titleSaveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.titleCancelButton}
              onPress={handleCancelTitleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={14} color={AppColors.textSecondary} />
              <Text style={styles.titleCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delay Thread */}
        {task.delays.length > 0 && (
          <View style={styles.threadWrapper}>
            <Text style={styles.threadTitle}>Delay History</Text>
            <View>
            {task.delays.map((delay, index) => (
              <View key={delay.id} style={[styles.threadEntry, { zIndex: task.delays.length - index }]}>
                {/* Thread line connector */}
                <View style={styles.threadLineColumn}>
                  <View style={styles.threadDot} />
                  {index < task.delays.length - 1 && (
                    <View style={styles.threadLine} />
                  )}
                </View>

                {/* Delay content */}
                <View style={styles.threadContent}>
                  <View style={styles.threadDateRow}>
                    <Text style={styles.threadDate}>{delay.date}</Text>
                    {delay.forkedTaskId && (
                      <TouchableOpacity
                        style={styles.forkedBadge}
                        activeOpacity={0.7}
                        onPress={() => onNavigateToParent?.(delay.forkedTaskId!)}
                      >
                        <Ionicons name="git-branch-outline" size={10} color="#22C55E" />
                        <Text style={styles.forkedBadgeText}>Forked as task</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {editingDelayId === delay.id ? (
                    /* Edit mode */
                    <View style={styles.delayCardEditing}>
                      <TextInput
                        ref={editInputRef}
                        style={styles.delayEditInput}
                        value={editingDelayText}
                        onChangeText={setEditingDelayText}
                        autoFocus
                        multiline
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={handleSaveEdit}
                      />
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={styles.editSaveButton}
                          onPress={handleSaveEdit}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="checkmark" size={14} color={AppColors.white} />
                          <Text style={styles.editSaveText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editCancelButton}
                          onPress={handleCancelEdit}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={14} color={AppColors.textSecondary} />
                          <Text style={styles.editCancelText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* View mode */
                    <View style={styles.delayCard}>
                      <View style={styles.delayCardContent}>
                        {delay.attachmentUri && (
                          Platform.OS === "web" ? (
                            <div
                              style={{ width: 40, height: 40, borderRadius: 6, overflow: "hidden", cursor: "pointer", flexShrink: 0 }}
                              onClick={() => openImageViewer(delay.attachmentUri!)}
                            >
                              <WebThumb urlOrKey={delay.attachmentUri} fetchBlobUrl={fetchBlobUrl} />
                            </div>
                          ) : (
                            <TouchableOpacity
                              style={styles.attachmentThumb}
                              onPress={() => openImageViewer(delay.attachmentUri!)}
                              activeOpacity={0.8}
                            >
                              <Image
                                source={{ uri: getProxyUrl(delay.attachmentUri), headers: { "X-TE-Token": authToken ?? "" } }}
                                style={styles.attachmentImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          )
                        )}
                        <TouchableOpacity
                          style={styles.delayReasonContainer}
                          onPress={() => handleStartEdit(delay)}
                          activeOpacity={0.6}
                        >
                          <LinkText text={delay.reason} style={styles.delayReasonText} />
                        </TouchableOpacity>
                      </View>
                      {/* Three-dot menu — pinned to top-right */}
                      <View style={styles.menuWrapper}>
                        <TouchableOpacity
                          style={styles.menuDotButton}
                          onPress={() => setMenuOpenDelayId(menuOpenDelayId === delay.id ? null : delay.id)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Entypo name="dots-three-vertical" size={14} color={AppColors.textSecondary} />
                        </TouchableOpacity>
                        {menuOpenDelayId === delay.id && (
                          <View style={styles.menuDropdown}>
                            {!delay.forkedTaskId && (
                              <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                  setMenuOpenDelayId(null);
                                  onForkDelay?.(delay.id, delay.reason);
                                }}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="git-branch-outline" size={14} color={AppColors.primarySolid} />
                                <Text style={styles.menuItemText}>Fork as task</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={[styles.menuItem, styles.menuItemDanger]}
                              onPress={() => {
                                setMenuOpenDelayId(null);
                                handleDeleteDelay(delay.id);
                              }}
                              activeOpacity={0.7}
                            >
                              <MaterialIcons name="delete-outline" size={14} color={AppColors.red500} />
                              <Text style={[styles.menuItemText, styles.menuItemDangerText]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
            </View>
          </View>
        )}

        {/* New Delay Action */}
        <View style={styles.delayBlock}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>New Delay Action</Text>
            <Text style={styles.labelDate}>
              {new Date().toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              ref={delayInputRef}
              style={styles.input}
              placeholder="Reason for delay"
              placeholderTextColor={AppColors.gray400}
              value={delayReason}
              onChangeText={setDelayReason}
              onFocus={() => onDelayFocus?.()}
            />
            <TouchableOpacity style={styles.attachButton} onPress={handlePickAttachment} activeOpacity={0.7}>
              {uploading
                ? <ActivityIndicator size={16} color={AppColors.gray400} />
                : <Entypo name="attachment" size={18} color={uploadedUrl ? AppColors.primarySolid : AppColors.gray400} />
              }
            </TouchableOpacity>
          </View>
          {attachmentUri && (
            <View style={styles.attachPreviewRow}>
              <Image source={{ uri: attachmentUri }} style={styles.attachPreviewImage} />
              {uploading && (
                <View style={styles.attachUploadingOverlay}>
                  <ActivityIndicator size="small" color={AppColors.white} />
                </View>
              )}
              <TouchableOpacity style={styles.attachClearBtn} onPress={handleClearAttachment} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={20} color={AppColors.gray400} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Save delay button — only visible when there's input */}
        {hasDelayInput && (
          <TouchableOpacity style={styles.saveDelayButton} onPress={handleSave} activeOpacity={0.8}>
            <Ionicons name="save-outline" size={14} color={AppColors.white} />
            <Text style={styles.saveDelayButtonText}>Save Delay</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppColors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AppColors.primarySolid,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
  },
  content: {
    flex: 1,
    marginLeft: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  date: {
    fontSize: 10,
    color: AppColors.gray400,
  },
  dueDatePill: {
    backgroundColor: AppColors.primarySolid,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dueDateText: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    backgroundColor: "rgba(249,250,251,0.5)",
    padding: 16,
    gap: 16,
  },
  // --- Thread styles ---
  threadWrapper: {
    gap: 0,
    zIndex: 10,
  },
  threadTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  threadEntry: {
    flexDirection: "row",
    minHeight: 48,
  },
  threadLineColumn: {
    width: 20,
    alignItems: "center",
  },
  threadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.primarySolid,
    marginTop: 4,
  },
  threadLine: {
    width: 2,
    flex: 1,
    backgroundColor: AppColors.gray200,
    marginTop: 4,
  },
  threadContent: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 16,
  },
  threadDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  threadDate: {
    fontSize: 10,
    color: AppColors.gray400,
  },
  delayCard: {
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  delayCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  delayCardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  menuWrapper: {
    alignItems: "flex-end",
    zIndex: 10,
  },
  attachmentThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: AppColors.gray100,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  attachmentImage: {
    width: "100%",
    height: "100%",
    opacity: 0.8,
  },
  delayReasonContainer: {
    flex: 1,
    flexShrink: 1,
  },
  delayReasonText: {
    fontSize: 13,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  // --- Input & buttons ---
  delayBlock: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  labelDate: {
    fontSize: 10,
    color: AppColors.gray400,
  },
  inputContainer: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 44,
    fontSize: 14,
    color: AppColors.textPrimary,
  },
  attachButton: {
    position: "absolute",
    right: 12,
    padding: 4,
  },
  attachIcon: {
    fontSize: 18,
  },
  attachPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  attachPreviewImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: AppColors.gray100,
  },
  attachUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  attachClearBtn: {
    marginLeft: 8,
    padding: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
  },
  delayButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: AppColors.primarySolid,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: "#22C55E",
  },
  delayButtonIcon: {
    fontSize: 14,
  },
  delayButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textPrimary,
  },
  saveButtonText: {
    color: AppColors.white,
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: AppColors.red50,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.red100,
  },
  deleteButtonIcon: {
    fontSize: 14,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.red600,
  },
  // --- Delay edit & delete styles ---
  delayCardEditing: {
    backgroundColor: AppColors.white,
    borderWidth: 2,
    borderColor: AppColors.primarySolid,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  delayEditInput: {
    fontSize: 13,
    fontWeight: "500",
    color: AppColors.textPrimary,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 36,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  editSaveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editSaveText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.white,
  },
  editCancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editCancelText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  delayDeleteButton: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: AppColors.red50,
  },
  forkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: AppColors.gray100,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  forkButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: AppColors.primarySolid,
  },
  menuDotButton: {
    padding: 6,
    borderRadius: 6,
  },
  menuDropdown: {
    position: "absolute",
    right: 0,
    top: 30,
    backgroundColor: AppColors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 99,
    minWidth: 140,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  menuItemDangerText: {
    color: AppColors.red500,
  },
  forkedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 4,
  },
  forkedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#22C55E",
  },
  parentIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AppColors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  parentIndicatorText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  // ── Title editing ──
  editTitleInput: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.primarySolid,
    paddingVertical: 4,
  },
  titleEditActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  titleSaveButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  titleSaveText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.white,
  },
  titleCancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.gray100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  titleCancelText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  // ── Task-level three-dot menu ──
  taskMenuDot: {
    padding: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  taskMenuOverlay: {
    flex: 1,
  },
  taskMenuDropdown: {
    position: "absolute",
    backgroundColor: AppColors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 20,
    minWidth: 150,
    overflow: "hidden",
  },
  saveDelayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveDelayButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.white,
  },
  // ── Edit & Drop buttons ──
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: AppColors.gray100,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  dropButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: AppColors.gray100,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  dropButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.gray400,
  },
  // ── Remind modal ──
  remindOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  remindSheet: {
    backgroundColor: AppColors.white,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    gap: 16,
  },
  remindTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  remindTaskName: {
    fontSize: 13,
    fontWeight: "500",
    color: AppColors.textSecondary,
    backgroundColor: AppColors.gray100,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  remindFields: {
    flexDirection: "row",
    gap: 12,
  },
  remindField: {
    flex: 1,
    gap: 4,
  },
  remindFieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: AppColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  remindInput: {
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: AppColors.textPrimary,
    backgroundColor: AppColors.white,
  },
  remindActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  remindCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: AppColors.gray100,
  },
  remindCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  remindConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: AppColors.primarySolid,
  },
  remindConfirmText: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.textPrimary,
  },
  // ── Full-screen image viewer ──
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.93)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageViewerClose: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 10,
  },
  imageViewerImage: {
    width: "92%",
    height: "80%",
    borderRadius: 10,
  },
});
