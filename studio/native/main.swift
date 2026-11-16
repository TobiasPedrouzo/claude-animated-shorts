import AVFoundation
import Foundation

func main() throws {
  let a = CommandLine.arguments
  guard a.count >= 2 else { throw StudioError("Operación requerida") }
  switch a[1] {
  case "voices":
    for v in AVSpeechSynthesisVoice.speechVoices() where v.language == "en-US" { print(v.name) }
  case "speech":
    guard a.count == 6 else { throw StudioError("speech plan scene-index audio report") }
    let p = try load(Plan.self, a[2])
    let i = Int(a[3])!
    try synthesize(p.scenes[i].narration, p.voice, a[4], a[5])
  case "render":
    let j = try load(RenderJob.self, a[2])
    try renderScene(j, a[3])
  case "soundtrack":
    let p = try load(Plan.self, a[2])
    try soundtrack(p, a[3])
  case "assemble":
    let j = try load(Assembly.self, a[2])
    try assemble(j)
  default: throw StudioError("Operación desconocida")
  }
}
do { try main() } catch {
  fputs("ERROR: \(error)\n", stderr)
  exit(1)
}
