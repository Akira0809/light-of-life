'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const ThreeModel = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountNode = mountRef.current;

    // シーン
    const scene = new THREE.Scene();

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;
    
    // 線形グラデーション作成（上から下）
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    
    // グラデーションの色 stop を rgba で指定
    gradient.addColorStop(0, 'rgb(0, 0, 5)');     // 上：濃い青
    gradient.addColorStop(1, 'rgb(0, 0, 0)');    // 下：紫がかった青
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    // THREE.jsの背景として設定
    const gradientTexture = new THREE.CanvasTexture(canvas);
    scene.background = gradientTexture;
    
    // カメラ
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 2.5);

    // ライト
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(ambientLight, directionalLight);

    // 地球テクスチャ
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('/textures/earthalbedo.jpg');

    // 地球メッシュ
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshStandardMaterial({ map: earthTexture });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // レンダラー
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountNode.appendChild(renderer.domElement);

    // OrbitControlsの設定
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; // ← パンを禁止
    controls.enableDamping = true; // スムーズな回転
    controls.dampingFactor = 0.1;
    controls.minDistance     = 1.1;   // 地球を貫通させない
    controls.maxDistance     = 10;    // ズームアウト限界

    // アニメーションループ
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      controls.update(); // damping を有効にするには毎フレーム更新が必要
      renderer.render(scene, camera);
    };
    animate();

    // ウィンドウサイズ変更対応
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // クリーンアップ
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      mountNode.removeChild(renderer.domElement);
      controls.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-screen h-screen fixed top-0 left-0 z-0" />;
};

export default ThreeModel;
