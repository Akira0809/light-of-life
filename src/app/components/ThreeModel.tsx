"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// 定数定義
const EARTH_RADIUS = 1; // 地球の半径（単位スケール）
const CAMERA_FOV = 60; // カメラの視野角（度）
const CAMERA_NEAR = 0.1; // カメラのニアクリップ
const CAMERA_FAR = 1000; // カメラのファークリップ
const CAMERA_POSITION_Z = 2.5; // カメラの初期Z位置

const BACKGROUND = {
  WIDTH: 512,
  HEIGHT: 512,
  TOP_COLOR: "rgb(0,0,10)", // 夜空の上部の色
  BOTTOM_COLOR: "rgb(0,0,0)", // 夜空の下部の色
};

const LIGHTS = {
  AMBIENT: {
    COLOR: 0xffffff,
    INTENSITY: 0.6,
  },
  DIRECTIONAL: {
    COLOR: 0xffffff,
    INTENSITY: 1.0,
    POSITION: new THREE.Vector3(5, 5, 5),
  },
};

const EARTH = {
  SEGMENTS: 64, // 球体の分割数
  ROTATION_SPEED: 0.001, // 自転速度
  TEXTURE_PATH: "/textures/earthalbedo.jpg",
};

const PIN = {
  HEIGHT: 0.08, // ピンの全体の高さ
  HEAD_RADIUS: 0.03, // ピンヘッドの半径
  STEM_RADIUS: 0.008, // ピンの軸の半径
  SEGMENTS: 32, // 円の分割数（滑らかさ）
  COLOR: 0x00ffff, // シアン色
  SURFACE_OFFSET: 1.01, // 地球の表面より少し外側に
  EMISSION_INTENSITY: 2.0, // 発光強度を上げる
};

const BLOOM = {
  STRENGTH: 0.25, // 発光の強さを増加
  RADIUS: 0.4, // 発光の広がりを少し増加
  THRESHOLD: 0.3, // 閾値を下げて発光しやすく
};

const CONTROLS = {
  MIN_DISTANCE: 1.1,
  MAX_DISTANCE: 10,
  DAMPING_FACTOR: 0.1,
};

const LAYERS = {
  DEFAULT: 0,
  BLOOM: 1,
};

type Props = {
  onClickLocation: (lat: number, lon: number) => void;
};

// 緯度経度を3D座標に変換する関数
function latLonToVector3(lat: number, lon: number, radius = 1): THREE.Vector3 {
  // 緯度経度をラジアンに変換
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(-lon); // toLatLonと合わせるためにlonを反転

  // 座標変換
  const x = radius * Math.cos(latRad) * Math.cos(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.sin(lonRad);

  return new THREE.Vector3(x, y, z);
}

const ThreeModel = ({ onClickLocation }: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const userPinRef = useRef<THREE.Group | null>(null);
  const bloomMeshesRef = useRef<THREE.Mesh[]>([]); // Bloom対象のメッシュを保持

  useEffect(() => {
    if (!mountRef.current) return;
    const mountNode = mountRef.current;

    /* ----------  Scene & Background  ---------- */
    const scene = new THREE.Scene();

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = BACKGROUND.WIDTH;
    bgCanvas.height = BACKGROUND.HEIGHT;
    const ctx = bgCanvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, BACKGROUND.HEIGHT);
    gradient.addColorStop(0, BACKGROUND.TOP_COLOR);
    gradient.addColorStop(1, BACKGROUND.BOTTOM_COLOR);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BACKGROUND.WIDTH, BACKGROUND.HEIGHT);
    scene.background = new THREE.CanvasTexture(bgCanvas);

    /* ----------  Camera  ---------- */
    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      CAMERA_NEAR,
      CAMERA_FAR
    );
    camera.position.set(0, 0, CAMERA_POSITION_Z);

    /* ----------  Renderer  ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountNode.appendChild(renderer.domElement);

    /* ----------  Bloom Effect Setup  ---------- */
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      BLOOM.STRENGTH,
      BLOOM.RADIUS,
      BLOOM.THRESHOLD
    );

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    /* ----------  Lights  ---------- */
    scene.add(
      new THREE.AmbientLight(LIGHTS.AMBIENT.COLOR, LIGHTS.AMBIENT.INTENSITY)
    );
    const dir = new THREE.DirectionalLight(
      LIGHTS.DIRECTIONAL.COLOR,
      LIGHTS.DIRECTIONAL.INTENSITY
    );
    dir.position.copy(LIGHTS.DIRECTIONAL.POSITION);
    scene.add(dir);

    /* ----------  Earth  ---------- */
    const earthGeometry = new THREE.SphereGeometry(
      EARTH_RADIUS,
      EARTH.SEGMENTS,
      EARTH.SEGMENTS
    );
    const earthTexture = new THREE.TextureLoader().load(EARTH.TEXTURE_PATH);
    const mat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      emissive: 0x000000, // 地球自体は発光しない
    });
    const earth = new THREE.Mesh(earthGeometry, mat);
    earth.layers.set(LAYERS.DEFAULT);

    // 地球とピンのための親オブジェクト
    const earthGroup = new THREE.Group();
    earthGroup.add(earth);
    scene.add(earthGroup);

    /* --- 初期回転 --- */
    const BASE = -Math.PI / 2;
    earthGroup.rotation.y = BASE;

    /* --- ② UTC による自転角を加算 --- */
    const setInitialRotation = () => {
      const now = new Date();
      const s =
        now.getUTCHours() * 3600 +
        now.getUTCMinutes() * 60 +
        now.getUTCSeconds();
      const daily = (s / 86400) * Math.PI * 2; // 1日で360°
      earthGroup.rotation.y = BASE + daily;
    };
    setInitialRotation();

    // ユーザーの位置にピンを追加する関数を更新
    const addUserPin = (lat: number, lon: number) => {
      // 既存のピンとBloomメッシュをクリア
      if (userPinRef.current) {
        earthGroup.remove(userPinRef.current);
        bloomMeshesRef.current = [];
      }

      const pos = latLonToVector3(lat, lon, PIN.SURFACE_OFFSET);
      const pinGroup = new THREE.Group();

      const headGeometry = new THREE.SphereGeometry(
        PIN.HEAD_RADIUS,
        PIN.SEGMENTS,
        PIN.SEGMENTS,
        0,
        Math.PI * 2,
        0,
        Math.PI
      );

      const stemGeometry = new THREE.CylinderGeometry(
        PIN.STEM_RADIUS,
        0,
        PIN.HEIGHT,
        PIN.SEGMENTS
      );

      // 通常表示用のマテリアル（発光を強める）
      const normalMaterial = new THREE.MeshStandardMaterial({
        color: PIN.COLOR,
        emissive: PIN.COLOR,
        emissiveIntensity: 3.0,
        transparent: true,
        opacity: 0.9,
      });

      // 発光用のマテリアル（より強い発光）
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: PIN.COLOR,
        transparent: true,
        opacity: 0.8,
      });

      // 通常表示用のメッシュ
      const headNormal = new THREE.Mesh(headGeometry, normalMaterial);
      const stemNormal = new THREE.Mesh(stemGeometry, normalMaterial);
      headNormal.layers.set(LAYERS.DEFAULT);
      stemNormal.layers.set(LAYERS.DEFAULT);

      // 発光用のメッシュ
      const headGlow = new THREE.Mesh(headGeometry, glowMaterial);
      const stemGlow = new THREE.Mesh(stemGeometry, glowMaterial);
      headGlow.layers.set(LAYERS.BLOOM);
      stemGlow.layers.set(LAYERS.BLOOM);

      // ヘッドの位置調整
      headNormal.position.y = PIN.HEIGHT;
      headGlow.position.y = PIN.HEIGHT;

      pinGroup.add(headNormal);
      pinGroup.add(stemNormal);
      pinGroup.add(headGlow);
      pinGroup.add(stemGlow);

      pinGroup.position.copy(pos);
      pinGroup.lookAt(new THREE.Vector3(0, 0, 0));
      pinGroup.rotateX(Math.PI / 2);

      earthGroup.add(pinGroup);
      userPinRef.current = pinGroup;

      // 発光用のメッシュをリストに追加
      bloomMeshesRef.current.push(headGlow, stemGlow);
    };

    // ユーザーの現在位置を取得してピンを追加
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        console.log("📍 ユーザーの現在位置:", {
          緯度: lat.toFixed(4),
          経度: lon.toFixed(4),
          精度: `${position.coords.accuracy}メートル`,
        });
        addUserPin(lat, lon);
      });
    }

    /* ----------  Controls  ---------- */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = CONTROLS.DAMPING_FACTOR;
    controls.minDistance = CONTROLS.MIN_DISTANCE;
    controls.maxDistance = CONTROLS.MAX_DISTANCE;

    /* ----------  Click → lat/lon  ---------- */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let isRotating = true;
    let resumeTimeout: number | null = null;
    let isWaitingForSecondClick = false;

    const toLatLon = (w: THREE.Vector3) => {
      const p = w.clone();
      earthGroup.worldToLocal(p);
      const r = p.length();
      const lat = THREE.MathUtils.radToDeg(Math.asin(p.y / r));
      let lon = -THREE.MathUtils.radToDeg(Math.atan2(p.z, p.x));
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      return { lat, lon };
    };

    const onClick = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Group内のメッシュも検出するためにrecursiveをtrueに設定
      const hit = raycaster.intersectObject(earthGroup, true)[0];
      if (!hit) return;

      if (!isWaitingForSecondClick) {
        isRotating = false;
        isWaitingForSecondClick = true;

        if (resumeTimeout) clearTimeout(resumeTimeout);
        resumeTimeout = window.setTimeout(() => {
          isRotating = true;
          isWaitingForSecondClick = false;
        }, 3000);
      } else {
        const { lat, lon } = toLatLon(hit.point);
        onClickLocation(lat, lon);
        console.log(`🌐 緯度: ${lat.toFixed(2)}°, 経度: ${lon.toFixed(2)}°`);
      }
    };
    window.addEventListener("click", onClick);

    /* ----------  Animate  ---------- */
    let animationId = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (isRotating) {
        earthGroup.rotation.y += EARTH.ROTATION_SPEED;
      }

      controls.update();

      // まず通常のシーンをレンダリング
      renderer.render(scene, camera);

      // 保存されたBloomメッシュのみを処理
      bloomMeshesRef.current.forEach((mesh) => {
        mesh.layers.enable(LAYERS.BLOOM);
      });
      composer.render();
      bloomMeshesRef.current.forEach((mesh) => {
        mesh.layers.disable(LAYERS.BLOOM);
      });
    };
    animate();

    /* ----------  Resize / Cleanup  ---------- */
    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      composer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("click", onClick);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      mountNode.removeChild(renderer.domElement);
      controls.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mountRef} className="w-screen h-screen fixed top-0 left-0 z-0" />
  );
};

export default ThreeModel;
