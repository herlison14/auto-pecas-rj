import { prisma } from '@sellsync/database'
import { parseTabularBuffer, toNum } from '../lib/spreadsheet'

export interface ImportRow {
  sku: string
  name: string
  description?: string
  brand?: string
  ncm?: string
  gtin?: string
  weight?: number
  height?: number
  width?: number
  length?: number
  images?: string
  price?: number
  stock?: number
}

export interface ImportResult {
  created: number
  updated: number
  errors: Array<{ row: number; sku: string; reason: string }>
}

export async function parseSpreadsheet(buffer: Buffer, _mimetype: string): Promise<ImportRow[]> {
  const rows = await parseTabularBuffer(buffer)

  return rows.map((norm) => {
    const get = (...keys: string[]) => keys.map((k) => norm[k]).find((v) => v != null && v !== '')

    return {
      sku: String(get('sku', 'codigo') ?? '').trim(),
      name: String(get('name', 'nome', 'produto') ?? '').trim(),
      description: String(get('description', 'descricao') ?? '').trim() || undefined,
      brand: String(get('brand', 'marca') ?? '').trim() || undefined,
      ncm: String(get('ncm') ?? '').replace(/\D/g, '') || undefined,
      gtin: String(get('gtin', 'ean', 'codigo de barras') ?? '').trim() || undefined,
      weight: toNum(get('weight', 'peso')),
      height: toNum(get('height', 'altura')),
      width: toNum(get('width', 'largura')),
      length: toNum(get('length', 'comprimento')),
      images: String(get('images', 'imagens', 'imagem', 'fotos') ?? '').trim() || undefined,
      price: toNum(get('price', 'preco')),
      stock: toNum(get('stock', 'estoque', 'quantidade')),
    }
  })
}

export async function importProducts(
  rows: ImportRow[],
  tenantId: string,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed + header

    if (!row.sku) {
      result.errors.push({ row: rowNum, sku: '', reason: 'SKU obrigatório' })
      continue
    }
    if (!row.name) {
      result.errors.push({ row: rowNum, sku: row.sku, reason: 'Nome obrigatório' })
      continue
    }

    try {
      const images = row.images
        ? row.images.split(/[,\n]/).map((u) => u.trim()).filter(Boolean)
        : []

      const existing = await prisma.product.findFirst({
        where: { tenantId, sku: row.sku },
      })

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            description: row.description,
            brand: row.brand,
            ncm: row.ncm,
            gtin: row.gtin,
            weight: row.weight,
            height: row.height,
            width: row.width,
            length: row.length,
            images: images.length > 0 ? images : existing.images,
          },
        })
        result.updated++
      } else {
        const product = await prisma.product.create({
          data: {
            tenantId,
            sku: row.sku,
            name: row.name,
            description: row.description,
            brand: row.brand,
            ncm: row.ncm,
            gtin: row.gtin,
            weight: row.weight,
            height: row.height,
            width: row.width,
            length: row.length,
            images,
          },
        })

        // Seed stock if provided
        if (row.stock && row.stock > 0) {
          const warehouse = await prisma.warehouse.findFirst({ where: { tenantId } })
          if (warehouse) {
            await prisma.stockItem.create({
              data: {
                productId: product.id,
                warehouseId: warehouse.id,
                quantity: row.stock,
                reserved: 0,
              },
            })
          }
        }

        result.created++
      }
    } catch (err) {
      result.errors.push({ row: rowNum, sku: row.sku, reason: 'Erro interno ao salvar' })
    }
  }

  return result
}
