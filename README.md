![Packi Icon](./resources/icons/128x128.png)
# Packi

A free, open-source, offline desktop application that bundles common game-artist texture tools into a lightweight standalone app with local-only, scriptable processing.

Packi isn't a replacement for any DCC; rather, it's a helpful sidecar for texture prep that doesn't need all that extra weight: packing channels, normal map ops, batch-converting formats, etc. These are operations artists often solve with ad-hoc Photoshop actions, single-purpose web tools, or CLI utilities they'd rather not have to deal with.


## Stack
- **Runtime / Package Manager:** Bun
- **Desktop Framework:** Tauri 2 (Rust backend)
- **Frontend:** React + TypeScript
- **Styling:** Tailwind CSS + daisyUI
- **Image Processing:** Rust `image` + `exr` crates, parallelized with `rayon`


## Modules

### Channel Packer
Pack individual grayscale texture maps into the RGBA channels of a single output image.
- Drag-and-drop or browse to assign source textures to R, G, B, A channels
- Pick which source channel to pull from (e.g., use the green channel of a map as roughness input)
- Per-channel invert toggle
- Live preview of the packed result with channel soloing
- Built-in presets for common packing conventions (Unity HDRP Mask Map, Unreal ORM, Unity URP)
- Export as PNG (8-bit and 16-bit) and TGA

### Normal Map Tools
A focused set of operations for working with normal maps.
- **Channel flip** — convert between DirectX and OpenGL conventions with a single click
- **Height-to-normal** — generate a normal map from a grayscale heightmap with adjustable strength (Sobel filter)
- **Normal map blending** — combine two normal maps using Reoriented Normal Mapping (RNM)
- **Normalization** — re-normalize a normal map that's been through lossy compression or manual editing
- Side-by-side before/after preview for every operation

### Batch Processor
Bulk operations on texture files: format conversion, resizing, and renaming.
- Build an ordered processing pipeline from conversion, resize, and rename steps
- Preview output filenames and formats before executing
- Real-time progress feedback for large batches
- Save and reload pipeline definitions as presets
- Non-destructive by default — always outputs to a separate folder


## Development

```bash
# Install dependencies
make setup

# Run in development mode
make dev

# Build for production
make build
```


## License

Covered under the GPL License, see [LICENSE](./LICENSE.md)

Beyond that, I only have one rule: **First, do no harm. Then, help where you can.**


## Financial Support

If you have some cash to spare and are inspired to share, that's very kind. Rather than sharing that kindness with me, I encourage you to share it with your charity of choice.

Mine is the [GiveWell top charities fund](https://www.givewell.org/top-charities-fund), which does excellent research to figure out which causes can save the most human lives for the money, and puts their funds there.

Their grant to the [Against Malaria Foundation](https://www.againstmalaria.com) was shown to deliver outcomes at a cost of just $1,700 per life saved.

![GiveWell Logo](.github/assets/givewell_logo.png)
