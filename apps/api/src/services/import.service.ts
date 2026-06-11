import ExcelJS from 'exceljs'
import { prisma } from '@sellsync/database'

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

function toNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number') return isNaN(v) ? undefined : v
  let s = String(v).trim()
  // Formato brasileiro: "1,5" → 1.5 e "1.234,56" → 1234.56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = Number(s)
  return isNaN(n) ? undefined : n
}

export async function parseSpreadsheet(buffer: Buffer, _mimetype: string): Promise<ImportRow[]> {
  let rawRows: Record<string, unknown>[]

  // Detecta o formato pelos magic bytes (PK = ZIP/XLSX), não pelo mimetype:
  // o Excel envia CSVs como application/vnd.ms-excel.
  const isXlsx = buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))

  if (!isXlsx) {
    // CSV: remove BOM e auto-detecta o separador — Excel pt-BR salva com ";"
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '')
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return []
    const headerLine = lines[0]
    const delimiter = [';', ',', '\t']
      .map((d) => ({ d, count: headerLine.split(d).length - 1 }))
      .sort((a, b) => b.count - a.count)[0].d
    const headers = headerLine.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''))
    rawRows = lines.slice(1).map((line) => {
      const vals = line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
  } else {
    // XLSX: magic bytes 50 4B 03 04 (ZIP/Office Open XML)
    const wb = new ExcelJS.Workbook()
    await (wb.xlsx.load as unknown as (b: unknown) => Promise<void>)(buffer)
    const ws = wb.worksheets[0]
    if (!ws) return []
    const headers: string[] = []
    ws.getRow(1).eachCell((cell) => headers.push(String(cell.value ?? '')))
    rawRows = []
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return
      const obj: Record<string, unknown> = {}
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        obj[headers[colNum - 1] ?? colNum] = cell.value ?? ''
      })
      rawRows.push(obj)
    })
  }

  return rawRows.map((row) => {
    // Normaliza cabeçalhos: minúsculas, sem acentos, sem sufixos como "(kg)"
    // — aceita "Descrição", "PESO (KG)", "Comprimento (cm)" etc.
    const norm: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      const nk = k
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\(.*?\)/g, '')
        .trim()
      norm[nk] = v
    }
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
