import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AudioPlayback } from './audio-playback.js'

function fixture(load = async () => 'blob:audio') {
  const states = [], audios = [], revoked = []
  const player = new AudioPlayback(load, (state, message) => states.push({ state, message }), url => {
    const audio = { url, play: async () => {}, pause() { this.paused = true }, removeAttribute() {}, load() {} }
    audios.push(audio)
    return audio
  }, url => revoked.push(url))
  return { player, states, audios, revoked }
}

test('server audio supports speed, pause, resume and completion with cleanup', async () => {
  const { player, states, audios, revoked } = fixture()
  let completed = 0
  await player.play({ page: 0 }, { rate: 0.9, onComplete: () => completed++ })
  assert.equal(audios[0].playbackRate, 0.9)
  assert.equal(states.at(-1).state, 'playing')
  player.pause()
  assert.equal(states.at(-1).state, 'paused')
  await player.resume()
  assert.equal(states.at(-1).state, 'playing')
  audios[0].onended()
  assert.equal(completed, 1)
  assert.equal(states.at(-1).state, 'ended')
  assert.deepEqual(revoked, ['blob:audio'])
})

test('stopped requests cannot start stale audio after navigating', async () => {
  let finish, signal
  const { player, audios, revoked, states } = fixture((source, requestSignal) => {
    signal = requestSignal
    return new Promise(resolve => { finish = resolve })
  })
  const request = player.play({ page: 0 })
  player.stop()
  assert.equal(signal.aborted, true)
  finish('blob:stale')
  await request
  assert.equal(audios.length, 0)
  assert.deepEqual(revoked, ['blob:stale'])
  assert.equal(states.at(-1).state, 'idle')
})

test('network and browser autoplay errors do not advance pages', async () => {
  const { player, states, audios } = fixture(async () => { throw new Error('Service unavailable') })
  let completed = 0
  await player.play({}, { onComplete: () => completed++ })
  assert.equal(states.at(-1).state, 'error')
  assert.equal(states.at(-1).message, 'Service unavailable')
  assert.equal(audios.length, 0)
  assert.equal(completed, 0)
  player.load = async () => 'blob:next'
  player.audioFactory = () => ({ play: async () => { throw Object.assign(new Error('Blocked'), { name: 'NotAllowedError' }) }, pause() {}, removeAttribute() {}, load() {} })
  await player.play({}, { onComplete: () => completed++ })
  assert.equal(states.at(-1).state, 'error')
  assert.equal(completed, 0)
})

test('cancelled audio events cannot finish a later page', async () => {
  const { player, states, audios } = fixture()
  let completed = 0
  await player.play({ page: 0 }, { onComplete: () => completed++ })
  const staleEnd = audios[0].onended
  await player.play({ page: 1 })
  staleEnd()
  assert.equal(completed, 0)
  assert.equal(states.at(-1).state, 'playing')
})

test('segments prefetch during playback and complete the page only after the last segment', async () => {
  const requests = []
  const { player, audios, revoked } = fixture(async source => {
    requests.push(source.segment)
    return { url: `blob:${source.segment}`, segments: 2 }
  })
  let completed = 0
  await player.play({ page: 0 }, { onComplete: () => completed++ })
  assert.deepEqual(requests, [0, 1])
  assert.equal(audios.length, 1)
  audios[0].onended()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(completed, 0)
  assert.equal(audios.length, 2)
  audios[1].onended()
  assert.equal(completed, 1)
  assert.deepEqual(revoked, ['blob:0', 'blob:1'])
})

test('stopping disposes a prefetched segment even if its request finishes late', async () => {
  let finish
  const { player, revoked, audios } = fixture(async source => source.segment === 0
    ? { url: 'blob:0', segments: 2 }
    : new Promise(resolve => { finish = resolve }))
  await player.play({ page: 0 })
  player.stop()
  finish({ url: 'blob:late', segments: 2 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(audios.length, 1)
  assert.deepEqual(revoked, ['blob:0', 'blob:late'])
})

test('prefetch failures surface at the next segment without completing the page', async () => {
  const { player, audios, states } = fixture(async source => {
    if (source.segment > 0) throw new Error('Next segment unavailable')
    return { url: 'blob:0', segments: 2 }
  })
  let completed = 0
  await player.play({}, { onComplete: () => completed++ })
  assert.equal(states.at(-1).state, 'playing')
  audios[0].onended()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(states.at(-1).state, 'error')
  assert.equal(completed, 0)
})
