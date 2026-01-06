// lib/watchlist.js
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const USERS_COLLECTION = "users";

/**
 * Ensure user doc exists and has a watchlist array.
 * Returns the current watchlist (array of symbols).
 */
export async function getWatchlist(uid) {
  if (!uid) throw new Error("Missing user id");

  const userRef = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // Create doc with empty watchlist (merge to avoid overwriting anything else later)
    await setDoc(userRef, { watchlist: [] }, { merge: true });
    return [];
  }

  const data = snap.data() || {};
  let watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];

  // If field missing or not array, normalize it
  if (!Array.isArray(data.watchlist)) {
    await updateDoc(userRef, { watchlist });
  }

  return watchlist;
}

/**
 * Add a symbol to the user's watchlist (no duplicates).
 */
export async function addToWatchlist(uid, symbol) {
  if (!uid) throw new Error("Missing user id");
  if (!symbol) throw new Error("Missing symbol");

  const cleanSymbol = symbol.toUpperCase().trim();

  const userRef = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, { watchlist: [cleanSymbol] }, { merge: true });
    return [cleanSymbol];
  }

  const data = snap.data() || {};
  let watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];

  if (!watchlist.includes(cleanSymbol)) {
    watchlist = [...watchlist, cleanSymbol];
    await updateDoc(userRef, { watchlist });
  }

  return watchlist;
}

/**
 * Remove a symbol from the watchlist.
 */
export async function removeFromWatchlist(uid, symbol) {
  if (!uid) throw new Error("Missing user id");
  if (!symbol) throw new Error("Missing symbol");

  const cleanSymbol = symbol.toUpperCase().trim();

  const userRef = doc(db, USERS_COLLECTION, uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    return [];
  }

  const data = snap.data() || {};
  let watchlist = Array.isArray(data.watchlist) ? data.watchlist : [];

  watchlist = watchlist.filter((s) => s !== cleanSymbol);
  await updateDoc(userRef, { watchlist });

  return watchlist;
}
