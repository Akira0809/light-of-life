declare module 'three.meshline' {
  import * as THREE from 'three';

  export class MeshLine extends THREE.BufferGeometry {
    setPoints(points: THREE.Vector3[] | number[]): void;
    geometry: THREE.BufferGeometry;
  }

  export class MeshLineMaterial extends THREE.Material {
    constructor(parameters?: any);
    lineWidth: number;
    color: THREE.Color;
    map: THREE.Texture;
    useMap: number;
    repeat: THREE.Vector2;
    dashArray: number;
    dashOffset: number;
    dashRatio: number;
    alphaTest: number;
    texture: THREE.Texture;
  }
}
