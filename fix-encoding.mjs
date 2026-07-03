#!/usr/bin/env node
import fs from "fs"
import path from "path"
import { PrismaClient } from "@prisma/client"

const MAX_PASSES = 5
const dryRun = process.argv.includes("--dry-run")

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"))
loadEnvFile(path.resolve(process.cwd(), ".env"))

const prisma = new PrismaClient()

function hasResidualMojibake(value) {
  return typeof value === "string" && /(?:Ã|Â|â€|ðŸ|ï¿½)/u.test(value)
}

function repairString(input) {
  if (typeof input !== "string" || input.length === 0) return null

  let current = input
  for (let i = 0; i < MAX_PASSES; i += 1) {
    const next = Buffer.from(current, "latin1").toString("utf8")
    if (next === current) break
    current = next
  }

  if (current === input) return null
  if (hasResidualMojibake(current)) return null
  return current
}

function repairJsonValue(value) {
  if (typeof value === "string") {
    return repairString(value) ?? value
  }

  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const repaired = repairJsonValue(item)
      if (repaired !== item) changed = true
      return repaired
    })
    return changed ? next : value
  }

  if (value && typeof value === "object") {
    let changed = false
    const next = {}
    for (const [key, item] of Object.entries(value)) {
      const repaired = repairJsonValue(item)
      if (repaired !== item) changed = true
      next[key] = repaired
    }
    return changed ? next : value
  }

  return value
}

function maybeRepairField(value) {
  if (typeof value !== "string") return { changed: false, value }
  const repaired = repairString(value)
  return repaired ? { changed: true, value: repaired } : { changed: false, value }
}

function logChange(table, id, before, after) {
  console.log("[" + table + "] " + id)
  console.log("before:", JSON.stringify(before))
  console.log("after :", JSON.stringify(after))
}

async function main() {
  const summary = {
    product: 0,
    productVariant: 0,
    categoryAttribute: 0,
    productAttributeValue: 0,
    order: 0,
    orderItem: 0,
  }

  const products = await prisma.product.findMany({ select: { id: true, category: true, subcategory: true } })
  for (const row of products) {
    const nextCategory = maybeRepairField(row.category)
    const nextSubcategory = maybeRepairField(row.subcategory ?? null)
    if (!nextCategory.changed && !nextSubcategory.changed) continue

    const before = { category: row.category, subcategory: row.subcategory }
    const after = {
      category: nextCategory.changed ? nextCategory.value : row.category,
      subcategory: nextSubcategory.changed ? nextSubcategory.value : row.subcategory,
    }

    logChange("Product", row.id, before, after)
    summary.product += 1
    if (!dryRun) await prisma.product.update({ where: { id: row.id }, data: after })
  }

  const variants = await prisma.productVariant.findMany({ select: { id: true, combination: true } })
  for (const row of variants) {
    const repaired = repairJsonValue(row.combination)
    if (JSON.stringify(repaired) === JSON.stringify(row.combination)) continue

    logChange("ProductVariant", row.id, row.combination, repaired)
    summary.productVariant += 1
    if (!dryRun) await prisma.productVariant.update({ where: { id: row.id }, data: { combination: repaired } })
  }

  const categoryAttributes = await prisma.categoryAttribute.findMany({ select: { id: true, label: true, options: true } })
  for (const row of categoryAttributes) {
    const nextLabel = maybeRepairField(row.label)
    const nextOptions = repairJsonValue(row.options)
    const changed = nextLabel.changed || JSON.stringify(nextOptions) !== JSON.stringify(row.options)
    if (!changed) continue

    const before = { label: row.label, options: row.options }
    const after = { label: nextLabel.changed ? nextLabel.value : row.label, options: nextOptions }

    logChange("CategoryAttribute", row.id, before, after)
    summary.categoryAttribute += 1
    if (!dryRun) await prisma.categoryAttribute.update({ where: { id: row.id }, data: after })
  }

  const productAttributeValues = await prisma.productAttributeValue.findMany({ select: { id: true, label: true, value: true } })
  for (const row of productAttributeValues) {
    const nextLabel = maybeRepairField(row.label)
    const nextValue = repairJsonValue(row.value)
    const changed = nextLabel.changed || JSON.stringify(nextValue) !== JSON.stringify(row.value)
    if (!changed) continue

    const before = { label: row.label, value: row.value }
    const after = { label: nextLabel.changed ? nextLabel.value : row.label, value: nextValue }

    logChange("ProductAttributeValue", row.id, before, after)
    summary.productAttributeValue += 1
    if (!dryRun) await prisma.productAttributeValue.update({ where: { id: row.id }, data: after })
  }

  const orders = await prisma.order.findMany({ select: { id: true, orderNote: true } })
  for (const row of orders) {
    const nextNote = maybeRepairField(row.orderNote)
    if (!nextNote.changed) continue

    logChange("Order", row.id, row.orderNote, nextNote.value)
    summary.order += 1
    if (!dryRun) await prisma.order.update({ where: { id: row.id }, data: { orderNote: nextNote.value } })
  }

  const orderItems = await prisma.orderItem.findMany({ select: { id: true, variantData: true } })
  for (const row of orderItems) {
    const repaired = repairJsonValue(row.variantData)
    if (JSON.stringify(repaired) === JSON.stringify(row.variantData)) continue

    logChange("OrderItem", row.id, row.variantData, repaired)
    summary.orderItem += 1
    if (!dryRun) await prisma.orderItem.update({ where: { id: row.id }, data: { variantData: repaired } })
  }

  const total = Object.values(summary).reduce((sum, count) => sum + count, 0)
  console.log((dryRun ? "DRY RUN" : "UPDATED") + ": " + total + " row(s)")
  console.log(summary)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
