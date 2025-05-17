'use client'

import { useState, useRef } from 'react'
import ThreeModel from './ThreeModel'
import NewPostForm from './NewPostForm'

const EarthWithForm = () => {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)
  const clearLineRef = useRef<() => void | null>(null)

  return (
    <>
      <ThreeModel
        onClickLocation={(lat, lon) => setLocation({ lat, lon })}
        onLineReady={(clear) => (clearLineRef.current = clear)}
      />
      <div className="absolute z-50">
        {location && (
          <NewPostForm
            lat={location.lat}
            lon={location.lon}
            onClose={() => {
              setLocation(null)
              clearLineRef.current?.()
            }}
          />
        )}
      </div>
    </>
  )
}

export default EarthWithForm
