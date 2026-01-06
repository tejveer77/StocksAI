import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";

import { fetchCompanyNews } from "../../lib/news";
import { analyzeNewsSentiment } from "../../lib/sentiment";

export default function NewsScreen() {
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [news, setNews] = useState([]);
  const [sentiment, setSentiment] = useState(null);

  const handleFetchNews = async () => {
    if (!symbol.trim()) return;

    try {
      setLoading(true);
      setSentiment(null);

      const data = await fetchCompanyNews(symbol.trim().toUpperCase());
      setNews(data);

      if (data.length > 0) {
        const ai = await analyzeNewsSentiment(
          symbol.trim().toUpperCase(),
          data
        );
        setSentiment(ai);
      }
    } catch (err) {
      console.log("News fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>News & Sentiment</Text>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter stock symbol (AAPL, TSLA)"
          placeholderTextColor="#6b7280"
          value={symbol}
          onChangeText={setSymbol}
          autoCapitalize="characters"
        />

        <TouchableOpacity style={styles.searchButton} onPress={handleFetchNews}>
          <Text style={styles.searchButtonText}>Go</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#22c55e"
          style={{ marginVertical: 20 }}
        />
      )}

      {/* AI Sentiment */}
      {sentiment && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Sentiment Analysis</Text>

          <Text style={styles.value}>
            Sentiment Score: {(sentiment.sentiment * 100).toFixed(1)}%
          </Text>

          <Text style={styles.value}>Impact: {sentiment.impact}</Text>

          <Text style={styles.value}>Risk: {sentiment.risk}</Text>

          <Text style={[styles.value, { marginTop: 10 }]}>
            {sentiment.summary}
          </Text>

          {/* AI Recommendation */}
          <View
            style={[
              styles.recommendBox,
              sentiment.impact === "positive"
                ? styles.greenBox
                : sentiment.impact === "negative"
                ? styles.redBox
                : styles.grayBox,
            ]}
          >
            <Text style={styles.recommendText}>
              Recommendation:{" "}
              {sentiment.impact === "positive"
                ? "BUY"
                : sentiment.impact === "negative"
                ? "SELL"
                : "HOLD"}
            </Text>
          </View>
        </View>
      )}

      {/* News List */}
      {news.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Latest News</Text>

          {news.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => Linking.openURL(item.url)}
              style={styles.newsItem}
            >
              <Text style={styles.newsHeadline}>{item.headline}</Text>
              <Text style={styles.newsSource}>{item.source}</Text>
              <Text style={styles.newsDate}>
                {new Date(item.datetime * 1000).toDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/* ------- STYLES -------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 16,
  },
  title: {
    color: "#f9fafb",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  searchButton: {
    backgroundColor: "#22c55e",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  searchButtonText: { color: "#000", fontWeight: "700" },

  card: {
    backgroundColor: "#0f172a",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 20,
  },
  cardTitle: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 10,
    fontWeight: "600",
  },
  value: {
    color: "#f3f4f6",
    fontSize: 15,
    marginTop: 4,
  },

  recommendBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
  },
  recommendText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },

  greenBox: { backgroundColor: "rgba(34,197,94,0.25)" },
  redBox: { backgroundColor: "rgba(239,68,68,0.25)" },
  grayBox: { backgroundColor: "rgba(148,163,184,0.25)" },

  newsItem: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  newsHeadline: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  newsSource: {
    color: "#94a3b8",
    fontSize: 13,
  },
  newsDate: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
});
