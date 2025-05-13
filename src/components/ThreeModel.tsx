'use client';//CSRの有効

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// DOM要素を参照するためのuseRef
const ThreeModel = () => {
  const mountRef = useRef<HTMLDivElement>(null);
// mountRefがnullの場合は処理を中断
  useEffect(() => {
    if (!mountRef.current) return;

    const mountNode = mountRef.current; // ローカル変数にコピー
    const scene = new THREE.Scene();
    //↓消すと背景が黒になる
    scene.background = new THREE.Color(0xffffff);
    // カメラを作成
    const camera = new THREE.PerspectiveCamera(
      60,// 視野角
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    //カメラの位置
    camera.position.set(0, 1, 5);
    // レンダラー(WebGL)を作成
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountNode.appendChild(renderer.domElement);
  //コントロール
    const controls = new OrbitControls(camera, renderer.domElement);
  //3Dモデルの読み込み
    const loader = new GLTFLoader();
    loader.load(
      '/models/earth2.glb',
      (gltf) => {
        scene.add(gltf.scene);
      },
      undefined,
      (error) => {
        console.error('モデル読み込みエラー:', error);
      }
    );
    //アニメーション
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // クリーンアップ
    return () => {
      mountNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
};

export default ThreeModel;// コンポーネントをエクスポート