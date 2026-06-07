#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const version = process.argv[2]

if (!version) {
  console.error('用法: node scripts/update-version.js <version>')
  console.error('示例: node scripts/update-version.js 1.2.0')
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`无效的版本号: ${version}`)
  process.exit(1)
}

const root = path.resolve(__dirname, '..')

function updatePackageJson(filePath) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const old = content.version
  content.version = version
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
  console.log(`${path.relative(root, filePath)}: ${old} → ${version}`)
}

// 更新根 package.json
updatePackageJson(path.join(root, 'package.json'))

// 更新所有子包
const packagesDir = path.join(root, 'packages')
for (const name of fs.readdirSync(packagesDir)) {
  const pkgPath = path.join(packagesDir, name, 'package.json')
  if (fs.existsSync(pkgPath)) {
    updatePackageJson(pkgPath)
  }
}

console.log(`\n✓ 所有包版本已更新为 ${version}`)
