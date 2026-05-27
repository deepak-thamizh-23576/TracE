import { AppColors } from "@/constants/colors";
import { DelayEntry, Goal } from "@/constants/tasks";
import { Entypo, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import LinkText from "./LinkText";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import PriorityDot from "./PriorityDot";

interface ExpandedGoalCardProps {
  goal: Goal;
  authToken?: string;
  onComplete?: () => void;
  onCollapse?: () => void;
  onDelete?: () => void;
  onEdit?: (newTitle: string) => void;
  onSaveDelay?: (reason: string, attachmentLink?: string) => void;
  onEditDelay?: (delayId: string, newReason: string) => void;
  onDeleteDelay?: (delayId: string) => void;
}

const API_BASE = "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function";

export default function ExpandedGoalCard({
  goal,
  authToken,
  onComplete,
  onCollapse,
  onDelete,
  onEdit,
  onSaveDelay,
  onEditDelay,
  onDeleteDelay,
}: ExpandedGoalCardProps) {
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleText, setEditTitleText] = useState(goal.title);
  const editTitleRef = useRef<TextInput>(null);

  // New delay input state
  const [delayReason, setDelayReason] = useState("");
  const hasDelayInput = delayReason.trim().length > 0;

  // Attachment state
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Delay history editing state
  const [editingDelayId, setEditingDelayId] = useState<string | null>(null);
  const [editingDelayText, setEditingDelayText] = useState("");
  const editDelayRef = useRef<TextInput>(null);

  // ── Goal three-dot menu ──
  const [goalMenuOpen, setGoalMenuOpen] = useState(false);
  const [goalMenuPos, setGoalMenuPos] = useState({ x: 0, y: 0 });
  const goalMenuBtnRef = useRef<TouchableOpacity>(null);

  const openGoalMenu = () => {
    goalMenuBtnRef.current?.measure((_fx, _fy, _w, _h, px, py) => {
      setGoalMenuPos({ x: px, y: py + _h + 4 });
      setGoalMenuOpen(true);
    });
  };

  // ── Title edit handlers ──

  const handleStartTitleEdit = () => {
    setIsEditingTitle(true);
    setEditTitleText(goal.title);
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
    setEditTitleText(goal.title);
    Keyboard.dismiss();
  };

  // ── Delete goal handler ──

  const handleDeleteGoal = () => {
    Alert.alert(
      "Delete Goal",
      `Are you sure you want to delete "${goal.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
      ]
    );
  };

  // ── Delay handlers ──

  const handlePickAttachment = async () => {
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
        formData.append("file", { uri: asset.uri, name: fileName, type: asset.mimeType ?? "image/jpeg" } as any);

        const res = await fetch(`${API_BASE}/uploadAttachment`, {
          method: "POST",
          headers: { "X-TE-Token": authToken ?? "" },
          body: formData,
        });
        const json = await res.json();
        if (json.url) {
          setUploadedUrl(json.url);
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
  };

  const handleSaveDelay = () => {
    if (hasDelayInput && onSaveDelay) {
      onSaveDelay(delayReason.trim(), uploadedUrl ?? undefined);
      setDelayReason("");
      setAttachmentUri(null);
      setUploadedUrl(null);
      Keyboard.dismiss();
    }
  };

  const handleStartDelayEdit = (delay: DelayEntry) => {
    setEditingDelayId(delay.id);
    setEditingDelayText(delay.reason);
    setTimeout(() => editDelayRef.current?.focus(), 100);
  };

  const handleSaveDelayEdit = () => {
    if (editingDelayId && editingDelayText.trim() && onEditDelay) {
      onEditDelay(editingDelayId, editingDelayText.trim());
    }
    setEditingDelayId(null);
    setEditingDelayText("");
    Keyboard.dismiss();
  };

  const handleCancelDelayEdit = () => {
    setEditingDelayId(null);
    setEditingDelayText("");
    Keyboard.dismiss();
  };

  const handleDeleteDelay = (delayId: string) => {
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
  };

  return (
    <View style={styles.container}>
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
              <Text style={styles.title}>{goal.title}</Text>
              <Text style={styles.date}>{goal.date}</Text>
            </>
          )}
        </View>
        <PriorityDot priority={goal.priority} />
        {/* Three-dot goal menu */}
        <TouchableOpacity
          ref={goalMenuBtnRef}
          style={styles.goalMenuDot}
          onPress={openGoalMenu}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Entypo name="dots-three-vertical" size={16} color={AppColors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Goal menu Modal */}
      <Modal
        visible={goalMenuOpen}
        transparent
        animationType="none"
        onRequestClose={() => setGoalMenuOpen(false)}
      >
        <TouchableOpacity style={styles.goalMenuOverlay} activeOpacity={1} onPress={() => setGoalMenuOpen(false)}>
          <View style={[styles.goalMenuDropdown, { top: goalMenuPos.y, left: Math.max(goalMenuPos.x - 100, 8) }]}>
            {!isEditingTitle && (
              <TouchableOpacity style={styles.menuItem} onPress={() => { setGoalMenuOpen(false); handleStartTitleEdit(); }} activeOpacity={0.7}>
                <MaterialIcons name="edit" size={15} color={AppColors.textPrimary} />
                <Text style={styles.menuItemText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={() => { setGoalMenuOpen(false); handleDeleteGoal(); }} activeOpacity={0.7}>
              <MaterialIcons name="delete-outline" size={15} color={AppColors.red600} />
              <Text style={[styles.menuItemText, styles.menuItemDangerText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Expanded section */}
      <View style={styles.expandedSection}>
        {/* Title edit actions (shown when editing title) */}
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
        {goal.delays.length > 0 && (
          <View style={styles.threadContainer}>
            <Text style={styles.threadTitle}>Delay History</Text>
            {goal.delays.map((delay, index) => (
              <View key={delay.id} style={styles.threadEntry}>
                {/* Thread line connector */}
                <View style={styles.threadLineColumn}>
                  <View style={styles.threadDot} />
                  {index < goal.delays.length - 1 && (
                    <View style={styles.threadLine} />
                  )}
                </View>

                {/* Delay content */}
                <View style={styles.threadContent}>
                  <Text style={styles.threadDate}>{delay.date}</Text>
                  {editingDelayId === delay.id ? (
                    /* Edit mode */
                    <View style={styles.delayCardEditing}>
                      <TextInput
                        ref={editDelayRef}
                        style={styles.delayEditInput}
                        value={editingDelayText}
                        onChangeText={setEditingDelayText}
                        autoFocus
                        multiline
                        returnKeyType="done"
                        blurOnSubmit
                        onSubmitEditing={handleSaveDelayEdit}
                      />
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={styles.editSaveButton}
                          onPress={handleSaveDelayEdit}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="checkmark" size={14} color={AppColors.white} />
                          <Text style={styles.editSaveText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editCancelButton}
                          onPress={handleCancelDelayEdit}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close" size={14} color={AppColors.textSecondary} />
                          <Text style={styles.editCancelText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* View mode */
                    <TouchableOpacity
                      style={styles.delayCard}
                      onPress={() => handleStartDelayEdit(delay)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.delayCardContent}>
                        {delay.attachmentUri && (
                          <View style={styles.attachmentThumb}>
                            <Image
                              source={{ uri: delay.attachmentUri }}
                              style={styles.attachmentImage}
                              resizeMode="cover"
                            />
                          </View>
                        )}
                        <View style={styles.delayReasonContainer}>
                          <LinkText text={delay.reason} style={styles.delayReasonText} />
                        </View>
                        <TouchableOpacity
                          style={styles.delayDeleteButton}
                          onPress={() => handleDeleteDelay(delay.id)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialIcons name="delete-outline" size={16} color={AppColors.red500} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
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
              style={styles.input}
              placeholder="Reason for delay"
              placeholderTextColor={AppColors.gray400}
              value={delayReason}
              onChangeText={setDelayReason}
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

        {/* Save Delay button — only shown when delay text is entered */}
        {hasDelayInput && (
          <TouchableOpacity
            style={styles.saveDelayButton}
            onPress={handleSaveDelay}
            activeOpacity={0.8}
          >
            <Ionicons name="save-outline" size={16} color={AppColors.white} />
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
  date: {
    fontSize: 10,
    color: AppColors.gray400,
    marginTop: 2,
  },
  editTitleInput: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.primarySolid,
    paddingVertical: 4,
  },
  expandedSection: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
    backgroundColor: "rgba(249,250,251,0.5)",
    padding: 16,
    gap: 16,
  },
  // ── Title edit actions ──
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
  // ── Thread styles ──
  threadContainer: {
    gap: 0,
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
  threadDate: {
    fontSize: 10,
    color: AppColors.gray400,
    marginBottom: 6,
  },
  delayCard: {
    backgroundColor: AppColors.white,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 8,
    padding: 12,
  },
  delayCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
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
  // ── Delay edit & delete ──
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
  // ── New delay input ──
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
  // ── Three-dot goal menu ──
  goalMenuDot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  goalMenuOverlay: {
    flex: 1,
  },
  goalMenuDropdown: {
    position: "absolute",
    backgroundColor: AppColors.white,
    borderRadius: 10,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: AppColors.gray100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: AppColors.gray100,
  },
  menuItemDangerText: {
    color: AppColors.red600,
  },
  // ── Save delay button ──
  saveDelayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    borderRadius: 8,
  },
  saveDelayButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.white,
  },
  attachPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  attachPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: AppColors.gray100,
  },
  attachUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  attachClearBtn: {
    padding: 4,
  },
});
