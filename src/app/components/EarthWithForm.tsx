"use client";

import { useState, useCallback } from "react";
import ThreeModel from "./ThreeModel";
import NewPostForm from "./NewPostForm";

const EarthWithForm = () => {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );

  // PostButtonがクリックされたときに呼び出されるハンドラ
  // NewPostFormがlat/lonを必要とするため、デフォルト値を設定
  const handleFormOpen = useCallback(() => {
    setLocation({ lat: 0, lon: 0 }); // 仮のデフォルト位置
  }, []);

  return (
    <>
      <div>
        <ThreeModel onPostButtonClick={handleFormOpen} />
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
