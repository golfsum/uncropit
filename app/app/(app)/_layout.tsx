import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth";
import { useEntitlement } from "../../src/lib/entitlements";
import { theme } from "../../src/theme";

export default function AppLayout() {
  const { user, initializing } = useAuth();
  const { status } = useEntitlement();
  if (!initializing && !user) return <Redirect href="/(auth)/sign-in" />;
  // After the 3-day trial, require login + a Pro subscription to continue.
  if (status === "trialExpired") return <Redirect href="/paywall" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTitleStyle: { color: theme.text, fontWeight: "800" },
        headerShadowVisible: false,
        // Fill the scene behind every tab with the dark bg (no white flashes/gaps).
        sceneStyle: { backgroundColor: theme.bg },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textDim,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Uncrop",
          // Screen renders its own ScreenHeader, so hide the native header.
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="expand" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="resize"
        options={{
          title: "Resize",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="crop-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      {/* Support is reached from the Account tab, not the tab bar. */}
      <Tabs.Screen name="support" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
