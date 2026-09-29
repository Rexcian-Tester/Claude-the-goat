import sharp from 'sharp'
import { readFileSync } from 'node:fs'
// All icons come from public/favicon.svg. The maskable icon is full-bleed with the mark kept inside the
// central safe zone (Android crops it to a circle or squircle).
const svg = readFileSync('public/favicon.svg', 'utf8')
const inner = svg.replace(/^[\s\S]*?<\/defs>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect[^>]*rx="112"[^>]*\/>/g, '')
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0]
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/><g transform="translate(64 64) scale(.75)">${inner}</g></svg>`)
const buf = Buffer.from(svg)
await sharp(buf, { density: 300 }).resize(192, 192).png().toFile('public/pwa-192.png')
await sharp(buf, { density: 300 }).resize(512, 512).png().toFile('public/pwa-512.png')
await sharp(buf, { density: 300 }).resize(180, 180).png().toFile('public/apple-touch-icon.png')
await sharp(maskable, { density: 300 }).resize(512, 512).png().toFile('public/pwa-maskable-512.png')
console.log('icons written')
