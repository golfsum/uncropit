import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/lib/auth";
import { theme } from "../../src/theme";

export default function AppLayout() {
  const { user, initializing } = useAuth();
  if (!initializing && !user) return <Redirect href="/(auth)/sign-in" />;

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
        name="support"
        options={{
          title: "Support",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
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
