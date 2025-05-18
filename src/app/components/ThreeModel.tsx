// components/ThreeModel.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import PlayButton from "./PlayButton";
import PostButton from "./PostButton";
import { supabase } from "@/lib/supabase";
import { latLonToVector3 } from "@/lib/geo";

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
      console.log("updateVis called with year:", y);
      if (
        !visualizationGroupRef.current ||
        !countryMeshesRef.current ||
        !earthRef.current
      ) {
        console.warn("Refs not yet initialized in updateVis");
        return;
      }

      const currentMeshesMap = countryMeshesRef.current;
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
          removeCylinder(countryEntry.death);
          countryEntry.death = undefined;
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
          removeCylinder(countryEntry.birth);
          countryEntry.birth = undefined;
        }

        if (countryEntry.birth || countryEntry.death) {
          currentMeshesMap.set(data.iso3, countryEntry);
        } else {
          currentMeshesMap.delete(data.iso3);
        }
      });

      const currentIso3s = Array.from(currentMeshesMap.keys());
      for (const iso3 of currentIso3s) {
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
    [removeCylinder, createOrUpdateCylinder]
  );

  /* ────────────────  PLAY/PAUSE  ──────────────── */
  const togglePlay = () => {
    setIsPlaying((p) => !p);
  };

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setYear((y) => (y >= 2024 ? 1950 : y + 1));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  /* ────────────────  INITIAL THREE  ──────────────── */
  useEffect(() => {
    console.log("Initial useEffect (mount) running");
    if (!mountRef.current) {
      console.log("mountRef.current is null in initial useEffect");
      return;
    }
    const el = mountRef.current;

    const currentCountryMeshes = countryMeshesRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      el.clientWidth / el.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, CAMERA_POSITION_Z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(el.clientWidth, el.clientHeight);
    THREE.ColorManagement.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const earthInstance = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, EARTH.SEGMENTS, EARTH.SEGMENTS),
      new THREE.MeshStandardMaterial({
        map: new THREE.TextureLoader().load(EARTH.TEX_PATH),
      })
    );
    earthRef.current = earthInstance;
    earthInstance.rotation.y = -Math.PI / 2;
    scene.add(earthInstance);

    const vizGroup = new THREE.Group();
    visualizationGroupRef.current = vizGroup;
    earthInstance.add(vizGroup);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = orbitControls;
    orbitControls.enableDamping = true;
    orbitControls.minDistance = 1.1;
    orbitControls.maxDistance = 10;

    const loop = () => {
      animationFrameIdRef.current = requestAnimationFrame(loop);
      if (earthRef.current) earthRef.current.rotation.y += EARTH.ROT_SPEED;
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current) rendererRef.current.render(scene, camera);
    };
    loop();

    const internalOnResize = () => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      if (rendererRef.current)
        rendererRef.current.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", internalOnResize);

    return () => {
      console.log("Cleaning up ThreeModel...");
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      window.removeEventListener("resize", internalOnResize);

      currentCountryMeshes.forEach((meshes) => {
        removeCylinder(meshes.birth);
        removeCylinder(meshes.death);
      });
      currentCountryMeshes.clear();

      if (earthRef.current) {
        earthRef.current.geometry.dispose();
        if (earthRef.current.material instanceof THREE.Material) {
          earthRef.current.material.dispose();
        }
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        if (el && rendererRef.current.domElement.parentNode === el) {
          el.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }
      sceneRef.current = null;
      earthRef.current = null;
      visualizationGroupRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPostButtonClick]);

  /* data fetch when year changes */
  useEffect(() => {
    console.log("useEffect for [year] running, year:", year);
    updateVis(year).catch(console.error);
  }, [year, updateVis]);

  return (
    <>
      <PlayButton onClick={togglePlay} isPlaying={isPlaying} />
      <PostButton onClick={handlePost} />
      <div ref={mountRef} className="fixed inset-0 z-0" />
      <span className="absolute bottom-4 right-4 text-white text-xl select-none">
        {year}
      </span>
    </>
  );
}
