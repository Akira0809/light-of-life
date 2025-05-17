'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Props = {
  onClickLocation: (lat: number, lon: number) => void;
};

const ThreeModel = ({ onClickLocation }: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountNode = mountRef.current;

    // シーン
    const scene = new THREE.Scene();

    // 🌌 星空グラデーション背景
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, 'rgb(0, 0, 10)');  // 上：濃い青
    gradient.addColorStop(1, 'rgb(0, 0, 0)');   // 下：黒
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
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

    // 地球テクスチャの読み込み
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('/textures/earthalbedo.jpg');

    // 地球メッシュ
    const radius = 1;
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const material = new THREE.MeshStandardMaterial({ map: earthTexture });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // レンダラー
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountNode.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 1.1;
    controls.maxDistance = 10;

    // クリックで緯度経度取得
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(earth);

      if (intersects.length > 0) {
        const point = intersects[0].point;

        const lat = THREE.MathUtils.radToDeg(Math.asin(point.y / radius));
        const lon = THREE.MathUtils.radToDeg(Math.atan2(point.z, point.x));

        console.log(`🌐 緯度: ${lat.toFixed(2)}°, 経度: ${lon.toFixed(2)}°`);

        onClickLocation(lat, lon);
      }
    };
    window.addEventListener('click', onClick);


    // アニメーション
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      earth.rotation.y += 0.001;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // リサイズ対応
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
      window.removeEventListener('click', onClick);
      mountNode.removeChild(renderer.domElement);
      controls.dispose();
    };
  }, []);



  return <div ref={mountRef} className="w-screen h-screen fixed top-0 left-0 z-0" />;
};

export default ThreeModel;
