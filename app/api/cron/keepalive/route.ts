import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: Request) {
  try {
    // 요청 헤더 확인 (Vercel Cron에서만 실행되도록)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 간단한 쿼리로 Supabase 연결 유지
    const { data, error } = await supabase
      .from('crypto_investments')
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
      timestamp: new Date().toISOString()
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
