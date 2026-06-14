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

// Mirrors the same URL logic as AuthContext so forgot/reset always hits the right environment
const PROD_BASE = "https://trackeverythingte-904503171.catalystserverless.com/server/track_everything_te_function";
const DEV_BASE  = "https://trackeverythingte-904503171.development.catalystserverless.com/server/track_everything_te_function";
const AUTH_API = __DEV__ ? (Platform.OS === "web" ? `http://localhost:3000/server/track_everything_te_function` : DEV_BASE) : PROD_BASE;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, signup, user } = useAuth();

  // mode: "login" | "signup" | "forgot" | "reset"
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">("login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

    if (mode === "signup") {
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
      if (mode === "signup") {
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

  const handleForgot = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSuccess("If that email is registered, a 6-digit code has been sent. Check your inbox.");
      setMode("reset");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !resetCode.trim() || !password.trim()) {
      setError("Email, code, and new password are required");
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
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: resetCode.trim(), newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setSuccess("Password reset! You can now log in with your new password.");
      setPassword("");
      setConfirmPassword("");
      setResetCode("");
      setMode("login");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goToMode = (next: "login" | "signup" | "forgot" | "reset") => {
    setMode(next);
    setError(null);
    setSuccess(null);
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
            {mode === "signup" ? "Create Account" : mode === "forgot" ? "Forgot Password" : mode === "reset" ? "Reset Password" : "Welcome Back"}
          </Text>

          {mode === "signup" && (
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

          {(mode === "login" || mode === "signup") && (
            <>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={AppColors.gray400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </>
          )}

          {mode === "login" && (
            <TouchableOpacity onPress={() => goToMode("forgot")} style={styles.forgotContainer}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {mode === "reset" && (
            <>
              <Text style={styles.label}>6-Digit Code</Text>
              <TextInput
                style={styles.input}
                placeholder="123456"
                placeholderTextColor={AppColors.gray400}
                value={resetCode}
                onChangeText={setResetCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={AppColors.gray400}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
              />
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={AppColors.gray400}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
              />
            </>
          )}

          {mode === "signup" && (
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

          {success && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={mode === "forgot" ? handleForgot : mode === "reset" ? handleReset : handleSubmit}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={AppColors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "signup" ? "Sign Up" : mode === "forgot" ? "Send Code" : mode === "reset" ? "Reset Password" : "Log In"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Toggle login/signup/forgot */}
        {(mode === "login" || mode === "signup") && (
          <TouchableOpacity onPress={() => goToMode(mode === "signup" ? "login" : "signup")} style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
              <Text style={styles.toggleLink}>
                {mode === "signup" ? "Log In" : "Sign Up"}
              </Text>
            </Text>
          </TouchableOpacity>
        )}

        {(mode === "forgot" || mode === "reset") && (
          <TouchableOpacity onPress={() => goToMode("login")} style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {"Back to "}
              <Text style={styles.toggleLink}>Log In</Text>
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.builtOnText}>Built on Catalyst by Zoho</Text>
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
  builtOnText: {
    textAlign: "center",
    fontSize: 11,
    color: AppColors.gray400,
    marginTop: 28,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  forgotContainer: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  successContainer: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  successText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: "500",
  },
});
