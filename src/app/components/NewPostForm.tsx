'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function NewPostForm() {
  const [form, setForm] = useState({
    status: '',
    lat: '',
    lng: '',
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

  const lat = parseFloat(form.lat)
  const lng = parseFloat(form.lng)
  const age = form.age ? parseInt(form.age) : null

  if (isNaN(lat) || isNaN(lng)) {
    setError('緯度・経度は数値で入力してください')
    return
  }

  const postData = {
    ...form,
    lat,
    lng,
    age
  }

  console.log('投稿内容:', postData)

  const { error } = await supabase.from('posts').insert([postData])

  if (error) {
    setError(error.message)
  } else {
    alert('投稿完了')
    setForm({ status: '', lat: '', lng: '', name: '', gender: '', age: '', comment: '' })
    setError('')
  }
}


  return (
    <div className="fixed bottom-4 right-4 bg-white border rounded-lg shadow-lg p-4 w-80 z-50">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input name="status" value={form.status} onChange={handleChange} placeholder="ステータス" className="w-full border p-2 rounded" />
        <input name="lat" value={form.lat} onChange={handleChange} placeholder="緯度" className="w-full border p-2 rounded" />
        <input name="lng" value={form.lng} onChange={handleChange} placeholder="経度" className="w-full border p-2 rounded" />
        <input name="name" value={form.name} onChange={handleChange} placeholder="名前" className="w-full border p-2 rounded" />
        <input name="gender" value={form.gender} onChange={handleChange} placeholder="性別" className="w-full border p-2 rounded" />
        <input name="age" value={form.age} onChange={handleChange} placeholder="年齢" className="w-full border p-2 rounded" />
        <textarea name="comment" value={form.comment} onChange={handleChange} placeholder="コメント" className="w-full border p-2 rounded" />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded w-full">投稿</button>
      </form>
    </div>
  )
}
