import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  '';
const cronSecret = process.env.CRON_SECRET || '';

function formatKst(date: Date) {
  // ISO 형태가 필요하면 서버/클라에서 timeZone 변환을 해도 되지만,
  // 여기서는 사람이 보기 좋은 KST 문자열을 함께 내려준다.
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} KST`;
}

// Supabase를 깨우기 위한 단순 keepalive 엔드포인트
// - 인증 없이 누구나 호출 가능하게 두어, Vercel Cron / 수동 호출 모두 성공하게 함
export async function GET(request: Request) {
  const timestamp = new Date().toISOString();
  const timestampKst = formatKst(new Date());
  const isCron = request.headers.get('x-vercel-cron') === '1';
  const source = isCron ? 'Vercel Cron' : 'Manual/API';
  
  console.log(`[${timestamp}] Keepalive called from: ${source}`);
  
  try {
    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${timestamp}] Missing Supabase credentials`);
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase credentials not configured',
        timestamp,
        source
      }, { status: 500 });
    }

    // Cron Secret이 설정되어 있으면, Cron 호출만 허용
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      const ok = authHeader === `Bearer ${cronSecret}`;
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized', timestamp, source },
          { status: 401 }
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // write heartbeat: DB 함수로 seq 증가 + last_time 갱신(원자적)
    // - Supabase SQL Editor에서 public.bump_heartbeat() 함수를 생성해둬야 함
    const { data, error } = await supabase
      .rpc('bump_heartbeat', { p_source: source })
      .single();

    if (error) {
      console.error(`[${timestamp}] Keepalive error:`, error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        timestamp,
        source
      }, { status: 500 });
    }

    console.log(`[${timestamp}] Keepalive successful from ${source}`);
    
    const res = NextResponse.json({ 
      success: true, 
      message: 'Supabase keepalive successful',
      timestamp,
      timestampKst,
      source,
      heartbeat: data,
      heartbeatLastTimeKst: data?.last_time ? formatKst(new Date(data.last_time)) : null,
    });
    // 캐시로 인해 Supabase 호출이 생략되는 것을 방지
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error(`[${timestamp}] Keepalive exception:`, err);
    return NextResponse.json({ 
      success: false, 
      error: String(err),
      timestamp,
      source
    }, { status: 500 });
  }
}
