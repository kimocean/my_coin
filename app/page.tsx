"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

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
  profit_rate_krw?: number;
  latest_buy_date: string;
  buy_rate?: number;
  curr_price_usd?: number;
  curr_price_krw?: number;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState<CoinGrouped[]>([]);
  const [usdKrw, setUsdKrw] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crypto");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCoins((data.coins as CoinGrouped[]).map((coin, idx) => ({
        ...coin,
        symbol: idx === 0 && coin.symbol === "전체" ? "ALL" : coin.symbol,
        kr_name: idx === 0 && coin.symbol === "전체" ? "전체" : coin.kr_name ?? "",
        invested_usd: coin.invested_usd ?? 0,
        invested_krw: coin.invested_krw ?? 0,
        quantity: coin.quantity ?? 0,
        curr_price_usd: coin.valuation_usd && coin.quantity ? coin.valuation_usd / coin.quantity : undefined,
        curr_price_krw: coin.valuation_krw && coin.quantity ? coin.valuation_krw / coin.quantity : undefined,
      })));
      setUsdKrw(data.usdKrw);
    } catch (e: any) {
      setError(e.message || "에러가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [refreshCount]);

  const assembledRows = coins.map((coin, idx) => {
    const buy_price_usd = coin.quantity ? coin.invested_usd / coin.quantity : undefined;
    const buy_price_krw = coin.quantity ? coin.invested_krw / coin.quantity : undefined;
    const curr_price_usd = coin.quantity ? coin.valuation_usd / coin.quantity : undefined;
    const curr_price_krw = coin.quantity ? coin.valuation_krw / coin.quantity : undefined;
    const buy_rate = coin.buy_rate;
    const curr_rate = usdKrw;
    return (
      <React.Fragment key={coin.symbol+idx}>
        {/* 첫번째 줄 */}
        <tr className={idx === 0 ? "font-extrabold bg-slate-900" : ""}>
          <td className="px-2 py-2 text-center whitespace-nowrap">{coin.symbol}</td>
          <td className="px-2 py-2 text-right">{coin.profit_usd?.toLocaleString(undefined, {maximumFractionDigits:2})??'-'}</td>
          <td className="px-2 py-2 text-right">{coin.profit_krw?.toLocaleString(undefined, {maximumFractionDigits:0})??'-'}</td>
          <td className="px-2 py-2 text-right">{coin.quantity?.toLocaleString(undefined, {minimumFractionDigits:5, maximumFractionDigits:5}) ?? '-'}</td>
          <td className="px-2 py-2 text-right">{buy_price_usd && isFinite(buy_price_usd)? buy_price_usd.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
          <td className="px-2 py-2 text-right">{buy_price_krw && isFinite(buy_price_krw)? buy_price_krw.toLocaleString(undefined, {maximumFractionDigits:0}): '-'}</td>
          <td className="px-2 py-2 text-right">{coin.invested_usd?.toLocaleString(undefined, {maximumFractionDigits:2})??'-'}</td>
          <td className="px-2 py-2 text-right">{coin.invested_krw?.toLocaleString(undefined, {maximumFractionDigits:0})??'-'}</td>
          <td className="px-2 py-2 text-right">{buy_rate && isFinite(buy_rate)? buy_rate.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
        </tr>
        {/* 두번째 줄 */}
        <tr className={idx === 0 ? "font-extrabold bg-slate-900 border-b-2 border-slate-700" : "border-b border-slate-800"}>
          <td className="px-2 py-2 text-center whitespace-nowrap">{coin.kr_name||'-'}</td>
          <td className="px-2 py-2 text-right">{coin.profit_rate !== undefined ? coin.profit_rate.toFixed(2)+"%" : '-'}</td>
          <td className="px-2 py-2 text-right">{coin.profit_rate_krw !== undefined ? coin.profit_rate_krw.toFixed(2)+"%" : '-'}</td>
          <td className="px-2 py-2" />
          <td className="px-2 py-2 text-right">{curr_price_usd && isFinite(curr_price_usd)? curr_price_usd.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
          <td className="px-2 py-2 text-right">{curr_price_krw && isFinite(curr_price_krw)? curr_price_krw.toLocaleString(undefined, {maximumFractionDigits:0}): '-'}</td>
          <td className="px-2 py-2 text-right">{coin.valuation_usd?.toLocaleString(undefined, {maximumFractionDigits:2})??'-'}</td>
          <td className="px-2 py-2 text-right">{coin.valuation_krw?.toLocaleString(undefined, {maximumFractionDigits:0})??'-'}</td>
          <td className="px-2 py-2 text-right">{curr_rate && isFinite(curr_rate)? curr_rate.toLocaleString(undefined, {maximumFractionDigits:2}): '-'}</td>
        </tr>
      </React.Fragment>
    );
  });

  return (
    <div className="min-h-screen bg-slate-900 px-1 py-4 text-white flex flex-col items-center">
      <main className="w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-center w-full">코인 수익률 대시보드 (2라인 표 실험)</h1>
          <Link href="/add">
            <button className="ml-2 rounded-full bg-blue-600 hover:bg-blue-800 text-white px-4 py-2 font-bold text-2xl">+</button>
          </Link>
        </div>
        <button
          className="mb-4 w-full rounded-md bg-slate-800 py-2 text-lg font-semibold transition hover:bg-slate-700"
          onClick={() => setRefreshCount((n) => n + 1)}
          disabled={loading}
        >
          {loading ? "시세 확인 중..." : "🔄 새로고침"}
        </button>
        {error && <div className="text-red-400 text-center mb-4">{error}</div>}
        <div className="overflow-x-auto rounded-lg bg-slate-800">
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
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
              <tr className="border-b border-slate-800 text-slate-400">
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
              {loading
                ? <tr><td colSpan={9} className="text-center p-10">시세 확인 중...</td></tr>
                : assembledRows}
            </tbody>
          </table>
        </div>
      </main>
      <footer className="mt-8 text-slate-500 text-xs text-center w-full">
        <div>USD/KRW 환율: {usdKrw ? usdKrw.toLocaleString() : (loading ? <span className="animate-pulse">------</span> : "-")} </div>
        <div>&copy; {new Date().getFullYear()} my-crypto-dashboard</div>
      </footer>
    </div>
  );
}
