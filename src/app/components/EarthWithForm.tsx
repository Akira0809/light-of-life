"use client";

import { useState, useCallback } from "react";
import ThreeModel from "./ThreeModel";
import NewPostForm from "./NewPostForm";
// import fatchData from "./fatchData";
import { supabase } from '@/lib/supabase'

const EarthWithForm = () => {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );

  // PostButtonがクリックされたときに呼び出されるハンドラ
  // NewPostFormがlat/lonを必要とするため、デフォルト値を設定
  const handleFormOpen = useCallback(() => {
    setLocation({ lat: 0, lon: 0 }); // 仮のデフォルト位置
  }, []);
const handleLocation = useCallback(async (lat: number, lon: number) => {
  console.log(`クリック位置: 緯度 ${lat}, 経度 ${lon}`)
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('lat', lat)
        .eq('lon', lon)
        if (error) {
          console.error('Supabaseエラー:', error)
          return
        }
        console.log('取得した投稿データ:', data)
        setLocation({ lat, lon });
  }, []);

  return (
    <>
      <div>
        <ThreeModel 
        onPostButtonClick={handleFormOpen}
        onClickLocation={handleLocation}
         />
        
      </div>
      <div className="absolute z-50">
        {location && (
          <NewPostForm
            lat={location.lat}
            lon={location.lon}
            onClose={() => setLocation(null)}
          />
        )}
      </div>
    </>
  );
};

export default EarthWithForm;
