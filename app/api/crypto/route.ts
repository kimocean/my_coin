import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 환경변수 체크
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_KEY is missing!');
}

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_KEY || ''
);
const MANANA_URL = 'https://api.manana.kr/exchange/rate/KRW/USD.json';
const BINANCE_URL = 'https://api.binance.com/api/v3/ticker/price';

function safeNum(n: any): number {
  if (typeof n === 'number') return n;
  if (typeof n === 'string') return Number(n) || 0;
  return 0;
}

export async function GET(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // 쿼리 파라미터 확인 - 상세 조회 모드
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const tradeType = searchParams.get('tradeType');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  // 상세 조회 모드 (symbol이 있으면)
  if (symbol && symbol !== 'ALL') {
    let query = supabase.from('coin').select('*', { count: 'exact' }).eq('symbol', symbol);
    if (startDate) query = query.gte('trade_date', startDate);
    if (endDate) query = query.lte('trade_date', endDate);
    if (tradeType && tradeType !== '전체') query = query.eq('trade_type', tradeType);
    query = query.order('trade_date', { ascending: false });
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    const { data: rows, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
    return NextResponse.json({ rows: rows || [], total: count || 0 }, { status: 200, headers });
  }
  
  // 전체 조회 모드 (기존 로직)
  const { data: rows, error } = await supabase.from('coin').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers });
  // 환율 fetch
  let usdKrw = 1450;
  try {
    const manaRes = await fetch(MANANA_URL);
    const manaArr = await manaRes.json();
    if (manaArr && Array.isArray(manaArr) && typeof manaArr[0]?.rate === 'number' && manaArr[0].rate > 1000) usdKrw = manaArr[0].rate;
  } catch (e) {}
  // 바이낸스 fetch
  let binance:any[] = [];
  try { 
    const binanceRes = await fetch(BINANCE_URL);
    const binanceData = await binanceRes.json();
    // 배열인지 확인
    if (Array.isArray(binanceData)) {
      binance = binanceData;
    } else {
      console.error('Binance API returned non-array:', typeof binanceData);
      binance = [];
    }
  } catch(e){
    console.error('Binance fetch error:', e);
    binance = [];
  }
  // 코인별 집계
  const group: Record<string, any> = {};
  rows?.forEach((r:any) => {
    if (!r.symbol) return;
    if (!group[r.symbol]) {
      group[r.symbol] = {
        symbol: r.symbol,
        kr_name: r.kr_name??'',
        quantity: 0, invested_usd: 0, invested_krw: 0,
        profit_usd: 0, profit_krw: 0,
        trade_type: r.trade_type,
        trade_rate: r.trade_rate,
      };
    }
    group[r.symbol].quantity += Number(r.quantity??0);
    group[r.symbol].invested_usd += Number(r.invested_usd??0);
    group[r.symbol].invested_krw += Number(r.invested_krw??0);
    // 최신 거래일자 구분
    if (!group[r.symbol].latest_date || r.trade_date > group[r.symbol].latest_date) {
      group[r.symbol].latest_date = r.trade_date;
      group[r.symbol].trade_rate = r.trade_rate;
    }
  });
  // 집계: 실시간 평가금액, 손익, 수익률 계산
  let coins = Object.keys(group).map(sym => {
    const g = group[sym];
    // 스테이블코인 처리 (USDT, USDC, BUSD 등)
    const stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'];
    let curr_usd = 0;
    if (stablecoins.includes(sym.toUpperCase())) {
      curr_usd = 1; // 스테이블코인은 1달러 고정
    } else {
      const binancePrice = binance.find(b => b.symbol === sym.toUpperCase()+'USDT');
      curr_usd = binancePrice ? parseFloat(binancePrice.price) : 0;
    }
    const valuation_usd = curr_usd * g.quantity;
    const valuation_krw = valuation_usd * usdKrw;
    const profit_usd = valuation_usd - g.invested_usd;
    const profit_krw = valuation_krw - g.invested_krw;
    const profit_rate = g.invested_usd > 0 ? (profit_usd / g.invested_usd) * 100 : 0;
    const profit_rate_krw = g.invested_krw > 0 ? (profit_krw / g.invested_krw) * 100 : 0;
    return {
      ...g,
      valuation_usd, valuation_krw,
      profit_usd, profit_krw,
      profit_rate, profit_rate_krw,
    };
  });
  // 투자금액KRW 내림차순 정렬
  coins = coins.sort((a,b)=>b.invested_krw-a.invested_krw);
  // 전체 합계
  const all = coins.reduce((acc,c)=>{
    acc.quantity += c.quantity; acc.invested_usd += c.invested_usd;
    acc.invested_krw += c.invested_krw;
    acc.valuation_usd += c.valuation_usd; acc.valuation_krw += c.valuation_krw;
    acc.profit_usd += c.profit_usd; acc.profit_krw += c.profit_krw;
    return acc;
  },{symbol:'ALL',kr_name:'전체',quantity:0,invested_usd:0,invested_krw:0,valuation_usd:0,valuation_krw:0,profit_usd:0,profit_krw:0,profit_rate:0,profit_rate_krw:0});
  all.profit_rate = all.invested_usd > 0 ? (all.profit_usd/all.invested_usd)*100 : 0;
  all.profit_rate_krw = all.invested_krw > 0 ? (all.profit_krw/all.invested_krw)*100 : 0;
  const result = [all,...coins];
  return NextResponse.json({ coins: result, usdKrw }, { status:200, headers });
}

export async function POST(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  try {
    const { symbol, kr_name, trade_date, buy_date, quantity, invested_krw, invested_usd, trade_type, trade_rate, buy_rate } = await req.json();
    // 컬럼명 호환: trade_date=buy_date, trade_rate=buy_rate
    const insertObj = {
      symbol,
      kr_name,
      trade_date: trade_date || buy_date,
      quantity: safeNum(quantity),
      invested_krw: safeNum(invested_krw),
      invested_usd: safeNum(invested_usd),
      trade_type: trade_type || '매수',
      trade_rate: safeNum(trade_rate || buy_rate),
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('coin').insert([insertObj]);
    if (error) return NextResponse.json({ error: error.message },{ status: 400, headers });
    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "저장 실패" }, { status: 500, headers });
  }
}

export async function PATCH(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  try {
    const { id, ...fields } = await req.json();
    if (!id) throw new Error('ID가 필요합니다.');
    const { error } = await supabase.from('coin').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400, headers });
    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "수정 실패" }, { status: 500, headers });
  }
}

export async function DELETE(req: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  try {
    const { id } = await req.json();
    if (!id) throw new Error('ID가 필요합니다.');
    const { error } = await supabase.from('coin').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400, headers });
    return NextResponse.json({ ok: true }, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "삭제 실패" }, { status: 500, headers });
  }
}
