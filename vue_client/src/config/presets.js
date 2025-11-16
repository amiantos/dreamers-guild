// Default preset settings for quick start
export const presets = [
  {
    prompt: "Jane Eyre with headphones, natural skin texture, 24mm, 4k textures, soft cinematic light, adobe lightroom, photolab, hdr, intricate, elegant, highly detailed, sharp focus, (cinematic look:1.2), soothing tones, insane details, intricate details, hyperdetailed, low contrast, soft cinematic light, dim colors, exposure blend, hdr, faded ### (deformed, distorted, disfigured:1.3), poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, (mutated hands and fingers:1.4), disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation",
    params: {
      sampler_name: "k_euler",
      cfg_scale: 9.0,
      height: 1024,
      width: 768,
      karras: true,
      hires_fix: true,
      clip_skip: 1,
      steps: 20,
      n: 4
    },
    models: ["Deliberate"]
  },
  {
    prompt: "end of the world, epic realistic, (hdr:1.4), (muted colors:1.4), apocalypse, freezing, abandoned, neutral colors, night, screen space refractions, (intricate details), (intricate details, hyperdetailed:1.2), artstation, cinematic shot, vignette, complex background, buildings, snowy ### poorly drawn",
    params: {
      sampler_name: "k_euler",
      cfg_scale: 9.0,
      height: 768,
      width: 1024,
      karras: true,
      hires_fix: false,
      clip_skip: 1,
      steps: 20,
      n: 4
    },
    models: ["Deliberate"]
  },
  {
    prompt: "medical mask, victorian era, cinematography, intricately detailed, crafted, meticulous, magnificent, maximum details, extremely hyper aesthetic ### deformed, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limb, ugly, disgusting, poorly drawn hands, missing limb, floating limbs, disconnected limbs, malformed hands, blurry, (mutated hands and fingers:1.2), watermark, watermarked, oversaturated, censored, distorted hands, amputation, missing hands, obese, doubled face, double hands, b&w, black and white, sepia, flowers, roses",
    params: {
      sampler_name: "k_euler",
      cfg_scale: 9.0,
      height: 1024,
      width: 768,
      karras: true,
      hires_fix: false,
      clip_skip: 1,
      steps: 20,
      n: 4
    },
    models: ["Deliberate"]
  }
]

export function getRandomPreset() {
  return presets[Math.floor(Math.random() * presets.length)]
}
