"use client";

import { PlayIcon, PauseIcon } from "@heroicons/react/24/solid"; // heroicons を使用（インストール必要）

type PlayButtonProps = {
  onClick: () => void;
  isPlaying: boolean;
};

const PlayButton = ({ onClick, isPlaying }: PlayButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="absolute top-4 right-4 z-10 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg flex items-center justify-center"
      title={isPlaying ? "停止" : "再生"}
    >
      {isPlaying ? (
        <PauseIcon className="w-7 h-7 text-white" />
      ) : (
        <PlayIcon className="w-7 h-7 text-white" />
      )}
    </button>
  );
};

export default PlayButton;
