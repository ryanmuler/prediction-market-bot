/**
 * Signal Analysis Engine
 * Multi-strategy analysis for prediction market signals
 */

import type { EnrichedPolymarketMarket } from "../clients/polymarket";
import type { EnrichedKalshiMarket } from "../clients/kalshi";

export interface SignalFactor {
  name: string;
  score: number; // -10 to +10
  description: string;
}

export interface SignalAnalysis {
  shouldSignal: boolean;
  signalType: "BUY" | "SELL" | "ARBITRAGE" | "MOMENTUM";
  direction: "UP" | "DOWN";
  confidence: number; // 0-100
  currentPrice: number;
  targetPrice?: number;
  factors: string[];
  analysis: string;
  score: number; // overall score
}

// ─── Strategy 1: Volume-Liquidity Confidence ──────────────────────

function volumeLiquidityAnalysis(
  volume24h: number,
  liquidity: number,
  platform: "polymarket" | "kalshi"
): SignalFactor {
  const volThreshold = platform === "polymarket" ? 50000 : 20000;
  const liqThreshold = platform === "polymarket" ? 30000 : 10000;

  let score = 0;
  const notes: string[] = [];

  if (volume24h > volThreshold * 5) {
    score += 3;
    notes.push("Very high 24h volume confirms strong market interest");
  } else if (volume24h > volThreshold) {
    score += 2;
    notes.push("Healthy 24h volume indicates active trading");
  } else if (volume24h > volThreshold * 0.3) {
    score += 1;
    notes.push("Moderate volume, acceptable for analysis");
  } else {
    score -= 2;
    notes.push("Low volume reduces signal reliability");
  }

  if (liquidity > liqThreshold * 5) {
    score += 3;
    notes.push("Excellent liquidity for position entry/exit");
  } else if (liquidity > liqThreshold) {
    score += 2;
    notes.push("Good liquidity available");
  } else if (liquidity > liqThreshold * 0.3) {
    score += 0;
    notes.push("Limited liquidity, consider smaller position");
  } else {
    score -= 2;
    notes.push("Low liquidity may cause slippage");
  }

  return {
    name: "Volume & Liquidity",
    score: Math.max(-10, Math.min(10, score)),
    description: notes.join("; "),
  };
}

// ─── Strategy 2: Spread Efficiency ─────────────────────────────────

function spreadAnalysis(
  spread: number,
  impliedProbability: number,
  platform: "polymarket" | "kalshi"
): SignalFactor {
  const normalizedSpread = platform === "kalshi" ? spread / 100 : spread;

  let score = 0;
  const notes: string[] = [];

  if (normalizedSpread < 0.02) {
    score += 3;
    notes.push("Tight spread indicates efficient market pricing");
  } else if (normalizedSpread < 0.05) {
    score += 1;
    notes.push("Reasonable spread, market is fairly efficient");
  } else if (normalizedSpread < 0.1) {
    score -= 1;
    notes.push("Wide spread suggests pricing uncertainty");
  } else {
    score -= 3;
    notes.push("Very wide spread, significant pricing inefficiency");
  }

  // Price zone analysis
  if (impliedProbability < 0.15) {
    score += 1;
    notes.push("Deep out-of-the-money, potential value if event likely");
  } else if (impliedProbability > 0.85) {
    score += 1;
    notes.push("Deep in-the-money, strong consensus but low upside");
  } else if (impliedProbability > 0.4 && impliedProbability < 0.6) {
    score += 1;
    notes.push("Near 50/50 pricing suggests informational symmetry");
  }

  return {
    name: "Market Efficiency",
    score: Math.max(-10, Math.min(10, score)),
    description: notes.join("; "),
  };
}

// ─── Strategy 3: Time Value Analysis ───────────────────────────────

function timeValueAnalysis(
  daysToResolution: number | null,
  impliedProbability: number
): SignalFactor {
  if (daysToResolution === null) {
    return {
      name: "Time Value",
      score: 0,
      description: "Resolution date unknown, cannot assess time decay",
    };
  }

  let score = 0;
  const notes: string[] = [];

  if (daysToResolution < 1) {
    score += 3;
    notes.push("Resolving within 24h - high certainty trades only");
  } else if (daysToResolution < 7) {
    score += 2;
    notes.push("Resolving within a week - time decay is minimal");
  } else if (daysToResolution < 30) {
    score += 1;
    notes.push("Resolving within a month - moderate time horizon");
  } else if (daysToResolution < 90) {
    score += 0;
    notes.push("Resolving in 1-3 months - standard time horizon");
  } else {
    score -= 1;
    notes.push("Long-dated market, significant time risk");
  }

  // Time-value vs probability
  if (daysToResolution !== null && daysToResolution < 7 && impliedProbability > 0.7) {
    score += 2;
    notes.push("High probability + near resolution = strong edge");
  }

  if (daysToResolution !== null && daysToResolution > 30 && impliedProbability < 0.2) {
    score += 1;
    notes.push("Low probability with time for information to change");
  }

  return {
    name: "Time Value",
    score: Math.max(-10, Math.min(10, score)),
    description: notes.join("; "),
  };
}

// ─── Strategy 4: Probability Value Detection ──────────────────────

function valueDetection(
  impliedProbability: number,
  _volume24h: number,
  openInterest: number,
  platform: "polymarket" | "kalshi"
): SignalFactor {
  let score = 0;
  const notes: string[] = [];

  // Value zones - prices that may be mispriced
  if (impliedProbability < 0.1) {
    score -= 2;
    notes.push("Extremely low implied probability - likely efficient pricing");
  } else if (impliedProbability < 0.25) {
    score += 2;
    notes.push("Potential value zone if supporting evidence exists");
  } else if (impliedProbability < 0.35) {
    score += 1;
    notes.push("Below 35% - worth investigating for mispricing");
  } else if (impliedProbability > 0.75 && impliedProbability < 0.85) {
    score += 1;
    notes.push("Above 75% - strong consensus but check for overconfidence");
  } else if (impliedProbability > 0.9) {
    score -= 1;
    notes.push("Extremely high probability - limited upside");
  } else if (impliedProbability >= 0.35 && impliedProbability <= 0.65) {
    score += 2;
    notes.push("Coin-flip territory - highest edge potential for informed traders");
  }

  // Open interest confirmation
  if (platform === "polymarket" && openInterest > 500000) {
    score += 1;
    notes.push("High open interest confirms market conviction");
  } else if (platform === "kalshi" && openInterest > 100000) {
    score += 1;
    notes.push("Strong open interest for Kalshi market");
  }

  return {
    name: "Value Detection",
    score: Math.max(-10, Math.min(10, score)),
    description: notes.join("; "),
  };
}

// ─── Strategy 5: Momentum Analysis (simulated from price position) ─

function momentumAnalysis(
  impliedProbability: number,
  spread: number,
  volume24h: number,
  liquidity: number,
  platform: "polymarket" | "kalshi"
): SignalFactor {
  const normalizedSpread = platform === "kalshi" ? spread / 100 : spread;
  let score = 0;
  const notes: string[] = [];

  // High volume with tight spread = institutional conviction
  const volThreshold = platform === "polymarket" ? 100000 : 50000;
  if (volume24h > volThreshold && normalizedSpread < 0.03) {
    score += 3;
    notes.push("High volume + tight spread indicates strong directional conviction");
  }

  // Extreme pricing suggests momentum
  if (impliedProbability > 0.8 && spread > 0) {
    score += 2;
    notes.push("Strong upward momentum confirmed by price action");
  } else if (impliedProbability < 0.2 && spread > 0) {
    score -= 2;
    notes.push("Strong downward momentum in price");
  }

  // Liquidity surge indicator
  if (liquidity > volThreshold * 2) {
    score += 1;
    notes.push("Elevated liquidity suggests incoming order flow");
  }

  return {
    name: "Momentum",
    score: Math.max(-10, Math.min(10, score)),
    description: notes.join("; "),
  };
}

// ─── Main Analysis Functions ──────────────────────────────────────

export function analyzePolymarketMarket(
  market: EnrichedPolymarketMarket
): SignalAnalysis {
  const factors: SignalFactor[] = [];

  factors.push(
    volumeLiquidityAnalysis(
      market.volume24hrNum,
      market.liquidityNum,
      "polymarket"
    )
  );
  factors.push(
    spreadAnalysis(market.spreadNum, market.impliedProbability, "polymarket")
  );
  factors.push(timeValueAnalysis(market.daysToResolution, market.impliedProbability));
  factors.push(
    valueDetection(
      market.impliedProbability,
      market.volume24hrNum,
      market.openInterestNum,
      "polymarket"
    )
  );
  factors.push(
    momentumAnalysis(
      market.impliedProbability,
      market.spreadNum,
      market.volume24hrNum,
      market.liquidityNum,
      "polymarket"
    )
  );

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxPossible = factors.length * 10;
  const confidence = Math.round(
    Math.max(0, Math.min(100, ((totalScore + maxPossible / 2) / maxPossible) * 100))
  );

  // Determine signal type and direction
  let signalType: "BUY" | "SELL" | "ARBITRAGE" | "MOMENTUM" = "BUY";
  let direction: "UP" | "DOWN" = "UP";
  let targetPrice: number | undefined;

  if (market.impliedProbability < 0.3) {
    signalType = "BUY";
    direction = "UP";
    targetPrice = Math.min(0.95, market.impliedProbability * 1.5 + 0.1);
  } else if (market.impliedProbability > 0.7) {
    signalType = "SELL";
    direction = "DOWN";
    targetPrice = Math.max(0.05, market.impliedProbability * 0.7 - 0.05);
  } else if (market.volume24hrNum > 100000 && market.spreadNum < 0.02) {
    signalType = "MOMENTUM";
    direction = market.impliedProbability > 0.5 ? "UP" : "DOWN";
    targetPrice =
      direction === "UP"
        ? Math.min(0.9, market.impliedProbability + 0.15)
        : Math.max(0.1, market.impliedProbability - 0.15);
  } else {
    signalType = "BUY";
    direction = market.impliedProbability < 0.5 ? "UP" : "DOWN";
    targetPrice = direction === "UP"
      ? Math.min(0.85, market.impliedProbability + 0.2)
      : Math.max(0.15, market.impliedProbability - 0.2);
  }

  // Build analysis text
  const topFactors = factors
    .filter((f) => Math.abs(f.score) >= 2)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const analysis = `Combined score: ${totalScore}/50. ${
    topFactors.length > 0
      ? topFactors[0].description
      : "Market shows moderate characteristics"
  }. ${
    confidence > 70
      ? "High confidence setup."
      : confidence > 50
      ? "Moderate confidence."
      : "Lower confidence, consider smaller position."
  }`;

  const factorDescriptions = factors.map(
    (f) => `${f.name}: ${f.score > 0 ? "+" : ""}${f.score} - ${f.description}`
  );

  // Signal threshold
  const shouldSignal = confidence >= 55;

  return {
    shouldSignal,
    signalType,
    direction,
    confidence,
    currentPrice: market.impliedProbability,
    targetPrice,
    factors: factorDescriptions,
    analysis,
    score: totalScore,
  };
}

export function analyzeKalshiMarket(
  market: EnrichedKalshiMarket
): SignalAnalysis {
  const factors: SignalFactor[] = [];

  factors.push(
    volumeLiquidityAnalysis(market.volume24hNum, market.liquidityNum, "kalshi")
  );
  factors.push(
    spreadAnalysis(market.spread, market.impliedProbability, "kalshi")
  );
  factors.push(timeValueAnalysis(market.daysToResolution, market.impliedProbability));
  factors.push(
    valueDetection(
      market.impliedProbability,
      market.volume24hNum,
      market.openInterestNum,
      "kalshi"
    )
  );
  factors.push(
    momentumAnalysis(
      market.impliedProbability,
      market.spread,
      market.volume24hNum,
      market.liquidityNum,
      "kalshi"
    )
  );

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const maxPossible = factors.length * 10;
  const confidence = Math.round(
    Math.max(0, Math.min(100, ((totalScore + maxPossible / 2) / maxPossible) * 100))
  );

  let signalType: "BUY" | "SELL" | "ARBITRAGE" | "MOMENTUM" = "BUY";
  let direction: "UP" | "DOWN" = "UP";
  let targetPrice: number | undefined;

  if (market.impliedProbability < 0.3) {
    signalType = "BUY";
    direction = "UP";
    targetPrice = Math.min(0.95, market.impliedProbability * 1.5 + 0.1);
  } else if (market.impliedProbability > 0.7) {
    signalType = "SELL";
    direction = "DOWN";
    targetPrice = Math.max(0.05, market.impliedProbability * 0.7 - 0.05);
  } else if (market.volume24hNum > 50000 && market.spread < 3) {
    signalType = "MOMENTUM";
    direction = market.impliedProbability > 0.5 ? "UP" : "DOWN";
    targetPrice =
      direction === "UP"
        ? Math.min(0.9, market.impliedProbability + 0.15)
        : Math.max(0.1, market.impliedProbability - 0.15);
  } else {
    signalType = "BUY";
    direction = market.impliedProbability < 0.5 ? "UP" : "DOWN";
    targetPrice = direction === "UP"
      ? Math.min(0.85, market.impliedProbability + 0.2)
      : Math.max(0.15, market.impliedProbability - 0.2);
  }

  const topFactors = factors
    .filter((f) => Math.abs(f.score) >= 2)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const analysis = `Combined score: ${totalScore}/50. ${
    topFactors.length > 0
      ? topFactors[0].description
      : "Market shows moderate characteristics"
  }. ${
    confidence > 70
      ? "High confidence setup."
      : confidence > 50
      ? "Moderate confidence."
      : "Lower confidence, consider smaller position."
  }`;

  const factorDescriptions = factors.map(
    (f) => `${f.name}: ${f.score > 0 ? "+" : ""}${f.score} - ${f.description}`
  );

  const shouldSignal = confidence >= 55;

  return {
    shouldSignal,
    signalType,
    direction,
    confidence,
    currentPrice: market.impliedProbability,
    targetPrice,
    factors: factorDescriptions,
    analysis,
    score: totalScore,
  };
}
