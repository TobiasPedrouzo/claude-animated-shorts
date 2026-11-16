import CoreGraphics
import Foundation

struct Joint {
  var x: Double
  var y: Double
  var point: CGPoint { CGPoint(x: x, y: y) }
}
struct Limb {
  let root: Joint
  let middle: Joint
  let tip: Joint
}
// Analytic two-bone IK. Target clamped to reachable distance to preserve limb lengths.
func limb(_ root: Joint, _ target: Joint, _ upper: Double, _ lower: Double, _ bend: Double) -> Limb
{
  let dx = target.x - root.x
  let dy = target.y - root.y
  let d = clamp(hypot(dx, dy), abs(upper - lower) + 0.001, upper + lower - 0.001)
  let direction = atan2(dy, dx)
  let angle = acos(clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1)) * bend
  let mid = Joint(
    x: root.x + cos(direction + angle) * upper, y: root.y + sin(direction + angle) * upper)
  let tip = Joint(x: root.x + cos(direction) * d, y: root.y + sin(direction) * d)
  return Limb(root: root, middle: mid, tip: tip)
}
struct Pose {
  let head: Joint
  let neck: Joint
  let hip: Joint
  let leftArm: Limb
  let rightArm: Limb
  let leftLeg: Limb
  let rightLeg: Limb
  let tilt: Double
  let x: Double
}
func pose(_ actor: Actor, _ time: Double, _ progress: Double) -> Pose {
  let walk = actor.action == "walk" || actor.action == "push"
  let stride = walk ? sin(time * 8.5) : 0
  let bob = walk ? abs(cos(time * 8.5)) * 8 : sin(time * 2.1) * 2
  let shoulder = Joint(x: 0, y: -322 + bob)
  let hip = Joint(x: 0, y: -192 + bob)
  var left = Joint(x: -96 - stride * 30, y: -205)
  var right = Joint(x: 96 + stride * 30, y: -205)
  switch actor.action {
  case "point": right = Joint(x: 165, y: -346)
  case "grab": right = Joint(x: 140, y: -273 - smooth(progress) * 65)
  case "push":
    left = Joint(x: 141, y: -310)
    right = Joint(x: 156, y: -286)
  case "celebrate":
    left = Joint(x: -122, y: -438)
    right = Joint(x: 122, y: -438)
  case "surprise":
    left = Joint(x: -105, y: -393)
    right = Joint(x: 105, y: -393)
  default: break
  }
  return Pose(
    head: Joint(x: 0, y: -416 + bob), neck: shoulder, hip: hip,
    leftArm: limb(shoulder, left, 88, 91, 1), rightArm: limb(shoulder, right, 88, 91, -1),
    leftLeg: limb(hip, Joint(x: -55 + stride * 65, y: -max(0, stride) * 32), 112, 112, 1),
    rightLeg: limb(hip, Joint(x: 55 - stride * 65, y: -max(0, -stride) * 32), 112, 112, -1),
    tilt: actor.action == "fall" ? smooth(progress) * 1.22 : (walk ? stride * 0.025 : 0),
    x: lerp(actor.x, actor.toX, smooth(progress)))
}
