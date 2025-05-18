"use client";

import { useState, useCallback } from "react";
import ThreeModel from "./ThreeModel";
import NewPostForm from "./NewPostForm";
// import fatchData from "./fatchData";
import { supabase } from "@/lib/supabase";

const EarthWithForm = () => {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [isFormVisible, setIsFormVisible] = useState(false);

  const handleFormOpen = useCallback(() => {
    setLocation({ lat: 0, lon: 0 });
    setIsFormVisible(true);
  }, []);

  const handleLocation = useCallback(async (lat: number, lon: number) => {
    console.log(`クリック位置: 緯度 ${lat}, 経度 ${lon}`);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("lat", lat)
      .eq("lon", lon);
    if (error) {
      console.error("Supabaseエラー:", error);
    }
    console.log("取得した投稿データ:", data);
    setLocation({ lat, lon });
  }, []);

  const handleFormClose = () => {
    setLocation(null);
    setIsFormVisible(false);
  };

  return (
    <>
      <div>
        <ThreeModel
          onPostButtonClick={handleFormOpen}
          onClickLocation={handleLocation}
          isFormVisible={isFormVisible}
        />
      </div>
      <div className="absolute z-50">
        {isFormVisible && location && (
          <NewPostForm
            lat={location.lat}
            lon={location.lon}
            onClose={handleFormClose}
          />
        )}
      </div>
    </>
  );
};

export default EarthWithForm;
