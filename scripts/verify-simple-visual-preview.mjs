import assert from "node:assert/strict";
import {
  AUTO_SIMPLE_VISUAL_MARKER,
  buildSimpleVisualPreviewHtml,
  createSimpleVisualPreviewFile,
  inspectSimpleVisualSource,
  isAutoSimpleVisualPreview
} from "../src/services/simpleVisualPreview.mjs";

const pygameImport = {
  path: "main.py",
  content: "import pygame\n",
  language: "Python",
  context: "Build a simple desktop platformer"
};
assert.deepEqual(inspectSimpleVisualSource(pygameImport), {
  supported: true,
  excludedEngine: false,
  profileId: "pygame",
  label: "Pygame"
});
const pygamePreview = createSimpleVisualPreviewFile(pygameImport);
assert.ok(pygamePreview);
assert.equal(pygamePreview.path, "preview/index.html");
assert.ok(isAutoSimpleVisualPreview(pygamePreview.content));
assert.match(pygamePreview.content, new RegExp(AUTO_SIMPLE_VISUAL_MARKER));
assert.match(pygamePreview.content, /stonecode-source[^>]+\.\.\/main\.py/);
assert.match(pygamePreview.content, /no window exists yet/i);

const pygameScene = buildSimpleVisualPreviewHtml({
  ...pygameImport,
  content: `import pygame
pygame.init()
WIDTH = 800
HEIGHT = 450
screen = pygame.display.set_mode((WIDTH, HEIGHT))
player = pygame.Rect(80, 330, 40, 40)
pygame.draw.rect(screen, (90, 210, 150), player)
`
});
assert.match(pygameScene, /Display surface detected|Display and game loop detected/);
assert.match(pygameScene, /"kind":"rectangle"/);
assert.match(pygameScene, /"width":800/);
assert.match(pygameScene, /"height":450/);

for (const source of [
  { path: "game.js", content: "const ctx = canvas.getContext('2d'); ctx.fillRect(10, 20, 80, 40);" },
  { path: "main.cpp", content: "#include <raylib.h>\nDrawCircle(120, 80, 20, RED);" },
  { path: "Main.java", content: "import javax.swing.*; graphics.fillRect(10, 20, 80, 40);" },
  { path: "app.dart", content: "import 'package:flutter/material.dart'; class App extends StatelessWidget {}" }
]) {
  assert.equal(inspectSimpleVisualSource(source).supported, true, `${source.path} should support a simple visual`);
  assert.ok(createSimpleVisualPreviewFile(source));
}

const unity = inspectSimpleVisualSource({
  path: "PlayerController.cs",
  content: "using UnityEngine; public class PlayerController : MonoBehaviour {}",
  context: "Unity platformer",
  requiresPreview: true
});
assert.equal(unity.supported, false);
assert.equal(unity.excludedEngine, true);
assert.equal(createSimpleVisualPreviewFile({ path: "PlayerController.cs", content: "using UnityEngine;", requiresPreview: true }), null);

console.log("Simple visual preview verification passed.");
