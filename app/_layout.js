// app/_layout.js
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../AuthContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth } from "../firebaseConfig";

export default function RootLayout() {

  useEffect(() => {
    // Temporary: logout on app start
    auth.signOut();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" />

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="stock/[symbol]"
            options={{ headerShown: true, title: "Stock Detail" }}
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
