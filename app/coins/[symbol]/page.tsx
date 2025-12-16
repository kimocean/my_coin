"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import dayjs from "dayjs";
import "react-datepicker/dist/react-datepicker.css";

interface Transaction {
  id: number;
  symbol: string;
  kr_name: string;
  trade_date: string;
  trade_type: string;
  quantity: number;
  invested_krw: number;
  invested_usd: number;
  trade_rate: number;
  created_at: string;
}

export default function CoinDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = params.symbol as string;
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // 검색 조건
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [tradeType, setTradeType] = useState<string>("전체");
  
  // 수정 모달
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  
  const limit = 10;
  const totalPages = Math.ceil(total / limit);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        symbol,
        page: page.toString(),
        limit: limit.toString(),
      });
      if (startDate) params.append('startDate', dayjs(startDate).format('YYYY-MM-DD'));
      if (endDate) params.append('endDate', dayjs(endDate).format('YYYY-MM-DD'));
      if (tradeType !== '전체') params.append('tradeType', tradeType === '매수' ? 'B' : 'S');
      
      const res = await fetch(`/api/crypto?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`API 오류: ${res.status}`);
      }
      const text = await res.text();
      if (!text) {
        throw new Error('서버에서 빈 응답을 반환했습니다.');
      }
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);
      setTransactions(data.rows || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error('fetchData error:', err);
      alert(`데이터 로딩 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [page, startDate, endDate, tradeType]);
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };
  
  const goToFirstPage = () => setPage(1);
  const goToLastPage = () => setPage(totalPages);
  const goToPrevTen = () => setPage(Math.max(1, page - 10));
  const goToNextTen = () => setPage(Math.min(totalPages, page + 10));
  
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-2xl hover:opacity-70 transition"
            title="돌아가기"
          >
            ◀️
          </button>
          <h1 className="text-lg font-bold text-center flex-1">{symbol} 거래 내역</h1>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-2xl hover:opacity-70 transition disabled:opacity-50 disabled:cursor-not-allowed"
            title={loading ? "로딩중..." : "새로고침"}
          >
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
        
        {/* 검색 조건 */}
        <div className="bg-slate-800 p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-slate-300">일자</span>
            <DatePicker
              selected={startDate}
              onChange={date => setStartDate(date)}
              dateFormat="yyyy-MM-dd"
              placeholderText="시작일"
              isClearable
              className="rounded p-2 text-white border border-slate-500 bg-slate-700 w-32"
            />
            <span className="text-slate-400">~</span>
            <DatePicker
              selected={endDate}
              onChange={date => setEndDate(date)}
              dateFormat="yyyy-MM-dd"
              placeholderText="종료일"
              isClearable
              className="rounded p-2 text-white border border-slate-500 bg-slate-700 w-32"
            />
            <span className="text-sm text-slate-300 sm:ml-4">구분</span>
            <select
              value={tradeType}
              onChange={e => setTradeType(e.target.value)}
              className="rounded p-2 text-white border border-slate-500 bg-slate-700 appearance-none h-[36px]"
            >
              <option value="전체">전체</option>
              <option value="매수">매수</option>
              <option value="매도">매도</option>
            </select>
          </div>
          <button
            onClick={() => { setPage(1); fetchData(); }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed sm:ml-auto"
          >
            {loading ? '조회중...' : '조회'}
          </button>
        </div>
        
        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">구분</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">수량</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">금액(KRW)</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">금액(USD)</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">일자</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10">로딩 중...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">데이터가 없습니다</td>
                </tr>
              ) : (
                transactions.map(tx => (
                  <tr
                    key={tx.id}
                    onClick={() => setEditingTx(tx)}
                    className="border-b border-slate-600 hover:bg-slate-800 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 text-center">
                      {tx.trade_type === 'B' ? '매수' : tx.trade_type === 'S' ? '매도' : tx.trade_type}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.quantity?.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.invested_krw?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.invested_usd?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">{tx.trade_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* 페이징 */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={goToFirstPage}
            disabled={page === 1 || loading}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {"<<"}
          </button>
          <button
            onClick={goToPrevTen}
            disabled={page <= 10 || loading}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {"<"}
          </button>
          {(() => {
            const startPage = Math.floor((page - 1) / 10) * 10 + 1;
            const endPage = Math.min(startPage + 9, totalPages);
            const pages = [];
            for (let i = startPage; i <= endPage; i++) {
              pages.push(
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  disabled={loading}
                  className={`px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed ${
                    i === page
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {i}
                </button>
              );
            }
            return pages;
          })()}
          <button
            onClick={goToNextTen}
            disabled={page + 10 > totalPages || loading}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {">"}
          </button>
          <button
            onClick={goToLastPage}
            disabled={page === totalPages || loading}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {">>"}
          </button>
        </div>
      </div>
      
      {/* 수정 모달 */}
      {editingTx && (
        <EditModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={() => {
            setEditingTx(null);
            // sessionStorage 캐시 무효화 플래그 설정 (새 데이터 반영을 위해)
            sessionStorage.setItem('crypto-dashboard-cache-invalidated', 'true');
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// 수정/삭제 모달 컴포넌트
function EditModal({ transaction, onClose, onSave }: {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    trade_type: transaction.trade_type,
    symbol: transaction.symbol,
    kr_name: transaction.kr_name,
    trade_date: transaction.trade_date,
    quantity: transaction.quantity.toLocaleString(undefined, {minimumFractionDigits: 5, maximumFractionDigits: 5}),
    invested_krw: transaction.invested_krw.toLocaleString(undefined, {maximumFractionDigits: 0}),
    trade_rate: transaction.trade_rate?.toLocaleString(undefined, {maximumFractionDigits: 2}) || '',
  });
  const [pickedDate, setPickedDate] = useState<Date>(new Date(transaction.trade_date));
  const [investedUsd, setInvestedUsd] = useState<number>(transaction.invested_usd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    setForm(f => ({ ...f, trade_date: dayjs(pickedDate).format('YYYY-MM-DD') }));
  }, [pickedDate]);
  
  useEffect(() => {
    const rate = Number(form.trade_rate.replace(/,/g, ''));
    const krw = Number(form.invested_krw.replace(/,/g, ''));
    if (rate > 0 && krw > 0) {
      setInvestedUsd(krw / rate);
    }
  }, [form.trade_rate, form.invested_krw]);
  
  const formatNumber = (val: string, allowDecimal: boolean = true): string => {
    let numStr = val.replace(/,/g, '');
    if (allowDecimal) {
      numStr = numStr.replace(/[^\d.]/g, '');
      if (numStr.split('.').length > 2) numStr = numStr.replace(/\.(?=.*\.)/g, '');
    } else {
      numStr = numStr.replace(/[^\d]/g, '');
    }
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name;
    let val = e.target.value;
    if (["quantity", "invested_krw", "trade_rate"].includes(name)) {
      val = formatNumber(val, true); // 모두 소수점 허용
    }
    setForm(f => ({ ...f, [name]: val }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: transaction.id,
        trade_type: form.trade_type,
        symbol: form.symbol,
        kr_name: form.kr_name,
        trade_date: form.trade_date,
        quantity: Number(form.quantity.replace(/,/g, '')),
        invested_krw: Number(form.invested_krw.replace(/,/g, '')),
        invested_usd: investedUsd,
        trade_rate: Number(form.trade_rate.replace(/,/g, '')),
      };
      const res = await fetch('/api/crypto', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      onSave();
    } catch (err: any) {
      setError(err?.message || '수정 실패');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/crypto', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transaction.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSave();
    } catch (err: any) {
      alert(err?.message || '삭제 실패');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed z-[1000] inset-0 flex items-center justify-center overflow-y-auto py-4 bg-slate-900">
      <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-[2px] min-h-full" onClick={onClose}></div>
      <form
        className="relative z-10 bg-slate-800 rounded-lg shadow-xl px-5 py-7 w-full max-w-sm mx-auto my-auto flex flex-col gap-5 border border-slate-500"
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="absolute right-3 top-2 text-2xl text-slate-400 hover:text-white" onClick={onClose}>×</button>
        <h2 className="text-xl font-bold text-white mb-2 text-center">거래 내역 수정</h2>
        
        <label className="flex flex-col gap-1 text-slate-300">
          구분
          <select name="trade_type" value={form.trade_type} onChange={handleChange} className="rounded p-3 text-white border border-slate-500 bg-slate-700 appearance-none h-[48px]">
            <option value="B">매수</option>
            <option value="S">매도</option>
          </select>
        </label>
        
        <label className="flex flex-col gap-1 text-slate-300">
          심볼
          <input name="symbol" value={form.symbol} onChange={handleChange} className="rounded p-3 text-white border border-slate-500 bg-slate-700" />
        </label>
        
        <label className="flex flex-col gap-1 text-slate-300">
          한글명
          <input name="kr_name" value={form.kr_name} onChange={handleChange} className="rounded p-3 text-white border border-slate-500 bg-slate-700" />
        </label>
        
        <label className="flex flex-col gap-1 text-slate-300">
          거래일자
          <DatePicker
            selected={pickedDate}
            onChange={date => date && setPickedDate(date)}
            dateFormat="yyyy-MM-dd"
            className="rounded p-3 text-white border border-slate-500 bg-slate-700 w-full"
          />
        </label>
        
        <label className="flex flex-col gap-1 text-slate-300">
          수량
          <input name="quantity" value={form.quantity} onChange={handleChange} className="rounded p-3 text-white border border-slate-500 bg-slate-700" />
        </label>
        
        <label className="flex flex-col gap-1 text-slate-300">
          금액(KRW)
          <input name="invested_krw" value={form.invested_krw} onChange={handleChange} className="rounded p-3 text-white border border-slate-500 bg-slate-700" />
        </label>
        
        <label className="flex flex-col gap-1 text-slate-300">
          환율
          <input name="trade_rate" value={form.trade_rate} onChange={handleChange} className="rounded p-3 text-white border border-slate-500 bg-slate-700" />
        </label>
        
        <div className="text-xs text-slate-400">
          금액(USD): {investedUsd?.toLocaleString(undefined, { maximumFractionDigits: 4 }) || '-'}
        </div>
        
        {error && <div className="text-red-400 text-sm text-center">{error}</div>}
        
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded bg-blue-600 hover:bg-blue-700 text-white py-2 font-bold"
            disabled={saving}
          >
            {saving ? '저장중...' : '저장'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 rounded bg-red-600 hover:bg-red-700 text-white py-2 font-bold"
            disabled={saving}
          >
            삭제
          </button>
        </div>
      </form>
    </div>
  );
}
