// lib/latlonToXYZ.ts
import * as THREE from 'three';

/**
 * 緯度経度 → xyz座標 に変換するユーティリティ関数
 * @param lat 緯度（度）
 * @param lon 経度（度）
 * @param radius 半径（デフォルト = 1）
 * @returns THREE.Vector3
 */
export function latLonToXYZ(lat: number, lon: number, radius: number = 1): THREE.Vector3 {
  const φ = THREE.MathUtils.degToRad(lat); // 緯度
  const θ = THREE.MathUtils.degToRad(lon); // 経度

  const x = radius * Math.cos(φ) * Math.cos(θ);
  const y = radius * Math.sin(φ);
  const z = radius * Math.cos(φ) * Math.sin(θ);

  return new THREE.Vector3(x, y, z);
}