import AVFoundation
import AppKit
import CoreGraphics
import CoreVideo
import Foundation

struct LayoutReport: Codable {
  let frames: Int
  let captionFrames: Int
  let maxCaptionWidth: Double
  let captionsSafe: Bool
  let actorsSafe: Bool
  let propsSafe: Bool
}
struct RenderJob: Decodable {
  let scene: Scene
  let words: [Word]
  let frames: Int
  let fps: Int
  let width: Int
  let height: Int
}
func waitFor(_ complete: @escaping () -> Bool, _ seconds: Double = 180) throws {
  let deadline = Date().addingTimeInterval(seconds)
  while !complete() {
    if Date() > deadline { throw StudioError("Tiempo de espera agotado") }
    RunLoop.current.run(until: Date().addingTimeInterval(0.01))
  }
}
func renderScene(_ job: RenderJob, _ path: String) throws {
  let url = URL(fileURLWithPath: path)
  try? FileManager.default.removeItem(at: url)
  let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
  let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: job.width,
    AVVideoHeightKey: job.height,
    AVVideoCompressionPropertiesKey: [
      AVVideoAverageBitRateKey: job.width == 1080 ? 8_000_000 : 1_800_000,
      AVVideoMaxKeyFrameIntervalKey: job.fps, AVVideoExpectedSourceFrameRateKey: job.fps,
      AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
  ]
  let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
  input.expectsMediaDataInRealTime = false
  let attributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
    kCVPixelBufferWidthKey as String: job.width, kCVPixelBufferHeightKey as String: job.height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
  ]
  let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input, sourcePixelBufferAttributes: attributes)
  guard writer.canAdd(input) else { throw StudioError("Configuración de video no soportada") }
  writer.add(input)
  guard writer.startWriting() else {
    throw writer.error ?? StudioError("No se inició el codificador")
  }
  writer.startSession(atSourceTime: .zero)
  guard let pool = adaptor.pixelBufferPool else { throw StudioError("Sin pool de fotogramas") }
  var captionFrames = 0
  var maxCaptionWidth = 0.0
  for i in 0..<job.frames {
    try autoreleasepool {
      let deadline = Date().addingTimeInterval(30)
      while !input.isReadyForMoreMediaData {
        if writer.status == .failed { throw writer.error! }
        if Date() > deadline { throw StudioError("Codificador detenido") }
        Thread.sleep(forTimeInterval: 0.002)
      }
      var buffer: CVPixelBuffer?
      guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess,
        let b = buffer
      else { throw StudioError("No se pudo reservar fotograma") }
      CVPixelBufferLockBaseAddress(b, [])
      defer { CVPixelBufferUnlockBaseAddress(b, []) }
      guard
        let ctx = CGContext(
          data: CVPixelBufferGetBaseAddress(b), width: job.width, height: job.height,
          bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(b),
          space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)
      else { throw StudioError("Sin contexto gráfico") }
      ctx.translateBy(x: 0, y: Double(job.height))
      ctx.scaleBy(x: Double(job.width) / 1080, y: -Double(job.height) / 1920)
      ctx.setShouldAntialias(true)
      let painter = Painter(ctx)
      painter.frame(
        job.scene, job.words, Double(i) / Double(job.fps), Double(job.frames) / Double(job.fps))
      guard painter.actorsSafe && painter.propsSafe else {
        throw StudioError("Personaje u objeto fuera de cuadro en \(job.scene.id), fotograma \(i)")
      }
      guard painter.captionsSafe else { throw StudioError("Subtítulo fuera de zona segura") }
      if painter.captionWidth > 0 {
        captionFrames += 1
        maxCaptionWidth = max(maxCaptionWidth, painter.captionWidth)
      }
      guard
        adaptor.append(b, withPresentationTime: CMTime(value: Int64(i), timescale: Int32(job.fps)))
      else { throw writer.error ?? StudioError("No se pudo escribir fotograma") }
    }
  }
  writer.endSession(atSourceTime: CMTime(value: Int64(job.frames), timescale: Int32(job.fps)))
  input.markAsFinished()
  var done = false
  writer.finishWriting { done = true }
  try waitFor({ done })
  guard writer.status == .completed else { throw writer.error ?? StudioError("Video incompleto") }
  try save(
    LayoutReport(
      frames: job.frames, captionFrames: captionFrames, maxCaptionWidth: maxCaptionWidth,
      captionsSafe: true, actorsSafe: true, propsSafe: true), path + ".layout.json")
}
struct Assembly: Decodable {
  let plan: Plan
  let videos: [String]
  let voices: [String]
  let soundtrack: String
  let output: String
}
func soundtrack(_ plan: Plan, _ output: String) throws {
  let sr = 48000.0
  let duration = plan.duration!
  let count = Int(duration * sr)
  let format = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 2)!
  let audio = try AVAudioFile(forWriting: URL(fileURLWithPath: output), settings: format.settings)
  let chunk = 4096
  let words = plan.words ?? []
  var wordIndex = 0
  var cues: [(Double, String)] = []
  for s in plan.scenes where s.sound != "none" {
    cues.append((s.start! + (s.sound == "impact" ? (s.end! - s.start!) * 0.85 : 0.05), s.sound))
  }
  var offset = 0
  while offset < count {
    let n = min(chunk, count - offset)
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(n))!
    buffer.frameLength = AVAudioFrameCount(n)
    for i in 0..<n {
      let t = Double(offset + i) / sr
      while wordIndex + 1 < words.count && words[wordIndex].end < t { wordIndex += 1 }
      let speaking =
        wordIndex < words.count && words[wordIndex].start - 0.06 <= t
        && t < words[wordIndex].end + 0.15
      let notes = [130.8128, 164.8138, 195.9977, 146.8324]
      let beat = t.truncatingRemainder(dividingBy: 0.5)
      let freq = notes[Int(t / 2) % notes.count]
      let bed =
        (sin(2 * Double.pi * freq * t) + 0.25 * sin(2 * Double.pi * freq * 2 * t)) * exp(-beat * 7)
        * 0.019 * (speaking ? 0.3 : 1)
      var effect = 0.0
      for (at, kind) in cues {
        let d = t - at
        if d >= 0 && d < 0.45 {
          let f = kind == "impact" ? 85.0 : (kind == "click" ? 1100.0 : 390.0)
          effect +=
            sin(2 * Double.pi * (f - 100 * d) * d) * exp(-d * (kind == "click" ? 30 : 12)) * 0.10
        }
      }
      let fade = min(clamp(t / 0.12), clamp((duration - t) / 0.3))
      let v = Float(clamp((bed + effect) * fade, -0.3, 0.3))
      buffer.floatChannelData![0][i] = v
      buffer.floatChannelData![1][i] = v
    }
    try audio.write(from: buffer)
    offset += n
  }
}
func assemble(_ job: Assembly) throws {
  let composition = AVMutableComposition()
  guard
    let video = composition.addMutableTrack(
      withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
    let voice = composition.addMutableTrack(
      withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid),
    let music = composition.addMutableTrack(
      withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
  else { throw StudioError("No se crearon pistas") }
  for (i, scene) in job.plan.scenes.enumerated() {
    let start = CMTime(seconds: scene.start!, preferredTimescale: 30000)
    let dur = CMTime(value: Int64(scene.frames!), timescale: Int32(job.plan.fps!))
    let v = AVURLAsset(url: URL(fileURLWithPath: job.videos[i]))
    let a = AVURLAsset(url: URL(fileURLWithPath: job.voices[i]))
    guard let vt = v.tracks(withMediaType: .video).first,
      let at = a.tracks(withMediaType: .audio).first
    else { throw StudioError("Pista faltante en \(scene.id)") }
    try video.insertTimeRange(CMTimeRange(start: .zero, duration: dur), of: vt, at: start)
    let ad = min(a.duration.seconds, dur.seconds)
    try voice.insertTimeRange(
      CMTimeRange(start: .zero, duration: CMTime(seconds: ad, preferredTimescale: 48000)), of: at,
      at: start)
  }
  let m = AVURLAsset(url: URL(fileURLWithPath: job.soundtrack))
  let duration = CMTime(seconds: job.plan.duration!, preferredTimescale: 30000)
  guard let mt = m.tracks(withMediaType: .audio).first else {
    throw StudioError("Sin banda sonora")
  }
  try music.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: mt, at: .zero)
  let mix = AVMutableAudioMix()
  let v = AVMutableAudioMixInputParameters(track: voice)
  let s = AVMutableAudioMixInputParameters(track: music)
  v.setVolume(0.88, at: .zero)
  s.setVolume(1, at: .zero)
  mix.inputParameters = [v, s]
  guard
    let export = AVAssetExportSession(
      asset: composition, presetName: AVAssetExportPresetHighestQuality)
  else { throw StudioError("Exportación no soportada") }
  let out = URL(fileURLWithPath: job.output)
  try? FileManager.default.removeItem(at: out)
  let vc = AVMutableVideoComposition()
  vc.frameDuration = CMTime(value: 1, timescale: Int32(job.plan.fps!))
  vc.renderSize = video.naturalSize
  let instruction = AVMutableVideoCompositionInstruction()
  instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
  instruction.layerInstructions = [AVMutableVideoCompositionLayerInstruction(assetTrack: video)]
  vc.instructions = [instruction]
  export.videoComposition = vc
  export.outputURL = out
  export.outputFileType = .mp4
  export.shouldOptimizeForNetworkUse = true
  export.audioMix = mix
  export.timeRange = CMTimeRange(start: .zero, duration: duration)
  var done = false
  export.exportAsynchronously { done = true }
  try waitFor({ done }, 600)
  guard export.status == .completed else {
    throw export.error ?? StudioError("Falló la exportación")
  }
}
