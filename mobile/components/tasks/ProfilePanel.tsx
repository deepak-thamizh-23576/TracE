import { AppColors } from "@/constants/colors";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface ProfilePanelProps {
  visible: boolean;
  firstName: string;
  lastName: string;
  email: string;
  onClose: () => void;
  onLogout: () => void;
  onOpenTravel?: () => void;
}

export default function ProfilePanel({
  visible,
  firstName,
  lastName,
  email,
  onClose,
  onLogout,
  onOpenTravel,
}: ProfilePanelProps) {
  const slideAnim = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 200,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleLogoutPress = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => {
            onClose();
            onLogout();
          },
        },
      ]
    );
  };

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: fadeAnim }]}
        pointerEvents="auto"
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[styles.panelContainer, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="auto"
      >
        <View style={[styles.panel, { paddingTop: insets.top + 24 }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          {/* Name */}
          <Text style={styles.name}>
            {firstName} {lastName}
          </Text>

          {/* Email */}
          <View style={styles.emailRow}>
            <MaterialIcons name="email" size={14} color={AppColors.textSecondary} />
            <Text style={styles.email}>{email}</Text>
          </View>

          {/* My Travels button */}
          <TouchableOpacity
            style={styles.travelsButton}
            onPress={() => { onClose(); onOpenTravel?.(); }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="map" size={18} color={AppColors.textPrimary} />
            <Text style={styles.travelsText}>My Travels</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Logout button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogoutPress}
            activeOpacity={0.8}
          >
            <MaterialIcons name="logout" size={18} color={AppColors.red500} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>

          {/* Drag indicator */}
          <View style={styles.dragIndicator} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panelContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  panel: {
    width: "100%",
    backgroundColor: AppColors.white,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 32,
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
    alignItems: "center",
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.primarySolid,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFD900",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: AppColors.textPrimary,
    letterSpacing: 1,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  email: {
    fontSize: 14,
    color: AppColors.textSecondary,
    fontWeight: "500",
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: AppColors.gray100,
    marginBottom: 20,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: AppColors.red50,
    borderWidth: 1,
    borderColor: AppColors.red100,
    width: "100%",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.red500,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.gray200,
    marginTop: 20,
  },
  travelsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: AppColors.gray100,
    borderWidth: 1,
    borderColor: AppColors.gray200,
    width: "100%",
    justifyContent: "center",
    marginBottom: 12,
  },
  travelsText: {
    fontSize: 15,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
});
