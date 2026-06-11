import axios, { type AxiosInstance } from 'axios'
import type { IMarketplaceAdapter, MarketplaceOrder, MarketplaceListing } from '../base/adapter'

const ML_API = 'https://api.mercadolibre.com'

export class MercadoLivreAdapter implements IMarketplaceAdapter {
  private http: AxiosInstance

  constructor(private accessToken: string) {
    this.http = axios.create({
      baseURL: ML_API,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  async getOrder(externalId: string): Promise<MarketplaceOrder> {
    const { data } = await this.http.get(`/orders/${externalId}`)

    return {
      externalId: String(data.id),
      status: data.status,
      buyerName: data.buyer?.nickname ?? '',
      buyerEmail: data.buyer?.email,
      items: (data.order_items ?? []).map((item: Record<string, unknown>) => {
        const details = item as {
          item: { id: string; seller_sku: string; title: string }
          quantity: number
          unit_price: number
        }
        return {
          externalId: details.item.id,
          sku: details.item.seller_sku ?? details.item.id,
          name: details.item.title,
          quantity: details.quantity,
          unitPrice: details.unit_price,
        }
      }),
      subtotal: Number(data.total_amount),
      shippingCost: Number(data.shipping?.cost ?? 0),
      total: Number(data.total_amount),
      shippingAddress: data.shipping?.receiver_address ?? {},
      paidAt: data.date_approved ? new Date(data.date_approved) : undefined,
      rawData: data,
    }
  }

  async updateStock(listingId: string, quantity: number): Promise<void> {
    await this.http.put(`/items/${listingId}`, { available_quantity: quantity })
  }

  async updatePrice(listingId: string, price: number): Promise<void> {
    await this.http.put(`/items/${listingId}`, { price })
  }

  async getListing(listingId: string): Promise<MarketplaceListing> {
    const { data } = await this.http.get(`/items/${listingId}`)
    return {
      externalId: data.id,
      title: data.title,
      price: data.price,
      stock: data.available_quantity,
      status: data.status,
    }
  }

  async confirmShipment(orderId: string, trackingCode: string, carrier: string): Promise<void> {
    const { data: order } = await this.http.get(`/orders/${orderId}`)
    const shipmentId = order.shipping?.id
    if (!shipmentId) throw new Error('No shipment found for this order')

    await this.http.post(`/shipments/${shipmentId}/fulfillment`, {
      tracking_number: trackingCode,
      service_id: carrier,
    })
  }

  /** Baixa a etiqueta de envio (PDF) do pedido — Mercado Envios. */
  async getShippingLabelPdf(orderId: string): Promise<Buffer> {
    const { data: order } = await this.http.get(`/orders/${orderId}`)
    const shipmentId = order.shipping?.id
    if (!shipmentId) throw new Error('Pedido sem envio associado (Mercado Envios)')

    return this.getShippingLabelsPdf([String(shipmentId)])
  }

  /** Etiquetas em lote: a API do ML aceita vários shipment_ids e devolve um único PDF. */
  async getShippingLabelsPdf(shipmentIds: string[]): Promise<Buffer> {
    const { data } = await this.http.get('/shipment_labels', {
      params: { shipment_ids: shipmentIds.join(','), response_type: 'pdf' },
      responseType: 'arraybuffer',
    })
    return Buffer.from(data)
  }
}
