"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

type Props = {
  lat: number;
  lon: number;
  onClose: () => void;
};

const PostForm = ({ lat, lon, onClose }: Props) => {
  const [form, setForm] = useState({
    status: "",
    name: "",
    gender: "",
    age: "",
    comment: "",
  });
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.status) {
      setError("「生まれた」または「亡くなった」を選択してください。");
      return;
    }

    const newId = uuidv4();
    const ageAsNumber = form.age ? parseInt(form.age, 10) : null;
    if (form.age && isNaN(ageAsNumber as unknown as number)) {
      setError("年齢は数値で入力してください。");
      return;
    }

    const postData = {
      id: newId,
      status: form.status,
      lat: lat,
      lon: lon,
      name: form.name || null,
      gender: form.gender || null,
      comment: form.comment || null,
      age: ageAsNumber,
      // created_at はDBのデフォルト値を使用
    };

    const { error: insertError } = await supabase
      .from("posts")
      .insert([postData]);

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      setError(`投稿失敗: ${insertError.message}`);
    } else {
      alert("投稿完了");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="postForm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-4 right-4 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4 w-80 z-50 text-white"
      >
        <form onSubmit={handleSubmit} className="space-y-2 flex flex-col">
          <div className="mb-2">
            <label className="mr-4">
              <input
                type="radio"
                name="status"
                value="生まれた"
                checked={form.status === "生まれた"}
                onChange={handleChange}
                className="mr-1"
              />
              生まれた
            </label>
            <label>
              <input
                type="radio"
                name="status"
                value="死んだ"
                checked={form.status === "死んだ"}
                onChange={handleChange}
                className="mr-1"
              />
              亡くなった
            </label>
          </div>

          <div className="space-y-2 max-sm:max-h-40 max-sm:overflow-y-auto pr-2">
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="名前"
              className="w-full border border-gray-600 p-2 rounded bg-gray-700 text-white placeholder-gray-500"
            />
            <input
              name="gender"
              value={form.gender}
              onChange={handleChange}
              placeholder="性別"
              className="w-full border border-gray-600 p-2 rounded bg-gray-700 text-white placeholder-gray-500"
            />
            <input
              name="age"
              value={form.age}
              onChange={handleChange}
              placeholder="年齢 (任意)"
              type="number"
              className="w-full border border-gray-600 p-2 rounded bg-gray-700 text-white placeholder-gray-500"
            />
            <textarea
              name="comment"
              value={form.comment}
              onChange={handleChange}
              placeholder="コメント"
              className="w-full border border-gray-600 p-2 rounded bg-gray-700 text-white placeholder-gray-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded w-full"
            >
              投稿
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-400 underline w-full"
            >
              キャンセル
            </button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};

export default PostForm;
