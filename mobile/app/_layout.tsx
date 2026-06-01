import { AuthProvider } from "@/contexts/AuthContext";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
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
