import { AuthProvider } from "@/contexts/AuthContext";
import { Entypo, Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  // Web fonts are declared via @font-face CSS in +html.tsx — no dynamic loading needed.
  // useFonts is only needed on native (iOS/Android).
  useFonts(
    Platform.OS === "web"
      ? {}
      : {
          ...Ionicons.font,
          ...MaterialIcons.font,
          ...Entypo.font,
          ...Feather.font,
        }
  );

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
