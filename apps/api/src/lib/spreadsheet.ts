import ExcelJS from 'exceljs'

// Normaliza cabecalhos: minusculas, sem acentos, sem sufixos como "(kg)"
// -- aceita "Descricao", "PESO (KG)", "Comprimento (cm)" etc.
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
}

// Detecta CSV vs XLSX pelos magic bytes (PK = ZIP/XLSX), nao pelo mimetype:
// o Excel envia CSVs como application/vnd.ms-excel. Retorna linhas com
// cabecalhos ja normalizados.
export async function parseTabularBuffer(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const isXlsx = buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))

  let rawRows: Record<string, unknown>[]

  if (!isXlsx) {
    // CSV: remove BOM e auto-detecta o separador -- Excel pt-BR salva com ";"
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
    const norm: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) norm[normalizeHeader(k)] = v
    return norm
  })
}

// Converte numeros em formato brasileiro: "1,5" -> 1.5, "1.234,56" -> 1234.56
export function toNum(v: unknown): number | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'number') return isNaN(v) ? undefined : v
  let s = String(v).trim()
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = Number(s)
  return isNaN(n) ? undefined : n
}
