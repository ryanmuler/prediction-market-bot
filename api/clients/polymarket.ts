/**
 * Polymarket API Client
 * Uses the Gamma API for market metadata and CLOB API for pricing data
 * No authentication required for public market data
 */

import axios from "axios";
import type { AxiosInstance } from "axios";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_API_BASE = "https://clob.polymarket.com";

// Market data types
export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  description?: string;
  outcomePrices: string; // JSON string: ["0.65", "0.35"]
  outcomes: string; // JSON string: ["Yes", "No"]
  volume24hr?: string;
  volume?: string;
  liquidity?: string;
  spread?: string;
  bestBid?: string;
  bestAsk?: string;
  openInterest?: string;
  clobTokenIds?: string; // JSON string
  conditionId: string;
  questionId?: string;
  endDate?: string;
  startDate?: string;
  closed: boolean;
  active: boolean;
  enableOrderBook: boolean;
  minimized: boolean;
  tags?: { id: string; slug: string; name: string }[];
  group?: { title: string; category: string }[];
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
  closed: boolean;
  volume24hr?: string;
  volume?: string;
  liquidity?: string;
  markets: PolymarketMarket[];
  tags?: { id: string; slug: string; name: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PolymarketPrice {
  token_id: string;
  price: string;
}

export interface EnrichedPolymarketMarket extends PolymarketMarket {
  yesPrice: number;
  noPrice: number;
  impliedProbability: number;
  volume24hrNum: number;
  liquidityNum: number;
  spreadNum: number;
  openInterestNum: number;
  daysToResolution: number | null;
}

class PolymarketClient {
  private gamma: AxiosInstance;
  private clob: AxiosInstance;

  constructor() {
    this.gamma = axios.create({
      baseURL: GAMMA_API_BASE,
      timeout: 15000,
      headers: {
        Accept: "application/json",
      },
    });
    this.clob = axios.create({
      baseURL: CLOB_API_BASE,
      timeout: 15000,
      headers: {
        Accept: "application/json",
      },
    });
  }

  /**
   * Get active events sorted by 24h volume (highest first)
   */
  async getActiveEvents(
    limit: number = 100,
    offset: number = 0,
    tagSlug?: string
  ): Promise<PolymarketEvent[]> {
    const params: Record<string, string> = {
      active: "true",
      closed: "false",
      order: "volume24hr",
      ascending: "false",
      limit: limit.toString(),
      offset: offset.toString(),
    };
    if (tagSlug) {
      params.tag_slug = tagSlug;
    }
    const response = await this.gamma.get<PolymarketEvent[]>("/events", {
      params,
    });
    return response.data;
  }

  /**
   * Get active markets sorted by 24h volume
   */
  async getActiveMarkets(
    limit: number = 200,
    offset: number = 0
  ): Promise<PolymarketMarket[]> {
    const response = await this.gamma.get<PolymarketMarket[]>("/markets", {
      params: {
        active: "true",
        closed: "false",
        order: "volume24hr",
        ascending: "false",
        limit: limit.toString(),
        offset: offset.toString(),
      },
    });
    return response.data;
  }

  /**
   * Get market details by condition ID
   */
  async getMarket(conditionId: string): Promise<PolymarketMarket | null> {
    try {
      const response = await this.gamma.get<PolymarketMarket>(
        `/markets/${conditionId}`
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get event details by slug
   */
  async getEventBySlug(slug: string): Promise<PolymarketEvent | null> {
    try {
      const response = await this.gamma.get<PolymarketEvent>(
        `/events/slug/${slug}`
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get current price for a token
   */
  async getPrice(tokenId: string): Promise<number | null> {
    try {
      const response = await this.clob.get<PolymarketPrice>("/price", {
        params: { token_id: tokenId },
      });
      return parseFloat(response.data.price);
    } catch {
      return null;
    }
  }

  /**
   * Get midpoint price for a token
   */
  async getMidpoint(tokenId: string): Promise<number | null> {
    try {
      const response = await this.clob.get<{ midpoint: string }>("/midpoint", {
        params: { token_id: tokenId },
      });
      return parseFloat(response.data.midpoint);
    } catch {
      return null;
    }
  }

  /**
   * Get order book for a token
   */
  async getOrderBook(tokenId: string): Promise<{
    bids: { price: string; size: string }[];
    asks: { price: string; size: string }[];
  } | null> {
    try {
      const response = await this.clob.get<{
        bids: { price: string; size: string }[];
        asks: { price: string; size: string }[];
      }>("/book", {
        params: { token_id: tokenId },
      });
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Enrich market data with parsed numerical values
   */
  enrichMarket(market: PolymarketMarket): EnrichedPolymarketMarket {
    let yesPrice = 0.5;
    let noPrice = 0.5;
    try {
      const prices = JSON.parse(market.outcomePrices || "[\"0.5\",\"0.5\"]");
      const outcomes = JSON.parse(market.outcomes || "[\"Yes\",\"No\"]");
      const yesIdx = outcomes.indexOf("Yes");
      yesPrice =
        yesIdx >= 0
          ? parseFloat(prices[yesIdx] || "0.5")
          : parseFloat(prices[0] || "0.5");
      noPrice = 1 - yesPrice;
    } catch {
      // keep defaults
    }

    let daysToResolution: number | null = null;
    if (market.endDate) {
      const end = new Date(market.endDate);
      const now = new Date();
      daysToResolution = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      ...market,
      yesPrice,
      noPrice,
      impliedProbability: yesPrice,
      volume24hrNum: parseFloat(market.volume24hr || "0"),
      liquidityNum: parseFloat(market.liquidity || "0"),
      spreadNum: parseFloat(market.spread || "0"),
      openInterestNum: parseFloat(market.openInterest || "0"),
      daysToResolution,
    };
  }

  /**
   * Get all tags/categories
   */
  async getTags(): Promise<{ id: string; slug: string; name: string }[]> {
    try {
      const response = await this.gamma.get<{ id: string; slug: string; name: string }[]>("/tags");
      return response.data;
    } catch {
      return [];
    }
  }

  /**
   * Search markets
   */
  async searchMarkets(query: string): Promise<PolymarketMarket[]> {
    try {
      const response = await this.gamma.get<PolymarketMarket[]>("/markets", {
        params: { q: query, active: "true", limit: "20" },
      });
      return response.data;
    } catch {
      return [];
    }
  }
}

export const polymarketClient = new PolymarketClient();
