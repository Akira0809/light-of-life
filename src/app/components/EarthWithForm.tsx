'use client'

import { useState } from 'react'
import ThreeModel from './ThreeModel'
import NewPostForm from './NewPostForm'
import { div } from 'three/tsl'

const EarthWithForm = () => {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)

  const handleLocation = (lat: number, lon: number) => {
    setLocation({ lat, lon })
  }

  return (
    <>
      <ThreeModel onClickLocation={handleLocation} />
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
  )
}

export default EarthWithForm
