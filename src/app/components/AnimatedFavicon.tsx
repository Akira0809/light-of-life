"use client";

import { useEffect, useRef } from "react";

interface AnimatedFaviconProps {
  images: string[]; // アニメーションに使用する画像パスの配列
  interval?: number; // アニメーション間隔（ミリ秒）
}

export const AnimatedFavicon: React.FC<AnimatedFaviconProps> = ({
  images,
  interval = 500, // デフォルトは500ミリ秒
}) => {
  const currentIndexRef = useRef(0);
  const loadedImagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    if (images.length === 0) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // キャンバスサイズを設定（32x32が一般的なファビコンサイズ）
    canvas.width = 32;
    canvas.height = 32;

    // 画像の読み込み状態を追跡
    let loadedCount = 0;
    let errorCount = 0;
    const totalImages = images.length;

    const checkIfReadyToStart = () => {
      // すべての画像が読み込まれたか、エラーが発生した場合
      if (
        loadedCount + errorCount === totalImages &&
        loadedImagesRef.current.length > 0
      ) {
        startAnimation();
      }
    };

    // 画像要素の配列を作成と読み込み
    images.forEach((src) => {
      const img = new Image();

      img.onload = () => {
        loadedCount++;
        loadedImagesRef.current.push(img);
        checkIfReadyToStart();
      };

      img.onerror = () => {
        console.warn(`Failed to load favicon frame: ${src}`);
        errorCount++;
        checkIfReadyToStart();
      };

      // 画像の読み込みを開始
      img.src = src;
    });

    // アニメーション関数
    const updateFavicon = () => {
      if (loadedImagesRef.current.length === 0) return;

      const currentImage = loadedImagesRef.current[currentIndexRef.current];

      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 画像を描画
      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);

      // ファビコン要素の取得または作成
      let link = document.querySelector(
        "link[rel*='icon']"
      ) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");

      // 次の画像インデックスを設定
      currentIndexRef.current =
        (currentIndexRef.current + 1) % loadedImagesRef.current.length;
    };

    let animationInterval: number;

    // アニメーションの開始
    const startAnimation = () => {
      if (loadedImagesRef.current.length === 0) return;

      updateFavicon(); // 初回実行
      animationInterval = window.setInterval(updateFavicon, interval);
    };

    // クリーンアップ関数
    return () => {
      if (animationInterval) {
        window.clearInterval(animationInterval);
      }
      // 読み込み済み画像の参照をクリア
      loadedImagesRef.current = [];
    };
  }, [images, interval]);

  // このコンポーネントは実際のDOMを描画しない
  return null;
};
