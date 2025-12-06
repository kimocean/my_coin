import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BINANCE_ENDPOINT = 'https://api.binance.com/api/v3/ticker/price';
const NAVER_RATE_ENDPOINT = 'https://api.manana.kr/exchange/rate/KRW/USD.json';
const NAVER_RATE_DATE_URL = (date: string) => `https://api.manana.kr/exchange/rate/KRW/USD/${date}.json`;

export async function GET(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  const { data: rows, error } = await supabase
    .from('coin')
    .select('symbol, kr_name, buy_date, quantity, invested_krw, invested_usd')
    .order('symbol', { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers });
  }

  // 네이버 환율 fetch (최신 환율)
  let usdKrw = 0;
  try {
    const res = await fetch(NAVER_RATE_ENDPOINT);
    const data = await res.json();
    usdKrw = Array.isArray(data) && typeof data[0]?.rate === 'number' ? data[0].rate : 0;
  } catch (e) {
    usdKrw = 0;
  }
  if (!usdKrw || isNaN(usdKrw) || usdKrw < 500) usdKrw = 1450;

  // Binance 가격 fetch
  let binanceData: { symbol: string; price: string }[] = [];
  try {
    const binanceRes = await fetch(BINANCE_ENDPOINT);
    binanceData = await binanceRes.json();
  } catch (e) {
    binanceData = [];
  }

  type Grouped = {
    symbol: string;
    kr_name: string;
    quantity: number;
    invested_usd: number;
    invested_krw: number;
    latest_buy_date: string;
    buy_date: string;
    buy_rate?: number;
    profit_krw?: number;
    profit_rate_krw?: number;
  };

  // 1계좌만 있다고 가정, 데이터 하나의 buy_date로 환율 fetch
  let buy_rate = 0;
  let ref_buy_date = '';
  if (rows && rows.length > 0 && rows[0].buy_date) {
    ref_buy_date = rows[0].buy_date;
    try {
      const res = await fetch(NAVER_RATE_DATE_URL(ref_buy_date));
      const data = await res.json();
      buy_rate = Array.isArray(data) && typeof data[0]?.rate === 'number' ? data[0].rate : 0;
    } catch (e) {
      buy_rate = 0;
    }
  }
  if (!buy_rate || isNaN(buy_rate) || buy_rate < 500) buy_rate = 1450;

  const group: Record<string, Grouped> = {};
  rows?.forEach((row) => {
    if (!row.symbol) return;
    if (!group[row.symbol]) {
      group[row.symbol] = {
        symbol: row.symbol,
        kr_name: row.kr_name ?? '',
        quantity: 0,
        invested_usd: 0,
        invested_krw: 0,
        latest_buy_date: row.buy_date || '',
        buy_date: row.buy_date || '',
        buy_rate,
      };
    }
    group[row.symbol].quantity += Number(row.quantity ?? 0);
    group[row.symbol].invested_usd += Number(row.invested_usd ?? 0);
    // invested_krw는 null이면 자동 계산(usd*buy_rate)
    if (row.invested_krw != null) {
      group[row.symbol].invested_krw += Number(row.invested_krw);
    } else {
      group[row.symbol].invested_krw += Number(row.invested_usd ?? 0) * buy_rate;
    }
    if (!group[row.symbol].latest_buy_date || (row.buy_date && row.buy_date > group[row.symbol].latest_buy_date)) {
      group[row.symbol].latest_buy_date = row.buy_date || '';
    }
  });

  let symbolGroups = Object.values(group).map((g) => {
    const binanceSymbol = g.symbol.endsWith('USDT') ? g.symbol : `${g.symbol}USDT`;
    const binance = binanceData.find((b) => b.symbol === binanceSymbol);
    const currPriceUsdt = binance ? parseFloat(binance.price) : 0;
    const valuation_usd = currPriceUsdt * g.quantity;
    const valuation_krw = valuation_usd * usdKrw;
    const profit_usd = valuation_usd - g.invested_usd;
    const profit_krw = valuation_krw - g.invested_krw;
    const profit_rate = g.invested_usd ? (profit_usd / g.invested_usd) * 100 : 0;
    const profit_rate_krw = g.invested_krw ? (profit_krw / g.invested_krw) * 100 : 0;
    return {
      symbol: g.symbol,
      kr_name: g.kr_name,
      quantity: g.quantity,
      invested_usd: g.invested_usd,
      invested_krw: g.invested_krw,
      valuation_usd,
      valuation_krw,
      profit_usd,
      profit_krw,
      profit_rate,
      profit_rate_krw,
      latest_buy_date: g.latest_buy_date,
      buy_rate: g.buy_rate,
    };
  });

  symbolGroups.sort((a, b) => b.invested_usd - a.invested_usd);
  const total = symbolGroups.reduce(
    (acc, c) => {
      acc.quantity += c.quantity;
      acc.invested_usd += c.invested_usd;
      acc.valuation_usd += c.valuation_usd;
      acc.invested_krw += c.invested_krw;
      acc.valuation_krw += c.valuation_krw;
      acc.profit_usd += c.profit_usd;
      acc.profit_krw += c.profit_krw;
      acc.profit_rate += c.profit_rate;
      acc.profit_rate_krw += c.profit_rate_krw;
      if (!acc.latest_buy_date || (c.latest_buy_date && c.latest_buy_date > acc.latest_buy_date)) {
        acc.latest_buy_date = c.latest_buy_date;
      }
      return acc;
    },
    {
      symbol: 'ALL',
      kr_name: '전체',
      quantity: 0,
      invested_usd: 0,
      valuation_usd: 0,
      invested_krw: 0,
      valuation_krw: 0,
      profit_usd: 0,
      profit_krw: 0,
      profit_rate: 0,
      profit_rate_krw: 0,
      latest_buy_date: '',
      buy_date: '',
      buy_rate,
    }
  );
  total.profit_rate = total.invested_usd ? (total.profit_usd / total.invested_usd) * 100 : 0;
  total.profit_rate_krw = total.invested_krw ? (total.profit_krw / total.invested_krw) * 100 : 0;

  const result = [total, ...symbolGroups];

  return NextResponse.json({ coins: result, usdKrw, buy_rate }, { status: 200, headers });
}

export async function POST(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const { symbol, kr_name, buy_date, quantity, invested_krw, invested_usd, buy_rate } = await req.json();
    const { error } = await supabase.from("coin").insert([
      {
        symbol, kr_name, buy_date, quantity,
        invested_krw, invested_usd,
        buy_rate_krw: buy_rate,
      },
    ]);
    if (error) return NextResponse.json({ error: error.message },{ status: 400, headers });
    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "데이터 저장 실패" }, { status: 500, headers });
  }
}
