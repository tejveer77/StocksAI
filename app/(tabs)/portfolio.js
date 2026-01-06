// app/(tabs)/portfolio.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../AuthContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function PortfolioScreen() {
  const { user, initializing } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setData(snap.data());
      } else {
        setData({
          balance: 100000,
          portfolio: [],
          trades: [],
        });
      }
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (initializing) return null;
  if (!user) return <Redirect href="/login" />;

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const portfolio = Array.isArray(data.portfolio) ? data.portfolio : [];
  const trades = Array.isArray(data.trades) ? data.trades : [];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Portfolio</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Cash Balance</Text>
        <Text style={styles.balance}>
          ${data.balance.toFixed(2)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Holdings</Text>

      {portfolio.length === 0 ? (
        <Text style={styles.emptyText}>
          You don't own any stocks yet. Go to Search/Explore and
          BUY something.
        </Text>
      ) : (
        portfolio.map((p, index) => (
          <View key={index} style={styles.holdingRow}>
            <View>
              <Text style={styles.holdingSymbol}>
                {p.symbol}
              </Text>
              <Text style={styles.holdingDetail}>
                {p.qty} shares @ ${p.avgPrice.toFixed(2)}
              </Text>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Trade History</Text>

      {trades.length === 0 ? (
        <Text style={styles.emptyText}>
          No trades yet. Start trading from a stock detail page.
        </Text>
      ) : (
        trades
          .slice()
          .reverse()
          .map((t, index) => (
            <View key={index} style={styles.tradeRow}>
              <Text
                style={[
                  styles.tradeType,
                  t.type === "BUY"
                    ? styles.buyText
                    : styles.sellText,
                ]}
              >
                {t.type}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tradeMain}>
                  {t.qty} {t.symbol} @ ${t.price.toFixed(2)}
                </Text>
                <Text style={styles.tradeTime}>
                  {new Date(t.timestamp).toLocaleString()}
                </Text>
              </View>
            </View>
          ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16,
  },
  center: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#f9fafb",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 20,
  },
  label: {
    color: "#9ca3af",
    fontSize: 13,
  },
  balance: {
    color: "#bbf7d0",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 6,
  },
  sectionTitle: {
    color: "#e5e7eb",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 8,
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 12,
  },
  holdingRow: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  holdingSymbol: {
    color: "#f9fafb",
    fontSize: 18,
    fontWeight: "600",
  },
  holdingDetail: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#020617",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 8,
    gap: 10,
  },
  tradeType: {
    fontWeight: "700",
    fontSize: 14,
    width: 46,
  },
  buyText: {
    color: "#22c55e",
  },
  sellText: {
    color: "#ef4444",
  },
  tradeMain: {
    color: "#e5e7eb",
    fontSize: 14,
  },
  tradeTime: {
    color: "#6b7280",
    fontSize: 11,
    marginTop: 2,
  },
});
