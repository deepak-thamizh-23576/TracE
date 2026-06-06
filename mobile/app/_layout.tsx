import { AuthProvider } from "@/contexts/AuthContext";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { Platform } from "react-native";

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web") {
      document.title = "TracE";
    }
  }, []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false, title: "TracE" }}>
          <Stack.Screen name="login" options={{ headerShown: false, title: "TracE" }} />
          <Stack.Screen name="index" options={{ headerShown: false, title: "TracE" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
