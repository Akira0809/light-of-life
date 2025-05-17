'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// import { MeshLine, MeshLineMaterial } from 'three.meshline';

type Props = {
  onClickLocation: (lat: number, lon: number) => void;
  onLineReady?: (clear: () => void) => void;
};

const EARTH_RADIUS = 1;

const ThreeModel = ({ onClickLocation, onLineReady }: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<THREE.Line | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mountNode = mountRef.current;

    // シーン
    const scene = new THREE.Scene();

    // 背景グラデーション
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, 'rgb(0,0,10)');
    gradient.addColorStop(1, 'rgb(0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    scene.background = new THREE.CanvasTexture(canvas);

    // カメラ
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 2.5);

    // ライト
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // 地球
    const texture = new THREE.TextureLoader().load('/textures/earthalbedo.jpg');
    const geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);

    // 初期回転（UTC）
    const base = -Math.PI / 2;
    const now = new Date();
    const s = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    const daily = (s / 86400) * Math.PI * 2;
    earth.rotation.y = base + daily;

    // レンダラー
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountNode.appendChild(renderer.domElement);

    // コントロール
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 1.1;
    controls.maxDistance = 10;
    controls.enablePan = false;

    // 光線描画関数
    const drawLine = (hitPoint: THREE.Vector3) => {
      if (lineRef.current) {
        earth.remove(lineRef.current);
        lineRef.current.geometry.dispose();
        (lineRef.current.material as THREE.Material).dispose();
      }

      const direction = hitPoint.clone().normalize();
      const start = direction.clone().multiplyScalar(EARTH_RADIUS + 0.01);
      const end = direction.clone().multiplyScalar(EARTH_RADIUS * 3);
      const localStart = earth.worldToLocal(start.clone());
      const localEnd = earth.worldToLocal(end.clone());

      const geometry = new THREE.BufferGeometry().setFromPoints([localStart, localEnd]);
      const material = new THREE.LineBasicMaterial({
        color: 0xffff00,
        linewidth: 0.1,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const line = new THREE.Line(geometry, material);
      earth.add(line);
      lineRef.current = line;
    };

    // 光線削除関数
    const clearLine = () => {
      if (lineRef.current) {
        earth.remove(lineRef.current);
        lineRef.current.geometry.dispose();
        (lineRef.current.material as THREE.Material).dispose();
        lineRef.current = null;
      }
    };

    // 親にクリア関数を渡す
    if (onLineReady) {
      onLineReady(clearLine);
    }

    // 緯度経度変換
    const toLatLon = (w: THREE.Vector3) => {
      const p = w.clone();
      earth.worldToLocal(p);
      const r = p.length();
      const lat = THREE.MathUtils.radToDeg(Math.asin(p.y / r));
      let lon = -THREE.MathUtils.radToDeg(Math.atan2(p.z, p.x));
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      return { lat, lon };
    };

    // クリック処理
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isRotating = true;
    let isWaitingForSecondClick = false;
    let resumeTimeout: number | null = null;

    const onClick = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(earth)[0];
      if (!hit) return;

      if (!isWaitingForSecondClick) {
        drawLine(hit.point);
        isRotating = false;
        isWaitingForSecondClick = true;
        drawLine(hit.point);

        if (resumeTimeout) clearTimeout(resumeTimeout);
        resumeTimeout = window.setTimeout(() => {
          isRotating = true;
          isWaitingForSecondClick = false;
          clearLine();
        }, 3000);
      } else {
        const { lat, lon } = toLatLon(hit.point);
        onClickLocation(lat, lon);
      }
    };

    window.addEventListener('click', onClick);

    // アニメーション
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (isRotating) {
        earth.rotation.y += 0.001;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // リサイズ対応
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // クリーンアップ
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('click', onClick);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      clearLine();
      mountNode.removeChild(renderer.domElement);
      controls.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-screen h-screen fixed top-0 left-0 z-0" />;
};

export default ThreeModel;
