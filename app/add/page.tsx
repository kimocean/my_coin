"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import dayjs from "dayjs";
import "react-datepicker/dist/react-datepicker.css";

const NAVER_RATE_DATE_URL = (date: string) => `https://api.manana.kr/exchange/rate/KRW/USD/${date}.json`;

// 평일로 보정 (토=6/일=0이면, 이전 금요일)
function adjustToBusinessDay(date: Date): Date {
  let d = new Date(date);
  const dow = d.getDay();
  if (dow === 0) d.setDate(d.getDate() - 2); // Sunday -> Friday
  else if (dow === 6) d.setDate(d.getDate() - 1); // Saturday -> Friday
  return d;
}

export default function AddCoinPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    symbol: "",
    kr_name: "",
    buy_date: dayjs().format("YYYY-MM-DD"),
    quantity: "",
    invested_krw: "",
  });
  const [pickedDate, setPickedDate] = useState<Date>(new Date());
  const [buyRate, setBuyRate] = useState<number|undefined>();
  const [investedUsd, setInvestedUsd] = useState<number|undefined>();
  const [loadingRate, setLoadingRate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [buyRateUrl, setBuyRateUrl] = useState<string>("");
  const [buyRateFallback, setBuyRateFallback] = useState(false);
  const [buyRateWarn, setBuyRateWarn] = useState<string>("");

  // 환율 fetch (선택한 날짜, 또는 그날이 불가하면 가장 가까운 평일)
  useEffect(() => {
    async function fetchRate(refDate: Date) {
      setLoadingRate(true); setBuyRate(undefined); setBuyRateWarn("");
      const ymd = dayjs(refDate).format("YYYY-MM-DD");
      const url = NAVER_RATE_DATE_URL(ymd);
      setBuyRateUrl(url); setBuyRateFallback(false);
      try {
        const res = await fetch(url);
        if (res.status === 404) throw new Error("404");
        const data = await res.json();
        const rate = Array.isArray(data) ? data[0]?.rate : null;
        if (typeof rate === "number" && rate > 1000 && rate < 2000) {
          setBuyRate(rate);
        } else {
          setBuyRate(1450); setBuyRateFallback(true); setBuyRateWarn("(환율 데이터 없음. 기본값 사용)");
          console.warn("환율 API fallback 적용:", data, url);
        }
      } catch (err) {
        // 주말/공휴일 등으로 인한 404 or fetch실패시 => 가장 가까운 평일로 재시도
        if (dayjs(refDate).day() === 0 || dayjs(refDate).day() === 6) {
          const bd = adjustToBusinessDay(refDate);
          if (dayjs(bd).isSame(refDate, 'day')) { setBuyRate(1450); setBuyRateFallback(true); setBuyRateWarn('(환율 데이터 없음. 기본값 사용)'); return; }
          await fetchRate(bd); // 재귀! 새로운 평일로 시도
        } else {
          setBuyRate(1450); setBuyRateFallback(true); setBuyRateWarn("(환율 데이터 없음. 기본값 사용)");
          console.warn("환율 API 오류 fallback", err, url);
        }
      } finally {
        setLoadingRate(false);
      }
    }
    const d = pickedDate;
    setForm(f => ({ ...f, buy_date: dayjs(d).format("YYYY-MM-DD") }));
    if(d) fetchRate(d);
  }, [pickedDate]);

  // invested_usd 계산
  useEffect(() => {
    if (buyRate && form.invested_krw && !isNaN(Number(form.invested_krw))) {
      setInvestedUsd(Number(form.invested_krw) / buyRate);
    } else {
      setInvestedUsd(undefined);
    }
  }, [buyRate, form.invested_krw]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaving(true);
    try {
      const payload = {
        symbol: form.symbol,
        kr_name: form.kr_name,
        buy_date: form.buy_date,
        quantity: Number(form.quantity),
        invested_krw: Number(form.invested_krw),
        invested_usd: investedUsd,
        buy_rate: buyRate,
      };
      const res = await fetch("/api/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push("/");
    } catch (err: any) {
      setError(err?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center py-12 px-2">
      <form
        className="bg-slate-800 rounded-lg shadow-md px-6 py-7 w-full max-w-md flex flex-col gap-5"
        onSubmit={handleSubmit}
      >
        <h2 className="text-xl font-bold text-white mb-2 text-center">코인 매수 데이터 추가</h2>
        <label className="flex flex-col gap-1 text-slate-300">
          매수일자
          <DatePicker
            selected={pickedDate}
            onChange={date => date && setPickedDate(date)}
            dateFormat="yyyy-MM-dd"
            className="rounded p-3 text-white border border-slate-500 focus:outline-blue-500 bg-slate-700 w-full"
            calendarClassName="bg-slate-300"
            popperPlacement="bottom"
          />
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          매입수량
          <input name="quantity" value={form.quantity} onChange={handleChange} required className="rounded p-3 text-white border border-slate-500 focus:outline-blue-500 bg-slate-700" type="number" min="0" step="any" />
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          매입금액(KRW)
          <input name="invested_krw" value={form.invested_krw} onChange={handleChange} required className="rounded p-3 text-white border border-slate-500 focus:outline-blue-500 bg-slate-700" type="number" min="0" step="any" />
        </label>
        <div className="flex flex-col gap-0.5 text-xs text-slate-400">
          <div>매입환율: {loadingRate? <span className="animate-pulse">조회중...</span> : (buyRate ?? '-')}
            {buyRateWarn && <span className="text-rose-400 ml-2">{buyRateWarn}</span>}
          </div>
          {buyRateUrl && (
            <div>환율 API: <a href={buyRateUrl} className="underline" target="_blank" rel="noopener noreferrer">{buyRateUrl}</a></div>
          )}
          <div>매입금액(USD): {investedUsd !== undefined ? investedUsd.toLocaleString(undefined, {maximumFractionDigits:4}) : '-'}</div>
        </div>
        <label className="flex flex-col gap-1 text-slate-300">
          심볼
          <input name="symbol" value={form.symbol} onChange={handleChange} required className="rounded p-3 text-white border border-slate-500 focus:outline-blue-500 bg-slate-700" maxLength={12} />
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          한글명
          <input name="kr_name" value={form.kr_name} onChange={handleChange} required className="rounded p-3 text-white border border-slate-500 focus:outline-blue-500 bg-slate-700" maxLength={20} />
        </label>
        {error && <div className="text-red-400 rounded p-1 text-center text-sm">{error}</div>}
        <button
          type="submit"
          className="mt-2 rounded bg-blue-600 hover:bg-blue-700 text-white py-2 font-bold text-lg w-full"
          disabled={saving || loadingRate}
        >{saving ? "저장중..." : "추가하기"}</button>
        <button type="button" className="text-slate-400 hover:underline mt-1 text-sm w-full" onClick={()=>router.back()}>◀ 돌아가기</button>
      </form>
    </div>
  );
}
