import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-client@2"

serve(async (req) => {
  // 1. สร้าง Supabase Client (ใช้ Service Role Key เพื่อสิทธิ์ในการ Update ทุกแถว)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // 2. ดึงข้อมูลคอมมิกที่ต้องการคำนวณ
    const { data: comics, error: fetchError } = await supabase
      .from('comics')
      .select('id, views_count, likes_count, comments_count, updated_at')

    if (fetchError) throw fetchError

    // 3. คำนวณคะแนนด้วยสูตร Trending
    const updates = comics.map((comic: any) => {
      const hoursSinceUpdate = (Date.now() - new Date(comic.updated_at).getTime()) / 3600000
      
      // LaTeX Formula: $Score = \frac{(V \times 1) + (L \times 5) + (C \times 10)}{(T + 2)^{1.8}}$
      const score = (comic.views_count * 1 + comic.likes_count * 5 + comic.comments_count * 10) / 
                    Math.pow(hoursSinceUpdate + 2, 1.8)

      return { id: comic.id, trending_score: score }
    })

    // 4. อัปเดตคะแนนกลับลงไปใน Database (Upsert)
    const { error: updateError } = await supabase
      .from('comics')
      .upsert(updates)

    if (updateError) throw updateError

    return new Response(JSON.stringify({ success: true, message: "Trending updated!" }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
