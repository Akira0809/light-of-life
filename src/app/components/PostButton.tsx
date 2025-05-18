"use client";

import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

type PostButtonProps = {
  onClick: () => void;
  // isPosting: boolean; // 必要に応じて追加
};

const PostButton = ({ onClick }: PostButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="absolute top-20 right-4 z-10 w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center"
      title="投稿"
    >
      <PaperAirplaneIcon className="w-7 h-7 text-white" />
    </button>
  );
};

export default PostButton;
