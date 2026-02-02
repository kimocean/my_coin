import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

// Supabase를 깨우기 위한 단순 keepalive 엔드포인트
// - 인증 없이 누구나 호출 가능하게 두어, Vercel Cron / 수동 호출 모두 성공하게 함
export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Supabase credentials not configured',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 실제 사용하는 테이블(coin)에 쿼리하여 Supabase 연결 유지
    const { data, error } = await supabase
      .from('coin')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Keepalive error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Supabase keepalive successful',
      timestamp: new Date().toISOString(),
      dataCount: data?.length || 0
    });
  } catch (err) {
    console.error('Keepalive exception:', err);
    return NextResponse.json({ 
      success: false, 
      error: String(err),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
