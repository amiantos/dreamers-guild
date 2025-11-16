// Base request configuration for AI Horde image generation
// This matches the baseRequest used in the preview generation script
export const baseRequest = {
  models: ['stable_diffusion'],
  prompt: '',
  censor_nsfw: true,
  shared: false,
  replacement_filter: true,
  dry_run: false,
  r2: true,
  nsfw: true,
  trusted_workers: true,
  slow_workers: false,
  params: {
    steps: 30,
    cfg_scale: 7.5,
    sampler_name: 'k_euler',
    seed: '',
    denoising_strength: 0.5,
    facefixer_strength: 0.5,
    n: 1,
    width: 512,
    height: 512,
    post_processing: [],
    karras: false,
    tiling: false,
    hires_fix: false,
    clip_skip: 1
  }
}

// Parameters that should be copied from a style to the request
export const styleCopyParams = [
  'steps',
  'width',
  'height',
  'cfg_scale',
  'clip_skip',
  'hires_fix',
  'karras',
  'sampler_name',
  'loras',
  'tis'
]
