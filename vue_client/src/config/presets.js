// Sample prompts for Basic mode (inspired by artbot)
// Each prompt is paired with a style that matches its intended aesthetic
export const samplePrompts = [
  {
    prompt: "A post-apocalyptic wasteland with an amusement park in ruins in the style of vintage poster, featuring distressed textures, muted colors, and bold typography, reminiscent of mid-century advertisements or travel posters. The poster says \"WELCOME!!!\"",
    style: "flux-landscape"
  },
  {
    prompt: "Schematics for a steampunk computer from the Victorian Age, showcasing long lost technology. ink and watercolor on parchment",
    style: "sdxl-landscape"
  },
  {
    prompt: "A penguin dressed like a superhero, wearing a red cape and flying through the air. Cartoon comic illustration in the style of roy lichtenstein and steve ditko, centered on a white background",
    style: "sdxl-portrait"
  },
  {
    prompt: "Industrial urban scene featuring stark, geometric buildings lining a narrow, reflective canal. Power lines stretch overhead, enhancing the sense of depth in this minimalist black and white illustration.",
    style: "flux-landscape"
  },
  {
    prompt: "A refined watercolor portrait of a distinguished penguin in a tailored suit and aviator sunglasses, looking heroic. Vibrant colors, artistic brushstrokes",
    style: "flux-portrait"
  },
  {
    prompt: "Himalayan mountains, flat design, vibrant colors, Moebius",
    style: "sdxl-landscape"
  },
  {
    prompt: "An astronaut resting on Mars in a beach chair.",
    style: "sdxl-landscape"
  },
  {
    prompt: "Mountain chalet covered in snow, foggy, sunrise, sharp details, sharp focus, elegant, highly detailed, illustration, by Jordan Grimmer and Greg Rutkowski",
    style: "sdxl-landscape"
  },
  {
    prompt: "Graffiti-style picture of a Raven, alcohol markers and aerosol paint",
    style: "sdxl-portrait"
  },
  {
    prompt: "macro photograph of a brisket on a table with beer, in a blurred restaurant with depth of field, bokeh, soft diffused light, professional food photography",
    style: "sdxl-landscape"
  },
  {
    prompt: "Beautiful portrait oil painting of an aristocrat chipmunk",
    style: "sdxl-portrait"
  },
  {
    prompt: "San Francisco Downtown, sunset, flat design poster, minimalist, modern, 4k, epic composition, flat vector art illustration, stunning realism, long shot, unreal engine 4d",
    style: "sdxl-portrait"
  },
  {
    prompt: "Cartoon animation style a cool penguin wearing sunglasses, surfing on a wave. The penguin has a playful expression, standing confidently on a surfboard, with one flipper raised in a thumbs-up gesture. The wave is a vibrant blue with white frothy details, curling dynamically around the penguin. The background includes a sunny sky with a few fluffy clouds. The overall style is bright, colorful, and cheerful, typical of classic Disney animation.",
    style: "sdxl-widescreen"
  },
  {
    prompt: "Plans for a mechanical brain, drawn in the style of Leonardo Da Vinci",
    style: "sdxl-widescreen"
  },
  {
    prompt: "Movie poster that says \"DREAMERS GUILD\" in the style of a 1980s fantasy adventure movie",
    style: "flux-portrait"
  }
]

export function getRandomSamplePrompt() {
  return samplePrompts[Math.floor(Math.random() * samplePrompts.length)]
}

// Base defaults for form reset (minimal settings, no prompts)
export const baseDefaults = {
  prompt: '',
  negativePrompt: '',
  model: 'AlbedoBase XL (SDXL)',
  n: 4,
  steps: 30,
  width: 1024,
  height: 1024,
  cfgScale: 7,
  clipSkip: 1,
  sampler: 'k_euler_a',
  seed: '',
  useRandomSeed: true,
  karras: true,
  hiresFix: false,
  hiresFixDenoisingStrength: 0.65,
  tiling: false,
  transparent: false,
  faceFix: 'none',
  faceFixStrength: 0.5,
  upscaler: 'none',
  stripBackground: false,
  loras: [],
  tis: []
}
