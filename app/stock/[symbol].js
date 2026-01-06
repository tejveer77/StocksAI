// app/stock/[symbol].js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, Redirect } from "expo-router";
import { useAuth } from "../../AuthContext";

import { LineChart } from "react-native-chart-kit";
const screenWidth = Dimensions.get("window").width;

import { buyStock, sellStock } from "../../lib/trading";
import { aiPredict } from "../../lib/ai";

const FINNHUB_API_KEY = "d4j86ppr01queualugtgd4j86ppr01queualugu0";
const POLYGON_API_KEY = "Bx_MEHIITa5XcetME0JJ8OLGlMiUTutW";

const daysForTimeframe = (tf) => {
  switch (tf) {
    case "1D": return 2;
    case "1W": return 7;
    case "1M": return 30;
    case "6M": return 180;
    case "1Y":
    default: return 365;
  }
};

const formatBigNumber = (n) => {
  if (!n && n !== 0) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toString();
};

const fetchPolygonDailySeries = async (ticker) => {
  try {
    const today = new Date();
    const toStr = today.toISOString().slice(0, 10);

    const fromDate = new Date(today.getTime() - 365 * 86400000);
    const fromStr = fromDate.toISOString().slice(0, 10);

    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=50000&market=stocks&apiKey=${POLYGON_API_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    if (!json.results) return [];

    return json.results.map((r) => ({
      x: new Date(r.t),
      y: r.c,
    }));
  } catch {
    return [];
  }
};

export default function StockDetailScreen() {
  const { user, initializing } = useAuth();
  const params = useLocalSearchParams();

  let ticker = Array.isArray(params.symbol) ? params.symbol[0] : params.symbol;
  ticker = ticker?.toUpperCase();

  const [timeframe, setTimeframe] = useState("1M");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [quote, setQuote] = useState(null);
  const [history, setHistory] = useState([]);
  const [fundamentals, setFundamentals] = useState(null);

  
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);


  const [showTradeModal, setShowTradeModal] = useState(false);
  const [tradeType, setTradeType] = useState("BUY");
  const [tradeQty, setTradeQty] = useState("");

  if (initializing) return null;
  if (!user) return <Redirect href="/login" />;

 
  const fetchQuoteAndChart = useCallback(async () => {
    try {
      setLoading(true);

      const q = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
      ).then((r) => r.json());

      if (q?.c) {
        setQuote({
          current: q.c,
          open: q.o,
          high: q.h,
          low: q.l,
          prevClose: q.pc,
          change: q.d,
          changePct: q.dp,
        });
      }

      const ohlc = await fetchPolygonDailySeries(ticker);
      const days = daysForTimeframe(timeframe);
      const cutoff = Date.now() - days * 86400000;

      setHistory(ohlc.filter((p) => p.x.getTime() >= cutoff));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ticker, timeframe]);

  
  const fetchFundamentals = useCallback(async () => {
    try {
      const p = await fetch(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`
      ).then((r) => r.json());

      const m = await fetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_API_KEY}`
      ).then((r) => r.json());

      const met = m.metric || {};

      setFundamentals({
        name: p.name,
        exchange: p.exchange,
        currency: p.currency,
        marketCap: p.marketCapitalization,
        peTTM: met.peTTM,
        epsTTM: met.epsTTM,
        beta: met.beta,
        weekHigh: met["52WeekHigh"],
        weekLow: met["52WeekLow"],
        dividendYield: met.dividendYieldIndicatedAnnual,
      });
    } catch {
      setFundamentals(null);
    }
  }, [ticker]);

  useEffect(() => { fetchQuoteAndChart(); }, [fetchQuoteAndChart]);
  useEffect(() => { fetchFundamentals(); }, [fetchFundamentals]);

  
  useEffect(() => {
    const runAI = async () => {
      if (!quote || !history || history.length < 5) {
        setAiData(null);
        return;
      }

      try {
        setAiLoading(true);
        const result = await aiPredict(ticker, quote, fundamentals, history);
        setAiData(result);
      } catch {
        setAiData(null);
      } finally {
        setAiLoading(false);
      }
    };

    runAI();
  }, [quote, fundamentals, history]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchQuoteAndChart();
  };

  
  const handleConfirmTrade = async () => {
    const qty = parseInt(tradeQty);
    if (!qty || qty <= 0) return Alert.alert("Invalid quantity");

    try {
      if (tradeType === "BUY") {
        await buyStock(user.uid, ticker, qty, quote.current);
      } else {
        await sellStock(user.uid, ticker, qty, quote.current);
      }
      Alert.alert("Success", `${tradeType} complete`);
      setShowTradeModal(false);
    } catch (err) {
      Alert.alert("Trade failed", err.message);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "white" }}>No data for {ticker}</Text>
      </View>
    );
  }

  const isUp = quote.change >= 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.symbol}>{ticker}</Text>
          <Text style={styles.company}>{fundamentals?.name}</Text>
          <Text style={styles.exchange}>
            {fundamentals?.exchange} {fundamentals?.currency && `• ${fundamentals.currency}`}
          </Text>

          <Text style={styles.price}>{quote.current.toFixed(2)}</Text>
          <Text style={[styles.change, isUp ? styles.green : styles.red]}>
            {quote.change?.toFixed(2)} ({quote.changePct?.toFixed(2)}%)
          </Text>
        </View>

        {/* BUY / SELL BUTTONS */}
<View style={styles.tradeRow}>
  <TouchableOpacity
    style={[styles.tradeButton, styles.buyButton]}
    onPress={() => {
      setTradeType("BUY");
      setShowTradeModal(true);
    }}
  >
    <Text style={styles.tradeText}>Buy</Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[styles.tradeButton, styles.sellButton]}
    onPress={() => {
      setTradeType("SELL");
      setShowTradeModal(true);
    }}
  >
    <Text style={styles.tradeText}>Sell</Text>
  </TouchableOpacity>
</View>


        {/* TIMEFRAME */}
        <View style={styles.timeframeRow}>
          {["1D", "1W", "1M", "6M", "1Y"].map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.timeButton, timeframe === tf && styles.timeButtonActive]}
              onPress={() => setTimeframe(tf)}
            >
              <Text
                style={[
                  styles.timeButtonText,
                  timeframe === tf && styles.timeButtonTextActive,
                ]}
              >
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CHART */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{timeframe} Price Chart</Text>

          {history.length < 3 ? (
            <Text style={{ color: "#9ca3af" }}>Loading...</Text>
          ) : (
            <LineChart
              data={{
                labels: history.map((p, i) =>
                  i % Math.floor(history.length / 6) === 0
                    ? `${p.x.getMonth() + 1}/${p.x.getDate()}`
                    : ""
                ),
                datasets: [{ data: history.map((p) => p.y) }],
              }}
              width={screenWidth - 40}
              height={260}
              chartConfig={{
                backgroundColor: "#020617",
                backgroundGradientFrom: "#020617",
                backgroundGradientTo: "#020617",
                decimalPlaces: 2,
                color: (opacity = 1) => `rgba(34,197,94, ${opacity})`,
                labelColor: () => "#9ca3af",
                propsForBackgroundLines: { stroke: "#1f2937" },
              }}
              bezier
              style={{ borderRadius: 16 }}
            />
          )}
        </View>

        

    
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Price Prediction</Text>

          {aiLoading ? (
            <Text style={{ color: "#9ca3af" }}>AI analyzing...</Text>
          ) : aiData ? (
            <>
              <Text style={styles.value}>
                Predicted Price: ${aiData.predicted?.toFixed(2)}
              </Text>

              <Text
                style={[
                  styles.value,
                  aiData.trend === "UP"
                    ? styles.green
                    : aiData.trend === "DOWN"
                    ? styles.red
                    : { color: "#e5e7eb" },
                ]}
              >
                Trend: {aiData.trend}
              </Text>

              <Text style={styles.value}>
                Confidence: {(aiData.confidence * 100).toFixed(1)}%
              </Text>
            </>
          ) : (
            <Text style={{ color: "#6b7280" }}>No AI prediction available.</Text>
          )}
        </View>

        {/* DAILY METRICS */}
        <View style={styles.row}>
          <View style={styles.metric}>
            <Text style={styles.label}>Open</Text>
            <Text style={styles.value}>{quote.open}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.label}>High</Text>
            <Text style={styles.value}>{quote.high}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.label}>Low</Text>
            <Text style={styles.value}>{quote.low}</Text>
          </View>
        </View>

        {/* FUNDAMENTALS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fundamentals</Text>

          <View style={styles.row}>
            <View style={styles.metric}>
              <Text style={styles.label}>P/E</Text>
              <Text style={styles.value}>{fundamentals?.peTTM ?? "—"}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.label}>EPS</Text>
              <Text style={styles.value}>{fundamentals?.epsTTM ?? "—"}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.metric}>
              <Text style={styles.label}>Dividend</Text>
              <Text style={styles.value}>
                {fundamentals?.dividendYield
                  ? (fundamentals.dividendYield * 100).toFixed(2) + "%"
                  : "—"}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.label}>Beta</Text>
              <Text style={styles.value}>{fundamentals?.beta ?? "—"}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.metric}>
              <Text style={styles.label}>52W High</Text>
              <Text style={styles.value}>{fundamentals?.weekHigh ?? "—"}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.label}>52W Low</Text>
              <Text style={styles.value}>{fundamentals?.weekLow ?? "—"}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* TRADE MODAL */}
      <Modal visible={showTradeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {tradeType} {ticker}
            </Text>
            <Text style={styles.modalSubtitle}>
              Current price: {quote.current.toFixed(2)}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Quantity"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={tradeQty}
              onChangeText={setTradeQty}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  tradeType === "BUY" ? styles.buyButton : styles.sellButton,
                ]}
                onPress={handleConfirmTrade}
              >
                <Text style={styles.tradeText}>Confirm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowTradeModal(false)}
              >
                <Text style={styles.tradeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", padding: 16 },
  center: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
  },
  header: { marginBottom: 16 },
  symbol: { color: "#9ca3af", fontSize: 16, fontWeight: "600" },
  company: { color: "#e5e7eb", fontSize: 16, marginTop: 2 },
  exchange: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  price: { color: "#f9fafb", fontSize: 34, fontWeight: "700", marginTop: 8 },
  change: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  green: { color: "#22c55e" },
  red: { color: "#ef4444" },

  tradeRow: { flexDirection: "row",  marginBottom: 12 },
  tradeButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  buyButton: { backgroundColor: "#22c55e" },
  sellButton: { backgroundColor: "#ef4444" },
  tradeText: { color: "white", fontWeight: "600", fontSize: 16 },

  timeframeRow: { flexDirection: "row", marginBottom: 10 },
  timeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
  },
  timeButtonActive: { backgroundColor: "#22c55e22", borderColor: "#22c55e" },
  timeButtonText: { color: "#9ca3af", fontSize: 12 },
  timeButtonTextActive: { color: "#bbf7d0", fontWeight: "600" },

  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#111827",
    marginBottom: 16,
  },
  cardTitle: { color: "#9ca3af", fontSize: 14, marginBottom: 10 },

  row: { flexDirection: "row",  marginBottom: 10 },
  metric: { flex: 1, backgroundColor: "#111827", borderRadius: 12, padding: 10 },
  label: { color: "#6b7280", fontSize: 12 },
  value: { color: "#f3f4f6", fontSize: 15, marginTop: 4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.9)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#020617",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  modalTitle: { color: "#f9fafb", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  modalSubtitle: { color: "#9ca3af", fontSize: 13, marginBottom: 12 },

  modalInput: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#f9fafb",
    marginBottom: 14,
  },
  modalButtonsRow: { flexDirection: "row" },
  modalButton: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },

  cancelButton: { backgroundColor: "#4b5563" },
});
