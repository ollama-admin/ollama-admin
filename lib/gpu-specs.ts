export type GpuEntry = { vram: number; bw: number };

// Memory bandwidth (GB/s) and VRAM (GB) for known GPUs.
// Sources: NVIDIA/AMD/Apple/Intel official specs, Wikipedia GPU series articles.
// Used by the model scoring algorithm to estimate inference tokens/second.
export const GPU_BANDWIDTH_DB: Record<string, GpuEntry> = {

  // ── NVIDIA GTX 16xx ────────────────────────────────────────────────────────
  "GTX 1660 Super": { vram: 6,  bw: 336 },
  "GTX 1660 Ti":    { vram: 6,  bw: 288 },
  "GTX 1660":       { vram: 6,  bw: 192 },

  // ── NVIDIA GTX 10xx ────────────────────────────────────────────────────────
  "GTX 1080 Ti": { vram: 11, bw: 484 },
  "GTX 1080":    { vram: 8,  bw: 320 },
  "GTX 1070 Ti": { vram: 8,  bw: 256 },
  "GTX 1070":    { vram: 8,  bw: 256 },

  // ── NVIDIA RTX 50xx ────────────────────────────────────────────────────────
  "RTX 5090":    { vram: 32, bw: 1792 },
  "RTX 5080":    { vram: 16, bw: 1024 },
  "RTX 5070 Ti": { vram: 16, bw: 960  },
  "RTX 5070":    { vram: 12, bw: 896  },
  "RTX 5060 Ti": { vram: 16, bw: 672  },
  "RTX 5060":    { vram: 8,  bw: 448  },

  // ── NVIDIA RTX 40xx ────────────────────────────────────────────────────────
  "RTX 4090":          { vram: 24, bw: 1008 },
  "RTX 4080 Super":    { vram: 16, bw: 736  },
  "RTX 4080":          { vram: 16, bw: 717  },
  "RTX 4070 Ti Super": { vram: 16, bw: 672  },
  "RTX 4070 Ti":       { vram: 12, bw: 504  },
  "RTX 4070 Super":    { vram: 12, bw: 504  },
  "RTX 4070":          { vram: 12, bw: 504  },
  "RTX 4060 Ti 16GB":  { vram: 16, bw: 288  },
  "RTX 4060 Ti":       { vram: 8,  bw: 288  },
  "RTX 4060":          { vram: 8,  bw: 272  },

  // ── NVIDIA RTX 30xx ────────────────────────────────────────────────────────
  "RTX 3090 Ti":   { vram: 24, bw: 1008 },
  "RTX 3090":      { vram: 24, bw: 936  },
  "RTX 3080 Ti":   { vram: 12, bw: 912  },
  "RTX 3080 12GB": { vram: 12, bw: 912  },
  "RTX 3080 10GB": { vram: 10, bw: 760  },
  "RTX 3080":      { vram: 10, bw: 760  },
  "RTX 3070 Ti":   { vram: 8,  bw: 608  },
  "RTX 3070":      { vram: 8,  bw: 448  },
  "RTX 3060 Ti":   { vram: 8,  bw: 448  },
  "RTX 3060 12GB": { vram: 12, bw: 360  },
  "RTX 3060":      { vram: 12, bw: 360  },
  "RTX 3050 8GB":  { vram: 8,  bw: 224  },
  "RTX 3050 6GB":  { vram: 6,  bw: 168  },
  "RTX 3050":      { vram: 8,  bw: 224  },

  // ── NVIDIA RTX 20xx ────────────────────────────────────────────────────────
  "RTX 2080 Ti":    { vram: 11, bw: 616 },
  "RTX 2080 Super": { vram: 8,  bw: 496 },
  "RTX 2080":       { vram: 8,  bw: 448 },
  "RTX 2070 Super": { vram: 8,  bw: 448 },
  "RTX 2070":       { vram: 8,  bw: 448 },
  "RTX 2060 Super": { vram: 8,  bw: 448 },
  "RTX 2060":       { vram: 6,  bw: 336 },

  // ── AMD Radeon RX 9000 ─────────────────────────────────────────────────────
  "RX 9070 XT":  { vram: 16, bw: 640 },
  "RX 9070":     { vram: 16, bw: 640 },
  "RX 9070 GRE": { vram: 12, bw: 432 },
  "RX 9060 XT":  { vram: 16, bw: 320 },
  "RX 9060":     { vram: 8,  bw: 288 },

  // ── AMD Radeon RX 7000 ─────────────────────────────────────────────────────
  "RX 7900 XTX": { vram: 24, bw: 960 },
  "RX 7900 XT":  { vram: 20, bw: 800 },
  "RX 7900 GRE": { vram: 16, bw: 576 },
  "RX 7800 XT":  { vram: 16, bw: 624 },
  "RX 7700 XT":  { vram: 12, bw: 432 },
  "RX 7600 XT":  { vram: 16, bw: 288 },
  "RX 7600":     { vram: 8,  bw: 288 },

  // ── AMD Radeon RX 6000 ─────────────────────────────────────────────────────
  "RX 6950 XT": { vram: 16, bw: 576 },
  "RX 6900 XT": { vram: 16, bw: 512 },
  "RX 6800 XT": { vram: 16, bw: 512 },
  "RX 6800":    { vram: 16, bw: 512 },
  "RX 6750 XT": { vram: 12, bw: 432 },
  "RX 6700 XT": { vram: 12, bw: 384 },
  "RX 6700":    { vram: 10, bw: 320 },
  "RX 6650 XT": { vram: 8,  bw: 280 },
  "RX 6600 XT": { vram: 8,  bw: 256 },
  "RX 6600":    { vram: 8,  bw: 224 },

  // ── AMD Radeon RX 5000 ─────────────────────────────────────────────────────
  "RX 5700 XT": { vram: 8, bw: 448 },
  "RX 5700":    { vram: 8, bw: 448 },

  // ── Intel Arc ──────────────────────────────────────────────────────────────
  "Arc B580":      { vram: 12, bw: 456 },
  "Arc B570":      { vram: 10, bw: 380 },
  "Arc A770 16GB": { vram: 16, bw: 560 },
  "Arc A770 8GB":  { vram: 8,  bw: 512 },
  "Arc A770":      { vram: 16, bw: 560 },
  "Arc A750":      { vram: 8,  bw: 512 },
  "Arc A580":      { vram: 8,  bw: 512 },
  "Arc A380":      { vram: 6,  bw: 186 },

  // ── Apple Silicon ──────────────────────────────────────────────────────────
  // Bandwidth source: Apple official specs pages + Apple M-series Wikipedia
  "M4 Max 48GB":    { vram: 48,  bw: 546 },
  "M4 Max 36GB":    { vram: 36,  bw: 410 },
  "M4 Pro 24GB":    { vram: 24,  bw: 273 },
  "M4 Pro 16GB":    { vram: 16,  bw: 273 },
  "M4 16GB":        { vram: 16,  bw: 120 },
  "M4 24GB":        { vram: 24,  bw: 120 },
  "M3 Max 48GB":    { vram: 48,  bw: 410 },
  "M3 Max 36GB":    { vram: 36,  bw: 300 },
  "M3 Pro 18GB":    { vram: 18,  bw: 150 },
  "M3 Pro 12GB":    { vram: 12,  bw: 150 },
  "M3 8GB":         { vram: 8,   bw: 102 },
  "M3 16GB":        { vram: 16,  bw: 102 },
  "M3 Ultra 192GB": { vram: 192, bw: 819 },
  "M3 Ultra 128GB": { vram: 128, bw: 819 },
  "M2 Ultra 192GB": { vram: 192, bw: 819 },
  "M2 Ultra 128GB": { vram: 128, bw: 819 },
  "M2 Max 96GB":    { vram: 96,  bw: 410 },
  "M2 Max 64GB":    { vram: 64,  bw: 410 },
  "M2 Pro 16GB":    { vram: 16,  bw: 205 },
  "M2 Pro 32GB":    { vram: 32,  bw: 205 },
  "M2 8GB":         { vram: 8,   bw: 102 },
  "M2 16GB":        { vram: 16,  bw: 102 },
  "M1 Ultra 128GB": { vram: 128, bw: 819 },
  "M1 Ultra 64GB":  { vram: 64,  bw: 819 },
  "M1 Max 64GB":    { vram: 64,  bw: 410 },
  "M1 Max 32GB":    { vram: 32,  bw: 410 },
  "M1 Pro 16GB":    { vram: 16,  bw: 200 },
  "M1 Pro 32GB":    { vram: 32,  bw: 200 },
  "M1 8GB":         { vram: 8,   bw: 68  },
  "M1 16GB":        { vram: 16,  bw: 68  },

  // ── NVIDIA Datacenter ──────────────────────────────────────────────────────
  // Blackwell
  "B200 192GB":      { vram: 192, bw: 8000 },
  "B100 192GB":      { vram: 192, bw: 8200 },
  // Hopper
  "GH200 96GB":      { vram: 96,  bw: 4000 }, // Grace Hopper Superchip (HBM3e)
  "H200 SXM 141GB":  { vram: 141, bw: 4800 },
  "H200 NVL 141GB":  { vram: 141, bw: 4800 },
  "H100 SXM 80GB":   { vram: 80,  bw: 3350 },
  "H100 SXM5 80GB":  { vram: 80,  bw: 3350 },
  "H100 PCIe 80GB":  { vram: 80,  bw: 2039 },
  "H100 NVL 94GB":   { vram: 94,  bw: 3900 },
  "H800 SXM 80GB":   { vram: 80,  bw: 3360 }, // export-restricted H100 variant (China)
  // Ada Lovelace
  "L40S 48GB":       { vram: 48,  bw: 864  },
  "L40 48GB":        { vram: 48,  bw: 864  },
  "L4 24GB":         { vram: 24,  bw: 300  },
  // Ampere
  "A800 80GB":       { vram: 80,  bw: 2000 }, // export-restricted A100 variant (China)
  "A100 SXM4 80GB":  { vram: 80,  bw: 2039 },
  "A100 PCIe 80GB":  { vram: 80,  bw: 1935 },
  "A100 SXM4 40GB":  { vram: 40,  bw: 1555 },
  "A100 PCIe 40GB":  { vram: 40,  bw: 1555 },
  "A40 48GB":        { vram: 48,  bw: 696  },
  "A30 24GB":        { vram: 24,  bw: 933  },
  "A10 24GB":        { vram: 24,  bw: 600  },
  "A10G 24GB":       { vram: 24,  bw: 600  },
  "A2 16GB":         { vram: 16,  bw: 200  }, // low-power inference card
  // Turing
  "T4 16GB":         { vram: 16,  bw: 320  },
  // Volta
  "V100S PCIe 32GB": { vram: 32,  bw: 1134 },
  "V100 SXM2 32GB":  { vram: 32,  bw: 900  },
  "V100 SXM2 16GB":  { vram: 16,  bw: 900  },
  "V100 PCIe 32GB":  { vram: 32,  bw: 900  },
  "V100 PCIe 16GB":  { vram: 16,  bw: 900  },
  // Pascal
  "P40 24GB":        { vram: 24,  bw: 346  }, // popular homelab inference card
  "P100 SXM2 16GB":  { vram: 16,  bw: 732  },
  "P100 PCIe 16GB":  { vram: 16,  bw: 549  },
  "P4 8GB":          { vram: 8,   bw: 192  }, // low-power inference card

  // ── NVIDIA Professional / Workstation ─────────────────────────────────────
  // Ada Lovelace
  "RTX 6000 Ada 48GB":     { vram: 48, bw: 960 },
  "RTX 5000 Ada 32GB":     { vram: 32, bw: 576 },
  "RTX 4500 Ada 24GB":     { vram: 24, bw: 432 },
  "RTX 4000 Ada 20GB":     { vram: 20, bw: 360 },
  "RTX 4000 SFF Ada 20GB": { vram: 20, bw: 280 },
  // Ampere
  "RTX A6000 48GB":    { vram: 48, bw: 768 },
  "RTX A5000 24GB":    { vram: 24, bw: 768 },
  "RTX A4500 20GB":    { vram: 20, bw: 640 },
  "RTX A4000 16GB":    { vram: 16, bw: 448 },

  // ── AMD Workstation ────────────────────────────────────────────────────────
  "Radeon Pro W7900 48GB": { vram: 48, bw: 864 },
  "Radeon Pro W7800 32GB": { vram: 32, bw: 576 },

  // ── AMD Instinct ───────────────────────────────────────────────────────────
  // CDNA 4
  "MI355X 288GB": { vram: 288, bw: 8000 },
  "MI350X 288GB": { vram: 288, bw: 8000 },
  // CDNA 3
  "MI325X 256GB": { vram: 256, bw: 6000 },
  "MI300X 192GB": { vram: 192, bw: 5300 },
  "MI300A 128GB": { vram: 128, bw: 5300 },
  // CDNA 2
  "MI250X 128GB": { vram: 128, bw: 3277 },
  "MI250 128GB":  { vram: 128, bw: 3200 },
  "MI210 64GB":   { vram: 64,  bw: 1638 },
  // CDNA 1
  "MI100 32GB":   { vram: 32,  bw: 1229 },

  // ── NVIDIA DGX Desktop Systems ─────────────────────────────────────────────
  // Unified CPU+GPU memory (LPDDR5x), slower than HBM but large capacity
  "DGX Spark GB10 128GB": { vram: 128, bw: 273 },

  // ── NVIDIA RTX 50xx Laptop GPU ─────────────────────────────────────────────
  // GDDR7; Sources: Wikipedia GeForce 50 series
  "RTX 5090 Laptop GPU":    { vram: 24, bw: 896 }, // 256-bit at 28 Gbps
  "RTX 5080 Laptop GPU":    { vram: 16, bw: 896 }, // 256-bit at 28 Gbps
  "RTX 5070 Ti Laptop GPU": { vram: 12, bw: 672 }, // 192-bit at 28 Gbps
  "RTX 5070 Laptop GPU":    { vram: 12, bw: 672 }, // 192-bit at 28 Gbps
  "RTX 5060 Laptop GPU":    { vram: 8,  bw: 384 }, // 128-bit at 24 Gbps
  "RTX 5050 Laptop GPU":    { vram: 8,  bw: 384 }, // 128-bit at 24 Gbps

  // ── NVIDIA RTX 40xx Laptop GPU ─────────────────────────────────────────────
  // GDDR6; Sources: Wikipedia GeForce 40 series
  "RTX 4090 Laptop GPU": { vram: 16, bw: 576 }, // 256-bit at 18 Gbps
  "RTX 4080 Laptop GPU": { vram: 12, bw: 432 }, // 192-bit at 18 Gbps
  "RTX 4070 Laptop GPU": { vram: 8,  bw: 256 }, // 128-bit at 16 Gbps (same bus as 4060)
  "RTX 4060 Laptop GPU": { vram: 8,  bw: 256 }, // 128-bit at 16 Gbps
  "RTX 4050 Laptop GPU": { vram: 6,  bw: 192 }, // 96-bit at 16 Gbps

  // ── NVIDIA RTX 30xx Laptop GPU ─────────────────────────────────────────────
  // GDDR6; Sources: Wikipedia GeForce 30 series (non-Max-Q/standard bandwidth)
  "RTX 3080 Ti Laptop GPU": { vram: 16, bw: 512 }, // 256-bit at 16 Gbps
  "RTX 3080 Laptop GPU":    { vram: 16, bw: 448 }, // 256-bit at 14 Gbps (8GB & 16GB same bw)
  "RTX 3070 Ti Laptop GPU": { vram: 8,  bw: 448 }, // 256-bit at 14 Gbps
  "RTX 3070 Laptop GPU":    { vram: 8,  bw: 448 }, // 256-bit at 14 Gbps
  "RTX 3060 Laptop GPU":    { vram: 6,  bw: 336 }, // 192-bit at 14 Gbps
  "RTX 3050 Laptop GPU":    { vram: 6,  bw: 144 }, // 96-bit at 12 Gbps (6GB 2022 refresh)
};

// Normalise a raw GPU name reported by the hardware sidecar to a DB key.
// Handles vendor prefixes ("NVIDIA GeForce", "AMD Radeon", "Apple ", "Intel "),
// Apple Silicon VRAM disambiguation, and multi-VRAM variants (Arc A770 8/16 GB).
export function lookupGpuSpecs(
  gpuName: string,
  vramGB: number
): GpuEntry | null {
  if (!gpuName) return null;

  // 1. Direct match
  if (GPU_BANDWIDTH_DB[gpuName]) return GPU_BANDWIDTH_DB[gpuName];

  // 2. Strip vendor prefixes
  const normalized = gpuName
    .replace(/^NVIDIA\s+(GeForce\s+)?/i, "")
    .replace(/^AMD\s+(Radeon\s+)?/i, "")
    .replace(/^Apple\s+/i, "")
    .replace(/^Intel\s+/i, "")
    .trim();

  if (GPU_BANDWIDTH_DB[normalized]) return GPU_BANDWIDTH_DB[normalized];

  // 3. Apple Silicon: append VRAM to distinguish "M1 Max 32GB" vs "M1 Max 64GB"
  if (/^M\d+/.test(normalized)) {
    const rounded = Math.round(vramGB);
    const withVram = `${normalized} ${rounded}GB`;
    if (GPU_BANDWIDTH_DB[withVram]) return GPU_BANDWIDTH_DB[withVram];
  }

  // 4. Fuzzy: collect all keys that contain the normalized string
  const normLower = normalized.toLowerCase();
  const candidates = Object.entries(GPU_BANDWIDTH_DB).filter(([key]) =>
    key.toLowerCase().includes(normLower)
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0][1];

  // 5. Disambiguate multi-VRAM variants by closest match to actual VRAM
  const roundedVram = Math.round(vramGB);
  const exact = candidates.find(([, e]) => e.vram === roundedVram);
  return exact ? exact[1] : candidates[0][1];
}
