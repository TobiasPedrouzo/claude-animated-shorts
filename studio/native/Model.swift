import Foundation

struct Word: Codable {
  let text: String
  var start: Double
  var end: Double
}
struct SpeechResult: Codable {
  let duration: Double
  let sampleRate: Double
  let channels: Int
  let timing: String
  let words: [Word]
}
struct Voice: Codable {
  let provider: String
  let name: String
  let rate: Float
}
struct Actor: Codable {
  let id: String
  let kind: String
  let action: String
  let x: Double
  let toX: Double
  let scale: Double
  let accent: String
}
struct Prop: Codable {
  let id: String
  let kind: String
  let x: Double
  let y: Double
  let toY: Double
  let scale: Double
  let toX: Double?
  let attachTo: String?
  let releaseAt: Double?
  let motion: String?
}
struct Camera: Codable {
  let mode: String
  let zoom: Double
  let pan: Double
}
struct Scene: Codable {
  let id: String
  let narration: String
  let background: String
  let transition: String
  let characters: [Actor]
  let props: [Prop]
  let camera: Camera
  let sound: String
  let start: Double?
  let end: Double?
  let frames: Int?
}
struct Plan: Codable {
  let id: String
  let title: String
  let voice: Voice
  let scenes: [Scene]
  let fps: Int?
  let duration: Double?
  let words: [Word]?
}
func load<T: Decodable>(_ type: T.Type, _ path: String) throws -> T {
  try JSONDecoder().decode(type, from: Data(contentsOf: URL(fileURLWithPath: path)))
}
func save<T: Encodable>(_ value: T, _ path: String) throws {
  let enc = JSONEncoder()
  enc.outputFormatting = [.prettyPrinted, .sortedKeys]
  try enc.encode(value).write(to: URL(fileURLWithPath: path), options: .atomic)
}
struct StudioError: Error, CustomStringConvertible {
  let description: String
  init(_ message: String) { description = message }
}
func clamp(_ x: Double, _ a: Double = 0, _ b: Double = 1) -> Double { min(b, max(a, x)) }
func smooth(_ x: Double) -> Double {
  let t = clamp(x)
  return t * t * (3 - 2 * t)
}
func lerp(_ a: Double, _ b: Double, _ u: Double) -> Double { a + (b - a) * u }
