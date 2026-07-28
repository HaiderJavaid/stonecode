import AppKit
import AVFoundation
import CoreImage
import Foundation

struct PromoScene {
    let id: String
    let windowTitle: String
    let eyebrow: String
    let title: String
    let copy: String
    let rail: [String]
    let actions: [String]
    let accent: NSColor
}

let scenes = [
    PromoScene(id: "discovery", windowTitle: "Add learning", eyebrow: "AI DISCOVERY", title: "What would you like to learn or build?", copy: "Tell Stonecode your goal in your own words. Suggested answers help, but free typing is always available.", rail: ["Goal", "Background", "Optional check", "Review"], actions: ["2D game with Pygame", "Web development", "Help me choose"], accent: NSColor(calibratedRed: 0.62, green: 0.46, blue: 0.96, alpha: 1)),
    PromoScene(id: "assessment", windowTitle: "Optional prerequisite check", eyebrow: "QUESTION 2 OF 3", title: "Show Stonecode what you already know.", copy: "Take a short check or skip it. Either path produces an editable brief grounded in your declared background.", rail: ["Goal", "Background", "Assessment", "Review"], actions: ["Choose an answer", "I don't know", "Skip assessment"], accent: NSColor(calibratedRed: 0.86, green: 0.67, blue: 0.33, alpha: 1)),
    PromoScene(id: "modules", windowTitle: "Personal course", eyebrow: "MODULE 1 READY", title: "A course shaped around your goal.", copy: "Stonecode plans the path, fully generates the first module, and keeps later modules visible as the journey continues.", rail: ["Modules", "Files", "Progress"], actions: ["Start Module 1", "View course"], accent: NSColor(calibratedRed: 0.40, green: 0.75, blue: 0.57, alpha: 1)),
    PromoScene(id: "tutor", windowTitle: "Personal AI tutor", eyebrow: "THEORY · VARIABLES", title: "Understand the idea before using the syntax.", copy: "Plain-language theory, useful analogies, and small examples prepare you for the editor instead of asking you to guess.", rail: ["Modules", "Theory", "main.py", "Tutor"], actions: ["Show an analogy", "Explain this line", "Give me an example"], accent: NSColor(calibratedRed: 0.43, green: 0.68, blue: 0.91, alpha: 1)),
    PromoScene(id: "workshop", windowTitle: "Guided workshop", eyebrow: "STEP 3 OF 12", title: "Build through one meaningful edit at a time.", copy: "The tutor, files, editor, Visual view, and Terminal share the same project context throughout the lesson.", rail: ["Modules", "main.py", "Visual", "Terminal"], actions: ["Why this change?", "Show the delta", "Check"], accent: NSColor(calibratedRed: 0.68, green: 0.49, blue: 0.92, alpha: 1)),
    PromoScene(id: "exercises", windowTitle: "Focused exercise", eyebrow: "PYTHON · EASY", title: "Practice the exact skill you want to strengthen.", copy: "Run freely, request one focused hint, and receive actionable feedback grounded in the generated acceptance criteria.", rail: ["Exercise 3", "main.py", "Terminal", "Checklist"], actions: ["Run", "Ask one hint", "Check answer"], accent: NSColor(calibratedRed: 0.90, green: 0.47, blue: 0.41, alpha: 1)),
    PromoScene(id: "progress", windowTitle: "Skill progression", eyebrow: "VERIFIED PROGRESS", title: "+20 Python XP", copy: "Completed work becomes language XP, solved-exercise history, program progress, and achievement titles you can equip.", rail: ["Overview", "Languages", "Exercises", "Titles"], actions: ["Python · 140 XP", "Game Dev · 65 XP", "First Steps earned"], accent: NSColor(calibratedRed: 0.38, green: 0.78, blue: 0.55, alpha: 1))
]

let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("public/marketing", isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func fill(_ rect: CGRect, color: NSColor, radius: CGFloat = 0) {
    color.setFill()
    if radius > 0 { NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill() }
    else { NSBezierPath(rect: rect).fill() }
}

func stroke(_ rect: CGRect, color: NSColor, radius: CGFloat, width: CGFloat = 1) {
    color.setStroke()
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    path.lineWidth = width
    path.stroke()
}

func text(_ value: String, rect: CGRect, size: CGFloat, color: NSColor, weight: NSFont.Weight = .regular, mono: Bool = false) {
    let font = mono
        ? NSFont.monospacedSystemFont(ofSize: size, weight: weight)
        : NSFont.systemFont(ofSize: size, weight: weight)
    let style = NSMutableParagraphStyle()
    style.lineBreakMode = .byWordWrapping
    let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: style]
    NSAttributedString(string: value, attributes: attributes).draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading])
}

func render(scene: PromoScene, progress: Double, width: Int, height: Int, context: CGContext) {
    let w = CGFloat(width), h = CGFloat(height)
    let graphics = NSGraphicsContext(cgContext: context, flipped: true)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics
    defer { NSGraphicsContext.restoreGraphicsState() }

    fill(CGRect(x: 0, y: 0, width: w, height: h), color: NSColor(calibratedWhite: 0.025, alpha: 1))
    fill(CGRect(x: 0, y: 0, width: w, height: h * 0.42), color: NSColor(calibratedWhite: 0.055, alpha: 1))
    let glowAlpha = 0.05 + 0.025 * sin(progress * .pi)
    fill(CGRect(x: w * 0.48, y: -h * 0.10, width: w * 0.62, height: h * 0.76), color: scene.accent.withAlphaComponent(glowAlpha), radius: h * 0.3)

    let scale = min(w / 1280, h / 720)
    let panel = CGRect(x: 70 * scale, y: 54 * scale, width: w - 140 * scale, height: h - 108 * scale)
    fill(panel, color: NSColor(calibratedWhite: 0.045, alpha: 0.97), radius: 14 * scale)
    stroke(panel, color: NSColor(calibratedWhite: 1, alpha: 0.10), radius: 14 * scale)

    let top = CGRect(x: panel.minX, y: panel.minY, width: panel.width, height: 58 * scale)
    fill(top, color: NSColor(calibratedWhite: 0.018, alpha: 0.96), radius: 14 * scale)
    for index in 0..<3 {
        fill(CGRect(x: panel.minX + (22 + CGFloat(index) * 18) * scale, y: panel.minY + 24 * scale, width: 7 * scale, height: 7 * scale), color: NSColor(calibratedWhite: 0.7, alpha: 0.34), radius: 4 * scale)
    }
    text("stonecode  /  \(scene.windowTitle)", rect: CGRect(x: panel.minX + 96 * scale, y: panel.minY + 19 * scale, width: panel.width - 120 * scale, height: 22 * scale), size: 11 * scale, color: NSColor(calibratedWhite: 0.76, alpha: 0.76), weight: .semibold, mono: true)

    let bodyY = panel.minY + 74 * scale
    let rail = CGRect(x: panel.minX + 18 * scale, y: bodyY, width: 190 * scale, height: panel.height - 94 * scale)
    fill(rail, color: NSColor(calibratedWhite: 0.02, alpha: 0.7), radius: 10 * scale)
    for (index, item) in scene.rail.enumerated() {
        let itemRect = CGRect(x: rail.minX + 12 * scale, y: rail.minY + (18 + CGFloat(index) * 48) * scale, width: rail.width - 24 * scale, height: 34 * scale)
        if index == min(Int(progress * Double(scene.rail.count)), scene.rail.count - 1) {
            fill(itemRect, color: scene.accent.withAlphaComponent(0.14), radius: 7 * scale)
        }
        text(item, rect: itemRect.insetBy(dx: 10 * scale, dy: 9 * scale), size: 10 * scale, color: NSColor(calibratedWhite: 0.86, alpha: index == 0 ? 0.9 : 0.52), weight: .semibold, mono: true)
    }

    let content = CGRect(x: rail.maxX + 22 * scale, y: bodyY, width: panel.maxX - rail.maxX - 40 * scale, height: panel.height - 94 * scale)
    fill(content, color: NSColor(calibratedWhite: 0.018, alpha: 0.78), radius: 10 * scale)
    let rise = CGFloat((1 - min(progress * 5, 1)) * 18) * scale
    let alpha = CGFloat(min(progress * 5, 1))
    text(scene.eyebrow, rect: CGRect(x: content.minX + 42 * scale, y: content.minY + 70 * scale + rise, width: content.width - 84 * scale, height: 22 * scale), size: 12 * scale, color: scene.accent.withAlphaComponent(alpha), weight: .bold, mono: true)
    text(scene.title, rect: CGRect(x: content.minX + 42 * scale, y: content.minY + 108 * scale + rise, width: content.width - 84 * scale, height: 96 * scale), size: 34 * scale, color: NSColor(calibratedWhite: 0.95, alpha: alpha), weight: .medium)
    text(scene.copy, rect: CGRect(x: content.minX + 42 * scale, y: content.minY + 214 * scale + rise, width: min(content.width - 84 * scale, 690 * scale), height: 82 * scale), size: 16 * scale, color: NSColor(calibratedWhite: 0.72, alpha: 0.78 * alpha))

    var actionX = content.minX + 42 * scale
    for (index, action) in scene.actions.enumerated() {
        let actionWidth = min(CGFloat(action.count) * 8.5 * scale + 28 * scale, 230 * scale)
        let actionRect = CGRect(x: actionX, y: content.maxY - 86 * scale, width: actionWidth, height: 38 * scale)
        fill(actionRect, color: index == 0 ? scene.accent.withAlphaComponent(0.18) : NSColor(calibratedWhite: 0.08, alpha: 0.52), radius: 8 * scale)
        stroke(actionRect, color: NSColor(calibratedWhite: 1, alpha: 0.08), radius: 8 * scale)
        text(action, rect: actionRect.insetBy(dx: 12 * scale, dy: 11 * scale), size: 10 * scale, color: NSColor(calibratedWhite: 0.88, alpha: 0.84), weight: .semibold, mono: true)
        actionX += actionWidth + 10 * scale
    }

    let progressRect = CGRect(x: content.minX + 42 * scale, y: content.maxY - 26 * scale, width: content.width - 84 * scale, height: 3 * scale)
    fill(progressRect, color: NSColor(calibratedWhite: 1, alpha: 0.08), radius: 2 * scale)
    fill(CGRect(x: progressRect.minX, y: progressRect.minY, width: progressRect.width * CGFloat(progress), height: progressRect.height), color: scene.accent.withAlphaComponent(0.9), radius: 2 * scale)
}

func makePixelBuffer(width: Int, height: Int, pool: CVPixelBufferPool?) -> CVPixelBuffer {
    var buffer: CVPixelBuffer?
    if let pool { CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) }
    if buffer == nil {
        CVPixelBufferCreate(nil, width, height, kCVPixelFormatType_32BGRA, [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true
        ] as CFDictionary, &buffer)
    }
    return buffer!
}

func drawBuffer(_ buffer: CVPixelBuffer, scene: PromoScene, progress: Double, width: Int, height: Int) {
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer), space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue)!
    context.translateBy(x: 0, y: CGFloat(height))
    context.scaleBy(x: 1, y: -1)
    render(scene: scene, progress: progress, width: width, height: height, context: context)
}

func writePoster(scene: PromoScene, width: Int, height: Int, url: URL) throws {
    let buffer = makePixelBuffer(width: width, height: height, pool: nil)
    drawBuffer(buffer, scene: scene, progress: 0.38, width: width, height: height)
    let image = CIImage(cvPixelBuffer: buffer)
    try CIContext().writePNGRepresentation(of: image, to: url, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
}

func writeVideo(url: URL, width: Int, height: Int, fps: Int32, duration: Double, sceneAt: (Double) -> (PromoScene, Double)) throws {
    try? FileManager.default.removeItem(at: url)
    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: width >= 1900 ? 5_000_000 : 2_400_000,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
        ]
    ])
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height
    ])
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? NSError(domain: "Promo", code: 1) }
    writer.startSession(atSourceTime: .zero)
    let frames = Int(duration * Double(fps))
    for frame in 0..<frames {
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
        autoreleasepool {
            let elapsed = Double(frame) / Double(fps)
            let (scene, progress) = sceneAt(elapsed)
            let buffer = makePixelBuffer(width: width, height: height, pool: adaptor.pixelBufferPool)
            drawBuffer(buffer, scene: scene, progress: progress, width: width, height: height)
            adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: fps))
        }
    }
    input.markAsFinished()
    let semaphore = DispatchSemaphore(value: 0)
    writer.finishWriting { semaphore.signal() }
    semaphore.wait()
    if writer.status != .completed { throw writer.error ?? NSError(domain: "Promo", code: 2) }
}

func mux(video: URL, audio: URL, output: URL) throws {
    try? FileManager.default.removeItem(at: output)
    let videoAsset = AVURLAsset(url: video)
    let audioAsset = AVURLAsset(url: audio)
    let composition = AVMutableComposition()
    guard let sourceVideo = videoAsset.tracks(withMediaType: .video).first,
          let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { return }
    try videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: videoAsset.duration), of: sourceVideo, at: .zero)
    if let sourceAudio = audioAsset.tracks(withMediaType: .audio).first,
       let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
        let audioDuration = CMTimeMinimum(audioAsset.duration, videoAsset.duration)
        try audioTrack.insertTimeRange(CMTimeRange(start: .zero, duration: audioDuration), of: sourceAudio, at: .zero)
    }
    guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality) else { return }
    exporter.outputURL = output
    exporter.outputFileType = .mp4
    exporter.shouldOptimizeForNetworkUse = true
    let semaphore = DispatchSemaphore(value: 0)
    exporter.exportAsynchronously { semaphore.signal() }
    semaphore.wait()
    if exporter.status != .completed { throw exporter.error ?? NSError(domain: "Promo", code: 3) }
}

for scene in scenes {
    let videoURL = outputDirectory.appendingPathComponent("\(scene.id)-loop.mp4")
    let posterURL = outputDirectory.appendingPathComponent("\(scene.id)-poster.png")
    try writePoster(scene: scene, width: 1280, height: 720, url: posterURL)
    try writeVideo(url: videoURL, width: 1280, height: 720, fps: 24, duration: 8) { elapsed in
        (scene, min(max(elapsed / 8, 0), 1))
    }
    print("Rendered \(scene.id)")
}

let silentMaster = outputDirectory.appendingPathComponent("stonecode-master-silent.mp4")
let master = outputDirectory.appendingPathComponent("stonecode-master.mp4")
let narration = FileManager.default.temporaryDirectory.appendingPathComponent("stonecode-master-narration.aiff")
let narrationText = "AI can generate code in seconds. Understanding it gives you control. Tell Stonecode what you want to learn or build, and share what you already know. Take a short prerequisite check, or skip it. Stonecode turns that context into a personal course with modules shaped around your goal. Learn each concept in plain language. Ask your AI tutor questions without leaving the lesson. Then build through one meaningful code change at a time. Practice with focused exercises, run your work, and get feedback that explains what still needs attention. Every verified result builds language experience, progress, and achievements. Start free with your own OpenAI key, or choose a plan with Stonecode AI credits. Learn the code AI helps you create."
try? FileManager.default.removeItem(at: narration)
let speech = Process()
speech.executableURL = URL(fileURLWithPath: "/usr/bin/say")
speech.arguments = ["-v", "Samantha", "-r", "165", "-o", narration.path, narrationText]
try speech.run()
speech.waitUntilExit()
try writePoster(scene: scenes[0], width: 1920, height: 1080, url: outputDirectory.appendingPathComponent("stonecode-master-poster.png"))
try writeVideo(url: silentMaster, width: 1920, height: 1080, fps: 30, duration: 60) { elapsed in
    let introDuration = 5.0
    let sceneDuration = 7.0
    if elapsed < introDuration { return (scenes[0], elapsed / introDuration) }
    let sceneElapsed = elapsed - introDuration
    let index = min(Int(sceneElapsed / sceneDuration), scenes.count - 1)
    return (scenes[index], (sceneElapsed.truncatingRemainder(dividingBy: sceneDuration)) / sceneDuration)
}
if FileManager.default.fileExists(atPath: narration.path) {
    try mux(video: silentMaster, audio: narration, output: master)
    try? FileManager.default.removeItem(at: silentMaster)
    try? FileManager.default.removeItem(at: narration)
} else {
    try? FileManager.default.removeItem(at: master)
    try FileManager.default.moveItem(at: silentMaster, to: master)
}
print("Rendered stonecode-master.mp4")
