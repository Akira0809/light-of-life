// components/ThreeModel.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import PlayButton from "./PlayButton";
import PostButton from "./PostButton";
import { supabase } from "@/lib/supabase";
import { latLonToVector3 } from "@/lib/geo";
import PostLights from "./PostLights";

/* ────────────────  CONSTS  ──────────────── */
const EARTH_RADIUS = 1;
const CAMERA_FOV = 60;
const CAMERA_POSITION_Z = 2.5;

const EARTH = {
  SEGMENTS: 64,
  ROT_SPEED: 0.001,
  TEX_PATH: "/textures/earthalbedo.jpg",
};

const VIS = {
  BIRTH_COLOR: new THREE.Color(0x00c0ff), // シアン
  DEATH_COLOR: new THREE.Color(0xff3030), // 赤
  CYLINDER_RADIUS: 0.007,
  CYLINDER_MAX_HEIGHT: 0.25,
  CYLINDER_HORIZONTAL_GAP: 0.005, // 水平方向の円柱間の全隙間
};

/* ────────────────  TYPES  ──────────────── */
type VitalStatsFromSupabase = {
  iso3: string;
  births: number;
  deaths: number;
  countries: { lat: number; lon: number } | null;
};

type VitalStatsProcessed = {
  iso3: string;
  births: number;
  deaths: number;
  lat: number;
  lon: number;
};

type CountryMeshes = {
  birth?: THREE.Mesh;
  death?: THREE.Mesh;
};

type Props = { onPostButtonClick: () => void };

/* ────────────────  HELPERS  ──────────────── */

async function fetchMatrices(year: number): Promise<VitalStatsProcessed[]> {
  console.log("fetchMatrices called with year:", year);
  const { data, error } = await supabase
    .from("vital_stats")
    .select(
      `
      iso3, births, deaths,
      countries:iso3(lat,lon)
    `
    )
    .eq("year", year)
    .returns<VitalStatsFromSupabase[]>();

  if (error) throw error;
  if (!data?.length) return [];

  const processedData = data
    .filter(
      (
        r
      ): r is VitalStatsFromSupabase & {
        countries: { lat: number; lon: number };
      } => r.countries !== null
    )
    .map((r) => ({
      iso3: r.iso3,
      births: r.births,
      deaths: r.deaths,
      lat: r.countries.lat,
      lon: r.countries.lon,
    }));
  return processedData;
}

/* ─────────────────────────────────────────── */

export default function ThreeModel({ onPostButtonClick }: Props) {
  console.log("ThreeModel component rendering");
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const visualizationGroupRef = useRef<THREE.Group | null>(null);
  const countryMeshesRef = useRef(new Map<string, CountryMeshes>());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [year, setYear] = useState(1950);
  const [isSceneInitialized, setIsSceneInitialized] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePost = () => {
    onPostButtonClick();
  };

  const removeCylinder = useCallback((mesh: THREE.Mesh | undefined) => {
    if (mesh) {
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
      visualizationGroupRef.current?.remove(mesh);
    }
  }, []);

  const createOrUpdateCylinder = useCallback(
    (
      existingMesh: THREE.Mesh | undefined,
      height: number,
      color: THREE.Color,
      position: THREE.Vector3,
      quaternion: THREE.Quaternion
    ): THREE.Mesh => {
      if (existingMesh) {
        let geometryNeedsUpdate = true;
        if (existingMesh.geometry instanceof THREE.CylinderGeometry) {
          if (
            Math.abs(existingMesh.geometry.parameters.height - height) < 0.0001
          ) {
            geometryNeedsUpdate = false;
          }
        }
        if (geometryNeedsUpdate) {
          existingMesh.geometry.dispose();
          existingMesh.geometry = new THREE.CylinderGeometry(
            VIS.CYLINDER_RADIUS,
            VIS.CYLINDER_RADIUS,
            height,
            16
          );
        }
        existingMesh.position.copy(position);
        existingMesh.quaternion.copy(quaternion);
        if (existingMesh.material instanceof THREE.MeshBasicMaterial) {
          existingMesh.material.color.set(color);
        }
        existingMesh.visible = true;
        return existingMesh;
      } else {
        const geometry = new THREE.CylinderGeometry(
          VIS.CYLINDER_RADIUS,
          VIS.CYLINDER_RADIUS,
          height,
          16
        );
        const material = new THREE.MeshBasicMaterial({ color });
        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.position.copy(position);
        newMesh.quaternion.copy(quaternion);
        visualizationGroupRef.current?.add(newMesh);
        return newMesh;
      }
    },
    []
  );

  /* ────────────────  DATA UPDATE  ──────────────── */
  const updateVis = useCallback(
    async (y: number) => {
      console.log("updateVis called with year:", y, "isPlaying:", isPlaying);
      if (
        !visualizationGroupRef.current ||
        !countryMeshesRef.current ||
        !earthRef.current
      ) {
        console.warn("Refs not yet initialized in updateVis");
        return;
      }

      const currentMeshesMap = countryMeshesRef.current;

      if (!isPlaying) {
        console.log("isPlaying is false, clearing all visualizations.");
        const currentIso3sToClear = Array.from(currentMeshesMap.keys());
        for (const iso3 of currentIso3sToClear) {
          const meshesToDelete = currentMeshesMap.get(iso3);
          if (meshesToDelete) {
            removeCylinder(meshesToDelete.birth);
            removeCylinder(meshesToDelete.death);
          }
          currentMeshesMap.delete(iso3);
        }
        return;
      }

      const vitalData = await fetchMatrices(y);
      const processedIso3s = new Set<string>();

      if (vitalData.length === 0 && currentMeshesMap.size === 0) {
        return;
      }

      const maxBirths = Math.max(...vitalData.map((d) => d.births), 1);
      const maxDeaths = Math.max(...vitalData.map((d) => d.deaths), 1);

      vitalData.forEach((data) => {
        processedIso3s.add(data.iso3);
        const countryPosition = latLonToVector3(
          data.lat,
          data.lon,
          EARTH_RADIUS
        );
        const normal = countryPosition.clone().normalize();
        let tangent = new THREE.Vector3().crossVectors(
          normal,
          new THREE.Vector3(0, 1, 0)
        );
        if (tangent.lengthSq() < 0.0001) {
          tangent = new THREE.Vector3().crossVectors(
            normal,
            new THREE.Vector3(1, 0, 0)
          );
        }
        tangent.normalize();
        const offsetAmount =
          VIS.CYLINDER_RADIUS + VIS.CYLINDER_HORIZONTAL_GAP / 2;
        const baseQuaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal
        );

        const countryEntry = currentMeshesMap.get(data.iso3) || {};

        // Death cylinder
        if (data.deaths > 0) {
          const deathHeight =
            (data.deaths / maxDeaths) * VIS.CYLINDER_MAX_HEIGHT;
          const deathPosition = countryPosition
            .clone()
            .addScaledVector(tangent, -offsetAmount)
            .addScaledVector(normal, deathHeight / 2);
          countryEntry.death = createOrUpdateCylinder(
            countryEntry.death,
            deathHeight,
            VIS.DEATH_COLOR,
            deathPosition,
            baseQuaternion
          );
        } else if (countryEntry.death) {
          countryEntry.death.visible = false;
        }

        // Birth cylinder
        if (data.births > 0) {
          const birthHeight =
            (data.births / maxBirths) * VIS.CYLINDER_MAX_HEIGHT;
          const birthPosition = countryPosition
            .clone()
            .addScaledVector(tangent, offsetAmount)
            .addScaledVector(normal, birthHeight / 2);
          countryEntry.birth = createOrUpdateCylinder(
            countryEntry.birth,
            birthHeight,
            VIS.BIRTH_COLOR,
            birthPosition,
            baseQuaternion
          );
        } else if (countryEntry.birth) {
          countryEntry.birth.visible = false;
        }

        if (data.deaths > 0 || data.births > 0) {
          currentMeshesMap.set(data.iso3, countryEntry);
        }
      });

      // Remove visualizations for countries not in the current year's data
      const allIso3s = Array.from(currentMeshesMap.keys());
      for (const iso3 of allIso3s) {
        if (!processedIso3s.has(iso3)) {
          const meshesToDelete = currentMeshesMap.get(iso3);
          if (meshesToDelete) {
            removeCylinder(meshesToDelete.birth);
            removeCylinder(meshesToDelete.death);
          }
          currentMeshesMap.delete(iso3);
        }
      }
    },
    [isPlaying, removeCylinder, createOrUpdateCylinder]
  );

  /* ────────────────  PLAYBACK & YEAR UPDATE  ──────────────── */
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setYear((prevYear) => {
          const nextYear = prevYear + 1;
          return nextYear > 2021 ? 1950 : nextYear; // Loop back
        });
      }, 500); // Adjust speed as needed
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    updateVis(year).catch(console.error);
  }, [isPlaying, year, updateVis]);

  /* ────────────────  SETUP  ──────────────── */
  useEffect(() => {
    console.log("ThreeModel setup useEffect triggered");
    // Initialize renderer only once
    if (!mountRef.current || rendererRef.current) {
      console.log(
        "Mount ref not available or renderer already exists, exiting setup."
      );
      return;
    }

    console.log("Initializing Three.js scene...");

    const currentMount = mountRef.current;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene; // sceneRefに代入。isSceneInitializedのトリガーになる

    // Camera
    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, CAMERA_POSITION_Z);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 5;
    controls.enablePan = false;
    controls.enableZoom = true;
    controlsRef.current = controls;

    // Earth
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(EARTH.TEX_PATH);
    const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture });
    const earthGeometry = new THREE.SphereGeometry(
      EARTH_RADIUS,
      EARTH.SEGMENTS,
      EARTH.SEGMENTS
    );
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);
    earthRef.current = earth;

    // Visualization Group (for cylinders)
    const visGroup = new THREE.Group();
    scene.add(visGroup);
    visualizationGroupRef.current = visGroup;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Initial render & Start animation loop
    renderer.render(scene, camera); //最初のレンダリング
    setIsSceneInitialized(true); // シーン初期化完了をマーク
    console.log("Three.js scene initialized and initial render complete.");

    const loop = () => {
      if (!rendererRef.current || !sceneRef.current) return;
      animationFrameIdRef.current = requestAnimationFrame(loop);

      if (earthRef.current) {
        earthRef.current.rotation.y += EARTH.ROT_SPEED;
      }
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      rendererRef.current.render(sceneRef.current, camera);
    };

    loop();

    // Resize listener
    const internalOnResize = () => {
      if (!currentMount || !rendererRef.current) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(
        currentMount.clientWidth,
        currentMount.clientHeight
      );
    };
    window.addEventListener("resize", internalOnResize);

    // Cleanup
    return () => {
      console.log("Cleaning up ThreeModel...");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      window.removeEventListener("resize", internalOnResize);

      // Dispose THREE.js objects
      countryMeshesRef.current.forEach((meshes: CountryMeshes) => {
        removeCylinder(meshes.birth);
        removeCylinder(meshes.death);
      });
      countryMeshesRef.current.clear();

      if (earthRef.current) {
        earthRef.current.geometry.dispose();
        if (earthRef.current.material instanceof THREE.Material) {
          earthRef.current.material.dispose();
        }
        scene.remove(earthRef.current); // 明示的にシーンから削除
      }
      if (visualizationGroupRef.current) {
        scene.remove(visualizationGroupRef.current); // 明示的にシーンから削除
      }
      // 他のライトなども必要に応じて削除・dispose
      scene.remove(ambientLight);
      scene.remove(directionalLight);
      ambientLight.dispose();
      directionalLight.dispose();

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        // DOM要素の削除はmountRef.currentのライフサイクルに任せるか、
        // ここで明示的に削除するならcurrentMountのチェックが必要
        if (
          currentMount &&
          rendererRef.current.domElement.parentNode === currentMount
        ) {
          currentMount.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }

      sceneRef.current = null;
      earthRef.current = null;
      visualizationGroupRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      setIsSceneInitialized(false); // Scene is no longer initialized
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount/unmountのみで実行

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100vh" }}>
      <PlayButton onClick={togglePlay} isPlaying={isPlaying} />
      <PostButton onClick={handlePost} />
      {/* sceneが初期化されたらPostLightsを描画し、sceneRef.currentを渡す */}
      {isSceneInitialized && sceneRef.current && (
        <PostLights scene={sceneRef.current} />
      )}
      {isPlaying && (
        <span
          className="absolute top-4 left-4 text-white text-4xl font-semibold select-none"
          style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.7)" }}
        >
          {year}
        </span>
      )}
    </div>
  );
}
