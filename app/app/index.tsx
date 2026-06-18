import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../src/lib/auth";
import { theme } from "../src/theme";

export default function Index() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={user ? "/(app)" : "/(auth)/sign-in"} />;
}
