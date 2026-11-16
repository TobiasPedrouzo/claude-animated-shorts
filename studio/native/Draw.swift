import AppKit
import CoreGraphics
import CoreText

let ink = NSColor(calibratedRed: 0.09, green: 0.10, blue: 0.12, alpha: 1)
let paper = NSColor(calibratedRed: 0.975, green: 0.966, blue: 0.945, alpha: 1)
func color(_ hex: String) -> NSColor {
  let n = UInt32(hex.dropFirst(), radix: 16) ?? 0
  return NSColor(
    calibratedRed: Double((n >> 16) & 255) / 255, green: Double((n >> 8) & 255) / 255,
    blue: Double(n & 255) / 255, alpha: 1)
}
final class Painter {
  let g: CGContext
  var captionWidth = 0.0
  var captionsSafe = true
  var actorsSafe = true
  var propsSafe = true
  init(_ context: CGContext) {
    g = context
    g.setLineCap(.round)
    g.setLineJoin(.round)
  }
  func line(_ points: [Joint], _ width: Double = 10, _ c: NSColor = ink) {
    guard let first = points.first else { return }
    g.setStrokeColor(c.cgColor)
    g.setLineWidth(width)
    g.beginPath()
    g.move(to: first.point)
    for p in points.dropFirst() { g.addLine(to: p.point) }
    g.strokePath()
  }
  func segment(
    _ a: Double, _ b: Double, _ c: Double, _ d: Double, _ width: Double = 10, _ col: NSColor = ink
  ) { line([Joint(x: a, y: b), Joint(x: c, y: d)], width, col) }
  func ellipse(
    _ x: Double, _ y: Double, _ rx: Double, _ ry: Double, _ fill: NSColor, _ stroke: Double = 0
  ) {
    g.setFillColor(fill.cgColor)
    g.setStrokeColor(ink.cgColor)
    g.setLineWidth(stroke)
    let r = CGRect(x: x - rx, y: y - ry, width: rx * 2, height: ry * 2)
    g.addEllipse(in: r)
    g.drawPath(using: stroke > 0 ? .fillStroke : .fill)
  }
  func rect(
    _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ fill: NSColor, _ stroke: Double = 0,
    _ radius: Double = 12
  ) {
    g.addPath(
      CGPath(
        roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerWidth: radius,
        cornerHeight: radius, transform: nil))
    g.setFillColor(fill.cgColor)
    g.setStrokeColor(ink.cgColor)
    g.setLineWidth(stroke)
    g.drawPath(using: stroke > 0 ? .fillStroke : .fill)
  }
  func text(
    _ s: String, _ x: Double, _ y: Double, _ size: Double, _ fill: NSColor = ink,
    _ outlined: Bool = false
  ) -> Double {
    var fontSize = size
    var line: CTLine
    var width = 0.0
    var ascent: CGFloat = 0
    var descent: CGFloat = 0
    repeat {
      let attrs: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: fontSize, weight: .heavy), .foregroundColor: fill,
        .strokeColor: ink, .strokeWidth: outlined ? -7.0 : 0.0,
      ]
      line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attrs))
      width = CTLineGetTypographicBounds(line, &ascent, &descent, nil)
      if !outlined || width <= 790 { break }
      fontSize *= 0.94
    } while fontSize > 18
    if outlined {
      captionWidth = width
      captionsSafe =
        (x - width / 2 - 8 >= 130 && x + width / 2 + 8 <= 950 && y - Double(ascent) - 8 >= 1510
          && y + Double(descent) + 8 <= 1730)
    }
    g.saveGState()
    g.translateBy(x: x - width / 2, y: y)
    g.scaleBy(x: 1, y: -1)
    g.textPosition = .zero
    CTLineDraw(line, g)
    g.restoreGState()
    return width
  }
  func bounds(_ points: [Joint]) -> Bool {
    points.allSatisfy {
      let p = $0.point.applying(g.ctm)
      return p.x >= 0 && p.x <= Double(g.width) && p.y >= 0 && p.y <= Double(g.height)
    }
  }
  func actor(_ a: Actor, _ time: Double, _ p: Double) {
    let r = pose(a, time, p)
    let x = r.x
    let ground = 1410.0
    ellipse(x + 22, ground + 13, 90 * a.scale, 16 * a.scale, ink.withAlphaComponent(0.10))
    g.saveGState()
    g.translateBy(x: x, y: ground)
    g.scaleBy(x: a.scale, y: a.scale)
    if a.kind == "observer" {
      actorsSafe = actorsSafe && bounds([Joint(x: -94, y: -350), Joint(x: 94, y: 0)])
      observer()
      g.restoreGState()
      return
    }
    g.translateBy(x: 0, y: -160)
    g.rotate(by: r.tilt)
    g.translateBy(x: 0, y: 160)
    var probes = [
      Joint(x: r.head.x - 70, y: r.head.y - 70), Joint(x: r.head.x + 70, y: r.head.y - 70),
      Joint(x: r.head.x - 70, y: r.head.y + 70), Joint(x: r.head.x + 70, y: r.head.y + 70),
    ]
    for l in [r.leftLeg, r.rightLeg, r.leftArm, r.rightArm] {
      for j in [l.root, l.middle, l.tip] {
        probes.append(Joint(x: j.x - 9, y: j.y - 9))
        probes.append(Joint(x: j.x + 9, y: j.y + 9))
      }
    }
    actorsSafe = actorsSafe && bounds(probes)
    for l in [r.leftLeg, r.rightLeg, r.leftArm, r.rightArm] {
      line([l.root, l.middle, l.tip], 12)
      ellipse(l.tip.x, l.tip.y, 7, 7, ink)
    }
    line([r.neck, r.hip], 15)
    segment(0, r.neck.y, 0, r.head.y + 62, 11)
    ellipse(r.head.x + 3, r.head.y + 4, 64, 64, ink.withAlphaComponent(0.10))
    ellipse(r.head.x, r.head.y, 64, 64, .white, 9)
    let glance = (a.action == "point" || a.action == "grab") ? 4.0 : 0
    // Both eyes retain fixed spacing and proportions; expressive brows provide emotion.
    let blink = time.truncatingRemainder(dividingBy: 3.7) > 3.57
    for ex in [-21.0, 21.0] { ellipse(ex + glance, r.head.y - 2, 6, blink ? 2 : 9, ink) }
    if a.action == "surprise" {
      segment(-35, r.head.y - 28, -14, r.head.y - 35, 5)
      segment(14, r.head.y - 35, 35, r.head.y - 28, 5)
    }
    segment(-17, -290, 17, -290, 8, color(a.accent))
    g.restoreGState()
  }
  func observer() {
    // Canonical hood, concealed face, near-black robe and fixed cyan eye spacing.
    let black = color("#040811")
    let hood = color("#0d1724")
    g.beginPath()
    g.move(to: CGPoint(x: -94, y: 0))
    g.addLines(between: [
      CGPoint(x: -69, y: -155), CGPoint(x: -48, y: -258), CGPoint(x: 0, y: -282),
      CGPoint(x: 48, y: -258), CGPoint(x: 69, y: -155), CGPoint(x: 94, y: 0),
    ])
    g.closePath()
    g.setFillColor(black.cgColor)
    g.fillPath()
    ellipse(0, -284, 64, 64, hood)
    rect(-56, -280, 112, 80, black, 0, 0)
    ellipse(0, -244, 45, 45, color("#02050c"))
    for x in [-18.0, 18.0] {
      ellipse(x, -242, 10, 10, color("#3690a9").withAlphaComponent(0.25))
      ellipse(x, -242, 5, 5, color("#e0fcff"))
    }
  }
  func prop(_ o: Prop, _ progress: Double, _ time: Double) {
    let travel = o.motion == "gravity" ? pow(clamp(progress / 0.85), 2) : pow(smooth(progress), 2)
    let y = lerp(o.y, o.toY, travel)
    let accent = color("#e7b75b")
    g.saveGState()
    g.translateBy(x: lerp(o.x, o.toX ?? o.x, smooth(progress)), y: y)
    g.scaleBy(x: o.scale, y: o.scale)
    let extent: [String: (Double, Double)] = [
      "hammer": (52, 96), "feather": (90, 96), "machine": (116, 148), "chamber": (202, 227),
      "table": (167, 153), "ball": (51, 51), "arrow": (33, 80), "air": (205, 107), "moon": (92, 92),
      "book": (55, 69),
    ]
    if let e = extent[o.kind] {
      propsSafe = propsSafe && bounds([Joint(x: -e.0, y: -e.1), Joint(x: e.0, y: e.1)])
    }
    switch o.kind {
    case "hammer":
      segment(0, -30, 0, 74, 17, color("#ae8256"))
      rect(-46, -66, 92, 48, color("#9ba6af"), 7, 5)
    case "feather":
      g.rotate(by: sin(time * 2) * 0.12)
      g.beginPath()
      g.move(to: CGPoint(x: 0, y: 70))
      g.addCurve(
        to: CGPoint(x: 10, y: -75), control1: CGPoint(x: -90, y: -20),
        control2: CGPoint(x: -60, y: -85))
      g.addCurve(
        to: CGPoint(x: 0, y: 70), control1: CGPoint(x: 85, y: -50), control2: CGPoint(x: 50, y: 20))
      g.setFillColor(NSColor(white: 1, alpha: 1).cgColor)
      g.setStrokeColor(ink.cgColor)
      g.setLineWidth(6)
      g.drawPath(using: .fillStroke)
      segment(0, 90, 10, -61, 5)
      for k in 0..<5 {
        let yy = Double(k) * 20 - 42
        segment(5, yy, 34, yy - 17, 3)
        segment(5, yy, -30, yy - 17, 3)
      }
    case "chamber":
      rect(-182, -202, 364, 416, color("#cde7e8").withAlphaComponent(0.23), 5, 36)
      rect(-195, 200, 390, 23, color("#a5b4b4"), 5, 6)
      rect(-195, -219, 390, 23, color("#b8c9c8"), 5, 6)
      segment(-145, -175, -145, 162, 4, NSColor.white.withAlphaComponent(0.7))
    case "machine":
      rect(-110, -140, 220, 220, color("#e7e7e2"), 8, 22)
      rect(-85, -108, 170, 103, color("#cce4e5"), 5, 15)
      ellipse(0, -57, 31, 31, .white, 5)
      segment(0, -57, cos(time * 3) * 23, sin(time * 3) * 23 - 57, 5)
      for x in [-65.0, 0, 65] { ellipse(x, 40, 10, 10, accent, 3) }
      segment(-84, 91, -84, 120, 12)
      segment(84, 91, 84, 120, 12)
    case "table":
      rect(-160, -10, 320, 23, color("#c2aa8d"), 6, 5)
      segment(-133, 16, -133, 145, 12)
      segment(133, 16, 133, 145, 12)
    case "ball":
      ellipse(0, 0, 45, 45, accent, 7)
      segment(-25, -26, 25, 26, 4)
    case "arrow":
      segment(0, -70, 0, 70, 9, color("#408c94"))
      line([Joint(x: -26, y: 42), Joint(x: 0, y: 72), Joint(x: 26, y: 42)], 9, color("#408c94"))
    case "air":
      for j in 0..<7 {
        let phase = (time * 90 + Double(j) * 77).truncatingRemainder(dividingBy: 300) - 150
        segment(phase, Double(j) * 31 - 95, phase + 40, Double(j) * 31 - 95, 4, color("#99c9cd"))
      }
    case "moon":
      ellipse(0, 0, 85, 85, color("#dcded8"), 5)
      for j in 0..<4 {
        ellipse(Double(j % 2) * 62 - 35, Double(j / 2) * 56 - 30, 16, 10, color("#bfc2be"))
      }
    case "book":
      rect(-48, -62, 96, 124, color("#dba978"), 7, 5)
      segment(-31, -60, -31, 60, 5)
    default: break
    }
    g.restoreGState()
  }
  func frame(_ scene: Scene, _ words: [Word], _ t: Double, _ duration: Double) {
    let p = clamp(t / duration)
    g.setFillColor(paper.cgColor)
    g.fill(CGRect(x: 0, y: 0, width: 1080, height: 1920))
    g.saveGState()
    let cam = scene.camera
    let zoom = lerp(1, cam.zoom, smooth(p))
    let pan =
      cam.mode == "follow"
      ? clamp(
        -lerp(scene.characters[0].x, scene.characters[0].toX, smooth(p)) + scene.characters[0].x,
        -30, 30) : cam.pan * smooth(p)
    let shake = cam.mode == "shake" ? sin(t * 70) * exp(-t * 5) * 8 : 0
    g.translateBy(x: 540 + pan + shake, y: 1040)
    g.scaleBy(x: zoom, y: zoom)
    g.translateBy(x: -540, y: -1040)
    if scene.background == "lab" {
      rect(130, 470, 820, 480, color("#ebefed"), 3, 25)
      for k in 0..<4 {
        segment(165, 575 + Double(k) * 95, 910, 575 + Double(k) * 95, 2, color("#d8dedb"))
      }
    }
    if scene.background == "moon" {
      ellipse(820, 440, 86, 86, color("#c4dce1"))
      ellipse(790, 425, 35, 56, color("#94b6ac"))
      for i in 0..<6 {
        ellipse(Double(i) * 188 + 80, 1465 + Double(i % 2) * 40, 62, 13, color("#deded6"))
      }
    }
    segment(55, 1430, 1025, 1430, 4, color("#b0b5af"))
    for o in scene.props
    where o.kind == "table" || o.kind == "air" || o.kind == "moon" || o.kind == "chamber" {
      prop(o, p, t)
    }
    for a in scene.characters { actor(a, t, p) }
    for o in scene.props
    where o.kind != "table" && o.kind != "air" && o.kind != "moon" && o.kind != "chamber" {
      if let actorID = o.attachTo, let actor = scene.characters.first(where: { $0.id == actorID }) {
        let release = o.releaseAt ?? 1.0
        let held = p < release
        let r = pose(actor, t, p)
        let x = r.x + r.rightArm.tip.x * actor.scale
        let y = 1410 + r.rightArm.tip.y * actor.scale
        let fall = held ? 0 : pow(clamp((p - release) / max(0.001, 1 - release)), 2)
        let attached = Prop(
          id: o.id, kind: o.kind, x: x, y: lerp(y, o.toY, fall), toY: lerp(y, o.toY, fall),
          scale: o.scale, toX: nil, attachTo: nil, releaseAt: nil, motion: nil)
        prop(attached, 0, t)
      } else {
        prop(o, p, t)
      }
    }
    g.restoreGState()
    if let w = words.first(where: { $0.start <= t && t < $0.end }) {
      let size = min(78, 800.0 / max(1, Double(w.text.count)) * 1.5)
      let u = clamp((t - w.start) / 0.07)
      let offset = (1 - smooth(u)) * 8
      _ = text(w.text.uppercased(), 540, 1660 + offset, size, .white, true)
    }
  }
}
