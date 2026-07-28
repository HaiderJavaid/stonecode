import AppKit
import AVFoundation
import CoreImage
import Foundation

struct CaptureStage {
    let start: Double
    let image: String
    let focusY: CGFloat
    let cursor: CGPoint
}

let projectRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let captureDirectory = projectRoot.appendingPathComponent("output/playwright/stonecode-discovery", isDirectory: true)
let outputDirectory = projectRoot.appendingPathComponent("public/marketing", isDirectory: true)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

let stages = [
    CaptureStage(start: 0.0, image: "00-dashboard.png", focusY: 540, cursor: CGPoint(x: 1690, y: 78)),
    CaptureStage(start: 1.0, image: "01-guide-thinking.png", focusY: 540, cursor: CGPoint(x: 1690, y: 78)),
    CaptureStage(start: 1.55, image: "02-first-question.png", focusY: 370, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 2.75, image: "03-goal-thinking.png", focusY: 700, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 3.3, image: "04-tool-question.png", focusY: 370, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 4.55, image: "05-stack-thinking.png", focusY: 700, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 5.1, image: "06-experience-question.png", focusY: 370, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 6.35, image: "07-background-thinking.png", focusY: 700, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 6.9, image: "08-assessment-offer.png", focusY: 430, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 8.65, image: "09-assessment-loading.png", focusY: 650, cursor: CGPoint(x: 1585, y: 955)),
    CaptureStage(start: 9.2, image: "10-assessment.png", focusY: 390, cursor: CGPoint(x: 1600, y: 260))
]

let images: [String: NSImage] = try Dictionary(uniqueKeysWithValues: Set(stages.map(\.image)).map { name in
    let url = captureDirectory.appendingPathComponent(name)
    guard let image = NSImage(contentsOf: url) else {
        throw NSError(domain: "StonecodeCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing browser capture: \(url.path)"])
    }
    return (name, image)
})

let width = 1280
let height = 720
let fps: Int32 = 30
let duration = 11.5

func clamp(_ value: Double, _ lower: Double = 0, _ upper: Double = 1) -> Double {
    min(max(value, lower), upper)
}

func smooth(_ value: Double) -> CGFloat {
    let x = clamp(value)
    return CGFloat(x * x * (3 - 2 * x))
}

func makePixelBuffer(pool: CVPixelBufferPool?) -> CVPixelBuffer {
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

func stageIndex(at time: Double) -> Int {
    stages.lastIndex(where: { $0.start <= time }) ?? 0
}

func camera(at time: Double, index: Int) -> (scale: CGFloat, focusY: CGFloat) {
    let stage = stages[index]
    let next = stages[min(index + 1, stages.count - 1)]
    let stageEnd = index + 1 < stages.count ? next.start : duration
    let progress = smooth((time - stage.start) / max(stageEnd - stage.start, 0.2))
    let pan = smooth((Double(progress) - 0.35) / 0.65)
    let focusY = stage.focusY + (next.focusY - stage.focusY) * pan
    let zoom = 1 + 1.05 * smooth((time - 0.45) / 1.15)
    return (zoom, focusY)
}

func destinationRect(scale: CGFloat, focusY: CGFloat) -> CGRect {
    let baseScale = CGFloat(width) / 1920
    let renderedScale = baseScale * scale
    let focusX: CGFloat = 1685
    let targetX: CGFloat = scale < 1.08 ? CGFloat(width) / 2 : 890
    let targetY: CGFloat = 360
    return CGRect(
        x: targetX - focusX * renderedScale,
        y: targetY - focusY * renderedScale,
        width: 1920 * renderedScale,
        height: 1080 * renderedScale
    )
}

func cursorPoint(_ source: CGPoint, in rect: CGRect) -> CGPoint {
    CGPoint(x: rect.minX + source.x * rect.width / 1920, y: rect.minY + source.y * rect.height / 1080)
}

func drawCursor(at point: CGPoint, time: Double) {
    let clickTimes = [1.0, 2.75, 4.55, 6.35, 8.65]
    if let clickTime = clickTimes.min(by: { abs($0 - time) < abs($1 - time) }), abs(clickTime - time) < 0.28 {
        let progress = CGFloat(abs(clickTime - time) / 0.28)
        let radius = 12 + progress * 20
        NSColor(calibratedRed: 0.72, green: 0.55, blue: 1, alpha: 0.55 * (1 - progress)).setStroke()
        let ring = NSBezierPath(ovalIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2))
        ring.lineWidth = 3
        ring.stroke()
    }

    let shadow = NSBezierPath()
    shadow.move(to: CGPoint(x: point.x + 2, y: point.y + 2))
    shadow.line(to: CGPoint(x: point.x + 2, y: point.y + 25))
    shadow.line(to: CGPoint(x: point.x + 9, y: point.y + 19))
    shadow.line(to: CGPoint(x: point.x + 15, y: point.y + 31))
    shadow.line(to: CGPoint(x: point.x + 21, y: point.y + 28))
    shadow.line(to: CGPoint(x: point.x + 15, y: point.y + 16))
    shadow.line(to: CGPoint(x: point.x + 25, y: point.y + 15))
    shadow.close()
    NSColor(calibratedWhite: 0, alpha: 0.72).setFill()
    shadow.fill()

    let pointer = NSBezierPath()
    pointer.move(to: point)
    pointer.line(to: CGPoint(x: point.x, y: point.y + 23))
    pointer.line(to: CGPoint(x: point.x + 7, y: point.y + 17))
    pointer.line(to: CGPoint(x: point.x + 13, y: point.y + 29))
    pointer.line(to: CGPoint(x: point.x + 19, y: point.y + 26))
    pointer.line(to: CGPoint(x: point.x + 13, y: point.y + 14))
    pointer.line(to: CGPoint(x: point.x + 23, y: point.y + 13))
    pointer.close()
    NSColor.white.setFill()
    pointer.fill()
    NSColor(calibratedWhite: 0.08, alpha: 0.9).setStroke()
    pointer.lineWidth = 1.5
    pointer.stroke()
}

func drawFrame(_ buffer: CVPixelBuffer, time: Double) {
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    )!
    context.translateBy(x: 0, y: CGFloat(height))
    context.scaleBy(x: 1, y: -1)
    let graphics = NSGraphicsContext(cgContext: context, flipped: true)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = graphics
    defer { NSGraphicsContext.restoreGraphicsState() }

    NSColor.black.setFill()
    NSBezierPath(rect: CGRect(x: 0, y: 0, width: width, height: height)).fill()

    let index = stageIndex(at: time)
    let current = stages[index]
    let previous = stages[max(0, index - 1)]
    let blend = index == 0 ? CGFloat(1) : smooth((time - current.start) / 0.16)
    let currentCamera = camera(at: time, index: index)
    let rect = destinationRect(scale: currentCamera.scale, focusY: currentCamera.focusY)
    let previousRect = destinationRect(scale: currentCamera.scale, focusY: previous.focusY + (current.focusY - previous.focusY) * blend)

    images[previous.image]?.draw(in: previousRect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
    if index > 0 {
        images[current.image]?.draw(in: rect, from: .zero, operation: .sourceOver, fraction: blend, respectFlipped: true, hints: nil)
    }

    let localDuration = index + 1 < stages.count ? stages[index + 1].start - current.start : duration - current.start
    let nextCursor = stages[min(index + 1, stages.count - 1)].cursor
    let move = smooth((time - current.start) / max(localDuration * 0.72, 0.2))
    let sourceCursor = CGPoint(
        x: current.cursor.x + (nextCursor.x - current.cursor.x) * move,
        y: current.cursor.y + (nextCursor.y - current.cursor.y) * move
    )
    drawCursor(at: cursorPoint(sourceCursor, in: rect), time: time)
}

func writePoster(url: URL) throws {
    let buffer = makePixelBuffer(pool: nil)
    drawFrame(buffer, time: 9.6)
    let image = CIImage(cvPixelBuffer: buffer)
    try CIContext().writePNGRepresentation(of: image, to: url, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
}

func writeVideo(url: URL) throws {
    try? FileManager.default.removeItem(at: url)
    let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 3_200_000,
            AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
        ]
    ])
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height
    ])
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? NSError(domain: "StonecodeCapture", code: 2) }
    writer.startSession(atSourceTime: .zero)
    for frame in 0..<Int(duration * Double(fps)) {
        while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.002) }
        autoreleasepool {
            let buffer = makePixelBuffer(pool: adaptor.pixelBufferPool)
            drawFrame(buffer, time: Double(frame) / Double(fps))
            adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: fps))
        }
    }
    input.markAsFinished()
    let semaphore = DispatchSemaphore(value: 0)
    writer.finishWriting { semaphore.signal() }
    semaphore.wait()
    if writer.status != .completed { throw writer.error ?? NSError(domain: "StonecodeCapture", code: 3) }
}

try writePoster(url: outputDirectory.appendingPathComponent("discovery-poster.png"))
try writeVideo(url: outputDirectory.appendingPathComponent("discovery-loop.mp4"))
print("Rendered discovery-loop.mp4 from real Stonecode browser captures")
