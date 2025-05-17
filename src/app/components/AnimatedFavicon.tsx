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

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // キャンバスサイズを設定（32x32が一般的なファビコンサイズ）
    canvas.width = 32;
    canvas.height = 32;

    // 画像要素の配列を作成
    const imageElements = images.map(() => new Image());
    let loadedImages = 0;

    // 全ての画像が読み込まれたかチェック
    const checkAllImagesLoaded = () => {
      loadedImages++;
      if (loadedImages === images.length) {
        startAnimation();
      }
    };

    // 画像の読み込み
    imageElements.forEach((img, index) => {
      img.src = images[index];
      img.onload = checkAllImagesLoaded;
    });

    // アニメーション関数
    const updateFavicon = () => {
      const currentImage = imageElements[currentIndexRef.current];

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
      currentIndexRef.current = (currentIndexRef.current + 1) % images.length;
    };

    let animationInterval: NodeJS.Timeout;

    // アニメーションの開始
    const startAnimation = () => {
      updateFavicon(); // 初回実行
      animationInterval = setInterval(updateFavicon, interval);
    };

    // クリーンアップ関数
    return () => {
      if (animationInterval) {
        clearInterval(animationInterval);
      }
    };
  }, [images, interval]);

  // このコンポーネントは実際のDOMを描画しない
  return null;
};
