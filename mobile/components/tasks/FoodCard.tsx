import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Keyboard } from "react-native";
import { AppColors } from "@/constants/colors";
import { FoodItem } from "@/constants/tasks";
import { Entypo, Ionicons, MaterialIcons } from "@expo/vector-icons";

interface FoodCardProps {
  item: FoodItem;
  onEdit?: (newTitle: string) => void;
  onDelete?: () => void;
}

/**
 * Parses a trailing quantity from a food title.
 * Examples:
 *   "rice 1 bowl"  → { name: "rice", qty: "1 bowl" }
 *   "dosa 2"       → { name: "dosa", qty: "2" }
 *   "idly 3"       → { name: "idly", qty: "3" }
 *   "morning tea"  → { name: "morning tea", qty: null }
 */
function parseQty(title: string): { name: string; qty: string | null } {
  // Match: everything before, then a space, then a number optionally followed by a unit word
  const match = title.match(/^(.*?)\s+(\d+(?:\s+[a-zA-Z]+)?)$/);
  if (match) {
    return { name: match[1].trim(), qty: match[2].trim() };
  }
  return { name: title, qty: null };
}

export default function FoodCard({ item, onEdit, onDelete }: FoodCardProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.title);
  const editInputRef = useRef<TextInput>(null);

  const { name, qty } = parseQty(item.title);

  const handleEdit = () => {
    setMenuVisible(false);
    setIsEditing(true);
    setEditText(item.title);
    setTimeout(() => editInputRef.current?.focus(), 100);
  };

  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(editText.trim());
    }
    setIsEditing(false);
    Keyboard.dismiss();
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(item.title);
    Keyboard.dismiss();
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert("Delete Food Item", `Delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
    ]);
  };

  return (
    <View style={[styles.container, menuVisible && styles.containerActive]}>
      <View style={styles.content}>
        {isEditing ? (
          <View>
            <TextInput
              ref={editInputRef}
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              autoFocus
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={handleSaveEdit}
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} activeOpacity={0.7}>
                <Ionicons name="checkmark" size={14} color={AppColors.white} />
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelEdit} activeOpacity={0.7}>
                <Ionicons name="close" size={14} color={AppColors.textSecondary} />
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{name}</Text>
              {qty && (
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>{qty}</Text>
                </View>
              )}
            </View>
            <Text style={styles.date}>{item.date}</Text>
          </>
        )}
      </View>

      {/* 3-dot menu */}
      {!isEditing && (onEdit || onDelete) && (
        <View style={styles.menuWrapper}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(!menuVisible)}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Entypo name="dots-three-vertical" size={16} color={AppColors.gray400} />
          </TouchableOpacity>

          {menuVisible && (
            <View style={styles.menuDropdown}>
              {onEdit && (
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit} activeOpacity={0.7}>
                  <MaterialIcons name="edit" size={16} color={AppColors.textSecondary} />
                  <Text style={styles.menuItemText}>Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity style={styles.menuItem} onPress={handleDelete} activeOpacity={0.7}>
                  <MaterialIcons name="delete-outline" size={16} color={AppColors.red500} />
                  <Text style={[styles.menuItemText, { color: AppColors.red500 }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: AppColors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.gray100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  containerActive: {
    zIndex: 999,
    elevation: 999,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
  },
  qtyBadge: {
    backgroundColor: AppColors.primarySolid,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  qtyText: {
    fontSize: 12,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  date: {
    fontSize: 10,
    color: AppColors.gray400,
    marginTop: 2,
  },
  editInput: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.primarySolid,
    paddingVertical: 4,
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.primarySolid,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.white,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  menuButton: {
    padding: 4,
  },
  menuWrapper: {
    zIndex: 999,
  },
  menuDropdown: {
    position: "absolute",
    right: 0,
    top: 28,
    backgroundColor: AppColors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 999,
    zIndex: 999,
    minWidth: 120,
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
});
