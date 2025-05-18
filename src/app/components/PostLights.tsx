"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import * as THREE from "three";
import { supabase } from "@/lib/supabase"; // supabaseクライアントのパスは適宜修正してください
import { latLonToVector3 } from "@/lib/geo"; // latLonToVector3のパスも確認してください

const EARTH_RADIUS = 1; // ThreeModel.tsxから持ってくるか、共有定数にする
const LIGHT_LIFETIME = 5000; // 光の寿命 (ミリ秒), 例: 5秒
const DEFAULT_INTENSITY = 1.2; // デフォルトの光の基本強度を少し調整
const MY_POST_INTENSITY_MULTIPLIER = 1.5; // 自分の投稿の明るさ倍率

const BIRTH_COLOR = new THREE.Color(0x00c0ff); // 青系
const DEATH_COLOR = new THREE.Color(0xff3030); // 赤系
const DEFAULT_EVENT_COLOR = new THREE.Color(0xffffff); // その他のイベントの色 (白)

// Supabaseから取得する投稿データの型定義
interface PostData {
  id: string;
  created_at: string;
  lat: number;
  lon: number;
  status: string; // イベントの種類 (例: '生まれた', '亡くなった')
  comment?: string;
  name?: string;
  gender?: string;
  age?: number;
}

// ThreeModelに渡す光オブジェクトの型定義（例としてPointLightを使用）
// 実際にはMeshなど他のオブジェクトも使用可能です
export interface LightObject {
  id: string;
  object: THREE.PointLight; // もしくは THREE.Mesh など
  // positionやcolorはobjectのプロパティとして設定済みとする
}

interface ManagedLight {
  id: string;
  object: THREE.PointLight;
  createdAt: number;
  initialIntensity: number;
  currentIntensity: number;
}

interface PostLightsProps {
  scene: THREE.Scene | null;
  myPostIds?: string[];
}

async function fetchPosts(): Promise<PostData[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, created_at, lat, lon, status, name, gender, comment, age"
    ) // カラム名を実際のテーブルに合わせる
    .order("created_at", { ascending: false }) // 新しいものから処理する方が良い場合
    .limit(100); // 初期表示件数に上限を設ける（パフォーマンス考慮）
  // .returns<PostData[]>(); // returnsは非推奨になったので削除

  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
  return (data as PostData[]) || []; // 型アサーションを追加
}

const PostLights: React.FC<PostLightsProps> = ({ scene, myPostIds = [] }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [managedLights, setManagedLights] = useState<ManagedLight[]>([]);
  const animationFrameIdRef = useRef<number | null>(null);

  // statusの値に基づいて色を決定する関数
  // TODO: ユーザーにstatusの具体的な値を確認し、マッピングを修正する
  const getEventColor = useCallback((status: string): THREE.Color => {
    if (status === "誕生" || status === "birth" || status === "生まれた") {
      return BIRTH_COLOR;
    } else if (
      status === "死亡" ||
      status === "death" ||
      status === "亡くなった"
    ) {
      return DEATH_COLOR;
    }
    console.warn(`Unknown status: ${status}, using default color.`);
    return DEFAULT_EVENT_COLOR;
  }, []);

  const addLight = useCallback(
    (post: PostData) => {
      if (!scene) return;

      setManagedLights((prevLights) => {
        if (prevLights.some((light) => light.id === post.id)) {
          // console.log("Light already managed, skipping addLight for:", post.id);
          return prevLights; // 既に存在する場合はstateを更新しない
        }

        const isMyPost = myPostIds.includes(post.id);
        const position = latLonToVector3(
          post.lat,
          post.lon,
          EARTH_RADIUS + 0.05 // 地球の表面より少しだけ浮かせる
        );
        const color = getEventColor(post.status);
        const initialIntensity = isMyPost
          ? DEFAULT_INTENSITY * MY_POST_INTENSITY_MULTIPLIER
          : DEFAULT_INTENSITY;

        const pointLight = new THREE.PointLight(
          color,
          initialIntensity,
          3 // distance: 光が届く最大距離。0は無限。調整が必要。
        );
        // pointLight.decay = 2; // 光の減衰率。デフォルトは2。
        pointLight.position.copy(position);

        // pointLightにidを紐づけておく (scene内での探索用)
        pointLight.userData = { id: post.id };

        scene.add(pointLight);

        return [
          ...prevLights,
          {
            id: post.id,
            object: pointLight,
            createdAt: Date.now(),
            initialIntensity: initialIntensity,
            currentIntensity: initialIntensity,
          },
        ];
      });
    },
    [scene, myPostIds, getEventColor]
  ); // managedLights を依存配列から削除

  // 初期データの読み込み
  useEffect(() => {
    if (!scene) return;
    let isMounted = true;

    const loadInitialPosts = async () => {
      const postsData = await fetchPosts();
      if (!isMounted) return;
      postsData.forEach((post) => {
        addLight(post);
      });
    };
    loadInitialPosts();
    return () => {
      isMounted = false;
    };
  }, [scene, addLight]); // myPostIdsはaddLightのdepsに含まれるのでここでは不要かも

  // Supabaseリアルタイムサブスクリプション
  useEffect(() => {
    if (!scene) return;

    const channel = supabase
      .channel("custom-posts-channel-v4") // チャンネル名更新
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        (payload) => {
          console.log("New post received via real-time:", payload);
          const newPost = payload.new as PostData;
          // まれにpayload.newがundefinedになるケースへの対応
          if (
            !newPost ||
            !newPost.id ||
            typeof newPost.lat === "undefined" ||
            typeof newPost.lon === "undefined" ||
            typeof newPost.status === "undefined"
          ) {
            console.warn(
              "Received incomplete post data via real-time, skipping:",
              payload
            );
            return;
          }
          addLight(newPost);
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("Subscribed to posts channel!");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Subscription error or timed out:", err);
          // 再試行ロジックなどをここに追加することも検討
        }
      });

    return () => {
      supabase
        .removeChannel(channel)
        .catch((err) => console.error("Error removing channel:", err));
    };
  }, [scene, addLight]);

  // アニメーションループ
  useEffect(() => {
    if (!scene) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      return;
    }

    const animateLights = () => {
      animationFrameIdRef.current = requestAnimationFrame(animateLights); // ループの最初に移動
      const now = Date.now();

      setManagedLights((prevLights) =>
        prevLights
          .map((light) => {
            const age = now - light.createdAt;
            if (age >= LIGHT_LIFETIME) {
              if (scene && light.object.parent === scene)
                scene.remove(light.object);
              light.object.dispose();
              return null;
            }
            const progress = age / LIGHT_LIFETIME;
            light.currentIntensity =
              light.initialIntensity * Math.max(0, 1 - progress * progress);
            light.object.intensity = light.currentIntensity;

            if (light.currentIntensity <= 0.01) {
              if (scene && light.object.parent === scene)
                scene.remove(light.object);
              light.object.dispose();
              return null;
            }
            return light;
          })
          .filter((light): light is ManagedLight => light !== null)
      );
    };

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    animationFrameIdRef.current = requestAnimationFrame(animateLights);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // アンマウント時に管理下のライトを全てクリーンアップ
      setManagedLights((currentLights) => {
        currentLights.forEach((light) => {
          if (scene && light.object.parent === scene) {
            // sceneに直接追加されているか確認
            scene.remove(light.object);
          }
          light.object.dispose();
        });
        return []; // stateを空にする
      });
    };
  }, [scene]); // sceneの変更時のみ再設定

  return null;
};

export default PostLights;
