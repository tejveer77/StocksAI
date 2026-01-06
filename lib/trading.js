// lib/trading.js
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteField 
} from "firebase/firestore";
import { db } from "../firebaseConfig";

const INITIAL_BALANCE = 100000;

// Ensure user document exists
async function ensureUserAccount(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const data = {
      balance: INITIAL_BALANCE,
      portfolio: {},
      trades: [],
    };
    await setDoc(userRef, data);
    return { ref: userRef, data };
  }

  return { ref: userRef, data: snap.data() };
}

// -------- BUY --------
export async function buyStock(uid, symbol, qty, price) {
  if (!uid) throw new Error("User not logged in");

  const { ref, data } = await ensureUserAccount(uid);

  const cost = qty * price;
  if (data.balance < cost) throw new Error("Not enough balance");

  const holdings = data.portfolio || {};
  const current = holdings[symbol] || { qty: 0, avgPrice: 0 };

  const newQty = current.qty + qty;
  const newAvg =
    (current.avgPrice * current.qty + cost) / newQty;

  holdings[symbol] = {
    qty: newQty,
    avgPrice: newAvg,
  };

  const trades = data.trades || [];
  trades.push({
    type: "BUY",
    symbol,
    qty,
    price,
    time: Date.now(),
  });

  await updateDoc(ref, {
    balance: data.balance - cost,
    portfolio: holdings,
    trades,
  });
}

// -------- SELL --------
export async function sellStock(uid, symbol, qty, price) {
  if (!uid) throw new Error("User not logged in");

  const { ref, data } = await ensureUserAccount(uid);

  const holdings = data.portfolio || {};
  const current = holdings[symbol];

  if (!current || current.qty < qty)
    throw new Error("Not enough shares");

  const newQty = current.qty - qty;

  if (newQty === 0) {
    holdings[symbol] = deleteField();
  } else {
    holdings[symbol] = {
      qty: newQty,
      avgPrice: current.avgPrice,
    };
  }

  const gain = qty * price;

  const trades = data.trades || [];
  trades.push({
    type: "SELL",
    symbol,
    qty,
    price,
    time: Date.now(),
  });

  await updateDoc(ref, {
    balance: data.balance + gain,
    portfolio: holdings,
    trades,
  });
}
