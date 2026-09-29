import sharp from 'sharp'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/favicon.svg')
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#3d5a2a"/><g transform="translate(76 76) scale(.703)"><path d="M96 384V152l160 152 160-152v232" fill="none" stroke="#f5f6f3" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`)
await sharp(svg).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(svg).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(maskable).resize(512, 512).png().toFile('public/pwa-maskable-512.png')
console.log('icons written')
