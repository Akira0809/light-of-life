"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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

const CONTROLS = {
  MIN_DISTANCE: 1.1,
  MAX_DISTANCE: 10,
  DAMPING_FACTOR: 0.1,
};

type Props = {
  onClickLocation: (lat: number, lon: number) => void;
};

const ThreeModel = ({ onClickLocation }: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);

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
    const mat = new THREE.MeshStandardMaterial({ map: earthTexture });
    const earth = new THREE.Mesh(earthGeometry, mat);
    scene.add(earth);

    /* --- 初期回転 --- */
    const BASE = -Math.PI / 2;
    earth.rotation.y = BASE;

    /* --- ② UTC による自転角を加算 --- */
    const setInitialRotation = () => {
      const now = new Date();
      const s =
        now.getUTCHours() * 3600 +
        now.getUTCMinutes() * 60 +
        now.getUTCSeconds();
      const daily = (s / 86400) * Math.PI * 2; // 1日で360°
      earth.rotation.y = BASE + daily;
    };
    setInitialRotation();

    /* ----------  Renderer  ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountNode.appendChild(renderer.domElement);

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
      earth.worldToLocal(p);
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

      const hit = raycaster.intersectObject(earth)[0];
      if (!hit) return;

      if (!isWaitingForSecondClick) { 
      isRotating = false;
      isWaitingForSecondClick = true;

      if (resumeTimeout) clearTimeout(resumeTimeout);
       resumeTimeout = window.setTimeout(() => {
         isRotating = true;
         isWaitingForSecondClick = false;
       }, 3000);
      }else{
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
      earth.rotation.y += EARTH.ROTATION_SPEED;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    /* ----------  Resize / Cleanup  ---------- */
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
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
  }, []);

  return (
    <div ref={mountRef} className="w-screen h-screen fixed top-0 left-0 z-0"  />
  );
};

export default ThreeModel;
