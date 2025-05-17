'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  lat: number
  lon: number
  onClose: () => void
}

const PostForm = ({ lat, lon, onClose }: Props) => {
  const [form, setForm] = useState({
    status: '',
    name: '',
    gender: '',
    age: '',
    comment: ''
  })
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const age = form.age ? parseInt(form.age) : null

    const { error: insertError } = await supabase.from('posts').insert([
      {
        ...form,
        age,
        latitude: lat,
        longitude: lon
      }
    ])

    if (insertError) {
      setError('投稿失敗')
    } else {
      alert('投稿完了')
      onClose()
    }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-4 w-80 z-50">
      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="mr-4">
          <input type="radio" name="status" value="生まれた" checked={form.status === "生まれた"} onChange={handleChange} className="mr-1" />
          生まれた
        </label>
        <label>
          <input type="radio" name="status" value="死んだ" checked={form.status === "死んだ"} onChange={handleChange} className="mr-1" />
          死んだ
        </label>
        <input name="name" value={form.name} onChange={handleChange} placeholder="名前" className="w-full border p-2 rounded" />
        <input name="gender" value={form.gender} onChange={handleChange} placeholder="性別" className="w-full border p-2 rounded" />
        <input name="age" value={form.age} onChange={handleChange} placeholder="年齢" className="w-full border p-2 rounded" />
        <textarea name="comment" value={form.comment} onChange={handleChange} placeholder="コメント" className="w-full border p-2 rounded" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded w-full">投稿</button>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 underline w-full">キャンセル</button>
      </form>
    </div>
  )
}

export default PostForm
