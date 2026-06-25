/**
 * Kalshi API Client
 * Uses the public REST API for market data (no authentication required)
 * Base URL: https://external-api.kalshi.com/trade-api/v2
 */

import axios from "axios";
import type { AxiosInstance } from "axios";

const KALSHI_API_BASE = "https://external-api.kalshi.com/trade-api/v2";

// Kalshi data types
export interface KalshiSeries {
  ticker: string;
  title: string;
  category: string;
  description?: string;
  status: string;
  frequency?: string;
  underlying?: string;
  settlement_source?: string;
}

export interface KalshiEvent {
  ticker: string;
  title: string;
  category: string;
  description?: string;
  status: string;
  close_date?: string;
  expiration_date?: string;
  settlement_date?: string;
  series_ticker?: string;
  mutually_exclusive?: boolean;
  markets: KalshiMarket[];
}

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title: string;
  yes_bid: number;
  yes_ask: number;
  last_price: number;
  volume_24h: number;
  volume: number;
  open_interest: number;
  liquidity?: number;
  status: string;
  close_date?: string;
  expiration_date?: string;
  settlement_date?: string;
  result?: string;
  subtitle?: string;
  strike_type?: string;
  floor_strike?: number;
  cap_strike?: number;
  custom_strike?: number;
  no_bid?: number;
  no_ask?: number;
  open_time?: string;
  close_time?: string;
  last_update_ts?: number;
  open_interest_change?: number;
  sort_order?: number;
  market_type?: string;
  yes_ask_size?: number;
  yes_bid_size?: number;
  no_ask_size?: number;
  no_bid_size?: number;
}

export interface KalshiOrderbook {
  yes_bids: { price: number; count: number }[];
  yes_asks: { price: number; count: number }[];
  no_bids: { price: number; count: number }[];
  no_asks: { price: number; count: number }[];
}

export interface EnrichedKalshiMarket extends KalshiMarket {
  impliedProbability: number;
  midpointPrice: number;
  spread: number;
  volume24hNum: number;
  liquidityNum: number;
  openInterestNum: number;
  daysToResolution: number | null;
}

class KalshiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: KALSHI_API_BASE,
      timeout: 15000,
      headers: {
        Accept: "application/json",
      },
    });
  }

  /**
   * Get active events with their markets
   */
  async getActiveEvents(
    limit: number = 100,
    cursor?: string,
    status: string = "open"
  ): Promise<{ events: KalshiEvent[]; cursor?: string }> {
    const params: Record<string, string> = {
      limit: limit.toString(),
      status,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const response = await this.client.get<{
      events: KalshiEvent[];
      cursor?: string;
    }>("/events", { params });
    return response.data;
  }

  /**
   * Get event details
   */
  async getEvent(eventTicker: string): Promise<KalshiEvent | null> {
    try {
      const response = await this.client.get<{ event: KalshiEvent }>(
        `/events/${eventTicker}`
      );
      return response.data.event;
    } catch {
      return null;
    }
  }

  /**
   * Get specific market details
   */
  async getMarket(
    eventTicker: string,
    marketTicker: string
  ): Promise<KalshiMarket | null> {
    try {
      const response = await this.client.get<{ market: KalshiMarket }>(
        `/series/${eventTicker}/markets/${marketTicker}`
      );
      return response.data.market;
    } catch {
      return null;
    }
  }

  /**
   * Get orderbook for a market
   */
  async getOrderBook(
    eventTicker: string,
    marketTicker: string
  ): Promise<KalshiOrderbook | null> {
    try {
      const response = await this.client.get<{
        orderbook: KalshiOrderbook;
      }>(`/series/${eventTicker}/markets/${marketTicker}/orderbook`);
      return response.data.orderbook;
    } catch {
      return null;
    }
  }

  /**
   * Get all open markets
   */
  async getMarkets(
    limit: number = 100,
    cursor?: string,
    status: string = "open",
    eventTicker?: string
  ): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    const params: Record<string, string> = {
      limit: limit.toString(),
      status,
    };
    if (cursor) {
      params.cursor = cursor;
    }
    if (eventTicker) {
      params.event_ticker = eventTicker;
    }
    const response = await this.client.get<{
      markets: KalshiMarket[];
      cursor?: string;
    }>("/markets", { params });
    return response.data;
  }

  /**
   * Get series information
   */
  async getSeries(seriesTicker: string): Promise<KalshiSeries | null> {
    try {
      const response = await this.client.get<{ series: KalshiSeries }>(
        `/series/${seriesTicker}`
      );
      return response.data.series;
    } catch {
      return null;
    }
  }

  /**
   * Enrich market data with calculated values
   */
  enrichMarket(market: KalshiMarket): EnrichedKalshiMarket {
    const yesBid = market.yes_bid || 0;
    const yesAsk = market.yes_ask || 0;
    const midpoint = yesBid > 0 && yesAsk > 0 ? (yesBid + yesAsk) / 2 : market.last_price || 0;
    const spread = yesBid > 0 && yesAsk > 0 ? yesAsk - yesBid : 0;

    let daysToResolution: number | null = null;
    const dateStr = market.expiration_date || market.close_date;
    if (dateStr) {
      const end = new Date(dateStr);
      const now = new Date();
      daysToResolution = Math.max(0, (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      ...market,
      impliedProbability: midpoint / 100,
      midpointPrice: midpoint,
      spread,
      volume24hNum: market.volume_24h || 0,
      liquidityNum: market.liquidity || 0,
      openInterestNum: market.open_interest || 0,
      daysToResolution,
    };
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<{ category: string; event_count: number }[]> {
    try {
      const response = await this.client.get<{
        categories: { category: string; event_count: number }[];
      }>("/events/categories");
      return response.data.categories;
    } catch {
      return [];
    }
  }
}

export const kalshiClient = new KalshiClient();
