// import { supabase } from '@/lib/supabase'

// const handleLocation = async (lat: number, lon: number) => {
//   console.log(`クリック位置: 緯度 ${lat}, 経度 ${lon}`)

//   // Supabaseからその緯度経度に近い投稿を取得
//   const { data, error } = await supabase
//     .from('posts')
//     .select('*')
//     .eq('latitude', lat)
//     .eq('longitude', lon)

//   if (error) {
//     console.error('Supabaseエラー:', error)
//   } else {
//     console.log('取得したデータ:', data)
//   }
// }
