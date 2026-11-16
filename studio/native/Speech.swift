import AVFoundation
import Foundation

func synthesize(_ text: String, _ voice: Voice, _ audio: String, _ report: String) throws {
  guard
    let selected = AVSpeechSynthesisVoice.speechVoices().first(where: {
      $0.name == voice.name && $0.language == "en-US"
    })
  else { throw StudioError("Voz en-US no instalada: \(voice.name)") }
  let synthesizer = AVSpeechSynthesizer()
  let utterance = AVSpeechUtterance(string: text)
  utterance.voice = selected
  utterance.rate = voice.rate
  utterance.preUtteranceDelay = 0
  utterance.postUtteranceDelay = 0
  let lock = NSLock()
  var file: AVAudioFile?
  var done = false
  var failure: Error?
  var marks: [(String, Int)] = []
  var sr = 0.0
  var channels = 0
  var bytesPerFrame = 0.0
  var totalFrames: Int64 = 0
  let ns = text as NSString
  synthesizer.write(
    utterance,
    toBufferCallback: { buffer in
      lock.lock()
      defer { lock.unlock() }
      guard let pcm = buffer as? AVAudioPCMBuffer else { return }
      if pcm.frameLength == 0 {
        done = true
        return
      }
      do {
        if file == nil {
          file = try AVAudioFile(
            forWriting: URL(fileURLWithPath: audio), settings: pcm.format.settings)
          sr = pcm.format.sampleRate
          channels = Int(pcm.format.channelCount)
          bytesPerFrame = Double(pcm.format.streamDescription.pointee.mBytesPerFrame)
        }
        try file!.write(from: pcm)
        totalFrames += Int64(pcm.frameLength)
      } catch {
        failure = error
        done = true
      }
    },
    toMarkerCallback: { markers in
      lock.lock()
      defer { lock.unlock() }
      for m in markers where m.mark == .word {
        if NSMaxRange(m.textRange) <= ns.length && m.textRange.length > 0 {
          marks.append((ns.substring(with: m.textRange), m.byteSampleOffset))
        }
      }
    })
  let deadline = Date().addingTimeInterval(120)
  while true {
    lock.lock()
    let complete = done
    lock.unlock()
    if complete { break }
    if Date() > deadline {
      synthesizer.stopSpeaking(at: .immediate)
      throw StudioError("Tiempo de síntesis agotado")
    }
    RunLoop.current.run(until: Date().addingTimeInterval(0.02))
  }
  lock.lock()
  let err = failure
  file = nil
  lock.unlock()
  if let err = err { throw err }
  guard sr > 0, bytesPerFrame > 0, totalFrames > 0 else {
    throw StudioError(
      "El proveedor no entregó audio y marcadores por palabra; no se inventan tiempos")
  }
  let duration = Double(totalFrames) / sr
  var seen = Set<String>()
  let ordered = marks.sorted { $0.1 < $1.1 }.filter { seen.insert("\($0.1):\($0.0)").inserted }
  var words: [Word] = []
  for i in ordered.indices {
    let start = Double(ordered[i].1) / (bytesPerFrame * sr)
    let next = i + 1 < ordered.count ? Double(ordered[i + 1].1) / (bytesPerFrame * sr) : duration
    guard start >= 0, start < duration, next >= start else {
      throw StudioError("Marcador de voz fuera del audio: \(start)/\(duration)")
    }
    words.append(Word(text: ordered[i].0, start: start, end: min(next, start + 0.85)))
  }
  try save(
    SpeechResult(
      duration: duration, sampleRate: sr, channels: channels,
      timing: words.isEmpty
        ? "requires-audio-alignment"
        : "apple-byte-sample-word-starts; ends=next-start-capped-850ms", words: words), report)
}
