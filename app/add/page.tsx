"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import dayjs from "dayjs";
import "react-datepicker/dist/react-datepicker.css";

const NAVER_RATE_URL = 'https://api.manana.kr/exchange/rate/KRW/USD.json';

function getClosestBusinessDay(date: Date): string {
  let d = new Date(date);
  // 최대 1000일 loop 제한(실수 방지, 1950년 이전으로는 실행 안함)
  for (let tries = 0; tries < 1000; tries++) {
    if (d.getDay() !== 0 && d.getDay() !== 6) return dayjs(d).format("YYYY-MM-DD");
    d.setDate(d.getDate() - 1);
    if (d.getFullYear() < 1950) break;
  }
  return dayjs(date).format("YYYY-MM-DD");
}

const tradeTypeOptions = [
  { label: "매수", value: "B" },
  { label: "매도", value: "S" }
];

export default function AddCoinPage({ isOpen = true, onClose }: { isOpen?: boolean, onClose?: () => void }) {
  const router = useRouter();
  // 진짜 등록용 form state
  const [form, setForm] = useState({
    trade_type: "B",
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
  const [buyRateFallback, setBuyRateFallback] = useState(false);
  const [buyRateWarn, setBuyRateWarn] = useState<string>("");
  const [touched, setTouched] = useState<{[k:string]:boolean}>({});

  // 환율 fetch (해당일->가장 가까운 과거 평일까지 재귀)
  useEffect(() => {
    async function fetchRate() {
      setLoadingRate(true); setBuyRate(undefined); setBuyRateWarn("");
      try {
        const res = await fetch(NAVER_RATE_URL);
        const data = await res.json();
        const rate = Array.isArray(data) && typeof data[0]?.rate === 'number' ? data[0].rate : null;
        if (rate && rate > 1000 && rate < 2000) {
          setBuyRate(rate);
          setBuyRateWarn("");
        } else {
          setBuyRate(1450);
          setBuyRateWarn("(환율 데이터 없음. 기본값 사용)");
        }
      } catch (err) {
        console.error("환율 fetch 실패", err);
        setBuyRate(1450);
        setBuyRateWarn("(환율 데이터 없음. 기본값 사용)");
      } finally {
        setLoadingRate(false);
      }
    }
    setForm(f => ({ ...f, buy_date: dayjs(pickedDate).format("YYYY-MM-DD") }));
    fetchRate();
  }, [pickedDate]);

  useEffect(() => {
    const krw = Number(form.invested_krw.replace(/,/g, ''));
    if (buyRate && form.invested_krw && !isNaN(krw)) {
      setInvestedUsd(krw / buyRate);
    } else {
      setInvestedUsd(undefined);
    }
  }, [buyRate, form.invested_krw]);

  // 숫자 포맷팅 (콤마 추가/제거)
  const formatNumber = (val: string, allowDecimal: boolean = true): string => {
    // 콤마 제거하고 숫자만 추출
    let numStr = val.replace(/,/g, '');
    if (allowDecimal) {
      numStr = numStr.replace(/[^\d.]/g, '');
      if (numStr.split('.').length > 2) numStr = numStr.replace(/\.(?=.*\.)/g, ''); // 소수점 1회만
    } else {
      numStr = numStr.replace(/[^\d]/g, '');
    }
    // 콤마 추가
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>|React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.name;
    let val = e.target.value;
    
    // 숫자 필드는 콤마 포맷팅 적용
    if (["quantity", "invested_krw"].includes(name)) {
      val = formatNumber(val, name === "quantity"); // quantity는 소수점 허용
    }
    
    setForm(f => ({ ...f, [name]: val }));
    setTouched(t => ({...t, [name]: true}));
  };
  const closeModal = () => {
    if(onClose) onClose();
    else router.push("/");
  };
  const isInvalid = (name: keyof typeof form) => touched[name] && !form[name];
  const allFilled = Object.entries(form).every(([k,v])=>!!v);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSaving(true);
    if(!allFilled) {
      setError("모든 입력란을 올바르게 입력해 주세요.");
      // 전체 touched 처리
      setTouched(t => {
        const nt = { ...t };
        Object.keys(form).forEach(f=>{ nt[f]=true });
        return nt;
      });
      setSaving(false); return;
    }
    try {
      const quantity = Number(form.quantity.replace(/,/g, ''));
      const invested_krw = Number(form.invested_krw.replace(/,/g, ''));
      if(isNaN(quantity)||isNaN(invested_krw)||!form.symbol||!form.kr_name||!form.buy_date||quantity<=0||invested_krw<=0) {
        setError("모든 입력란을 올바르게 입력해 주세요."); setSaving(false); return;
      }
      const payload = {
        trade_type: form.trade_type,
        symbol: form.symbol,
        kr_name: form.kr_name,
        trade_date: form.buy_date,
        quantity, invested_krw, invested_usd: investedUsd,
        trade_rate: buyRate,
      };
      const res = await fetch("/api/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      // 대시보드 새로고침
      if (onClose) {
        onClose();
        window.location.reload();
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      console.error("등록실패:", err);
      setError(err?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // 모달 오버레이와 팝업
  if (!isOpen) return null;
  return (
    <div className="fixed z-[1000] inset-0 flex items-center justify-center overflow-y-auto py-4 bg-slate-900">
      <div className="absolute inset-0 bg-slate-900 bg-opacity-80 backdrop-blur-[2px] transition-all duration-200 min-h-full" onClick={closeModal}></div>
      {/* 팝업 본체 */}
      <form
        className="relative z-10 bg-slate-800 rounded-lg shadow-xl px-5 py-7 w-full max-w-sm mx-auto my-auto flex flex-col gap-5 border border-slate-500"
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
      >
        {/* X 버튼 */}
        <button type="button" aria-label="닫기" className="absolute right-3 top-2 text-2xl text-slate-400 hover:text-white" onClick={closeModal}>×</button>
        <h2 className="text-xl font-bold text-white mb-2 text-center">거래 내역 추가</h2>
        <label className="flex flex-col gap-1 text-slate-300">
          구분
          <select name="trade_type" value={form.trade_type} onChange={handleChange} className={`rounded p-3 text-white border ${isInvalid('trade_type') ? 'border-red-500' : 'border-slate-500'} focus:outline-blue-500 bg-slate-700`}>
            {tradeTypeOptions.map(o=>(<option value={o.value} key={o.value}>{o.label}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          심볼
          <input name="symbol" value={form.symbol} onChange={handleChange} required className={`rounded p-3 text-white border ${isInvalid('symbol')?'border-red-500':'border-slate-500'} focus:outline-blue-500 bg-slate-700`} maxLength={12} />
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          한글명
          <input name="kr_name" value={form.kr_name} onChange={handleChange} required className={`rounded p-3 text-white border ${isInvalid('kr_name')?'border-red-500':'border-slate-500'} focus:outline-blue-500 bg-slate-700`} maxLength={20} />
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          매수일자
          <DatePicker
            selected={pickedDate}
            onChange={date => { 
              if(date) { 
                setPickedDate(date); 
                setTouched(t => ({...t, buy_date: true})); 
              } 
            }}
            dateFormat="yyyy-MM-dd"
            className={`rounded p-3 text-white border ${isInvalid('buy_date') ? 'border-red-500' : 'border-slate-500'} focus:outline-blue-500 bg-slate-700 w-full`}
            calendarClassName="bg-slate-300"
            popperPlacement="bottom"
          />
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          매입수량
          <input name="quantity" value={form.quantity} onChange={handleChange} required inputMode="decimal" className={`rounded p-3 text-white border ${isInvalid('quantity')?'border-red-500':'border-slate-500'} focus:outline-blue-500 bg-slate-700`} type="text" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-slate-300">
          매입금액(KRW)
          <input name="invested_krw" value={form.invested_krw} onChange={handleChange} required inputMode="decimal" className={`rounded p-3 text-white border ${isInvalid('invested_krw')?'border-red-500':'border-slate-500'} focus:outline-blue-500 bg-slate-700`} type="text" autoComplete="off" />
        </label>
        <div className="flex flex-col gap-0.5 text-xs text-slate-400">
          <div>
            매입환율: {loadingRate? <span className="animate-pulse">조회중...</span> : (buyRate !== undefined ? buyRate.toLocaleString(undefined, {maximumFractionDigits:2}) : '-')}
            {buyRateWarn && <span className="text-rose-400 ml-2">{buyRateWarn}</span>}
          </div>
          <div>매입금액(USD): {investedUsd !== undefined ? investedUsd.toLocaleString(undefined, {maximumFractionDigits:4}) : '-'}</div>
        </div>
        {error && <div className="text-red-400 rounded p-1 text-center text-sm">{error}</div>}
        <button
          type="submit"
          className="mt-2 rounded bg-blue-600 hover:bg-blue-700 text-white py-2 font-bold w-full"
          disabled={saving || loadingRate}
          title={saving ? "저장중..." : "추가하기"}
        >{saving ? "⏳" : "등록"}</button>
      </form>
    </div>
  );
}
