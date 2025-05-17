"use client";

import { useState } from "react";
import ThreeModel from "./ThreeModel";
import NewPostForm from "./NewPostForm";

const EarthWithForm = () => {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );

  const handleLocation = (lat: number, lon: number) => {
    setLocation({ lat, lon });
  };

  return (
    <>
      <div style={{ display: location ? "none" : "block" }}>
        <ThreeModel onClickLocation={handleLocation} />
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
