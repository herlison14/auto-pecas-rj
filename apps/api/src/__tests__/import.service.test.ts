import { describe, it, expect } from 'vitest'
import { parseSpreadsheet } from '../services/import.service'

const BOM = '﻿'

describe('parseSpreadsheet — CSV', () => {
  it('aceita cabeçalhos em português com ponto-e-vírgula e BOM (Excel pt-BR)', async () => {
    const csv = Buffer.from(
      `${BOM}SKU;Nome;Descrição;Marca;NCM;EAN;Peso (kg);Estoque\r\n` +
      'PROD-1;Pastilha de Freio;Dianteira;Bosch;87083090;7891234567890;0,8;25\r\n',
    )
    const [row] = await parseSpreadsheet(csv, 'application/vnd.ms-excel')
    expect(row).toMatchObject({
      sku: 'PROD-1',
      name: 'Pastilha de Freio',
      description: 'Dianteira',
      brand: 'Bosch',
      ncm: '87083090',
      gtin: '7891234567890',
      weight: 0.8,
      stock: 25,
    })
  })

  it('aceita cabeçalhos em inglês com vírgula (formato legado)', async () => {
    const csv = Buffer.from('sku,name,weight,stock\nA-1,Old Product,2.5,7\n')
    const [row] = await parseSpreadsheet(csv, 'text/csv')
    expect(row).toMatchObject({ sku: 'A-1', name: 'Old Product', weight: 2.5, stock: 7 })
  })

  it('normaliza CAIXA ALTA, acentos e sinônimos (Quantidade, Código)', async () => {
    const csv = Buffer.from('CÓDIGO;NOME;PESO (KG);Quantidade\nB-2;Variação;1,5;3\n')
    const [row] = await parseSpreadsheet(csv, 'text/csv')
    expect(row).toMatchObject({ sku: 'B-2', name: 'Variação', weight: 1.5, stock: 3 })
  })

  it('converte números no formato brasileiro com milhar (1.234,56)', async () => {
    const csv = Buffer.from('sku;nome;preco\nC-3;Caro;1.234,56\n')
    const [row] = await parseSpreadsheet(csv, 'text/csv')
    expect(row.price).toBe(1234.56)
  })

  it('retorna sku/name vazios quando faltam (validados depois pelo importador)', async () => {
    const csv = Buffer.from('sku;nome\n;Sem SKU\n')
    const [row] = await parseSpreadsheet(csv, 'text/csv')
    expect(row.sku).toBe('')
    expect(row.name).toBe('Sem SKU')
  })

  it('arquivo vazio retorna lista vazia', async () => {
    expect(await parseSpreadsheet(Buffer.from(''), 'text/csv')).toEqual([])
  })
})
