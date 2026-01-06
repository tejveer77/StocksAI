// app/(tabs)/index.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../AuthContext";

import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from "../../lib/watchlist";

import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";


const FINNHUB_API_KEY = "";

// ---- Helpers ----
async function searchSymbols(query) {
  if (!query || !query.trim()) return [];
  const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(
    query.trim()
  )}&token=${FINNHUB_API_KEY}`;

  const res = await fetch(url);
  const json = await res.json();
  if (!json || !Array.isArray(json.result)) return [];

  return json.result.filter(
    (item) => item.type === "Common Stock" || item.type === "ETP"
  );
}

async function fetchQuote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  return res.json();
}

const formatCurrency = (n) => `$${n?.toFixed(2) || "0.00"}`;

export default function DashboardScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();

  // portfolio summary
  const [balance, setBalance] = useState(100000);
  const [portfolio, setPortfolio] = useState([]);
  const [portfolioValue, setPortfolioValue] = useState(0);

  // search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // watchlist
  const [watchlistSymbols, setWatchlistSymbols] = useState([]);
  const [watchlistData, setWatchlistData] = useState([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!initializing && !user) {
      router.replace("/login");
    }
  }, [initializing, user]);

  // ---- Load portfolio – clean + simple ----
  const loadPortfolio = useCallback(async () => {
    if (!user) return;

    try {
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setBalance(data.balance || 0);
        setPortfolio(Array.isArray(data.portfolio) ? data.portfolio : []);

        // calculate total value (using avg price only)
        let totalVal = 0;
        data.portfolio?.forEach((p) => {
          totalVal += (p.qty || 0) * (p.avgPrice || 0);
        });
        setPortfolioValue(totalVal);
      }
    } catch (err) {
      console.log("Portfolio load error:", err);
    }
  }, [user]);

  // ---- Load watchlist ----
  const loadWatchlist = useCallback(async () => {
    if (!user) return;

    try {
      setWatchlistLoading(true);

      const symbols = await getWatchlist(user.uid);
      setWatchlistSymbols(symbols);

      if (symbols.length === 0) {
        setWatchlistData([]);
        return;
      }

      const results = await Promise.all(
        symbols.map(async (sym) => {
          try {
            const q = await fetchQuote(sym);
            return {
              symbol: sym,
              current: q.c,
              change: q.d,
              changePct: q.dp,
            };
          } catch {
            return { symbol: sym, current: null, change: null, changePct: null };
          }
        })
      );

      setWatchlistData(results);
    } catch (e) {
      console.log("Error loading watchlist:", e);
    } finally {
      setWatchlistLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!initializing && user) {
      loadPortfolio();
      loadWatchlist();
    }
  }, [initializing, user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPortfolio();
    loadWatchlist();
  };

  // ---- SEARCH ----
  const handleSearch = async () => {
    if (!searchQuery.trim()) return setSearchResults([]);

    try {
      setSearchLoading(true);
      const results = await searchSymbols(searchQuery);
      setSearchResults(results);
    } finally {
      setSearchLoading(false);
    }
  };

  const isInWatchlist = (s) => watchlistSymbols.includes(s.toUpperCase());

  const toggleWatchlist = async (symbol) => {
    try {
      if (isInWatchlist(symbol)) {
        setWatchlistSymbols(await removeFromWatchlist(user.uid, symbol));
      } else {
        setWatchlistSymbols(await addToWatchlist(user.uid, symbol));
      }
      loadWatchlist();
    } catch (e) {
      console.log("Watchlist toggle error:", e);
    }
  };

  const goToStock = (symbol) => router.push(`/stock/${symbol}`);

  // ---- RENDER ----
  if (initializing || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Dashboard</Text>

      {/* ------- PORTFOLIO SUMMARY ------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Portfolio Summary</Text>

        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.label}>Cash Balance</Text>
            <Text style={styles.value}>{formatCurrency(balance)}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.label}>Portfolio Value</Text>
            <Text style={styles.value}>{formatCurrency(portfolioValue)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.label}>Total Account</Text>
            <Text style={styles.value}>
              {formatCurrency(balance + portfolioValue)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.label}>Total Positions</Text>
            <Text style={styles.value}>{portfolio.length}</Text>
          </View>
        </View>
      </View>

      {/* ------- SEARCH ------- */}
      <Text style={styles.subtitle}>Search for stocks or add to watchlist</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search stock (AAPL, TSLA...)"
          placeholderTextColor="#6b7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Go</Text>
        </TouchableOpacity>
      </View>

      {searchLoading && <ActivityIndicator color="#22c55e" />}

      {searchResults.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search Results</Text>

          {searchResults.map((item) => (
            <View key={item.symbol} style={styles.resultRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultSymbol}>{item.symbol}</Text>
                <Text style={styles.resultDesc}>{item.description}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.tagButton,
                  isInWatchlist(item.symbol) && styles.tagActive,
                ]}
                onPress={() => toggleWatchlist(item.symbol)}
              >
                <Text
                  style={[
                    styles.tagText,
                    isInWatchlist(item.symbol) && styles.tagTextActive,
                  ]}
                >
                  {isInWatchlist(item.symbol) ? "★" : "+"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => goToStock(item.symbol)}
              >
                <Text style={styles.viewButtonText}>Open</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ------- WATCHLIST ------- */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Watchlist</Text>

        {watchlistLoading ? (
          <ActivityIndicator color="#22c55e" />
        ) : watchlistData.length === 0 ? (
          <Text style={styles.emptyText}>No stocks added yet.</Text>
        ) : (
          watchlistData.map((item) => {
            const isUp = (item.change || 0) >= 0;
            return (
              <TouchableOpacity
                key={item.symbol}
                style={styles.watchRow}
                onPress={() => goToStock(item.symbol)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.watchSymbol}>{item.symbol}</Text>
                  <Text style={styles.watchPrice}>
                    {item.current?.toFixed(2) || "--"}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.watchChange,
                    isUp ? styles.green : styles.red,
                  ]}
                >
                  {item.change?.toFixed(2) || "--"}(
                  {item.changePct?.toFixed(2) || "--"}%)
                </Text>

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => toggleWatchlist(item.symbol)}
                >
                  <Text style={styles.removeButtonText}>×</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

/* -------- STYLES -------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#020617",
  },

  title: {
    color: "#f9fafb",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 10,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 13,
    marginBottom: 12,
  },

  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 16,
  },
  cardTitle: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  metric: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 12,
  },
  label: {
    color: "#6b7280",
    fontSize: 12,
  },
  value: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },

  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#020617",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#fff",
  },
  searchButton: {
    backgroundColor: "#22c55e",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "600",
  },

  resultRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  resultSymbol: {
    color: "#fff",
    fontWeight: "700",
  },
  resultDesc: {
    color: "#9ca3af",
    fontSize: 12,
  },

  tagButton: {
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 999,
    padding: 6,
  },
  tagActive: {
    backgroundColor: "#22c55e22",
    borderColor: "#22c55e",
  },
  tagText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  tagTextActive: {
    color: "#bbf7d0",
    fontWeight: "700",
  },

  viewButton: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  viewButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },

  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingVertical: 10,
  },
  watchSymbol: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  watchPrice: {
    color: "#e5e7eb",
  },
  watchChange: {
    width: 80,
    textAlign: "right",
    fontSize: 12,
    marginRight: 8,
  },
  green: { color: "#22c55e" },
  red: { color: "#ef4444" },

  removeButton: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
  },
  removeButtonText: {
    color: "#9ca3af",
    fontSize: 16,
    fontWeight: "900",
  },
});
