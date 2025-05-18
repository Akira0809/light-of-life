// components/UserPin.tsx
import * as THREE from "three";
import { useEffect } from "react";
import { latLonToVector3 } from "@/lib/geo";

type Props = {
  group: THREE.Group | null;
  lat: number;
  lon: number;
  radius?: number;
};

export default function UserPin({ group, lat, lon, radius = 1 }: Props) {
  useEffect(() => {
    if (!group) return;

    const position = latLonToVector3(lat, lon, radius);
    const geometry = new THREE.SphereGeometry(0.015, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // 黄色
    const pin = new THREE.Mesh(geometry, material);
    pin.position.copy(position);

    group.add(pin);

    return () => {
      group.remove(pin);
      geometry.dispose();
      material.dispose();
    };
  }, [group, lat, lon, radius]);

  return null;
}
