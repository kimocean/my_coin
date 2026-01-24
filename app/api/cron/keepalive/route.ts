import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

export async function GET(req: Request) {
  try {
    // Vercel Cron 인증 확인 (x-vercel-cron 헤더 확인)
    const cronHeader = req.headers.get('x-vercel-cron');
    // CRON_SECRET이 설정되어 있으면 추가 인증 확인
    if (process.env.CRON_SECRET) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && !cronHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (!cronHeader) {
      // CRON_SECRET이 없으면 Vercel Cron 헤더만 확인
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
