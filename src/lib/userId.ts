import { v4 as uuidv4 } from 'uuid'

export const getUserId = (): string => {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('user_id')
  if (!id) {
    id = uuidv4()
    localStorage.setItem('user_id', id)
  }
  return id
}