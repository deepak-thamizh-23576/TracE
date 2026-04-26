import { AppColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Redirect } from "expo-router";
import type { Href } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, signup, user } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to home
  if (user) {
    return <Redirect href={"/" as Href} />;
  }

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    if (isSignup) {
      if (!firstName.trim()) {
        setError("First name is required");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
    }

    setLoading(true);
    try {
      let err: string | null;
      if (isSignup) {
        err = await signup(email.trim(), password, firstName.trim(), lastName.trim());
      } else {
        err = await login(email.trim(), password);
      }
      if (err) {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup((prev) => !prev);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo & branding */}
        <View style={styles.brandingContainer}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>TracE</Text>
          <Text style={styles.tagline}>Track Everything, Every Day</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isSignup ? "Create Account" : "Welcome Back"}
          </Text>

          {isSignup && (
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Deepak"
                  placeholderTextColor={AppColors.gray400}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.nameField}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="T"
                  placeholderTextColor={AppColors.gray400}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={AppColors.gray400}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={AppColors.gray400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
          />

          {isSignup && (
            <>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={AppColors.gray400}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="new-password"
              />
            </>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={AppColors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>
                {isSignup ? "Sign Up" : "Log In"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Toggle login/signup */}
        <TouchableOpacity onPress={toggleMode} style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            {isSignup
              ? "Already have an account? "
              : "Don't have an account? "}
            <Text style={styles.toggleLink}>
              {isSignup ? "Log In" : "Sign Up"}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  brandingContainer: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 12,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: AppColors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: AppColors.gray50,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: AppColors.gray200,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: AppColors.textPrimary,
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: AppColors.gray200,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: AppColors.textPrimary,
  },
  errorContainer: {
    backgroundColor: AppColors.red50,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: AppColors.red100,
  },
  errorText: {
    color: AppColors.red600,
    fontSize: 13,
    fontWeight: "500",
  },
  button: {
    backgroundColor: AppColors.primarySolid,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
  toggleContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  toggleText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  toggleLink: {
    fontWeight: "700",
    color: AppColors.textPrimary,
  },
});
