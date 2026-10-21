// A generation owns its request, audio element and object URL, including during page changes.
export class AudioPlayback {
  constructor(load, onState, audioFactory = url => new Audio(url), revoke = url => URL.revokeObjectURL(url)) {
    this.load = load
    this.onState = onState
    this.audioFactory = audioFactory
    this.revoke = revoke
    this.generation = 0
    this.state = 'idle'
  }

  notify(state, message = '') { this.state = state; this.onState(state, message) }

  release() {
    if (this.audio) {
      this.audio.onended = this.audio.onerror = this.audio.onplaying = this.audio.onwaiting = null
      this.audio.pause()
      this.audio.removeAttribute('src')
      this.audio.load()
      this.audio = null
    }
    if (this.url) { this.revoke(this.url); this.url = null }
  }

  stop(silent = false) {
    this.generation++
    this.controller?.abort()
    this.controller = null
    const prepared = this.prefetch
    this.prefetch = null
    if (prepared) prepared.promise.then(result => { if (result.value) this.revoke(result.value.url || result.value) })
    this.release()
    this.state = 'idle'
    if (!silent) this.notify('idle')
  }

  async play(source, { rate = 1, onComplete = () => {} } = {}) {
    this.stop(true)
    const generation = this.generation
    const controller = new AbortController()
    this.controller = controller
    this.notify('loading')
    const startSegment = async segment => {
      if (generation !== this.generation) return
      this.notify('loading')
      try {
        let result
        if (this.prefetch?.segment === segment) {
          const prepared = this.prefetch
          this.prefetch = null
          const loaded = await prepared.promise
          if (loaded.error) throw loaded.error
          result = loaded.value
        } else {
          result = await this.load({ ...source, segment }, controller.signal)
        }
        const url = result.url || result
        const segments = result.segments || 1
        if (generation !== this.generation) { this.revoke(url); return }
        this.url = url
        const audio = this.audioFactory(url)
        this.audio = audio
        audio.playbackRate = rate
        audio.preservesPitch = true
        audio.onplaying = () => { if (generation === this.generation) this.notify('playing') }
        audio.onwaiting = () => { if (generation === this.generation && this.state !== 'paused') this.notify('buffering') }
        audio.onended = () => {
          if (generation !== this.generation) return
          this.release()
          if (segment + 1 < segments) { void startSegment(segment + 1); return }
          this.notify('ended')
          onComplete()
        }
        audio.onerror = () => this.fail(generation, 'Không phát được âm thanh. Hãy thử lại.')
        if (segment + 1 < segments) {
          this.prefetch = {
            segment: segment + 1,
            promise: this.load({ ...source, segment: segment + 1 }, controller.signal)
              .then(value => ({ value }), error => ({ error })),
          }
        }
        await audio.play()
        if (generation === this.generation && this.audio === audio && this.state !== 'paused') this.notify('playing')
      } catch (err) {
        this.fail(generation, err.name === 'NotAllowedError' ? 'Trình duyệt yêu cầu thao tác phát. Hãy nhấn Đọc trang này để tiếp tục.' : err.message)
      }
    }
    await startSegment(0)
  }

  fail(generation, message) {
    if (generation !== this.generation) return
    this.stop(true)
    this.notify('error', message || 'Dịch vụ giọng đọc chưa sẵn sàng. Hãy thử lại.')
  }

  pause() {
    if (this.audio && ['playing', 'buffering'].includes(this.state)) {
      this.audio.pause()
      this.notify('paused')
    }
  }

  async resume() {
    if (!this.audio || this.state !== 'paused') return
    const generation = this.generation
    try {
      await this.audio.play()
      if (generation === this.generation && this.audio) this.notify('playing')
    } catch { this.fail(generation, 'Hãy nhấn Đọc trang này để phát lại âm thanh.') }
  }
}
