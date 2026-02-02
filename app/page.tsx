"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type CoinGrouped = {
  symbol: string;
  kr_name: string;
  quantity: number;
  invested_usd: number;
  invested_krw: number;
  valuation_usd: number;
  valuation_krw: number;
  profit_usd: number;
  profit_krw: number;
  profit_rate: number;
  profit_rate_krw: number;
  latest_buy_date: string;
  buy_rate?: number;
  trade_rate?: number;
  curr_price_usd?: number;
  curr_price_krw?: number;
};

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState<CoinGrouped[]>([]);
  const [usdKrw, setUsdKrw] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 대시보드 새로고침 시 Supabase keepalive 쿼리 직접 실행 (크론과 동일한 쿼리)
  const pingKeepalive = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase 환경변수가 설정되지 않아 keepalive를 건너뜁니다.");
      return;
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      // 크론과 동일한 쿼리: coin 테이블에서 id만 1개 조회 (데이터 변경 없음)
      const { data, error } = await supabase
        .from('coin')
        .select('id')
        .limit(1);

      if (error) {
        console.warn("keepalive 쿼리 실패:", error.message);
      } else {
        console.log("keepalive 쿼리 성공:", data?.length || 0, "개 레코드 확인됨");
      }
    } catch (err: any) {
      console.warn("keepalive 쿼리 에러:", err?.message || err);
    }
  };

  const fetchData = async (forceRefresh = false) => {
    // sessionStorage에서 캐시 확인 (명시적 새로고침이 아닐 때)
    // 단, 캐시가 무효화되었는지 확인 (데이터 변경 후에는 캐시 무시)
    if (!forceRefresh && refreshCount === 0) {
      const cached = sessionStorage.getItem('crypto-dashboard-cache');
      const cacheInvalidated = sessionStorage.getItem('crypto-dashboard-cache-invalidated');
      
      if (cached && !cacheInvalidated) {
        try {
          const data = JSON.parse(cached);
          setCoins(data.coins || []);
          setUsdKrw(data.usdKrw);
          setLoading(false);
          return;
        } catch (e) {
          // 캐시 파싱 실패 시 무시하고 새로 가져오기
        }
      }
      
      // 캐시 무효화 플래그 제거
      if (cacheInvalidated) {
        sessionStorage.removeItem('crypto-dashboard-cache-invalidated');
      }
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crypto");
      if (!res.ok) {
        throw new Error(`API 오류: ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      if (!text) {
        throw new Error("서버에서 빈 응답을 반환했습니다. 환경변수를 확인해주세요.");
      }
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);
      setCoins(data.coins as CoinGrouped[]);
      setUsdKrw(data.usdKrw);
      // sessionStorage에 캐시 저장
      sessionStorage.setItem('crypto-dashboard-cache', JSON.stringify(data));
    } catch (e: any) {
      console.error('fetchData error:', e);
      setError(e.message || "에러가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(refreshCount > 0);
  }, [refreshCount]);

  // ---행 색상/구분; 수익률 컬러---
  const posColor = "text-red-500", negColor = "text-blue-500", baseColor = "text-slate-50";
  const assembledRows = coins.map((coin, idx) => {
    const trade_price_usd = coin.quantity ? coin.invested_usd / coin.quantity : undefined;
    const trade_price_krw = coin.quantity ? coin.invested_krw / coin.quantity : undefined;
    const curr_price_usd = coin.quantity ? coin.valuation_usd / coin.quantity : undefined;
    const curr_price_krw = coin.quantity ? coin.valuation_krw / coin.quantity : undefined;
    const trade_rate = coin.trade_rate ?? coin.buy_rate;
    const curr_rate = usdKrw;
    // 컬러 결정
    // 전체-개별 구분: 전체=idx0, 진배경/굵은 선, 나머지 얇고 hover
    const row1Class = idx === 0
      ? "font-extrabold bg-slate-900 border-b-2 border-slate-500"
      : "border-b border-slate-700 hover:bg-slate-800 transition";
    const row2Class = idx === 0
      ? "font-extrabold bg-slate-900 border-b-2 border-slate-500"
      : "border-b border-slate-700 hover:bg-slate-800 transition";
    return (
      <React.Fragment key={coin.symbol+idx}>
        {/* 첫번째 줄 */}
        <tr className={row1Class}>
          <td className="px-2 py-2 text-center whitespace-nowrap">{coin.symbol}</td>
          <td className={`px-2 py-2 text-right ${coin.profit_usd>0?posColor:coin.profit_usd<0?negColor:baseColor}`}>{coin.profit_usd?.toLocaleString(undefined, {maximumFractionDigits:2})??'-'}</td>
          <td className={`px-2 py-2 text-right ${coin.profit_krw>0?posColor:coin.profit_krw<0?negColor:baseColor}`}>{coin.profit_krw?.toLocaleString(undefined, {maximumFractionDigits:0})??'-'}</td>
          <td className="px-2 py-2 text-right">{coin.quantity?.toLocaleString(undefined, {minimumFractionDigits:5, maximumFractionDigits:5}) ?? '-'}</td>
          <td className="px-2 py-2 text-right">{trade_price_usd && isFinite(trade_price_usd)? trade_price_usd.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
          <td className="px-2 py-2 text-right">{trade_price_krw && isFinite(trade_price_krw)? trade_price_krw.toLocaleString(undefined, {maximumFractionDigits:0}): '-'}</td>
          <td className="px-2 py-2 text-right">{coin.invested_usd?.toLocaleString(undefined, {maximumFractionDigits:2})??'-'}</td>
          <td className="px-2 py-2 text-right">{coin.invested_krw?.toLocaleString(undefined, {maximumFractionDigits:0})??'-'}</td>
          <td className="px-2 py-2 text-right">{trade_rate && isFinite(trade_rate)? trade_rate.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
        </tr>
        {/* 두번째 줄 */}
        <tr className={row2Class}>
          <td className="px-2 py-2 text-center whitespace-nowrap">{coin.kr_name||'-'}</td>
          <td className={`px-2 py-2 text-right ${coin.profit_rate>0?posColor:coin.profit_rate<0?negColor:baseColor}`}>{coin.profit_rate !== undefined ? coin.profit_rate.toFixed(2)+"%" : '-'}</td>
          <td className={`px-2 py-2 text-right ${(coin.profit_rate_krw||0)>0?posColor:(coin.profit_rate_krw||0)<0?negColor:baseColor}`}>{coin.profit_rate_krw !== undefined ? coin.profit_rate_krw.toFixed(2)+"%" : '-'}</td>
          <td className="px-2 py-2" />
          <td className="px-2 py-2 text-right">{curr_price_usd && isFinite(curr_price_usd)? curr_price_usd.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
          <td className="px-2 py-2 text-right">{curr_price_krw && isFinite(curr_price_krw)? curr_price_krw.toLocaleString(undefined, {maximumFractionDigits:0}): '-'}</td>
          <td className="px-2 py-2 text-right">{coin.valuation_usd?.toLocaleString(undefined, {maximumFractionDigits:2})??'-'}</td>
          <td className="px-2 py-2 text-right">{coin.valuation_krw?.toLocaleString(undefined, {maximumFractionDigits:0})??'-'}</td>
          <td className="px-2 py-2 text-right">{(usdKrw !== null && isFinite(usdKrw))? usdKrw.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
        </tr>
      </React.Fragment>
    );
  });

  const isAll = (idx: number) => idx === 0 && coins[0]?.symbol;
  const handleCoinDetail = (coin: CoinGrouped) => {
    if(coin.symbol!=="ALL") window.location.href=`/coins/${coin.symbol}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 px-1 py-4 text-white flex flex-col items-center">
      <main className="w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <button
            className="text-2xl hover:opacity-70 transition"
            onClick={() => {
              setRefreshCount((n) => n + 1);
              pingKeepalive();
            }}
            disabled={loading}
            title="새로고침"
          >
            {loading ? "⏳" : "🔄"}
          </button>
          <h1 className="text-lg font-bold">koin</h1>
          <Link href="/add">
            <button className="text-2xl hover:opacity-70 transition" title="등록">➕</button>
          </Link>
        </div>
        {error && <div className="text-red-400 text-center mb-4">{error}</div>}
        <div className="w-full max-w-6xl mx-auto overflow-x-auto">
          {/* 표 헤더 유지 */}
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              {/* 기존 thead 유지 */}
              <tr className="text-slate-400">
                <th className="px-2 py-3 font-semibold min-w-[60px]">코인</th>
                <th className="px-2 py-3 font-semibold min-w-[80px]">손익USD</th>
                <th className="px-2 py-3 font-semibold min-w-[80px]">손익KRW</th>
                <th className="px-2 py-3 font-semibold min-w-[90px]">보유수량</th>
                <th className="px-2 py-3 font-semibold min-w-[90px]">매입가USD</th>
                <th className="px-2 py-3 font-semibold min-w-[90px]">매입가KRW</th>
                <th className="px-2 py-3 font-semibold min-w-[110px]">매입금액USD</th>
                <th className="px-2 py-3 font-semibold min-w-[110px]">매입금액KRW</th>
                <th className="px-2 py-3 font-semibold min-w-[70px]">매입환율</th>
              </tr>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="px-2 py-1 font-semibold min-w-[60px]">한글명</th>
                <th className="px-2 py-1 font-semibold min-w-[80px]">수익률USD</th>
                <th className="px-2 py-1 font-semibold min-w-[80px]">수익률KRW</th>
                <th className="px-2 py-1 font-semibold min-w-[90px]"/>
                <th className="px-2 py-1 font-semibold min-w-[90px]">현재가USD</th>
                <th className="px-2 py-1 font-semibold min-w-[90px]">현재가KRW</th>
                <th className="px-2 py-1 font-semibold min-w-[110px]">평가금액USD</th>
                <th className="px-2 py-1 font-semibold min-w-[110px]">평가금액KRW</th>
                <th className="px-2 py-1 font-semibold min-w-[70px]">현재환율</th>
              </tr>
            </thead>
            <tbody>
              {!loading && coins.map((coin, idx) => {
                const trade_price_usd = coin.quantity ? coin.invested_usd / coin.quantity : undefined;
                const trade_price_krw = coin.quantity ? coin.invested_krw / coin.quantity : undefined;
                const curr_price_usd = coin.quantity ? coin.valuation_usd / coin.quantity : undefined;
                const curr_price_krw = coin.quantity ? coin.valuation_krw / coin.quantity : undefined;
                const trade_rate = coin.trade_rate ?? coin.buy_rate ?? (usdKrw || 0);
                const fontClass = coin.symbol === 'ALL' ? 'font-bold' : '';
                const handleRowClick = () => {
                  if (coin.symbol === 'ALL') return;
                  router.push(`/coins/${coin.symbol}`);
                };
                const isHovered = hoveredIndex === idx;
                return (
                  <React.Fragment key={coin.symbol+idx}>
                    <tr 
                      className={`${fontClass} ${isHovered ? 'bg-slate-800' : ''} cursor-pointer transition`} 
                      onClick={handleRowClick}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <td className="px-2 py-2 text-center whitespace-nowrap">{coin.symbol}</td>
                      <td className={`px-2 py-2 text-right ${coin.profit_usd>0?posColor:coin.profit_usd<0?negColor:baseColor}`}>{coin.profit_usd !== undefined ? coin.profit_usd.toLocaleString(undefined, {maximumFractionDigits:2}) : '-'}</td>
                      <td className={`px-2 py-2 text-right ${coin.profit_krw>0?posColor:coin.profit_krw<0?negColor:baseColor}`}>{coin.profit_krw !== undefined ? coin.profit_krw.toLocaleString(undefined, {maximumFractionDigits:0}) : '-'}</td>
                      <td className="px-2 py-2 text-right">{coin.quantity !== undefined ? coin.quantity.toLocaleString(undefined, {minimumFractionDigits:5, maximumFractionDigits:5}) : '-'}</td>
                      <td className="px-2 py-2 text-right">{trade_price_usd && isFinite(trade_price_usd)? trade_price_usd.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
                      <td className="px-2 py-2 text-right">{trade_price_krw && isFinite(trade_price_krw)? trade_price_krw.toLocaleString(undefined, {maximumFractionDigits:0}): '-'}</td>
                      <td className="px-2 py-2 text-right">{coin.invested_usd !== undefined ? coin.invested_usd.toLocaleString(undefined, {maximumFractionDigits:2}) : '-'}</td>
                      <td className="px-2 py-2 text-right">{coin.invested_krw !== undefined ? coin.invested_krw.toLocaleString(undefined, {maximumFractionDigits:0}) : '-'}</td>
                      <td className="px-2 py-2 text-right">{trade_rate && isFinite(trade_rate)? trade_rate.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
                    </tr>
                    <tr 
                      className={`${idx < coins.length - 1 ? 'border-b border-slate-600' : ''} ${fontClass} ${isHovered ? 'bg-slate-800' : ''} cursor-pointer transition`} 
                      onClick={handleRowClick}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <td className="px-2 py-2 text-center whitespace-nowrap">{coin.kr_name||'-'}</td>
                      <td className={`px-2 py-2 text-right ${coin.profit_rate>0?posColor:coin.profit_rate<0?negColor:baseColor}`}>{coin.profit_rate !== undefined ? coin.profit_rate.toFixed(2)+"%" : '-'}</td>
                      <td className={`px-2 py-2 text-right ${(coin.profit_rate_krw||0)>0?posColor:(coin.profit_rate_krw||0)<0?negColor:baseColor}`}>{coin.profit_rate_krw !== undefined ? coin.profit_rate_krw.toFixed(2)+"%" : '-'}</td>
                      <td className="px-2 py-2" />
                      <td className="px-2 py-2 text-right">{curr_price_usd && isFinite(curr_price_usd)? curr_price_usd.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
                      <td className="px-2 py-2 text-right">{curr_price_krw && isFinite(curr_price_krw)? curr_price_krw.toLocaleString(undefined, {maximumFractionDigits:0}): '-'}</td>
                      <td className="px-2 py-2 text-right">{coin.valuation_usd !== undefined ? coin.valuation_usd.toLocaleString(undefined, {maximumFractionDigits:2}) : '-'}</td>
                      <td className="px-2 py-2 text-right">{coin.valuation_krw !== undefined ? coin.valuation_krw.toLocaleString(undefined, {maximumFractionDigits:0}) : '-'}</td>
                      <td className="px-2 py-2 text-right">{(usdKrw !== null && usdKrw !== undefined) ? usdKrw.toLocaleString(undefined, {maximumFractionDigits:2}) : '-'}</td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {loading && (
                <tr><td colSpan={9} className="text-center p-10">시세 확인 중...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
      <footer className="mt-8 text-slate-500 text-xs text-center w-full">
        <div>USD/KRW 환율: {usdKrw ? usdKrw.toLocaleString() : (loading ? <span className="animate-pulse">------</span> : "-")} </div>
      </footer>
    </div>
  );
}
