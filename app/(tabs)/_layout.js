import React from "react";
import { Tabs } from "expo-router";
import { Redirect } from "expo-router";
import { useAuth } from "../../AuthContext";

export default function TabsLayout() {
  const { user, initializing } = useAuth();

  if (initializing) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#020617" },
        headerTintColor: "#fff",
        tabBarStyle: { backgroundColor: "#020617", borderTopColor: "#111827" },
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#6b7280",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />
     
      <Tabs.Screen
        name="portfolio"
        options={{
          title: "Portfolio",
        }}
      />
      <Tabs.Screen name="news" options={{ title: "News" }} />

    </Tabs>
  );
}
