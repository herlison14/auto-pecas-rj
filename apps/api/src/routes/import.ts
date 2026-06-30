import type { FastifyInstance } from 'fastify'
import { parseSpreadsheet, importProducts } from '../services/import.service'

export async function importRoutes(app: FastifyInstance) {
  // POST /import/products — multipart upload of CSV or XLSX
  app.post('/products', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk as Buffer)
    const buffer = Buffer.concat(chunks)

    // Magic-bytes check: CSV (text) or XLSX (PK zip header 50 4B 03 04)
    const magic4 = buffer.slice(0, 4)
    const isXlsx = magic4.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    const isCsv = data.mimetype === 'text/csv' || data.filename.match(/\.csv$/i)
    if (!isXlsx && !isCsv) {
      return reply.status(400).send({ error: 'Formato inválido. Use CSV ou XLSX.' })
    }

    let rows
    try {
      rows = await parseSpreadsheet(buffer, data.mimetype)
    } catch {
      return reply.status(400).send({ error: 'Não foi possível ler o arquivo. Verifique o formato.' })
    }

    if (rows.length === 0) return reply.status(400).send({ error: 'Arquivo vazio ou sem dados válidos.' })
    if (rows.length > 2000) return reply.status(400).send({ error: 'Máximo de 2.000 produtos por importação.' })

    const { tenantId } = (req as any).user
    const result = await importProducts(rows, tenantId)

    return reply.send(result)
  })

  // POST /import/products/preview — parse only, no DB write
  app.post('/products/preview', {
    onRequest: [app.authenticate],
  }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk as Buffer)
    const buffer = Buffer.concat(chunks)

    let rows
    try {
      rows = await parseSpreadsheet(buffer, data.mimetype)
    } catch {
      return reply.status(400).send({ error: 'Não foi possível ler o arquivo.' })
    }

    return reply.send({
      total: rows.length,
      preview: rows.slice(0, 10),
    })
  })
}
