// components/UserPin.tsx
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { latLonToVector3 } from "@/lib/geo";

type Props = {
  group: THREE.Group | null;
  lat: number;
  lon: number;
  radius?: number; // 地球の半径
  pinHeight?: number; // ピンの高さ (円錐の高さ)
  pinRadius?: number; // ピンの底面半径 (円錐の底面半径)
  pinColor?: number; // ピンの色
};

const DEFAULT_PIN_HEIGHT = 0.05;
const DEFAULT_PIN_RADIUS = 0.01;
const DEFAULT_PIN_COLOR = 0x32cd32; // ライムグリーン
const RADIAL_SEGMENTS = 16; // 円錐の滑らかさ

export default function UserPin({
  group,
  lat,
  lon,
  radius = 1,
  pinHeight = DEFAULT_PIN_HEIGHT,
  pinRadius = DEFAULT_PIN_RADIUS,
  pinColor = DEFAULT_PIN_COLOR,
}: Props) {
  const pinGeometry = useMemo(() => {
    return new THREE.ConeGeometry(pinRadius, pinHeight, RADIAL_SEGMENTS);
  }, [pinRadius, pinHeight]);

  useEffect(() => {
    if (!group || !pinGeometry) return;

    const material = new THREE.MeshBasicMaterial({ color: pinColor });
    const pinMesh = new THREE.Mesh(pinGeometry, material);

    const surfacePosition = latLonToVector3(lat, lon, radius);
    const normal = surfacePosition.clone().normalize(); // normalをuseEffectスコープ内で定義

    pinMesh.position
      .copy(surfacePosition)
      .addScaledVector(normal, pinHeight / 2);
    pinMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

    group.add(pinMesh);

    return () => {
      if (group) {
        group.remove(pinMesh);
      }
      material.dispose();
    };
  }, [group, lat, lon, radius, pinColor, pinGeometry, pinHeight]);

  return null;
}
