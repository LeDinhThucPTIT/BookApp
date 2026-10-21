import { useEffect, useRef, useState } from 'react'
import { loadNarrationAudio } from '../api/narration'
import { AudioPlayback } from '../utils/audio-playback'

const VOICES = [
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoài My · Nữ' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh · Nam' },
]

export default function NarrationPlayer({ bookId, chapterId, text, page, total, onNext }) {
  const [voice, setVoice] = useState(VOICES[0].id)
  const [rate, setRate] = useState(1)
  const [continuous, setContinuous] = useState(false)
  const [playback, setPlayback] = useState({ status: 'idle', message: '' })
  const { status, message } = playback
  const pendingPage = useRef(null)
  const options = useRef(null)
  const [player] = useState(() => new AudioPlayback(loadNarrationAudio, (status, message) => setPlayback({ status, message })))

  useEffect(() => {
    options.current = { bookId, chapterId, page, voice, rate, continuous, total, onNext }
  }, [bookId, chapterId, page, voice, rate, continuous, total, onNext])

  const begin = () => {
    if (!text) return
    const current = options.current
    player.play(current, { rate: current.rate, onComplete: () => {
      if (options.current.continuous && page < options.current.total - 1) {
        pendingPage.current = page + 1
        options.current.onNext()
      }
    } })
  }

  useEffect(() => {
    player.stop()
    if (pendingPage.current === page) {
      if (!text) { player.notify('waiting'); return () => player.stop(true) }
      pendingPage.current = null
      const current = options.current
      player.play(current, { rate: current.rate, onComplete: () => {
        if (options.current.continuous && page < options.current.total - 1) {
          pendingPage.current = page + 1
          options.current.onNext()
        }
      } })
    } else pendingPage.current = null
    return () => player.stop(true)
  }, [bookId, page, text, player])

  const active = ['playing', 'paused', 'loading', 'buffering', 'waiting'].includes(status)
  const loading = ['loading', 'waiting'].includes(status)
  const reading = ['playing', 'buffering'].includes(status)
  return <details className="narration-player">
    <summary>🔊 Nghe đọc {active ? (loading ? '· Đang chuẩn bị âm thanh' : status === 'paused' ? '· Đang tạm dừng' : `· Đang đọc trang ${page + 1}`) : ''}</summary>
    <p>Giọng đọc tiếng Việt trực tuyến. Nội dung trang được gửi tới dịch vụ giọng nói Microsoft khi bạn nhấn đọc.</p>
    <div className="narration-settings">
      <label>Giọng đọc<select value={voice} disabled={active} onChange={e => setVoice(e.target.value)}>
        {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select></label>
      <label>Tốc độ<select value={rate} disabled={active} onChange={e => setRate(Number(e.target.value))}>
        {[0.75, 0.9, 1, 1.25, 1.5, 1.75, 2].map(value => <option key={value} value={value}>{value}×</option>)}
      </select></label>
      <label className="narration-continuous"><input type="checkbox" checked={continuous} onChange={e => setContinuous(e.target.checked)} />Tự chuyển trang / chương</label>
    </div>
    <div className="reading-tool-actions">
      <button type="button" disabled={!text || loading} onClick={() => reading ? player.pause() : status === 'paused' ? player.resume() : begin()}>{loading ? 'Đang chuẩn bị…' : reading ? 'Tạm dừng' : status === 'paused' ? 'Tiếp tục' : 'Đọc trang này'}</button>
      <button type="button" disabled={!active} onClick={() => { pendingPage.current = null; player.stop() }}>Dừng đọc</button>
    </div>
    <p role="status" aria-live="polite">{status === 'error' ? message : status === 'loading' ? 'Đang tạo hoặc tải âm thanh. Lần đầu có thể mất vài giây.' : status === 'buffering' ? 'Đang tải âm thanh…' : status === 'waiting' ? 'Đang tải trang / chương kế tiếp…' : status === 'ended' ? 'Đã đọc xong trang.' : 'Đổi trang thủ công hoặc rời trang sẽ dừng giọng đọc. Dừng đọc trước khi đổi giọng hoặc tốc độ.'}</p>
  </details>
}
