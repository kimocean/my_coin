"use client";
import React, { useState } from "react";
import DatePicker from "react-datepicker";
import dayjs from "dayjs";

export default function EditModal({open, row, onClose, onSaved}:{open:boolean, row:any, onClose:()=>void, onSaved:()=>void}) {
  const [form, setForm] = useState({ ...row });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  if (!open) return null;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => {
    setForm((f: any)=>({...f, [e.target.name]: e.target.value }));
  };
  const handleDate = (d:Date)=> setForm((f: any)=>({...f, trade_date:dayjs(d).format('YYYY-MM-DD')}));
  const handleSave = async(e:React.FormEvent)=>{
    e.preventDefault(); setError(""); setSaving(true);
    try{
      const payload = {...form};
      const res = await fetch('/api/crypto', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!res.ok) throw new Error(await res.text());
      onSaved();
    }catch(err:any){setError(err.message)}finally{ setSaving(false); }
  };
  const handleDelete=async()=>{
    if(!form.id) return;
    setSaving(true);
    try{
      const res = await fetch('/api/crypto', {method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:form.id})});
      if(!res.ok) throw new Error(await res.text());
      onSaved();
    }catch(err:any){setError(err.message)}finally{setSaving(false);}
  }
  return (
    <div className="fixed z-[100] inset-0 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <form className="relative z-10 bg-slate-800 rounded-xl px-7 py-6 max-w-sm w-full mx-auto border border-slate-400 flex flex-col gap-4" style={{minWidth:'320px'}} onSubmit={handleSave} onClick={e=>e.stopPropagation()}>
        <button type="button" className="absolute right-3 top-2 text-2xl text-slate-400 hover:text-white" onClick={onClose}>×</button>
        <h2 className="font-bold mb-2 text-center">거래내역 수정</h2>
        <input type="hidden" name="id" value={form.id} readOnly />
        <label className="flex flex-col gap-1 text-sm text-slate-300">구분<select name="trade_type" value={form.trade_type} onChange={handleChange} className="rounded p-2 text-white border border-slate-500 bg-slate-700"><option value="매수">매수</option><option value="매도">매도</option></select></label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">심볼<input name="symbol" value={form.symbol} onChange={handleChange} className="rounded p-2 text-white border border-slate-500 bg-slate-700" /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">한글명<input name="kr_name" value={form.kr_name} onChange={handleChange} className="rounded p-2 text-white border border-slate-500 bg-slate-700" /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">거래일자<DatePicker selected={form.trade_date?dayjs(form.trade_date).toDate():undefined} onChange={handleDate} dateFormat="yyyy-MM-dd" className="rounded p-2 text-white border border-slate-500 bg-slate-700 w-full" /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">수량<input name="quantity" value={form.quantity} onChange={handleChange} className="rounded p-2 text-white border border-slate-500 bg-slate-700" /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">금액(KRW)<input name="invested_krw" value={form.invested_krw} onChange={handleChange} className="rounded p-2 text-white border border-slate-500 bg-slate-700" /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">금액(USD)<input name="invested_usd" value={form.invested_usd} onChange={handleChange} className="rounded p-2 text-white border border-slate-500 bg-slate-700" /></label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">환율<input name="trade_rate" value={form.trade_rate} onChange={handleChange} className="rounded p-2 text-white border border-slate-500 bg-slate-700" /></label>
        {error && <div className="text-red-400 rounded p-1 text-center text-xs mb-1">{error}</div>}
        <div className="flex gap-3">
          <button type="submit" className="rounded flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 font-bold">저장</button>
          <button type="button" className="rounded flex-1 bg-rose-600 hover:bg-rose-800 text-white py-2 font-bold" onClick={()=>setConfirmDel(true)}>삭제</button>
        </div>
        {confirmDel && (<div className="fixed inset-0 z-[110] flex items-center justify-center"><div className="bg-black/70 p-6 rounded shadow-xl text-white">정말 삭제하시겠습니까?<br/><button type="button" className="bg-rose-600 rounded px-3 py-2 m-2" onClick={handleDelete}>확인</button><button onClick={()=>setConfirmDel(false)} className="ml-2">취소</button></div></div>)}
      </form>
    </div>
  )
}
